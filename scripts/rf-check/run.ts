/**
 * Numeric regression checks for the /physics/rf/ subsection.
 *
 *   npm run check:rf
 *
 * Same rationale as scripts/physics-check: every page states checkable
 * numbers, and a canvas that "looks like a radiation pattern" proves nothing.
 * The values here are cross-checked against textbook closed forms (array
 * directivity, Rayleigh moments, the −174 dBm/Hz noise floor) rather than
 * against the implementation's own output, so a wrong constant fails loudly.
 *
 * Reuses the DOM stub from the physics checks — the scenes are the same
 * Canvas2DBase subclasses.
 */
import { installDomStub } from '../physics-check/domstub';
installDomStub();

import {
  fsplDb, rangeKmForLoss, noiseFloorDbm, wavelengthM, fresnelRadiusM,
  fresnelParameter, knifeEdgeLossDb, shannonCapacity, dbToLinear, solveLink,
  RADIO_PRESETS,
} from '@/lib/rf/radio';
import { LinkBudgetScene } from '@/lib/rf/LinkBudgetScene';
import { AntennaArrayScene } from '@/lib/rf/AntennaArrayScene';
import { FresnelScene } from '@/lib/rf/FresnelScene';
import { MultipathScene } from '@/lib/rf/MultipathScene';
import { ShannonScene } from '@/lib/rf/ShannonScene';
import { InverseSquareScene } from '@/lib/rf/InverseSquareScene';
import { MeshScene } from '@/lib/rf/MeshScene';
import { MeshSim, compareModes, MESH_MODES } from '@/lib/rf/MeshSim';

