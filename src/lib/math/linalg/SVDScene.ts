import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { jacobiEigenSymmetric3 } from "./MatrixMath";

export interface SVDDecomposition {
  U: number[][];      // 3×3 orthogonal
  sigma: [number, number, number]; // descending
  V: number[][];      // 3×3 orthogonal (so Vᵀ is applied first in A = U Σ Vᵀ)
}

export interface SVDUpdate {
  matrix: number[][];
  decomposition: SVDDecomposition;
  phase: 0 | 1 | 2 | 3;
  rank: 1 | 2 | 3;
  conditionNumber: number;
  rankEffective: number;
}

export interface SVDSceneOptions {
  containerId: string;
  onUpdate?: (state: SVDUpdate) => void;
}

const SPHERE_SEGMENTS = 24;

const COLORS = [0xff80ab, 0xb9f6ca, 0x80d8ff]; // pink, mint, sky

/**
 * SVD of a 3×3 matrix via AᵀA eigendecomposition.
 * Returns U, Σ (descending), V such that A = U·Σ·Vᵀ.
 */
function computeSVD3(A: number[][]): SVDDecomposition {
  // B = AᵀA (symmetric, positive semi-definite)
  const B: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += A[k][i] * A[k][j];
      B[i][j] = s;
    }
  }
  const { eigenvalues, eigenvectors } = jacobiEigenSymmetric3(B);

  // σᵢ = sqrt(λᵢ), clamped to 0 (eigenvalues should be ≥ 0 for AᵀA, but numerical noise may go slightly negative)
  const sigma: [number, number, number] = [
    Math.sqrt(Math.max(eigenvalues[0], 0)),
    Math.sqrt(Math.max(eigenvalues[1], 0)),
    Math.sqrt(Math.max(eigenvalues[2], 0)),
  ];

  // V columns are the eigenvectors (in descending eigenvalue order, already sorted by jacobi)
  const V = eigenvectors;

  // U columns: uᵢ = A·vᵢ / σᵢ for σᵢ > 0; otherwise pick orthogonal complement
  const U: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const goodCols: number[] = [];
  for (let k = 0; k < 3; k++) {
    if (sigma[k] > 1e-9) {
      // u_k = A · v_k / σ_k
      const v_k: [number, number, number] = [V[0][k], V[1][k], V[2][k]];
      U[0][k] = (A[0][0] * v_k[0] + A[0][1] * v_k[1] + A[0][2] * v_k[2]) / sigma[k];
      U[1][k] = (A[1][0] * v_k[0] + A[1][1] * v_k[1] + A[1][2] * v_k[2]) / sigma[k];
      U[2][k] = (A[2][0] * v_k[0] + A[2][1] * v_k[1] + A[2][2] * v_k[2]) / sigma[k];
      goodCols.push(k);
    }
  }
  // Fill any missing U columns with vectors orthogonal to the good ones
  if (goodCols.length < 3) {
    // Gram-Schmidt over standard basis to fill orthogonal columns
    const filled = [...goodCols];
    const standardBasis = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    let nextFill = filled.length;
    for (let s = 0; s < 3 && nextFill < 3; s++) {
      const candidate = [...standardBasis[s]];
      // Subtract projections on filled columns
      for (const f of filled) {
        const uf = [U[0][f], U[1][f], U[2][f]];
        const dot = candidate[0] * uf[0] + candidate[1] * uf[1] + candidate[2] * uf[2];
        candidate[0] -= dot * uf[0];
        candidate[1] -= dot * uf[1];
        candidate[2] -= dot * uf[2];
      }
      const len = Math.hypot(candidate[0], candidate[1], candidate[2]);
      if (len > 1e-9) {
        // Find an empty column slot
        for (let k = 0; k < 3; k++) {
          if (!filled.includes(k)) {
            U[0][k] = candidate[0] / len;
            U[1][k] = candidate[1] / len;
            U[2][k] = candidate[2] / len;
            filled.push(k);
            nextFill++;
            break;
          }
        }
      }
    }
  }

  return { U, sigma, V };
}

