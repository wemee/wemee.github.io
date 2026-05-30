import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * ThreeSceneBase — shared Three.js scaffolding for the /math/linalg/ 3D
 * matrix-visualization scenes (transform, composition, projection,
 * change-of-basis, eigen, svd).
 *
 * It owns everything those scenes had byte-for-byte in common:
 *   - scene + dark background
 *   - a y-up PerspectiveCamera (FOV 50) with OrbitControls + damping
 *   - reference GridHelper + AxesHelper + ambient/directional lights
 *   - ResizeObserver-driven camera/renderer resize
 *   - render-on-demand RAF (deduped; runs controls.update() so damping eases)
 *   - destroy() that disposes every geometry/material and detaches the canvas
 *
 * Subclasses add their own meshes in the constructor (after `super(...)`),
 * implement their own update logic, and call `this.scheduleRender()` whenever
 * state changes. The few values that legitimately differ per scene
 * (camera position, orbit target, axes size, background) are constructor
 * options with sensible defaults.
 *
 * NOT a fit for GradientScene (/math/calculus/): that is a z-up surface plot
 * with a different camera, grid orientation, and lighting — deliberately kept
 * standalone rather than bending this base out of shape.
 */
export interface ThreeSceneBaseOptions {
  containerId: string;
  /** camera world position; default [4, 3, 5] */
  cameraPosition?: [number, number, number];
  /** orbit target / camera lookAt; default [0, 0, 0] */
  target?: [number, number, number];
  /** AxesHelper size; default 3 */
  axesSize?: number;
  /** scene background color; default 0x0a0a0a */
  background?: number;
}

export abstract class ThreeSceneBase {
  protected container: HTMLElement;
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected renderer: THREE.WebGLRenderer;
  protected controls: OrbitControls;

  private resizeObserver: ResizeObserver;
  private rafScheduled = false;
  protected destroyed = false;

  constructor(options: ThreeSceneBaseOptions) {
    const container = document.getElementById(options.containerId);
    if (!container) throw new Error(`Container #${options.containerId} not found`);
    this.container = container;

    const cameraPosition = options.cameraPosition ?? [4, 3, 5];
    const target = options.target ?? [0, 0, 0];
    const axesSize = options.axesSize ?? 3;
    const background = options.background ?? 0x0a0a0a;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
    this.camera.lookAt(target[0], target[1], target[2]);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(target[0], target[1], target[2]);
    // Render-on-demand: re-render whenever the controls move (incl. damping easing).
    this.controls.addEventListener("change", () => this.scheduleRender());

    this.scene.add(new THREE.GridHelper(10, 10, 0x333333, 0x1f1f1f));
    this.scene.add(new THREE.AxesHelper(axesSize));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  /**
   * Queue a render on the next animation frame. Multiple calls per frame
   * coalesce. Clears the flag BEFORE rendering so a 'change' fired by damping
   * during controls.update() can re-schedule the next frame.
   */
  protected scheduleRender(): void {
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

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.LineSegments ||
        obj instanceof THREE.Line
      ) {
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
}
