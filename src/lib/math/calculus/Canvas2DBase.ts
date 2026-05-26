/**
 * Canvas2DBase — shared base class for /math/calculus/ 2D visualizations.
 *
 * Responsibilities:
 *   - devicePixelRatio scaling so lines stay crisp on Retina displays
 *   - ResizeObserver on the canvas element (handles flex-grid resizing,
 *     not just window resize — important when the right-hand control
 *     panel collapses to a second row on narrow screens)
 *   - Render-on-demand via requestAnimationFrame, deduplicated so calling
 *     scheduleRender() multiple times per frame coalesces into one draw
 *   - destroy() cleanup so SPA-style nav doesn't leak observers
 *
 * Subclasses implement draw() using `this.ctx`, `this.width`, `this.height`
 * (all in CSS pixels — DPR is already applied to the context transform).
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

  /**
   * Apply devicePixelRatio scaling. Called on init and whenever the canvas
   * element resizes. Reads CSS dimensions from getBoundingClientRect so the
   * stylesheet controls sizing (responsive aspect-ratio etc.).
   */
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

  /**
   * Queue a redraw on the next animation frame. Multiple calls per frame
   * coalesce into a single draw — safe to call from input handlers, slider
   * change events, and ResizeObserver callbacks without worrying about
   * over-drawing.
   */
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

  /**
   * Implemented by each scene. The context is already clearRect'd and
   * DPR-scaled — draw in CSS-pixel coordinates.
   */
  protected abstract draw(): void;

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
