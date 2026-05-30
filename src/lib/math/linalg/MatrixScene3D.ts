import * as THREE from "three";
import { ThreeSceneBase } from "./ThreeSceneBase";
import {
  type Matrix4,
  type Vector3,
  applyMatrix4ToVec4,
  determinant4,
  identity4,
  transformPoint,
} from "./MatrixMath";

export interface SceneUpdate {
  result: [number, number, number, number]; // M · v (homogeneous)
  determinant: number;
  matrix: Matrix4;
  vector: Vector3;
}

export interface SceneOptions {
  containerId: string;
  onUpdate?: (state: SceneUpdate) => void;
}

const UNIT_CUBE_CORNERS: Vector3[] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const CUBE_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face
  [4, 5], [5, 6], [6, 7], [7, 4], // front face
  [0, 4], [1, 5], [2, 6], [3, 7], // connectors
];

export class MatrixScene3D extends ThreeSceneBase {
  private cubeLines: THREE.LineSegments;
  private cubeFaces: THREE.Mesh;
  private originArrow: THREE.ArrowHelper | null = null;
  private resultArrow: THREE.ArrowHelper | null = null;

  private matrix: Matrix4 = identity4();
  private vector: Vector3 = [1, 1, 1];

  private onUpdate?: (state: SceneUpdate) => void;

  constructor(options: SceneOptions) {
    super({ containerId: options.containerId });
    this.onUpdate = options.onUpdate;

    // Deformable cube: edges + translucent faces
    this.cubeLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x4dd0e1, linewidth: 2 })
    );
    this.scene.add(this.cubeLines);

    this.cubeFaces = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshPhongMaterial({
        color: 0x4dd0e1,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
    );
    this.scene.add(this.cubeFaces);

    this.applyChanges();
    this.scheduleRender();
  }

  public setMatrix(m: Matrix4): void {
    this.matrix = m.map((row) => [...row]);
    this.applyChanges();
  }

  public setMatrixCell(row: number, col: number, value: number): void {
    this.matrix[row][col] = value;
    this.applyChanges();
  }

  public setVector(v: Vector3): void {
    this.vector = [...v] as Vector3;
    this.applyChanges();
  }

  public getMatrix(): Matrix4 {
    return this.matrix.map((row) => [...row]);
  }

  public getVector(): Vector3 {
    return [...this.vector] as Vector3;
  }

  private applyChanges(): void {
    this.updateCube();
    this.updateArrows();
    this.emitUpdate();
    this.scheduleRender();
  }

  private updateCube(): void {
    const transformed = UNIT_CUBE_CORNERS.map((c) => transformPoint(this.matrix, c));

    // Edges: 12 segments × 2 endpoints × 3 coords
    const edgePositions = new Float32Array(CUBE_EDGES.length * 2 * 3);
    CUBE_EDGES.forEach(([a, b], i) => {
      edgePositions.set(transformed[a], i * 6);
      edgePositions.set(transformed[b], i * 6 + 3);
    });
    const edgeGeo = this.cubeLines.geometry;
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
    edgeGeo.computeBoundingSphere();

    // Faces: 6 faces × 2 triangles × 3 vertices = 36 verts
    // Faces by corner indices, in CCW order viewed from outside
    const faces: [number, number, number, number][] = [
      [0, 3, 2, 1], // -Z
      [4, 5, 6, 7], // +Z
      [0, 1, 5, 4], // -Y
      [3, 7, 6, 2], // +Y
      [0, 4, 7, 3], // -X
      [1, 2, 6, 5], // +X
    ];
    const facePositions = new Float32Array(faces.length * 6 * 3);
    faces.forEach((quad, fi) => {
      const [a, b, c, d] = quad;
      // Two triangles: a-b-c, a-c-d
      const tris = [a, b, c, a, c, d];
      tris.forEach((cornerIdx, vi) => {
        facePositions.set(transformed[cornerIdx], (fi * 6 + vi) * 3);
      });
    });
    const faceGeo = this.cubeFaces.geometry;
    faceGeo.setAttribute("position", new THREE.BufferAttribute(facePositions, 3));
    faceGeo.computeVertexNormals();
    faceGeo.computeBoundingSphere();
  }

  private updateArrows(): void {
    if (this.originArrow) {
      this.scene.remove(this.originArrow);
      this.originArrow.dispose();
      this.originArrow = null;
    }
    if (this.resultArrow) {
      this.scene.remove(this.resultArrow);
      this.resultArrow.dispose();
      this.resultArrow = null;
    }

    const origin = new THREE.Vector3(0, 0, 0);

    const [vx, vy, vz] = this.vector;
    const origLen = Math.hypot(vx, vy, vz);
    if (origLen > 0) {
      const dir = new THREE.Vector3(vx, vy, vz).normalize();
      this.originArrow = new THREE.ArrowHelper(dir, origin, origLen, 0xff9800, 0.25, 0.15);
      this.scene.add(this.originArrow);
    }

    const result = applyMatrix4ToVec4(this.matrix, [vx, vy, vz, 1]);
    const w = result[3] === 0 ? 1 : result[3];
    const [rx, ry, rz] = [result[0] / w, result[1] / w, result[2] / w];
    const resLen = Math.hypot(rx, ry, rz);
    if (resLen > 0) {
      const dir = new THREE.Vector3(rx, ry, rz).normalize();
      this.resultArrow = new THREE.ArrowHelper(dir, origin, resLen, 0x00e5ff, 0.25, 0.15);
      this.scene.add(this.resultArrow);
    }
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const result = applyMatrix4ToVec4(this.matrix, [
      this.vector[0],
      this.vector[1],
      this.vector[2],
      1,
    ]);
    this.onUpdate({
      result,
      determinant: determinant4(this.matrix),
      matrix: this.getMatrix(),
      vector: this.getVector(),
    });
  }
}
