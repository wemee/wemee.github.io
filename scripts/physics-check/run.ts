/**
 * Numeric regression checks for the /physics/ scenes.
 *
 *   npm run check:physics
 *
 * Why this exists rather than a screenshot pass: every page under /physics/
 * makes a *quantitative* claim — Δx·Δp = 0.5 exactly for a Gaussian, E/N = −√2
 * at the Ising critical point, CHSH S = 2√2, R + T = 1 through a barrier. Those
 * are checkable, and eyeballing a canvas is not a check. Three real defects were
 * caught here that no visual pass would have found:
 *
 *   - the resonance preset was so sharp the packet's own ΔE washed it out,
 *     so the page promised "T ≈ 1" while the simulation honestly reported 0.67
 *   - a lesson step told the reader to move an analyser angle that does not
 *     actually drop S below the classical bound
 *   - the barrier is 1% of the box width, so "watch ψ decay inside the wall"
 *     was invisible until a magnified panel was added
 *
 * The scenes are Canvas2DBase subclasses, so a tiny DOM stub (domstub.ts) lets
 * the *real* classes run under Node — no logic is duplicated here. TypeScript's
 * `private` is compile-time only, so the checks reach into internals via
 * bracket access on an `any`; that is deliberate, and keeps the production
 * classes free of test-only escape hatches.
 */
import { installDomStub } from './domstub';
installDomStub();

import { IsingScene, T_CRITICAL } from '@/lib/physics/IsingScene';
import { TunnelingScene } from '@/lib/physics/TunnelingScene';
import { UncertaintyScene } from '@/lib/physics/UncertaintyScene';
import { BellScene, TSIRELSON_BOUND } from '@/lib/physics/BellScene';
import { DoubleSlitScene } from '@/lib/physics/DoubleSlitScene';
import { CoupledOscillatorScene } from '@/lib/physics/CoupledOscillatorScene';
import { ResonanceScene } from '@/lib/physics/ResonanceScene';
import { fft, ifft, fftFreqs } from '@/lib/physics/fft';

