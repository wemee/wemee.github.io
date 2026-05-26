import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FUNCTION_PRESETS_3D, type FunctionPreset3D } from './presets3d';

/**
 * 3D surface visualization for the gradient page.
 *
 * - Renders z = f(x, y) as a deformable mesh + wireframe overlay.
 * - Drops a marker sphere at the current (x₀, y₀, f(x₀, y₀)).
 * - Draws the gradient arrow ∇f at the marker, projected onto the xy-plane
 *   (so its length is |∇f| and it shows where to walk for fastest ascent).
 * - Draws a unit direction arrow at angle θ in the xy-plane, plus a "slope
 *   bar" lifting from that arrow's tip to z = D_v f. This visualises the
 *   directional derivative.
 */
export interface GradientState {
  x0: number;
  y0: number;
  z0: number;
  theta: number;
  fx: number;
  fy: number;
  gradMagnitude: number;
  gradAngle: number;        // atan2(fy, fx) — radians
  directionalDerivative: number;
}

export interface GradientSceneOptions {
  containerId: string;
  onUpdate?: (s: GradientState) => void;
}

const SURFACE_SEGMENTS = 80;

const COLORS = {
  bg: 0x0e1620,
  ambient: 0xffffff,
  directional: 0xffffff,
  grid: 0x2a3a4a,
  axis: 0x4a5a6a,
  surface: 0x2aa198,           // accent-cyan
  wireframe: 0x4dd0e1,
  marker: 0xffffff,
  gradArrow: 0xffd54f,          // accent-yellow
  dirArrow: 0xff6b9d,           // magenta
  slopeBar: 0xff6b9d,
};

