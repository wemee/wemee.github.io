/**
 * Shared radio-propagation maths for the /physics/rf/ subsection.
 *
 * Everything here is pure and unit-explicit, because the whole subsection
 * hinges on numbers a reader can check against a datasheet. Getting the
 * constant in the FSPL formula wrong, or silently mixing MHz with Hz, would
 * make every page quietly lie. Frequencies are in MHz, distances in km unless
 * a name says otherwise, powers in dBm and gains in dBi.
 */

export const SPEED_OF_LIGHT = 299_792_458; // m/s
/** Boltzmann constant, J/K — for the thermal-noise floor. */
export const BOLTZMANN = 1.380649e-23;
export const T0_KELVIN = 290;

/** Wavelength in metres for a frequency in MHz. */
export function wavelengthM(freqMHz: number): number {
  return SPEED_OF_LIGHT / (freqMHz * 1e6);
}

/**
 * Free-space path loss in dB.
 *
 *   FSPL = 20log₁₀(d_km) + 20log₁₀(f_MHz) + 32.44
 *
 * The 32.44 is not magic: it is 20log₁₀(4π·10⁹/c) with d in km and f in MHz.
 * Returns 0 for non-positive distance rather than −∞, so a slider at zero
 * cannot poison the whole budget.
 */
export function fsplDb(distanceKm: number, freqMHz: number): number {
  if (distanceKm <= 0 || freqMHz <= 0) return 0;
  return 20 * Math.log10(distanceKm) + 20 * Math.log10(freqMHz) + 32.44;
}

/** Distance (km) at which FSPL reaches a given budget — the inverse of fsplDb. */
export function rangeKmForLoss(lossDb: number, freqMHz: number): number {
  if (freqMHz <= 0) return 0;
  return Math.pow(10, (lossDb - 20 * Math.log10(freqMHz) - 32.44) / 20);
}

export interface LinkBudget {
  txPowerDbm: number;
  txGainDbi: number;
  txLossDb: number;
  rxGainDbi: number;
  rxLossDb: number;
  sensitivityDbm: number;
}

export interface LinkResult {
  fsplDb: number;
  /** everything except the path loss — the budget the path is allowed to eat */
  eirpDbm: number;
  rxPowerDbm: number;
  marginDb: number;
  /** distance at which the margin hits zero, km */
  maxRangeKm: number;
}

export function solveLink(b: LinkBudget, distanceKm: number, freqMHz: number): LinkResult {
  const loss = fsplDb(distanceKm, freqMHz);
  const eirp = b.txPowerDbm + b.txGainDbi - b.txLossDb;
  const rx = eirp - loss + b.rxGainDbi - b.rxLossDb;
  const allowedLoss = eirp + b.rxGainDbi - b.rxLossDb - b.sensitivityDbm;
  return {
    fsplDb: loss,
    eirpDbm: eirp,
    rxPowerDbm: rx,
    marginDb: rx - b.sensitivityDbm,
    maxRangeKm: rangeKmForLoss(allowedLoss, freqMHz),
  };
}

/**
 * Radius of the first Fresnel zone at a point d1 from one end of a link of
 * total length d = d1 + d2, in metres. All distances in metres.
 */
export function fresnelRadiusM(d1M: number, d2M: number, freqMHz: number): number {
  const total = d1M + d2M;
  if (total <= 0) return 0;
  return Math.sqrt((wavelengthM(freqMHz) * d1M * d2M) / total);
}

/**
 * Dimensionless Fresnel–Kirchhoff diffraction parameter ν for a knife edge of
 * height h (metres) above the line of sight.
 */
export function fresnelParameter(hM: number, d1M: number, d2M: number, freqMHz: number): number {
  if (d1M <= 0 || d2M <= 0) return 0;
  const lambda = wavelengthM(freqMHz);
  return hM * Math.sqrt((2 * (d1M + d2M)) / (lambda * d1M * d2M));
}

/**
 * Knife-edge diffraction loss in dB, ITU-R P.526 approximation.
 * Valid for ν > −0.7; below that the obstruction is clear enough that the
 * recommendation gives 0 dB.
 */
