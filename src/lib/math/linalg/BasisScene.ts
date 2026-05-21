import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  type Matrix4,
  type Vector3,
  applyMatrix3ToVec3,
  inverse3,
  determinant3,
  transformPoint,
} from "./MatrixMath";

export interface BasisUpdate {
  basis: Matrix4;            // current basis as 4×4 (last row [0,0,0,1])
  vector: Vector3;           // input vector in standard coords
  newCoords: Vector3 | null; // v in new basis (= B⁻¹·v), null if B singular
  basisInverse: number[][] | null; // 3×3 inverse, null if singular
  determinant: number;
  basisVectors: [Vector3, Vector3, Vector3]; // b1, b2, b3 in standard coords
}

export interface BasisSceneOptions {
  containerId: string;
  onUpdate?: (state: BasisUpdate) => void;
}

const UNIT_CORNERS: Vector3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export class BasisScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private parallelepipedLines: THREE.LineSegments;
  private b1Arrow: THREE.ArrowHelper | null = null;
  private b2Arrow: THREE.ArrowHelper | null = null;
  private b3Arrow: THREE.ArrowHelper | null = null;
  private vectorArrow: THREE.ArrowHelper | null = null;

  private basis: Matrix4 = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  private vector: Vector3 = [1, 1, 1];

  private onUpdate?: (state: BasisUpdate) => void;
  private resizeObserver: ResizeObserver;
  private rafScheduled = false;
  private destroyed = false;

  constructor(options: BasisSceneOptions) {
    const container = document.getElementById(options.containerId);
    if (!container) throw new Error(`Container #${options.containerId} not found`);
    this.container = container;
    this.onUpdate = options.onUpdate;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(3.5, 3, 4.5);
    this.camera.lookAt(0.5, 0.5, 0.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0.5, 0.5, 0.5);
    this.controls.addEventListener("change", () => this.scheduleRender());

    this.scene.add(new THREE.GridHelper(10, 10, 0x333333, 0x1f1f1f));
    this.scene.add(new THREE.AxesHelper(2.2));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    // Transformed parallelepiped — wireframe edges of unit cube under B
    this.parallelepipedLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xe1bee7, transparent: true, opacity: 0.55 })
    );
    this.scene.add(this.parallelepipedLines);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.applyChanges();
    this.scheduleRender();
  }

  public setBasis(b: Matrix4): void {
    this.basis = b.map((row) => [...row]);
    this.applyChanges();
  }

  public setBasisCell(row: number, col: number, value: number): void {
    this.basis[row][col] = value;
    this.applyChanges();
  }

  public setVector(v: Vector3): void {
    this.vector = [...v] as Vector3;
    this.applyChanges();
  }

  public getBasis(): Matrix4 {
    return this.basis.map((row) => [...row]);
  }

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private applyChanges(): void {
    this.updateParallelepiped();
    this.updateBasisArrows();
    this.updateVectorArrow();
    this.emit();
    this.scheduleRender();
  }

  private updateParallelepiped(): void {
    const transformed = UNIT_CORNERS.map((c) => transformPoint(this.basis, c));
    const positions = new Float32Array(EDGES.length * 2 * 3);
    EDGES.forEach(([a, b], i) => {
      positions.set(transformed[a], i * 6);
      positions.set(transformed[b], i * 6 + 3);
    });
    const geo = this.parallelepipedLines.geometry;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
  }

  private addArrow(dir: Vector3, color: number): THREE.ArrowHelper | null {
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 1e-9) return null;
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(),
      new THREE.Vector3(0, 0, 0),
      len,
      color,
      0.18,
      0.1
    );
    this.scene.add(arrow);
    return arrow;
  }

  private updateBasisArrows(): void {
    if (this.b1Arrow) { this.scene.remove(this.b1Arrow); this.b1Arrow.dispose(); }
    if (this.b2Arrow) { this.scene.remove(this.b2Arrow); this.b2Arrow.dispose(); }
    if (this.b3Arrow) { this.scene.remove(this.b3Arrow); this.b3Arrow.dispose(); }

    const b1: Vector3 = [this.basis[0][0], this.basis[1][0], this.basis[2][0]];
    const b2: Vector3 = [this.basis[0][1], this.basis[1][1], this.basis[2][1]];
    const b3: Vector3 = [this.basis[0][2], this.basis[1][2], this.basis[2][2]];

    // Use brighter / warmer colors than the standard RGB axes to differentiate
    this.b1Arrow = this.addArrow(b1, 0xff80ab); // pink
    this.b2Arrow = this.addArrow(b2, 0xb9f6ca); // mint
    this.b3Arrow = this.addArrow(b3, 0x80d8ff); // sky
  }

  private updateVectorArrow(): void {
    if (this.vectorArrow) { this.scene.remove(this.vectorArrow); this.vectorArrow.dispose(); this.vectorArrow = null; }
    const [vx, vy, vz] = this.vector;
    const len = Math.hypot(vx, vy, vz);
    if (len > 0) {
      this.vectorArrow = new THREE.ArrowHelper(
        new THREE.Vector3(vx, vy, vz).normalize(),
        new THREE.Vector3(0, 0, 0),
        len,
        0xff9800,
        0.25,
        0.15
      );
      this.scene.add(this.vectorArrow);
    }
  }

  private emit(): void {
    if (!this.onUpdate) return;
    const basis3 = [
      [this.basis[0][0], this.basis[0][1], this.basis[0][2]],
      [this.basis[1][0], this.basis[1][1], this.basis[1][2]],
      [this.basis[2][0], this.basis[2][1], this.basis[2][2]],
    ];
    const det = determinant3(basis3);
    const inv = inverse3(basis3);
    const newCoords = inv ? applyMatrix3ToVec3(inv, this.vector) : null;
    const b1: Vector3 = [this.basis[0][0], this.basis[1][0], this.basis[2][0]];
    const b2: Vector3 = [this.basis[0][1], this.basis[1][1], this.basis[2][1]];
    const b3: Vector3 = [this.basis[0][2], this.basis[1][2], this.basis[2][2]];
    this.onUpdate({
      basis: this.basis.map((r) => [...r]),
      vector: [...this.vector] as Vector3,
      newCoords,
      basisInverse: inv,
      determinant: det,
      basisVectors: [b1, b2, b3],
    });
  }

  private scheduleRender(): void {
    if (this.rafScheduled || this.destroyed) return;
    this.rafScheduled = true;
    requestAnimationFrame(() => {
      this.rafScheduled = false;
      if (this.destroyed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private handleResize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.scheduleRender();
  }
}
