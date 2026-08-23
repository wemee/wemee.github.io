/** Minimal DOM stub so the real scene classes can run under Node for numeric QA. */
export function installDomStub(): void {
  const makeCtx = () => {
    const ctx: any = new Proxy(
      {
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        measureText: () => ({ width: 10 }),
      },
      {
        get(target, prop) {
          if (prop in target) return (target as any)[prop];
          return () => {};
        },
        set() { return true; },
      },
    );
    return ctx;
  };
  const makeCanvas = () => ({
    width: 600, height: 400,
    style: {},
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ width: 600, height: 400, left: 0, top: 0 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  });
  (globalThis as any).document = {
    getElementById: () => makeCanvas(),
    createElement: () => makeCanvas(),
    addEventListener: () => {},
  };
  (globalThis as any).window = { devicePixelRatio: 1, addEventListener: () => {} };
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  (globalThis as any).requestAnimationFrame = () => 0;
  (globalThis as any).cancelAnimationFrame = () => {};
}