export class SVDScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  private referenceSphere: THREE.LineSegments;
  private mainMesh: THREE.Mesh;
  private mainWire: THREE.LineSegments;
  private arrows: THREE.ArrowHelper[] = [];

  private matrix: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  private decomposition: SVDDecomposition;
  private phase: 0 | 1 | 2 | 3 = 3;
  private rank: 1 | 2 | 3 = 3;

  private baseSphereGeo: THREE.SphereGeometry;
  private basePositions: Float32Array;

  private onUpdate?: (state: SVDUpdate) => void;
  private resizeObserver: ResizeObserver;
  private rafScheduled = false;
  private destroyed = false;

  constructor(options: SVDSceneOptions) {
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

    // Reference sphere
    const refGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 12, 8));
    this.referenceSphere = new THREE.LineSegments(
      refGeo,
      new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 })
    );
    this.scene.add(this.referenceSphere);

    // Deformable mesh
    this.baseSphereGeo = new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2);
    const positions = this.baseSphereGeo.attributes.position;
    this.basePositions = new Float32Array(positions.array);

    this.mainMesh = new THREE.Mesh(
      this.baseSphereGeo,
      new THREE.MeshPhongMaterial({
        color: 0x80d8ff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      })
    );
    this.scene.add(this.mainMesh);

    this.mainWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(this.baseSphereGeo),
      new THREE.LineBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.55 })
    );
    this.scene.add(this.mainWire);

    this.decomposition = computeSVD3(this.matrix);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.applyChanges();
    this.scheduleRender();
  }

  public setMatrix(m: number[][]): void {
    this.matrix = m.map((r) => [...r]);
    this.decomposition = computeSVD3(this.matrix);
    this.applyChanges();
  }

  public setMatrixCell(row: number, col: number, value: number): void {
    this.matrix[row][col] = value;
    this.decomposition = computeSVD3(this.matrix);
    this.applyChanges();
  }

  public setPhase(p: 0 | 1 | 2 | 3): void {
    this.phase = p;
    this.applyChanges();
  }

  public setRank(k: 1 | 2 | 3): void {
    this.rank = k;
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

  /** Compute the cumulative transformation at the current phase, with rank truncation. */
  private phaseMatrix(): number[][] {
    const { U, sigma, V } = this.decomposition;
    // sigma truncated by rank
    const truncSigma: [number, number, number] = [
      this.rank >= 1 ? sigma[0] : 0,
      this.rank >= 2 ? sigma[1] : 0,
      this.rank >= 3 ? sigma[2] : 0,
    ];

    if (this.phase === 0) {
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
    }
    if (this.phase === 1) {
      // Apply Vᵀ
      return [
        [V[0][0], V[1][0], V[2][0]],
        [V[0][1], V[1][1], V[2][1]],
        [V[0][2], V[1][2], V[2][2]],
      ];
    }
    if (this.phase === 2) {
      // Apply Σ Vᵀ
      const Vt = [
        [V[0][0], V[1][0], V[2][0]],
        [V[0][1], V[1][1], V[2][1]],
        [V[0][2], V[1][2], V[2][2]],
      ];
      return [
        [truncSigma[0] * Vt[0][0], truncSigma[0] * Vt[0][1], truncSigma[0] * Vt[0][2]],
        [truncSigma[1] * Vt[1][0], truncSigma[1] * Vt[1][1], truncSigma[1] * Vt[1][2]],
        [truncSigma[2] * Vt[2][0], truncSigma[2] * Vt[2][1], truncSigma[2] * Vt[2][2]],
      ];
    }
    // Phase 3: U Σ Vᵀ (rank-truncated)
    const Vt = [
      [V[0][0], V[1][0], V[2][0]],
      [V[0][1], V[1][1], V[2][1]],
      [V[0][2], V[1][2], V[2][2]],
    ];
    // Σ Vᵀ
    const SVt = [
      [truncSigma[0] * Vt[0][0], truncSigma[0] * Vt[0][1], truncSigma[0] * Vt[0][2]],
      [truncSigma[1] * Vt[1][0], truncSigma[1] * Vt[1][1], truncSigma[1] * Vt[1][2]],
      [truncSigma[2] * Vt[2][0], truncSigma[2] * Vt[2][1], truncSigma[2] * Vt[2][2]],
    ];
    // U · (Σ Vᵀ)
    const out: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out[i][j] = U[i][0] * SVt[0][j] + U[i][1] * SVt[1][j] + U[i][2] * SVt[2][j];
      }
    }
    return out;
  }

  private applyChanges(): void {
    const M = this.phaseMatrix();
    const posAttr = this.baseSphereGeo.attributes.position;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < this.basePositions.length; i += 3) {
      const x = this.basePositions[i];
      const y = this.basePositions[i + 1];
      const z = this.basePositions[i + 2];
      arr[i]     = M[0][0] * x + M[0][1] * y + M[0][2] * z;
      arr[i + 1] = M[1][0] * x + M[1][1] * y + M[1][2] * z;
      arr[i + 2] = M[2][0] * x + M[2][1] * y + M[2][2] * z;
    }
    posAttr.needsUpdate = true;
    this.baseSphereGeo.computeVertexNormals();
    this.baseSphereGeo.computeBoundingSphere();

    this.mainWire.geometry.dispose();
    this.mainWire.geometry = new THREE.WireframeGeometry(this.baseSphereGeo);

    // Update 3 arrows tracking V columns through the phase
    this.arrows.forEach((a) => { this.scene.remove(a); a.dispose(); });
    this.arrows = [];

    const { U, sigma, V } = this.decomposition;
    const truncSigma: [number, number, number] = [
      this.rank >= 1 ? sigma[0] : 0,
      this.rank >= 2 ? sigma[1] : 0,
      this.rank >= 3 ? sigma[2] : 0,
    ];

    for (let k = 0; k < 3; k++) {
      let target: [number, number, number];
      const v_k: [number, number, number] = [V[0][k], V[1][k], V[2][k]];
      if (this.phase === 0) {
        target = v_k;
      } else if (this.phase === 1) {
        // Vᵀ · v_k = e_k
        target = [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0];
      } else if (this.phase === 2) {
        // Σ · e_k = σ_k · e_k (with rank truncation)
        const s = truncSigma[k];
        target = [k === 0 ? s : 0, k === 1 ? s : 0, k === 2 ? s : 0];
      } else {
        // U Σ e_k = σ_k · U_k (rank-truncated)
        const s = truncSigma[k];
        target = [s * U[0][k], s * U[1][k], s * U[2][k]];
      }

      const len = Math.hypot(target[0], target[1], target[2]);
      if (len < 1e-9) continue;
      const dir = new THREE.Vector3(target[0], target[1], target[2]).normalize();
      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, 0, 0),
        Math.min(len, 5),
        COLORS[k],
        0.22,
        0.13
      );
      this.scene.add(arrow);
      this.arrows.push(arrow);
    }

    if (this.onUpdate) {
      const conditionNumber = sigma[2] > 1e-9 ? sigma[0] / sigma[2] : Infinity;
      const rankEffective = sigma.filter((s) => s > 1e-9).length;
      this.onUpdate({
        matrix: this.matrix.map((r) => [...r]),
        decomposition: this.decomposition,
        phase: this.phase,
        rank: this.rank,
        conditionNumber,
        rankEffective,
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