const f = (x: number, n = 4) => x.toFixed(n);
let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label.padEnd(48)} ${detail}`);
}

// ─────────────────────────────── propagation maths
{
  // 20log₁₀(1) + 20log₁₀(923) + 32.44
  const l = fsplDb(1, 923);
  check('FSPL 1 km @ 923 MHz', Math.abs(l - 91.74) < 0.02, `${f(l, 2)} dB`);
  check('doubling distance costs 6.02 dB',
    Math.abs(fsplDb(2, 923) - fsplDb(1, 923) - 6.0206) < 1e-3,
    `${f(fsplDb(2, 923) - fsplDb(1, 923), 4)} dB`);
  check('doubling frequency costs 6.02 dB',
    Math.abs(fsplDb(1, 1846) - fsplDb(1, 923) - 6.0206) < 1e-3,
    `${f(fsplDb(1, 1846) - fsplDb(1, 923), 4)} dB`);
  const back = rangeKmForLoss(fsplDb(37.5, 868), 868);
  check('rangeKmForLoss inverts fsplDb', Math.abs(back - 37.5) < 1e-9, `${f(back, 6)} km`);

  // kTB: −174 dBm/Hz is the number every RF engineer quotes
  check('noise floor is −174 dBm/Hz', Math.abs(noiseFloorDbm(1) + 173.98) < 0.02, `${f(noiseFloorDbm(1), 2)} dBm/Hz`);
  check('noise floor in 250 kHz = −120 dBm', Math.abs(noiseFloorDbm(250_000) + 120) < 0.02, `${f(noiseFloorDbm(250_000), 2)} dBm`);
  // LoRa SF11: −174 + 10log(250k) + NF 6 + SNR −17.5
  const sens = noiseFloorDbm(250_000, 6) - 17.5;
  check('LoRa SF11 sensitivity ≈ preset −132 dBm', Math.abs(sens + 131.5) < 0.1, `computed ${f(sens, 2)} dBm`);

  check('λ at 923 MHz ≈ 32.5 cm', Math.abs(wavelengthM(923) - 0.3249) < 1e-3, `${f(wavelengthM(923) * 100, 2)} cm`);

  // r₁ = √(λ d₁d₂ / d) at mid-span of a 12 km link
  const r1 = fresnelRadiusM(6000, 6000, 923);
  check('first Fresnel radius, 12 km @ 923 MHz', Math.abs(r1 - 31.2) < 0.3, `${f(r1, 2)} m`);
  check('Fresnel zone is widest at mid-span',
    fresnelRadiusM(6000, 6000, 923) > fresnelRadiusM(1000, 11000, 923),
    `mid ${f(fresnelRadiusM(6000, 6000, 923), 1)} m vs 1/6 point ${f(fresnelRadiusM(1000, 11000, 923), 1)} m`);
  check('lower frequency needs MORE clearance',
    fresnelRadiusM(6000, 6000, 145) > fresnelRadiusM(6000, 6000, 5800),
    `145 MHz ${f(fresnelRadiusM(6000, 6000, 145), 1)} m vs 5.8 GHz ${f(fresnelRadiusM(6000, 6000, 5800), 1)} m`);

  // grazing the line of sight costs exactly 6 dB — the number the 60 % rule exists to avoid
  check('knife-edge loss at ν = 0 is 6 dB', Math.abs(knifeEdgeLossDb(0) - 6.02) < 0.05, `${f(knifeEdgeLossDb(0), 2)} dB`);
  check('knife-edge loss is 0 below ν = −0.7', knifeEdgeLossDb(-0.8) === 0, `${f(knifeEdgeLossDb(-0.8), 2)} dB`);
  check('loss grows monotonically with ν',
    knifeEdgeLossDb(0) < knifeEdgeLossDb(1) && knifeEdgeLossDb(1) < knifeEdgeLossDb(3),
    `ν=0 ${f(knifeEdgeLossDb(0), 1)} → ν=1 ${f(knifeEdgeLossDb(1), 1)} → ν=3 ${f(knifeEdgeLossDb(3), 1)} dB`);
  // 60 % clearance should land near "no loss"
  const nu60 = fresnelParameter(-0.6 * r1, 6000, 6000, 923);
  check('60 % clearance gives ≈ 0 dB', knifeEdgeLossDb(nu60) < 0.6, `ν = ${f(nu60, 2)} → ${f(knifeEdgeLossDb(nu60), 2)} dB`);
}

// ─────────────────────────────── link budget
{
  const s: any = new LinkBudgetScene({ canvasId: 'x' });
  for (const p of RADIO_PRESETS) {
    s.applyPreset(p.id);
    s.snapToMaxRange();
    const r = s.result();
    // snapToMaxRange clamps to the chart's 2000 km axis, so a link whose
    // free-space range exceeds that legitimately keeps a positive margin
    const clamped = r.maxRangeKm > 2000;
    check(`margin is 0 at max range · ${p.id}`,
      clamped ? r.marginDb > 0 : Math.abs(r.marginDb) < 0.01,
      clamped
        ? `range ${f(r.maxRangeKm, 0)} km exceeds the 2000 km axis; clamped, margin ${f(r.marginDb, 2)} dB`
        : `margin ${f(r.marginDb, 5)} dB, range ${f(r.maxRangeKm, 2)} km`);
  }
  s.applyPreset('lora-longfast');
  const before = s.result().maxRangeKm;
  s.setBudgetField('txPowerDbm', s['budget'].txPowerDbm + 6);
  const after = s.result().maxRangeKm;
  check('+6 dB of power doubles the range', Math.abs(after / before - 2) < 0.01, `${f(before, 1)} → ${f(after, 1)} km`);
  s.destroy();
}

// ─────────────────────────────── antenna array
{
  const s: any = new AntennaArrayScene({ canvasId: 'x' });
  s.setSpacing(0.5); s.setSteer(0); s.setTaper('uniform');
  for (const n of [2, 4, 8, 16]) {
    s.setElements(n);
    const d = s.stats.directivityDbi;
    check(`directivity of N=${n} at d=λ/2 is 10log₁₀(N)`, Math.abs(d - 10 * Math.log10(n)) < 0.02,
      `${f(d, 3)} dBi vs ${f(10 * Math.log10(n), 3)}`);
  }
  s.setElements(8);
  const hpbw8 = s.stats.hpbwDeg;
  s.setElements(16);
  const hpbw16 = s.stats.hpbwDeg;
  check('doubling the aperture halves the beamwidth', Math.abs(hpbw8 / hpbw16 - 2) < 0.06, `${f(hpbw8, 2)}° → ${f(hpbw16, 2)}°`);

  s.setElements(8); s.setTaper('uniform');
  const sllUniform = s.stats.sidelobeDb;
  const hpbwUniform = s.stats.hpbwDeg;
  s.setTaper('hamming');
  check('uniform sidelobe level ≈ −13 dB', Math.abs(sllUniform + 13.2) < 0.6, `${f(sllUniform, 2)} dB`);
  check('tapering buys sidelobes and pays in beamwidth',
    s.stats.sidelobeDb < sllUniform - 15 && s.stats.hpbwDeg > hpbwUniform,
    `SLL ${f(sllUniform, 1)} → ${f(s.stats.sidelobeDb, 1)} dB, HPBW ${f(hpbwUniform, 1)}° → ${f(s.stats.hpbwDeg, 1)}°`);

  // the 1/cos θ₀ broadening law is itself an approximation and degrades near
  // endfire, so it is checked at 45° where it is meant to hold
  s.setTaper('uniform'); s.setSteer(45);
  check('steering broadens the beam by 1/cos θ₀ (at 45°)',
    Math.abs(s.stats.hpbwDeg / hpbwUniform - Math.SQRT2) < 0.08,
    `${f(hpbwUniform, 1)}° → ${f(s.stats.hpbwDeg, 1)}° (expected ×${f(Math.SQRT2, 3)})`);
  s.setSteer(60);
  check('steering past 45° broadens it further still', s.stats.hpbwDeg > hpbwUniform * Math.SQRT2,
    `60° gives ${f(s.stats.hpbwDeg, 1)}°`);

  s.setSteer(0); s.setSpacing(0.5);
  check('no grating lobe at d = λ/2 broadside', !s.stats.gratingLobe, 'flag false');
  s.setSpacing(1.0);
  check('grating lobe flagged at d = λ', s.stats.gratingLobe, 'flag true');
  s.destroy();
}

// ─────────────────────────────── Fresnel scene
{
  const s: any = new FresnelScene({ canvasId: 'x' });
  s.setFrequency(923); s.setLinkKm(12); s.setTxHeight(30); s.setRxHeight(30);
  s.setObstacleFraction(0.5); s.setEarthCurvature(false);
  s.setObstacleHeight(30); // exactly on the line of sight
  let g = s.geometry();
  check('obstacle on the LOS costs 6 dB', Math.abs(g.diff - 6.02) < 0.1, `h = ${f(g.h, 2)} m → ${f(g.diff, 2)} dB`);

  s.setObstacleHeight(30 - 0.6 * g.radius);
  g = s.geometry();
  check('60 % clearance is essentially free', g.diff < 0.6, `clearance ${(g.clearanceRatio * 100).toFixed(0)}% → ${f(g.diff, 2)} dB`);

  s.setObstacleHeight(0);
  s.setEarthCurvature(true);
  s.setLinkKm(50);
  g = s.geometry();
  check('earth bulge at mid-span of a 50 km link ≈ 37 m', Math.abs(g.bulge - 36.76) < 0.5, `${f(g.bulge, 2)} m`);

  s.setLinkKm(12); s.setObstacleHeight(80); s.setTxHeight(10); s.setRxHeight(10);
  s.solveForClearance();
  check('solveForClearance reaches the 60 % rule', s.geometry().clearanceRatio >= 0.6,
    `tower raised to ${f(s['txHeightM'], 0)} m, clearance ${(s.geometry().clearanceRatio * 100).toFixed(0)}%`);
  s.destroy();
}

// ─────────────────────────────── multipath
{
  const s: any = new MultipathScene({ canvasId: 'x', statsCanvasId: 'y' });
  s.setFrequency(923);

  // no scatterers, LOS only: power must fall off monotonically. Comparing
  // peak to trough would just measure 1/L² path loss across the track, which
  // is not fading at all — the signature of fading is *ripple*.
  s.setScatterers(0); s.setLineOfSight(true);
  {
    let monotonic = true;
    for (let i = 1; i < s.track.length; i++) {
      if (s.track[i] > s.track[i - 1] * 1.0001) { monotonic = false; break; }
    }
    check('free space has no ripple, only path loss', monotonic, 'power decays monotonically along the track');
  }

  // one scatterer: a clean standing-wave ripple appears
  s.setScatterers(1);
  check('one reflection is enough to create fades', s.stats.deepestFadeDb < -4, `deepest ${f(s.stats.deepestFadeDb, 1)} dB`);

  // many scatterers, no LOS: the envelope should be Rayleigh.
  // For unit mean power, E[r] = √π/2 ≈ 0.8862 and E[r²] = 1.
  s.setScatterers(24); s.setLineOfSight(false);
  {
    let sumR = 0, sumR2 = 0;
    const n = s.track.length;
    const norm = Math.sqrt(s.meanPower);
    for (const p of s.track) {
      const r = Math.sqrt(p) / norm;
      sumR += r; sumR2 += r * r;
    }
    const meanR = sumR / n;
    const meanR2 = sumR2 / n;
    check('NLOS envelope mean matches Rayleigh √π/2', Math.abs(meanR - Math.sqrt(Math.PI) / 2) < 0.06,
      `E[r] = ${f(meanR, 4)} vs ${f(Math.sqrt(Math.PI) / 2, 4)}`);
    check('NLOS envelope second moment is 1 by construction', Math.abs(meanR2 - 1) < 1e-9, `E[r²] = ${f(meanR2, 6)}`);
  }

  // a dominant direct ray shallows the fades — that is what K measures
  s.setScatterers(12); s.setLineOfSight(true);
  s.setKFactor(-6);
  const lowK = s.stats.deepestFadeDb;
  s.setKFactor(20);
  check('a strong direct ray shallows the fades', s.stats.deepestFadeDb > lowK + 10,
    `K = −6 dB: ${f(lowK, 1)} dB → K = 20 dB: ${f(s.stats.deepestFadeDb, 1)} dB`);
  s.setKFactor(6);

  // fades repeat every half wavelength
  check('coherence distance is λ/2', Math.abs(s.stats.coherenceDistanceCm - wavelengthM(923) * 50) < 1e-6,
    `${f(s.stats.coherenceDistanceCm, 2)} cm`);
  // Doppler: 100 km/h at 923 MHz ≈ 85 Hz
  s.setSpeed(100);
  check('Doppler at 100 km/h, 923 MHz ≈ 85 Hz', Math.abs(s.stats.maxDopplerHz - 85.5) < 1.5, `${f(s.stats.maxDopplerHz, 1)} Hz`);
  s.destroy();
}

// ─────────────────────────────── Shannon
{
  const s: any = new ShannonScene({ canvasId: 'x' });
  for (const p of RADIO_PRESETS) {
    const c = shannonCapacity(p.bandwidthHz, dbToLinear(p.snrDb));
    check(`${p.id} runs below its own Shannon limit`, p.actualBitrate < c,
      `${(p.actualBitrate / 1000).toFixed(1)} kbps of ${(c / 1000).toFixed(1)} kbps (${((p.actualBitrate / c) * 100).toFixed(0)}%)`);
  }
  const lora = RADIO_PRESETS[0];
  const cLora = shannonCapacity(lora.bandwidthHz, dbToLinear(lora.snrDb));
  check('capacity stays positive below the noise floor', cLora > 0 && lora.snrDb < 0,
    `SNR ${lora.snrDb} dB → C = ${(cLora / 1000).toFixed(2)} kbps`);
  check('+3 dB of SNR adds ≈ 1 bit/s/Hz at high SNR',
    Math.abs((shannonCapacity(1, dbToLinear(33)) - shannonCapacity(1, dbToLinear(30))) - 1) < 0.02,
    `${f(shannonCapacity(1, dbToLinear(33)) - shannonCapacity(1, dbToLinear(30)), 4)} bit/s/Hz`);

  // C(B) must saturate at S/(N₀ ln2)
  s.applyPreset('lora-longfast');
  const n0 = dbToLinear(noiseFloorDbm(250_000, 6)) / 250_000;
  const sig = dbToLinear(noiseFloorDbm(250_000, 6) + (-17.5));
  const cInf = sig / (n0 * Math.LN2);
  const cHuge = shannonCapacity(1e12, sig / (n0 * 1e12));
  check('capacity saturates as bandwidth → ∞', Math.abs(cHuge / cInf - 1) < 0.01,
    `C(1 THz) = ${f(cHuge, 1)} vs C∞ = ${f(cInf, 1)} bit/s`);
  s.destroy();
}

// ─────────────────────────────── mesh
{
  const cfg = { nodeCount: 30, range: 26, hopLimit: 3, airtimeMs: 354, contentionWindowMs: 700 };
  const result = compareModes(cfg, 40, 4242);
  const by = (m: string) => result.find((r) => r.mode === m)!;

  check('every strategy terminates', result.every((r) => r.transmissions > 0), result.map((r) => r.transmissions.toFixed(1)).join(' / '));
  check('naive flooding transmits the most',
    by('naive').transmissions > by('counter').transmissions * 1.5,
    `naive ${by('naive').transmissions.toFixed(1)} vs counter ${by('counter').transmissions.toFixed(1)}`);
  check('naive flooding collides the most',
    by('naive').collisions > by('meshtastic').collisions * 2,
    `naive ${by('naive').collisions.toFixed(1)} vs meshtastic ${by('meshtastic').collisions.toFixed(1)}`);
  check('…and still delivers to fewer nodes than Meshtastic',
    by('naive').deliveryRatio < by('meshtastic').deliveryRatio,
    `naive ${(by('naive').deliveryRatio * 100).toFixed(1)}% vs meshtastic ${(by('meshtastic').deliveryRatio * 100).toFixed(1)}%`);
  check('SNR-ordered back-off beats plain random back-off',
    by('meshtastic').deliveryRatio > by('counter').deliveryRatio,
    `counter ${(by('counter').deliveryRatio * 100).toFixed(1)}% vs meshtastic ${(by('meshtastic').deliveryRatio * 100).toFixed(1)}%`);
  check('back-off + cancel cuts airtime versus dedupe alone',
    by('counter').airtimeMs < by('dedupe').airtimeMs * 0.7,
    `dedupe ${(by('dedupe').airtimeMs / 1000).toFixed(1)}s vs counter ${(by('counter').airtimeMs / 1000).toFixed(1)}s`);

  // a higher hop limit must reach further, and cost more airtime
  const h1 = compareModes({ ...cfg, hopLimit: 1 }, 15, 99).find((r) => r.mode === 'meshtastic')!;
  const h5 = compareModes({ ...cfg, hopLimit: 5 }, 15, 99).find((r) => r.mode === 'meshtastic')!;
  check('raising the hop limit trades airtime for coverage',
    h5.deliveryRatio > h1.deliveryRatio && h5.airtimeMs > h1.airtimeMs,
    `hop 1: ${(h1.deliveryRatio * 100).toFixed(0)}% / ${(h1.airtimeMs / 1000).toFixed(1)}s → hop 5: ${(h5.deliveryRatio * 100).toFixed(0)}% / ${(h5.airtimeMs / 1000).toFixed(1)}s`);

  // same seed, same answer
  const a = new MeshSim({ ...cfg, mode: 'meshtastic' }, 555).runToCompletion();
  const b = new MeshSim({ ...cfg, mode: 'meshtastic' }, 555).runToCompletion();
  check('simulation is deterministic for a given seed',
    a.reached === b.reached && a.transmissions === b.transmissions && a.collisions === b.collisions,
    `${a.reached}/${a.transmissions}/${a.collisions} twice`);

  // only the ratio of airtime to back-off window matters: scale both and the
  // outcome must not move. The page makes this claim, so it gets checked.
  const scaled = compareModes({ ...cfg, airtimeMs: 3540, contentionWindowMs: 7000 }, 40, 4242);
  const drift = Math.max(...scaled.map((r) =>
    Math.abs(r.deliveryRatio - by(r.mode).deliveryRatio)));
  check('scaling airtime and CW together changes nothing', drift < 0.02,
    `largest delivery-ratio drift ${(drift * 100).toFixed(2)} pp`);

  // widening the back-off window buys fewer collisions and costs latency
  const narrow = compareModes({ ...cfg, contentionWindowMs: 100 }, 25, 4242).find((r) => r.mode === 'meshtastic')!;
  const wide = compareModes({ ...cfg, contentionWindowMs: 2000 }, 25, 4242).find((r) => r.mode === 'meshtastic')!;
  check('a wider back-off window trades latency for collisions',
    wide.collisions < narrow.collisions && wide.completionMs > narrow.completionMs,
    `CW 100 ms: ${narrow.collisions.toFixed(1)} col / ${(narrow.completionMs / 1000).toFixed(2)}s → ` +
    `CW 2000 ms: ${wide.collisions.toFixed(1)} col / ${(wide.completionMs / 1000).toFixed(2)}s`);
}

// ─────────────────────────────── draw paths
console.log('\n— draw paths —');
let bad = 0;
const ok = (l: string, fn: () => void) => {
  try { fn(); console.log(`  ok   ${l}`); } catch (e) { bad++; console.log(` FAIL  ${l}: ${(e as Error).message}`); }
};

ok('InverseSquareScene.draw at both ends', () => {
  const s: any = new InverseSquareScene({ canvasId: 'x' });
  s.setDistance(1); s.draw(); s.setDistance(64); s.draw(); s.destroy();
});
ok('LinkBudgetScene.draw for every preset', () => {
  const s: any = new LinkBudgetScene({ canvasId: 'x' });
  for (const p of RADIO_PRESETS) { s.applyPreset(p.id); s.draw(); s.snapToMaxRange(); s.draw(); }
  s.setBudgetField('sensitivityDbm', -60); s.draw();
  s.destroy();
});
ok('AntennaArrayScene.draw across the parameter space', () => {
  const s: any = new AntennaArrayScene({ canvasId: 'x' });
  for (const n of [1, 3, 12, 24]) for (const d of [0.1, 0.5, 1.5]) {
    s.setElements(n); s.setSpacing(d); s.setSteer(-80); s.draw(); s.setSteer(80); s.draw();
  }
  s.destroy();
});
ok('FresnelScene.draw at extremes', () => {
  const s: any = new FresnelScene({ canvasId: 'x' });
  s.setObstacleHeight(0); s.draw();
  s.setObstacleHeight(400); s.draw();
  s.setLinkKm(60); s.setEarthCurvature(true); s.draw();
  s.setObstacleFraction(0.05); s.draw();
  s.setFrequency(50); s.draw();
  s.destroy();
});
ok('MultipathScene.draw with 0 and 24 scatterers', () => {
  const s: any = new MultipathScene({ canvasId: 'x', statsCanvasId: 'y' });
  s.setScatterers(0); s.draw(); s.chart.draw();
  s.setScatterers(24); s.setLineOfSight(false); s.draw(); s.chart.draw();
  s.setFrequency(6000); s.draw(); s.chart.draw();
  s.destroy();
});
ok('ShannonScene.draw for every preset', () => {
  const s: any = new ShannonScene({ canvasId: 'x' });
  for (const p of RADIO_PRESETS) { s.applyPreset(p.id); s.draw(); }
  s.setSnr(-30); s.draw(); s.setSnr(40); s.draw();
  s.setBandwidth(1e3); s.draw(); s.setBandwidth(1e9); s.draw();
  s.destroy();
});
ok('MeshScene.draw mid-flight and the comparison chart', () => {
  const s: any = new MeshScene({ canvasId: 'x', chartCanvasId: 'y' });
  s.draw();
  for (let i = 0; i < 400; i++) s.sim.step(5);
  s.draw();
  s.clearComparison(); s.chart.draw();
  s.runComparison(4); s.chart.draw();
  for (const m of MESH_MODES) { s.setMode(m.id); s.draw(); }
  s.destroy();
});


const SCENE_FACTORIES: [string, () => any][] = [
  ['InverseSquareScene', () => new InverseSquareScene({ canvasId: 'x' })],
  ['LinkBudgetScene', () => new LinkBudgetScene({ canvasId: 'x' })],
  ['AntennaArrayScene', () => new AntennaArrayScene({ canvasId: 'x' })],
  ['FresnelScene', () => new FresnelScene({ canvasId: 'x' })],
  ['MultipathScene', () => new MultipathScene({ canvasId: 'x', statsCanvasId: 'y' })],
  ['ShannonScene', () => new ShannonScene({ canvasId: 'x' })],
  ['MeshScene', () => new MeshScene({ canvasId: 'x', chartCanvasId: 'y' })],
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
  console.log('ALL CHECKS PASSED (rf scenes)');
  process.exit(0);
}
console.log(`${failures} numeric check(s) failed, ${bad} draw path(s) threw`);
process.exit(1);
