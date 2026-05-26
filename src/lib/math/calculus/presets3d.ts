/**
 * 3D function presets for /math/calculus/gradient. Each one ships closed-form
 * partial derivatives so the gradient field is exact, not estimated.
 */
export interface FunctionPreset3D {
  id: string;
  label: string;
  /** f(x, y). */
  f: (x: number, y: number) => number;
  /** ∂f/∂x. */
  fx: (x: number, y: number) => number;
  /** ∂f/∂y. */
  fy: (x: number, y: number) => number;
  /** Square xy-domain — both axes use this range. */
  range: [number, number];
  /** Optional z-range hint. If absent, scenes auto-fit. */
  zRange?: [number, number];
}

export const FUNCTION_PRESETS_3D: FunctionPreset3D[] = [
  {
    id: 'bowl',
    label: '碗 · x² + y²',
    f: (x, y) => x * x + y * y,
    fx: (x) => 2 * x,
    fy: (_, y) => 2 * y,
    range: [-2, 2],
    zRange: [0, 8],
  },
  {
    id: 'saddle',
    label: '鞍點 · x² − y²',
    f: (x, y) => x * x - y * y,
    fx: (x) => 2 * x,
    fy: (_, y) => -2 * y,
    range: [-2, 2],
    zRange: [-4, 4],
  },
  {
    id: 'ripple',
    label: '漣漪 · sin(x)·cos(y)',
    f: (x, y) => Math.sin(x) * Math.cos(y),
    fx: (x, y) => Math.cos(x) * Math.cos(y),
    fy: (x, y) => -Math.sin(x) * Math.sin(y),
    range: [-Math.PI, Math.PI],
    zRange: [-1.2, 1.2],
  },
  {
    id: 'gaussian',
    label: '高斯峰 · e^(−(x²+y²)/2)',
    f: (x, y) => Math.exp(-(x * x + y * y) / 2),
    fx: (x, y) => -x * Math.exp(-(x * x + y * y) / 2),
    fy: (x, y) => -y * Math.exp(-(x * x + y * y) / 2),
    range: [-2.5, 2.5],
    zRange: [0, 1.1],
  },
  {
    id: 'hills',
    label: '雙峰 · sin(x) + sin(y)',
    f: (x, y) => Math.sin(x) + Math.sin(y),
    fx: (x) => Math.cos(x),
    fy: (_, y) => Math.cos(y),
    range: [-Math.PI, Math.PI],
    zRange: [-2.2, 2.2],
  },
  {
    id: 'monkey',
    label: '猴鞍 · x³ − 3xy²',
    f: (x, y) => x ** 3 - 3 * x * y * y,
    fx: (x, y) => 3 * x * x - 3 * y * y,
    fy: (x, y) => -6 * x * y,
    range: [-1.5, 1.5],
    zRange: [-4, 4],
  },
];

export function getPreset3D(id: string): FunctionPreset3D | undefined {
  return FUNCTION_PRESETS_3D.find((p) => p.id === id);
}