const f = (x: number, n = 4) => x.toFixed(n);
let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(46)} ${detail}`);
}

// ─────────────────────────────── FFT round-trip
{
  const n = 256;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((3 * 2 * Math.PI * i) / n) + 0.5 * Math.cos((11 * 2 * Math.PI * i) / n);
  const orig = Float64Array.from(re);
  fft(re, im); ifft(re, im);
  let maxErr = 0;
  for (let i = 0; i < n; i++) maxErr = Math.max(maxErr, Math.abs(re[i] - orig[i]), Math.abs(im[i]));
  check('FFT round-trip error < 1e-12', maxErr < 1e-12, `max |err| = ${maxErr.toExponential(2)}`);

  const k = fftFreqs(8, 1);
  check('fftFreqs order [0..n/2-1, -n/2..-1]', k[0] === 0 && k[4] < 0 && k[3] > 0, `[${Array.from(k).map((v) => f(v, 2)).join(', ')}]`);
}

// ─────────────────────────────── Coupled oscillator
{
  const s: any = new CoupledOscillatorScene({ canvasId: 'x' });
  s.setK(1.6); s.setKc(0.45); s.setMass(1);
  check('ω₁ = √(k/m)', Math.abs(s.omega1 - Math.sqrt(1.6)) < 1e-12, `${f(s.omega1)}`);
  check('ω₂ = √((k+2k_c)/m)', Math.abs(s.omega2 - Math.sqrt(2.5)) < 1e-12, `${f(s.omega2)}`);

  s.setPreset('in-phase');
  const inPhase = s.modeEnergies();
  check('in-phase preset excites only mode 1', inPhase.e2 < 1e-24, `E₂ = ${inPhase.e2.toExponential(1)}`);
  const w1Before = s.omega1;
  s.setKc(2);
  check('k_c does not change ω₁', Math.abs(s.omega1 - w1Before) < 1e-12, `ω₁ ${f(w1Before)} → ${f(s.omega1)}`);

  s.setKc(0.45);
  s.setPreset('anti-phase');
  check('anti-phase preset excites only mode 2', s.modeEnergies().e1 < 1e-24, `E₁ = ${s.modeEnergies().e1.toExponential(1)}`);

  // total energy must be conserved along the exact solution
  s.setPreset('push-one');
  const modes = s.modeEnergies();
  const modeTotal = modes.e1 + modes.e2;
  let worst = 0;
  for (let t = 0; t <= 40; t += 0.37) {
    const loc = s.localEnergies(t);
    worst = Math.max(worst, Math.abs(loc.e1 + loc.e2 - modeTotal));
  }
  check('Σ local energy = Σ mode energy ∀t', worst < 1e-12, `max drift = ${worst.toExponential(2)}`);

  // in a beat, energy really does leave mass 1 almost completely
  let minShare = 1;
  for (let t = 0; t <= 60; t += 0.05) {
    const loc = s.localEnergies(t);
    minShare = Math.min(minShare, loc.e1 / (loc.e1 + loc.e2));
  }
  check('beat drains mass 1 below 10% of the energy', minShare < 0.1, `min share = ${f(minShare, 3)}`);
  s.destroy();
}

// ─────────────────────────────── Uncertainty
{
  const s: any = new UncertaintyScene({ canvasId: 'x' });
  const products: string[] = [];
  for (const w of [0.4, 0.8, 1.5, 3]) {
    s.setMode('gaussian'); s.setWidth(w); s.setK0(4);
    products.push(f(s.deltaX * s.deltaK, 4));
  }
  const allHalf = products.every((p) => Math.abs(Number(p) - 0.5) < 2e-3);
  check('Gaussian packet sits at Δx·Δp = 0.5', allHalf, `widths 0.4/0.8/1.5/3 → ${products.join(', ')}`);

  s.setWidth(1.2);
  const dpBefore = s.deltaK;
  s.setK0(-9);
  check('k₀ shifts the centre, not the width', Math.abs(s.deltaK - dpBefore) < 1e-3, `Δp ${f(dpBefore)} → ${f(s.deltaK)}, ⟨k⟩ = ${f(s.meanK, 2)}`);

  s.setK0(4);
  s.setMode('square');
  const sq = s.deltaX * s.deltaK;
  check('square packet is strictly above the bound', sq > 0.5, `Δx·Δp = ${f(sq)}`);
  s.setMode('double');
  const db = s.deltaX * s.deltaK;
  check('double packet is strictly above the bound', db > 0.5, `Δx·Δp = ${f(db)}`);
  s.destroy();
}

// ─────────────────────────────── Tunneling
{
  const s: any = new TunnelingScene({ canvasId: 'x' });
  const run = (steps: number) => { for (let i = 0; i < steps; i++) s.step(); s.updateProb(); };

  s.applyPreset('tunnel');
  run(6000);
  let p = s.partition();
  check('split-step conserves total probability', Math.abs(p.norm - 1) < 1e-6, `norm = ${f(p.norm, 8)}`);
  check('E < V₀ still transmits (T > 0)', p.T > 1e-4, `T = ${f(p.T)}, R = ${f(p.R)}, analytic T = ${f(s.analyticT())}`);
  check('R + T ≈ 1 after the packet clears', Math.abs(p.R + p.T - 1) < 1e-3, `R+T = ${f(p.R + p.T, 6)}`);

  const tTunnel = p.T;
  s.setBarrierWidth(3.2);
  run(6000);
  const tWide = s.partition().T;
  check('doubling the width crushes T exponentially', tWide < tTunnel / 8, `T: ${f(tTunnel)} → ${f(tWide, 6)}`);

  s.applyPreset('resonance');
  run(6000);
  p = s.partition();
  check('resonance preset is near-perfect transmission', p.T > 0.9, `T = ${f(p.T)}, analytic = ${f(s.analyticT())}`);
  s.destroy();
}

// ─────────────────────────────── Bell / CHSH
{
  const s: any = new BellScene({ canvasId: 'x' });
  s.setMode('quantum'); s.run(300000);
  const sq = s.currentS();
  check('quantum S → 2√2', Math.abs(sq - TSIRELSON_BOUND) < 0.02, `S = ${f(sq, 3)} ± ${f(s.sigmaS(), 3)} (target ${f(TSIRELSON_BOUND, 3)})`);
  check('quantum S exceeds the classical bound by >5σ', sq - 2 > 5 * s.sigmaS(), `(S−2)/σ = ${f((sq - 2) / s.sigmaS(), 1)}`);

  s.setMode('hidden'); s.run(300000);
  const sh = s.currentS();
  check('local hidden-variable model stays ≤ 2', sh <= 2 + 4 * s.sigmaS(), `S = ${f(sh, 3)} ± ${f(s.sigmaS(), 3)}`);

  s.setMode('best'); s.run(300000);
  const sb = s.currentS();
  check('optimal classical strategy saturates at 2', Math.abs(sb - 2) < 1e-9, `S = ${f(sb, 6)}`);

  // Bob's two settings coinciding kills the first two terms → S = √2 < 2.
  // (Moving b to 0° instead is NOT enough: that still predicts 2.414.)
  s.setMode('quantum');
  s.setAngle('b2', 22.5); s.run(200000);
  check('coinciding Bob settings hide the violation', s.currentS() < 2, `S = ${f(s.currentS(), 3)} (predicted √2 = 1.414)`);
  s.destroy();
}

// ─────────────────────────────── Double slit
{
  const s: any = new DoubleSlitScene({ canvasId: 'x' });
  s.fire(400000);
  const counts: Uint32Array = s.counts;
  const pdf: Float64Array = s.pdf;
  // chi-square-ish agreement between sampled histogram and the source pdf
  let pdfSum = 0; for (let i = 0; i < pdf.length; i++) pdfSum += pdf[i];
  let worstRel = 0;
  const group = 20;
  for (let g0 = 0; g0 + group <= counts.length; g0 += group) {
    let c = 0, e = 0;
    for (let i = g0; i < g0 + group; i++) { c += counts[i]; e += (pdf[i] / pdfSum) * 400000; }
    if (e > 400) worstRel = Math.max(worstRel, Math.abs(c - e) / e);
  }
  check('sampled histogram tracks the theory curve', worstRel < 0.12, `worst relative deviation = ${f(worstRel * 100, 1)}%`);

  // the fringe signature: with interference the pdf has deep zeros, without it does not
  const minMax = (a: Float64Array, from: number, to: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = from; i < to; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
    return { lo, hi };
  };
  const mid = [Math.floor(pdf.length * 0.45), Math.floor(pdf.length * 0.55)] as const;
  const withFringes = minMax(pdf, mid[0], mid[1]);
  s.setWhichPath(true);
  const noFringes = minMax(s.pdf, mid[0], mid[1]);
  check('which-path detector removes the fringes', withFringes.lo / withFringes.hi < 0.05 && noFringes.lo / noFringes.hi > 0.9,
    `min/max: interference ${f(withFringes.lo / withFringes.hi, 3)} → which-path ${f(noFringes.lo / noFringes.hi, 3)}`);
  s.destroy();
}

// ─────────────────────────────── Ising
{
  const s: any = new IsingScene({ canvasId: 'x', chartCanvasId: 'y' });
  const equilibrate = (T: number, sweeps: number) => {
    s.setTemperature(T);
    for (let i = 0; i < sweeps; i++) s.sweep();
  };
  const measure = (sweeps: number) => {
    let m = 0, e = 0;
    for (let i = 0; i < sweeps; i++) { s.sweep(); m += Math.abs(s.magnetization); e += s.energy / (96 * 96); }
    return { m: m / sweeps, e: e / sweeps };
  };

  s.randomize(); equilibrate(3.5, 400);
  const hot = measure(300);
  check('T = 3.5 is disordered (⟨|M|⟩ ≈ 0)', hot.m < 0.1, `⟨|M|⟩ = ${f(hot.m, 3)}, E/N = ${f(hot.e, 3)}`);

  s.randomize(); equilibrate(1.4, 1500);
  const cold = measure(300);
  check('T = 1.4 is ordered (⟨|M|⟩ → 1)', cold.m > 0.9, `⟨|M|⟩ = ${f(cold.m, 3)}, E/N = ${f(cold.e, 3)}`);

  s.alignUp(); equilibrate(T_CRITICAL, 2000);
  const crit = measure(1500);
  // Onsager: the exact internal energy per site at T_c is −√2
  check('E/N at T_c ≈ −√2 (Onsager exact)', Math.abs(crit.e + Math.SQRT2) < 0.05, `E/N = ${f(crit.e, 3)} vs −1.414`);
  check('⟨|M|⟩ at T_c sits between the two phases', crit.m > 0.15 && crit.m < 0.95, `⟨|M|⟩ = ${f(crit.m, 3)}`);

  // magnetisation must stay an exact integer ratio, never drift
  const exact = (() => { let t = 0; for (let i = 0; i < 96 * 96; i++) t += s.spins[i]; return t / (96 * 96); })();
  check('incremental magnetisation matches a full recount', Math.abs(exact - s.magnetization) < 1e-15, `drift = ${Math.abs(exact - s.magnetization).toExponential(1)}`);
  s.destroy();
}



console.log('\n— draw paths —');
let bad = 0;
const ok = (l: string, fn: () => void) => {
  try { fn(); console.log(`  ok   ${l}`); } catch (e) { bad++; console.log(` FAIL  ${l}: ${(e as Error).message}`); }
};

// draw() at several points in the packet's flight, including while it is
// straddling the barrier — that is when the inset panel has real work to do
ok('TunnelingScene.draw across the whole flight', () => {
  const s: any = new TunnelingScene({ canvasId: 'x' });
  s.applyPreset('tunnel');
  for (let phase = 0; phase < 12; phase++) {
    for (let i = 0; i < 700; i++) s.step();
    s.updateProb();
    s.draw();
  }
  s.applyPreset('resonance'); s.draw();
  s.setBarrierWidth(0.2); s.draw();
  s.setV0(0); s.draw();
  s.destroy();
});

ok('IsingScene.draw at both phases', () => {
  const s: any = new IsingScene({ canvasId: 'x', chartCanvasId: 'y' });
  s.draw(); s.setTemperature(1.2);
  for (let i = 0; i < 50; i++) s.sweep();
  s.draw(); s.startAutoSweep(); s.draw(); s.recordPoint(); s.chart.draw(); s.clearCurve(); s.chart.draw();
  s.destroy();
});

ok('UncertaintyScene.draw in all three modes at extreme widths', () => {
  const s: any = new UncertaintyScene({ canvasId: 'x' });
  for (const m of ['gaussian', 'square', 'double']) {
    for (const w of [0.25, 1.2, 4]) { s.setMode(m); s.setWidth(w); s.setK0(-14); s.draw(); s.setK0(14); s.draw(); }
  }
  s.destroy();
});

ok('DoubleSlitScene.draw empty and loaded, both modes', () => {
  const s: any = new DoubleSlitScene({ canvasId: 'x' });
  s.draw(); s.fire(5000); s.draw();
  s.setWhichPath(true); s.fire(5000); s.draw();
  s.setSeparationMm(0.4); s.setSlitWidthMm(0.08); s.setWavelengthNm(400); s.draw();
  s.destroy();
});

ok('BellScene.draw empty and after a long run', () => {
  const s: any = new BellScene({ canvasId: 'x' });
  s.draw(); s.run(50000); s.draw();
  s.setMode('hidden'); s.run(50000); s.draw();
  s.setAngle('a1', 90); s.run(1000); s.draw();
  s.destroy();
});

ok('CoupledOscillatorScene.draw at k_c = 0 and t large', () => {
  const s: any = new CoupledOscillatorScene({ canvasId: 'x' });
  s.setKc(0); s.draw();
  s.setPreset('in-phase'); s.t = 500; s.draw();
  s.setKc(2); s.setMass(0.4); s.setK(4); s.draw();
  s.destroy();
});

ok('ResonanceScene.draw at low damping near resonance', () => {
  const s: any = new ResonanceScene({ canvasId: 'x' });
  s.setDamping(0.01); s.setDriveFrequency(1);
  for (let i = 0; i < 2000; i++) s.step();
  s.draw();
  s.setDriveFrequency(0.05); s.draw();
  s.setDriveFrequency(2.5); s.draw();
  s.destroy();
});




const SCENE_FACTORIES: [string, () => any][] = [
  ['ResonanceScene', () => new ResonanceScene({ canvasId: 'x' })],
  ['CoupledOscillatorScene', () => new CoupledOscillatorScene({ canvasId: 'x' })],
  ['IsingScene', () => new IsingScene({ canvasId: 'x', chartCanvasId: 'y' })],
  ['UncertaintyScene', () => new UncertaintyScene({ canvasId: 'x' })],
  ['DoubleSlitScene', () => new DoubleSlitScene({ canvasId: 'x' })],
  ['TunnelingScene', () => new TunnelingScene({ canvasId: 'x' })],
  ['BellScene', () => new BellScene({ canvasId: 'x' })],
];

// A collapsed canvas (display:none, a mid-flight viewport resize, a full-page
// screenshot pass) used to make arc() throw IndexSizeError on a negative
// radius. Canvas2DBase now skips the draw, but draw() is also reachable
// directly, so every scene is checked at zero size too.
console.log('\n— collapsed canvas —');
{
  const collapse = (s: any) => { s.width = 0; s.height = 0; };
  const tiny = (s: any) => { s.width = 12; s.height = 8; };
  for (const [name, make] of SCENE_FACTORIES) {
    try {
      const s: any = make();
      collapse(s); s.draw();
      tiny(s); s.draw();
      s.destroy();
      console.log(`  ok   ${name} survives a collapsed canvas`);
    } catch (e) {
      bad++;
      console.log(` FAIL  ${name} threw at zero size: ${(e as Error).message}`);
    }
  }
}

console.log('');
if (failures === 0 && bad === 0) {
  console.log(`ALL CHECKS PASSED (${'physics scenes'})`);
  process.exit(0);
}
console.log(`${failures} numeric check(s) failed, ${bad} draw path(s) threw`);
process.exit(1);
