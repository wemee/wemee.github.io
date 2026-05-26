/**
 * Function presets shared across calculus pages.
 *
 * Each preset includes the function, its analytic derivative (for ground
 * truth comparison on slope-tangent), and a sensible default plot window.
 * Pages filter to the subset that suits their pedagogy — e.g. taylor.astro
 * skips presets that blow up at the expansion centre.
 */
export interface FunctionPreset {
  id: string;
  label: string;
  f: (x: number) => number;
  fPrime: (x: number) => number;
  /** Default x-range for plotting (lo, hi). */
  range: [number, number];
  /** Optional y-range hint. If absent, scenes auto-fit from samples. */
  yRange?: [number, number];
  /**
   * Optional Taylor coefficient generator centred at `a`. n is the term
   * index (0 = constant, 1 = linear, …). Only set for functions with a
   * clean closed-form expansion; taylor.astro filters by presence.
   */
  taylor?: (a: number, n: number) => number;
}

const factorial = (n: number): number => {
  if (n <= 1) return 1;
  let acc = 1;
  for (let i = 2; i <= n; i++) acc *= i;
  return acc;
};

export const FUNCTION_PRESETS: FunctionPreset[] = [
  {
    id: 'parabola',
    label: 'f(x) = x²',
    f: (x) => x * x,
    fPrime: (x) => 2 * x,
    range: [-3, 3],
    yRange: [-1, 9],
    // Taylor series of x² around a: f(a) + 2a(x-a) + (x-a)², terms 0/1/2 only.
    taylor: (a, n) => {
      if (n === 0) return a * a;
      if (n === 1) return 2 * a;
      if (n === 2) return 1;
      return 0;
    },
  },
  {
    id: 'cubic',
    label: 'f(x) = x³ − x',
    f: (x) => x ** 3 - x,
    fPrime: (x) => 3 * x * x - 1,
    range: [-2, 2],
    yRange: [-3, 3],
    taylor: (a, n) => {
      if (n === 0) return a ** 3 - a;
      if (n === 1) return 3 * a * a - 1;
      if (n === 2) return 3 * a;
      if (n === 3) return 1;
      return 0;
    },
  },
  {
    id: 'sin',
    label: 'f(x) = sin(x)',
    f: (x) => Math.sin(x),
    fPrime: (x) => Math.cos(x),
    range: [-Math.PI * 1.5, Math.PI * 1.5],
    yRange: [-1.5, 1.5],
    // n-th derivative of sin at a: sin(a + nπ/2). Coefficient = that / n!.
    taylor: (a, n) => Math.sin(a + (n * Math.PI) / 2) / factorial(n),
  },
  {
    id: 'cos',
    label: 'f(x) = cos(x)',
    f: (x) => Math.cos(x),
    fPrime: (x) => -Math.sin(x),
    range: [-Math.PI * 1.5, Math.PI * 1.5],
    yRange: [-1.5, 1.5],
    taylor: (a, n) => Math.cos(a + (n * Math.PI) / 2) / factorial(n),
  },
  {
    id: 'exp',
    label: 'f(x) = eˣ',
    f: (x) => Math.exp(x),
    fPrime: (x) => Math.exp(x),
    range: [-2, 2],
    yRange: [0, 8],
    taylor: (a, n) => Math.exp(a) / factorial(n),
  },
  {
    id: 'gaussian',
    label: 'f(x) = e^(−x²)',
    f: (x) => Math.exp(-x * x),
    fPrime: (x) => -2 * x * Math.exp(-x * x),
    range: [-3, 3],
    yRange: [-0.2, 1.2],
    // No clean closed-form Taylor; numerical derivatives only.
  },
  {
    id: 'reciprocal',
    label: 'f(x) = 1 / (1 − x)',
    f: (x) => 1 / (1 - x),
    fPrime: (x) => 1 / ((1 - x) ** 2),
    range: [-2, 0.9],
    yRange: [-1, 8],
    // Geometric series: 1/(1-x) = Σ x^n at a = 0. Generalised via shift.
    taylor: (a, n) => 1 / Math.pow(1 - a, n + 1),
  },
];

export function getPreset(id: string): FunctionPreset | undefined {
  return FUNCTION_PRESETS.find((p) => p.id === id);
}