export function knifeEdgeLossDb(v: number): number {
  if (v <= -0.7) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

/** Shannon–Hartley capacity in bits/s. `snr` is a linear power ratio. */
export function shannonCapacity(bandwidthHz: number, snrLinear: number): number {
  if (bandwidthHz <= 0 || snrLinear <= 0) return 0;
  return bandwidthHz * Math.log2(1 + snrLinear);
}

export const dbToLinear = (db: number) => Math.pow(10, db / 10);
export const linearToDb = (x: number) => 10 * Math.log10(x);

/** Thermal noise floor in dBm for a given bandwidth at 290 K. */
export function noiseFloorDbm(bandwidthHz: number, noiseFigureDb = 0): number {
  if (bandwidthHz <= 0) return -Infinity;
  return 10 * Math.log10(BOLTZMANN * T0_KELVIN * bandwidthHz * 1000) + noiseFigureDb;
}

export interface RadioPreset {
  id: string;
  name: string;
  blurb: string;
  freqMHz: number;
  bandwidthHz: number;
  budget: LinkBudget;
  /** the rate the system actually achieves, bits/s — compared against Shannon */
  actualBitrate: number;
  /** typical operating SNR in dB; LoRa's is famously negative */
  snrDb: number;
}

/**
 * Real systems, with numbers taken from their datasheets/standards rather than
 * invented. They are what makes the Shannon page land: LoRa runs *below the
 * noise floor* and still closes the link, and the capacity formula says that
 * is allowed.
 */
export const RADIO_PRESETS: RadioPreset[] = [
  {
    id: 'lora-longfast',
    name: 'LoRa · Meshtastic LongFast',
    blurb: 'SF11 / 250 kHz。用速率換距離：在雜訊底下數 dB 仍然解得出來。',
    freqMHz: 923,
    bandwidthHz: 250_000,
    // sensitivity is not a wish: −174 dBm/Hz + 10log₁₀(250 kHz) + 6 dB NF
    // + SF11's −17.5 dB demodulation floor = −131.5 dBm
    budget: { txPowerDbm: 20, txGainDbi: 2, txLossDb: 0.5, rxGainDbi: 2, rxLossDb: 0.5, sensitivityDbm: -132 },
    // SF11 × 250 kHz / 2¹¹ × 4/5 = 1074 bps
    actualBitrate: 1074,
    snrDb: -17.5,
  },
  {
    id: 'wifi',
    name: 'Wi-Fi 2.4 GHz（802.11n）',
    blurb: '短距離、高速率。頻寬換來的容量，代價是路徑損耗與穿透力。',
    freqMHz: 2437,
    bandwidthHz: 20_000_000,
    budget: { txPowerDbm: 20, txGainDbi: 2, txLossDb: 1, rxGainDbi: 2, rxLossDb: 1, sensitivityDbm: -82 },
    actualBitrate: 65_000_000,
    snrDb: 25,
  },
  {
    id: 'lte',
    name: '4G LTE 上行（700 MHz）',
    blurb: '低頻穿透好、基地台天線增益高，所以手機用 23 dBm 就能連上數公里外。',
    freqMHz: 700,
    bandwidthHz: 10_000_000,
    budget: { txPowerDbm: 23, txGainDbi: 0, txLossDb: 0, rxGainDbi: 17, rxLossDb: 2, sensitivityDbm: -100 },
    actualBitrate: 25_000_000,
    snrDb: 12,
  },
  {
    id: 'vhf-voice',
    name: '業餘無線電 VHF 手持（145 MHz）',
    blurb: '波長 2 公尺，繞射能力最強 — 這也是為什麼它翻得過山稜線。',
    freqMHz: 145,
    bandwidthHz: 12_500,
    budget: { txPowerDbm: 37, txGainDbi: 0, txLossDb: 0, rxGainDbi: 2, rxLossDb: 0.5, sensitivityDbm: -119 },
    actualBitrate: 9600,
    snrDb: 10,
  },
];

export function getRadioPreset(id: string): RadioPreset {
  return RADIO_PRESETS.find((p) => p.id === id) ?? RADIO_PRESETS[0];
}

/** Deterministic PRNG — reproducible scatterer layouts and node placements. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nice engineering formatting for bits/s. */
export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(2)} kbps`;
  return `${bps.toFixed(0)} bps`;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  if (km >= 1000) return `${km.toFixed(0)} km`;
  if (km >= 1) return `${km.toFixed(2)} km`;
  return `${(km * 1000).toFixed(0)} m`;
}
