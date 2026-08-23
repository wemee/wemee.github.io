/**
 * Canvas2DBase — shared base class for all /math/ 2D canvas visualizations
 * (calculus, probstat, and any future 2D subsection).
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
   *
   * Only the backing-store size (the width/height *attributes*) is written
   * here. It used to also pin `style.width`/`style.height` to the measured
   * pixel size, which quietly froze the element: an inline width beats the
   * `w-full` class, so the canvas could never grow again when its container
   * did, and the ResizeObserver — watching an element whose box no longer
   * changed — never fired. Widening the window left every scene rendering at
   * its first-paint width. Every canvas in the project is sized by CSS
   * (`w-full` plus an explicit height or aspect-ratio), so dropping the pin
   * changes nothing on first paint and makes resizing work.
   */
  protected setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height || 360;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;

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
      // A collapsed box (display:none, a mid-flight viewport resize, a
      // full-page screenshot pass) makes every derived length negative, and
      // any radius computed from them throws IndexSizeError out of arc().
      // There is nothing to draw at zero size, so skip rather than making
      // every subclass defend itself.
      if (this.width <= 0 || this.height <= 0) return;
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
