import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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

export class EigenScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

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
  private resizeObserver: ResizeObserver;
  private rafScheduled = false;
  private destroyed = false;

  constructor(options: EigenSceneOptions) {
    const container = document.getElementById(options.containerId);
    if (!container) throw new Error(`Container #${options.containerId} not found`);
    this.container = container;
    this.onUpdate = options.onUpdate;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(4, 3, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.addEventListener("change", () => this.scheduleRender());

    this.scene.add(new THREE.GridHelper(10, 10, 0x333333, 0x1f1f1f));
    this.scene.add(new THREE.AxesHelper(3));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

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

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

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
