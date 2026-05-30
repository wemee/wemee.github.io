import * as THREE from "three";
import { ThreeSceneBase } from "./ThreeSceneBase";
import { jacobiEigenSymmetric3, applyMatrix3ToVec3 } from "./MatrixMath";

export interface EigenUpdate {
  matrix: number[][]; // 3×3 symmetric
  eigenvalues: [number, number, number];
  eigenvectors: number[][]; // 3×3, columns are eigenvectors
  determinant: number; // λ1·λ2·λ3
  trace: number;       // λ1+λ2+λ3
  converged: boolean;
}

export interface EigenSceneOptions {
  containerId: string;
  onUpdate?: (state: EigenUpdate) => void;
}

const SPHERE_SEGMENTS = 24;

const POS_COLOR = 0xff80ab;
const NEG_COLOR = 0x4dd0e1;
const ZERO_COLOR = 0xaaaaaa;

export class EigenScene extends ThreeSceneBase {
  private referenceSphere: THREE.LineSegments;
  private ellipsoidMesh: THREE.Mesh;
  private ellipsoidWire: THREE.LineSegments;
  private eigenArrows: THREE.ArrowHelper[] = [];

  private matrix: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  private baseSphereGeo: THREE.SphereGeometry;
  private basePositions: Float32Array;

  private onUpdate?: (state: EigenUpdate) => void;

  constructor(options: EigenSceneOptions) {
    super({ containerId: options.containerId });
    this.onUpdate = options.onUpdate;

    // Reference unit sphere — faint wireframe to show "what shape would we have if A=I"
    const refGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 12, 8));
    this.referenceSphere = new THREE.LineSegments(
      refGeo,
      new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.35 })
    );
    this.scene.add(this.referenceSphere);

    // Deformable ellipsoid — clone of sphere, will be reshaped per vertex
    this.baseSphereGeo = new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2);
    const positions = this.baseSphereGeo.attributes.position;
    this.basePositions = new Float32Array(positions.array);

    this.ellipsoidMesh = new THREE.Mesh(
      this.baseSphereGeo,
      new THREE.MeshPhongMaterial({
        color: 0x80d8ff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      })
    );
    this.scene.add(this.ellipsoidMesh);

    this.ellipsoidWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(this.baseSphereGeo),
      new THREE.LineBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.55 })
    );
    this.scene.add(this.ellipsoidWire);

    this.applyChanges();
    this.scheduleRender();
  }

  public setMatrix(m: number[][]): void {
    this.matrix = m.map((r) => [...r]);
    this.applyChanges();
  }

  public setMatrixCell(row: number, col: number, value: number): void {
    this.matrix[row][col] = value;
    // Keep symmetric: mirror to the transpose entry.
    if (row !== col) this.matrix[col][row] = value;
    this.applyChanges();
  }

  private applyChanges(): void {
    // Deform the sphere vertices: x' = A · x (we know A symmetric → ellipsoid).
    const posAttr = this.baseSphereGeo.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < this.basePositions.length; i += 3) {
      const x = this.basePositions[i];
      const y = this.basePositions[i + 1];
      const z = this.basePositions[i + 2];
      arr[i]     = this.matrix[0][0] * x + this.matrix[0][1] * y + this.matrix[0][2] * z;
      arr[i + 1] = this.matrix[1][0] * x + this.matrix[1][1] * y + this.matrix[1][2] * z;
      arr[i + 2] = this.matrix[2][0] * x + this.matrix[2][1] * y + this.matrix[2][2] * z;
    }
    posAttr.needsUpdate = true;
    this.baseSphereGeo.computeVertexNormals();
    this.baseSphereGeo.computeBoundingSphere();

    // Rebuild wireframe to follow the deformed sphere
    this.ellipsoidWire.geometry.dispose();
    this.ellipsoidWire.geometry = new THREE.WireframeGeometry(this.baseSphereGeo);

    // Eigen decomposition for arrows
    const { eigenvalues, eigenvectors, converged } = jacobiEigenSymmetric3(this.matrix);

    // Clear previous arrows
    this.eigenArrows.forEach((a) => { this.scene.remove(a); a.dispose(); });
    this.eigenArrows = [];

    for (let k = 0; k < 3; k++) {
      const lambda = eigenvalues[k];
      const v: [number, number, number] = [eigenvectors[0][k], eigenvectors[1][k], eigenvectors[2][k]];
      const mag = Math.hypot(v[0], v[1], v[2]);
      if (mag < 1e-9) continue;

      // Visual length: |λ|, but capped to keep scene bounded.
      const visualLen = Math.min(Math.max(Math.abs(lambda), 0.05), 5);
      // Direction: if λ < 0, the eigenvector direction flips (A·v = λv with negative λ).
      const dir = new THREE.Vector3(v[0], v[1], v[2]).normalize();
      if (lambda < 0) dir.multiplyScalar(-1);
      const color = lambda > 1e-9 ? POS_COLOR : lambda < -1e-9 ? NEG_COLOR : ZERO_COLOR;

      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, 0, 0),
        visualLen,
        color,
        0.22,
        0.13
      );
      this.scene.add(arrow);
      this.eigenArrows.push(arrow);
    }

    if (this.onUpdate) {
      this.onUpdate({
        matrix: this.matrix.map((r) => [...r]),
        eigenvalues,
        eigenvectors,
        determinant: eigenvalues[0] * eigenvalues[1] * eigenvalues[2],
        trace: eigenvalues[0] + eigenvalues[1] + eigenvalues[2],
        converged,
      });
    }

    this.scheduleRender();
  }
}
