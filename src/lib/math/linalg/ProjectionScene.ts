import * as THREE from "three";
import { ThreeSceneBase } from "./ThreeSceneBase";

export type Vector3 = [number, number, number];

export interface ProjectionUpdate {
  vector: Vector3;
  normal: Vector3;       // unit
  projection: Vector3;   // P · v
  residual: Vector3;     // v - P·v
  projectionMatrix: number[][]; // 3×3 representation
  vMag: number;
  pMag: number;
  rMag: number;
  orthogonality: number; // p · r, should be 0
}

export interface ProjectionSceneOptions {
  containerId: string;
  mode?: "plane" | "line";
  onUpdate?: (state: ProjectionUpdate) => void;
}

const PLANE_SIZE = 4;

export class ProjectionScene extends ThreeSceneBase {
  private planeMesh: THREE.Mesh;
  private lineMesh: THREE.Line;
  private vectorArrow: THREE.ArrowHelper | null = null;
  private projectionArrow: THREE.ArrowHelper | null = null;
  private residualLine: THREE.Line | null = null;

  private vector: Vector3 = [1, 2, 1.5];
  private normal: Vector3 = [0, 1, 0]; // default plane = XZ plane
  private mode: "plane" | "line";

  private onUpdate?: (state: ProjectionUpdate) => void;

  constructor(options: ProjectionSceneOptions) {
    super({ containerId: options.containerId, cameraPosition: [4, 4, 5] });
    this.onUpdate = options.onUpdate;
    this.mode = options.mode ?? "plane";

    // Target plane: a flat translucent quad
    this.planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE),
      new THREE.MeshPhongMaterial({
        color: 0x4dd0e1,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      })
    );
    this.scene.add(this.planeMesh);

    // Target line: a long line through origin in direction of "axis"
    // In line mode the "normal" actually represents the line direction (we treat consistently)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-3, 0, 0),
      new THREE.Vector3(3, 0, 0),
    ]);
    this.lineMesh = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x4dd0e1, linewidth: 2 })
    );
    this.lineMesh.visible = false;
    this.scene.add(this.lineMesh);

    this.applyChanges();
    this.scheduleRender();
  }

  public setMode(mode: "plane" | "line"): void {
    this.mode = mode;
    this.planeMesh.visible = mode === "plane";
    this.lineMesh.visible = mode === "line";
    this.applyChanges();
  }

  public setNormal(n: Vector3): void {
    this.normal = [...n] as Vector3;
    this.applyChanges();
  }

  public setVector(v: Vector3): void {
    this.vector = [...v] as Vector3;
    this.applyChanges();
  }

  private applyChanges(): void {
    const [nx, ny, nz] = this.normal;
    const mag = Math.hypot(nx, ny, nz);
    if (mag < 1e-9) return; // skip if degenerate

    const unit: Vector3 = [nx / mag, ny / mag, nz / mag];

    // Orient plane: normal aligned to `unit`. Default PlaneGeometry faces +Z.
    if (this.mode === "plane") {
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(unit[0], unit[1], unit[2])
      );
      this.planeMesh.setRotationFromQuaternion(q);
    } else {
      // Line mode: stretch line along `unit`
      this.lineMesh.geometry.setFromPoints([
        new THREE.Vector3(-3 * unit[0], -3 * unit[1], -3 * unit[2]),
        new THREE.Vector3(3 * unit[0], 3 * unit[1], 3 * unit[2]),
      ]);
    }

    // Compute projection
    const [vx, vy, vz] = this.vector;
    const dot = vx * unit[0] + vy * unit[1] + vz * unit[2];

    let projection: Vector3;
    let projectionMatrix: number[][];
    if (this.mode === "plane") {
      // P = I - n̂n̂ᵀ ; project = v - (v·n̂)n̂
      projection = [vx - dot * unit[0], vy - dot * unit[1], vz - dot * unit[2]];
      projectionMatrix = [
        [1 - unit[0] * unit[0], -unit[0] * unit[1], -unit[0] * unit[2]],
        [-unit[1] * unit[0], 1 - unit[1] * unit[1], -unit[1] * unit[2]],
        [-unit[2] * unit[0], -unit[2] * unit[1], 1 - unit[2] * unit[2]],
      ];
    } else {
      // P = ââᵀ ; project = (v·â)â
      projection = [dot * unit[0], dot * unit[1], dot * unit[2]];
      projectionMatrix = [
        [unit[0] * unit[0], unit[0] * unit[1], unit[0] * unit[2]],
        [unit[1] * unit[0], unit[1] * unit[1], unit[1] * unit[2]],
        [unit[2] * unit[0], unit[2] * unit[1], unit[2] * unit[2]],
      ];
    }
    const residual: Vector3 = [vx - projection[0], vy - projection[1], vz - projection[2]];

    this.updateArrows(projection, residual);

    const vMag = Math.hypot(vx, vy, vz);
    const pMag = Math.hypot(projection[0], projection[1], projection[2]);
    const rMag = Math.hypot(residual[0], residual[1], residual[2]);
    const orthogonality =
      projection[0] * residual[0] + projection[1] * residual[1] + projection[2] * residual[2];

    if (this.onUpdate) {
      this.onUpdate({
        vector: [...this.vector] as Vector3,
        normal: unit,
        projection,
        residual,
        projectionMatrix,
        vMag,
        pMag,
        rMag,
        orthogonality,
      });
    }

    this.scheduleRender();
  }

  private updateArrows(projection: Vector3, residual: Vector3): void {
    // Remove old arrows
    if (this.vectorArrow) { this.scene.remove(this.vectorArrow); this.vectorArrow.dispose(); this.vectorArrow = null; }
    if (this.projectionArrow) { this.scene.remove(this.projectionArrow); this.projectionArrow.dispose(); this.projectionArrow = null; }
    if (this.residualLine) {
      this.scene.remove(this.residualLine);
      this.residualLine.geometry.dispose();
      (this.residualLine.material as THREE.Material).dispose();
      this.residualLine = null;
    }

    const origin = new THREE.Vector3(0, 0, 0);
    const [vx, vy, vz] = this.vector;
    const vLen = Math.hypot(vx, vy, vz);
    if (vLen > 0) {
      this.vectorArrow = new THREE.ArrowHelper(
        new THREE.Vector3(vx, vy, vz).normalize(),
        origin,
        vLen,
        0xff9800,
        0.25,
        0.15
      );
      this.scene.add(this.vectorArrow);
    }

    const pLen = Math.hypot(projection[0], projection[1], projection[2]);
    if (pLen > 1e-9) {
      this.projectionArrow = new THREE.ArrowHelper(
        new THREE.Vector3(projection[0], projection[1], projection[2]).normalize(),
        origin,
        pLen,
        0x00e5ff,
        0.25,
        0.15
      );
      this.scene.add(this.projectionArrow);
    }

    // Residual: dashed line from projection tip to v tip
    const rLen = Math.hypot(residual[0], residual[1], residual[2]);
    if (rLen > 1e-9) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(projection[0], projection[1], projection[2]),
        new THREE.Vector3(vx, vy, vz),
      ]);
      const mat = new THREE.LineDashedMaterial({
        color: 0xff5252,
        dashSize: 0.12,
        gapSize: 0.08,
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.scene.add(line);
      this.residualLine = line;
    }
  }
}
