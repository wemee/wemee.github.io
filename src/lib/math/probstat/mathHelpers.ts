/**
 * Shared math helpers for /math/probstat/ scenes.
 *
 * Self-contained: no external deps. PDF/PMF/CDF for the 5 distributions used
 * in the `distributions` page; samplers for LLN / CLT / MCMC; Beta PDF for
 * the `bayes` page; logGamma / erf for downstream pieces.
 */

// ─────────────────────────────────────────── numerical primitives

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const SQRT_2 = Math.sqrt(2);

/** Lanczos approximation, valid for x > 0.5. ~14 digits of precision. */
export function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function logFactorial(n: number): number {
  return logGamma(n + 1);
}

/** Abramowitz & Stegun 7.1.26 — max error ~1.5e-7. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

// ─────────────────────────────────────────── distributions

export function normalPDF(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
}

export function normalCDF(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * SQRT_2)));
}

/** Box–Muller. Returns one standard normal sample. */
export function randNormal(mu = 0, sigma = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

export function binomialPMF(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const logC = logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

export function binomialCDF(k: number, n: number, p: number): number {
  let s = 0;
  for (let i = 0; i <= Math.min(k, n); i++) s += binomialPMF(i, n, p);
  return s;
}

export function randBinomial(n: number, p: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) s++;
  return s;
}

export function poissonPMF(k: number, lambda: number): number {
  if (k < 0 || lambda <= 0) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
}

export function poissonCDF(k: number, lambda: number): number {
  let s = 0;
  for (let i = 0; i <= k; i++) s += poissonPMF(i, lambda);
  return s;
}

/** Knuth's algorithm — fine for the λ ≤ 30 range this page uses. */
export function randPoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function exponentialPDF(x: number, lambda: number): number {
  if (x < 0) return 0;
  return lambda * Math.exp(-lambda * x);
}

export function exponentialCDF(x: number, lambda: number): number {
  if (x < 0) return 0;
  return 1 - Math.exp(-lambda * x);
}

export function randExponential(lambda: number): number {
  return -Math.log(1 - Math.random()) / lambda;
}

export function uniformPDF(x: number, a: number, b: number): number {
  if (x < a || x > b) return 0;
  return 1 / (b - a);
}

export function uniformCDF(x: number, a: number, b: number): number {
  if (x <= a) return 0;
  if (x >= b) return 1;
  return (x - a) / (b - a);
}

export function randUniform(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Beta(α, β) PDF. α, β > 0; support x ∈ (0, 1). */
export function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
}

// ─────────────────────────────────────────── presentation

/** Strip negative zero and round to fixed decimals; safe for display. */
export function fmt(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return '—';
  const rounded = Number(v.toFixed(decimals));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(decimals);
}