export class GradientScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private resizeObserver: ResizeObserver;

  private preset: FunctionPreset3D;
  private x0 = 0.7;
  private y0 = 0.4;
  private theta = Math.PI / 4;

  // Scene objects (rebuilt when preset changes).
  private surfaceMesh: THREE.Mesh | null = null;
  private wireMesh: THREE.LineSegments | null = null;
  private marker: THREE.Mesh;
  private gradArrow: THREE.ArrowHelper;
  private dirArrow: THREE.ArrowHelper;
  private slopeBar: THREE.Line;

  private onUpdate?: (s: GradientState) => void;
  private rafScheduled = false;
  private destroyed = false;

  constructor(options: GradientSceneOptions) {
    const container = document.getElementById(options.containerId);
    if (!container) throw new Error(`Container #${options.containerId} not found`);
    this.container = container;
    this.onUpdate = options.onUpdate;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.bg);

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 480;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    // We use z as the height axis (z = f(x, y)), so override Three.js's default
    // y-up camera orientation. Without this, OrbitControls orbit around Y and
    // the surface tilts in screen space.
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(5.5, -5.5, 4.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('change', () => this.scheduleRender());

    // Lighting
    this.scene.add(new THREE.AmbientLight(COLORS.ambient, 0.55));
    const dir = new THREE.DirectionalLight(COLORS.directional, 0.7);
    dir.position.set(6, 12, 8);
    this.scene.add(dir);

    // Reference grid + axes at z=0
    const grid = new THREE.GridHelper(6, 12, COLORS.axis, COLORS.grid);
    grid.rotation.x = Math.PI / 2; // Lay flat in xy-plane (default is xz)
    this.scene.add(grid);
    this.scene.add(new THREE.AxesHelper(2.5));

    // Marker sphere — placed in updateMarkerAndArrows().
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 18, 14),
      new THREE.MeshStandardMaterial({ color: COLORS.marker, emissive: 0x555555 }),
    );
    this.scene.add(this.marker);

    // Gradient arrow — initial length placeholder, repositioned in update.
    this.gradArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      1,
      COLORS.gradArrow,
      0.18,
      0.1,
    );
    this.scene.add(this.gradArrow);

    // Direction arrow (unit length in xy-plane).
    this.dirArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      1,
      COLORS.dirArrow,
      0.18,
      0.1,
    );
    this.scene.add(this.dirArrow);

    // Slope bar (line from xy-plane up to z = D_v f at the dir-arrow's tip).
    const slopeGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    this.slopeBar = new THREE.Line(
      slopeGeom,
      new THREE.LineBasicMaterial({ color: COLORS.slopeBar, linewidth: 2 }),
    );
    this.scene.add(this.slopeBar);

    this.preset = FUNCTION_PRESETS_3D[0];
    this.rebuildSurface();
    this.updateMarkerAndArrows();
    this.emitUpdate();

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      this.handleResize();
      this.scheduleRender();
    });
    this.resizeObserver.observe(container);

    // Damping needs a ticking loop while controls are moving — but we still
    // gate by `scheduleRender` to avoid free 60fps.
    this.scheduleRender();
  }

  public setPreset(id: string): void {
    const next = FUNCTION_PRESETS_3D.find((p) => p.id === id);
    if (!next) return;
    this.preset = next;
    // Clamp x0/y0 into new range.
    const [lo, hi] = next.range;
    this.x0 = Math.max(lo, Math.min(hi, this.x0));
    this.y0 = Math.max(lo, Math.min(hi, this.y0));
    this.rebuildSurface();
    this.updateMarkerAndArrows();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setPoint(x0: number, y0: number): void {
    this.x0 = x0;
    this.y0 = y0;
    this.updateMarkerAndArrows();
    this.emitUpdate();
    this.scheduleRender();
  }

  public setTheta(theta: number): void {
    this.theta = theta;
    this.updateMarkerAndArrows();
    this.emitUpdate();
    this.scheduleRender();
  }

  public getRange(): [number, number] {
    return this.preset.range;
  }

  private rebuildSurface(): void {
    if (this.surfaceMesh) {
      this.scene.remove(this.surfaceMesh);
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
      this.surfaceMesh = null;
    }
    if (this.wireMesh) {
      this.scene.remove(this.wireMesh);
      this.wireMesh.geometry.dispose();
      (this.wireMesh.material as THREE.Material).dispose();
      this.wireMesh = null;
    }

    const [lo, hi] = this.preset.range;
    const span = hi - lo;
    const seg = SURFACE_SEGMENTS;
    const geom = new THREE.PlaneGeometry(span, span, seg, seg);
    // PlaneGeometry lies in the xy-plane (z=0), centred at origin. We need to
    // deform z, but THREE's PlaneGeometry vertices index in (i, j) order with
    // x along width and y along height.
    const positions = geom.attributes.position;
    const colours: number[] = [];

    const palette = (z: number, zMin: number, zMax: number): [number, number, number] => {
      const t = zMax === zMin ? 0.5 : (z - zMin) / (zMax - zMin);
      // Blend from deep teal (low) → mid cyan → bright yellow (high).
      const low = [0.06, 0.22, 0.25];
      const mid = [0.16, 0.63, 0.60];
      const hi = [0.94, 0.84, 0.31];
      if (t < 0.5) {
        const s = t * 2;
        return [low[0] * (1 - s) + mid[0] * s, low[1] * (1 - s) + mid[1] * s, low[2] * (1 - s) + mid[2] * s];
      }
      const s = (t - 0.5) * 2;
      return [mid[0] * (1 - s) + hi[0] * s, mid[1] * (1 - s) + hi[1] * s, mid[2] * (1 - s) + hi[2] * s];
    };

    // First pass: compute z and min/max.
    const zs: number[] = new Array(positions.count);
    let zMin = Infinity, zMax = -Infinity;
    const mid = (lo + hi) / 2;
    for (let i = 0; i < positions.count; i++) {
      // PlaneGeometry is centred at origin, so positions.x ranges from -span/2..span/2.
      // Translate to world xy = (mid + position.x, mid + position.y).
      const px = positions.getX(i);
      const py = positions.getY(i);
      const wx = mid + px;
      const wy = mid + py;
      const z = this.preset.f(wx, wy);
      zs[i] = Number.isFinite(z) ? z : 0;
      if (zs[i] < zMin) zMin = zs[i];
      if (zs[i] > zMax) zMax = zs[i];
    }

    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, zs[i]);
      const [r, g, b] = palette(zs[i], zMin, zMax);
      colours.push(r, g, b);
    }

    positions.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geom.computeVertexNormals();
    // Translate the plane so its centre aligns with the world (mid, mid, 0).
    geom.translate(mid, mid, 0);

    this.surfaceMesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: false,
        transparent: true,
        opacity: 0.92,
        roughness: 0.7,
        metalness: 0.0,
      }),
    );
    this.scene.add(this.surfaceMesh);

    // Wireframe overlay (coarser for legibility).
    const wireGeom = new THREE.WireframeGeometry(this.buildCoarseGeometry());
    this.wireMesh = new THREE.LineSegments(
      wireGeom,
      new THREE.LineBasicMaterial({ color: COLORS.wireframe, transparent: true, opacity: 0.25 }),
    );
    this.scene.add(this.wireMesh);
  }

  /**
   * Build a coarser version of the surface for the wireframe overlay — full
   * SURFACE_SEGMENTS would produce visual noise. Uses 14×14 grid.
   */
  private buildCoarseGeometry(): THREE.BufferGeometry {
    const [lo, hi] = this.preset.range;
    const span = hi - lo;
    const mid = (lo + hi) / 2;
    const seg = 14;
    const g = new THREE.PlaneGeometry(span, span, seg, seg);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const wx = mid + pos.getX(i);
      const wy = mid + pos.getY(i);
      const z = this.preset.f(wx, wy);
      pos.setZ(i, Number.isFinite(z) ? z : 0);
    }
    pos.needsUpdate = true;
    g.translate(mid, mid, 0);
    return g;
  }

  private updateMarkerAndArrows(): void {
    const z0 = this.preset.f(this.x0, this.y0);
    const fx = this.preset.fx(this.x0, this.y0);
    const fy = this.preset.fy(this.x0, this.y0);
    const mag = Math.sqrt(fx * fx + fy * fy);

    // Marker
    this.marker.position.set(this.x0, this.y0, Number.isFinite(z0) ? z0 : 0);

    // Gradient arrow on xy-plane. Length scaled so very steep gradients don't
    // explode off the plot. Cap at 1.2 world units.
    const visualLen = Math.min(mag, 2.0);
    const safeLen = Math.max(visualLen, 0.001);
    const gx = mag === 0 ? 1 : fx / mag;
    const gy = mag === 0 ? 0 : fy / mag;
    this.gradArrow.position.set(this.x0, this.y0, 0.01);
    this.gradArrow.setDirection(new THREE.Vector3(gx, gy, 0).normalize());
    this.gradArrow.setLength(safeLen, Math.min(0.2, safeLen * 0.3), 0.12);

    // Direction arrow (always unit length).
    const dx = Math.cos(this.theta);
    const dy = Math.sin(this.theta);
    this.dirArrow.position.set(this.x0, this.y0, 0.01);
    this.dirArrow.setDirection(new THREE.Vector3(dx, dy, 0));
    this.dirArrow.setLength(1.0, 0.2, 0.12);

    // Slope bar: from the dir-arrow tip on xy-plane, lift to z = D_v f.
    // We're showing "if you walk one unit in direction (dx,dy), z changes by D_v f".
    const dvf = fx * dx + fy * dy;
    const tipX = this.x0 + dx;
    const tipY = this.y0 + dy;
    const positions = (this.slopeBar.geometry.attributes.position as THREE.BufferAttribute);
    positions.setXYZ(0, tipX, tipY, 0);
    positions.setXYZ(1, tipX, tipY, dvf);
    positions.needsUpdate = true;
  }

  private emitUpdate(): void {
    if (!this.onUpdate) return;
    const z0 = this.preset.f(this.x0, this.y0);
    const fx = this.preset.fx(this.x0, this.y0);
    const fy = this.preset.fy(this.x0, this.y0);
    const gradMagnitude = Math.sqrt(fx * fx + fy * fy);
    const gradAngle = Math.atan2(fy, fx);
    const dx = Math.cos(this.theta);
    const dy = Math.sin(this.theta);
    const directionalDerivative = fx * dx + fy * dy;
    this.onUpdate({ x0: this.x0, y0: this.y0, z0, theta: this.theta, fx, fy, gradMagnitude, gradAngle, directionalDerivative });
  }

  private handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public scheduleRender(): void {
    if (this.rafScheduled || this.destroyed) return;
    this.rafScheduled = true;
    requestAnimationFrame(() => {
      this.rafScheduled = false;
      if (this.destroyed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      // If controls are still settling from damping, keep ticking.
      if (this.controlsMoving()) this.scheduleRender();
    });
  }

  private controlsMoving(): boolean {
    // OrbitControls don't expose a "settling" flag directly. Approximate by
    // checking damping factor — if damping is on, give it a few extra frames
    // after each interaction. The change event already gives us a tick on
    // every micro-movement, so this is mostly a no-op safety net.
    return false;
  }

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.surfaceMesh) {
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
    }
    if (this.wireMesh) {
      this.wireMesh.geometry.dispose();
      (this.wireMesh.material as THREE.Material).dispose();
    }
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.slopeBar.geometry.dispose();
    (this.slopeBar.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
