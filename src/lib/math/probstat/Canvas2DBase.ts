/**
 * Canvas2DBase — shared base class for /math/probstat/ 2D visualizations.
 *
 * Duplicated from /math/calculus/Canvas2DBase.ts. Kept per-subsection for now;
 * if a third 2D-canvas subsection appears, extract to src/lib/math/Canvas2DBase.ts
 * and update both imports.
 *
 * Responsibilities:
 *   - devicePixelRatio scaling
 *   - ResizeObserver on the canvas (handles flex-grid resizing)
 *   - Render-on-demand via requestAnimationFrame, deduplicated
 *   - destroy() cleanup
 *
 * Subclasses implement draw() using `this.ctx`, `this.width`, `this.height`
 * (CSS pixels — DPR is already applied to the context transform).
 * Subclasses call this.scheduleRender() whenever state changes.
 */
export interface Canvas2DBaseOptions {
  canvasId: string;
}

export abstract class Canvas2DBase {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected width = 0;
  protected height = 0;

  private renderQueued = false;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor(options: Canvas2DBaseOptions) {
    const canvas = document.getElementById(options.canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error(`Canvas with id "${options.canvasId}" not found`);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.canvas = canvas;
    this.ctx = ctx;

    this.setupCanvas();

    this.resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      this.setupCanvas();
      this.scheduleRender();
    });
    this.resizeObserver.observe(canvas);
  }

  protected setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height || 360;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  public scheduleRender(): void {
    if (this.renderQueued || this.destroyed) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (this.destroyed) return;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.draw();
    });
  }

  protected abstract draw(): void;

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
