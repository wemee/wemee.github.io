// Test-only Taiwan national ID (中華民國身分證字號) generator.
//
// Produces checksum-valid IDs for exercising form validation. The numbers are
// algorithmically well-formed but are NOT tied to any real person.
//
// Format: 1 region letter + 1 gender digit + 7 random digits + 1 check digit.
// Validation: map the letter to two digits (n1, n2); then
//   n1*1 + n2*9 + d1*8 + d2*7 + d3*6 + d4*5 + d5*4 + d6*3 + d7*2 + d8*1 + check*1
// must be divisible by 10.

export type Gender = 'male' | 'female';

export interface GeneratedTwId {
  id: string;
  /** Region registration letter (A–Z). */
  region: string;
  /** Human-readable registration location. */
  regionName: string;
  gender: Gender;
}

// Letter → numeric value used by the checksum (the standard A=10 … Z=33 table,
// with the irregular I/O/W/X/Y/Z ordering baked in).
const LETTER_VALUE: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};

// Registration location for each region letter. A few are historical (the
// letter is still issued/seen even after administrative renaming).
export const REGION_NAMES: Record<string, string> = {
  A: '臺北市', B: '臺中市', C: '基隆市', D: '臺南市', E: '高雄市',
  F: '新北市', G: '宜蘭縣', H: '桃園市', I: '嘉義市', J: '新竹縣',
  K: '苗栗縣', L: '臺中縣', M: '南投縣', N: '彰化縣', O: '新竹市',
  P: '雲林縣', Q: '嘉義縣', R: '臺南縣', S: '高雄縣', T: '屏東縣',
  U: '花蓮縣', V: '臺東縣', W: '金門縣', X: '澎湖縣', Y: '陽明山',
  Z: '連江縣',
};

export const REGION_LETTERS = Object.keys(LETTER_VALUE);

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

/**
 * Compute the trailing check digit for the first 9 characters of an ID
 * (region letter + gender digit + 7 body digits). Returns a single digit.
 */
export function twIdCheckDigit(region: string, body: string): number {
  const value = LETTER_VALUE[region.toUpperCase()];
  if (value === undefined) throw new Error(`Invalid region letter: ${region}`);
  if (!/^\d{8}$/.test(body)) throw new Error(`Body must be 8 digits, got: ${body}`);

  const n1 = Math.floor(value / 10);
  const n2 = value % 10;
  let sum = n1 * 1 + n2 * 9;

  // body digits weighted 8,7,6,5,4,3,2,1
  for (let i = 0; i < 8; i++) {
    sum += (body.charCodeAt(i) - 48) * (8 - i);
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full 10-character Taiwan national ID. */
export function isValidTwId(id: string): boolean {
  if (!/^[A-Z][0-9]{9}$/.test(id)) return false;
  const region = id[0];
  const body = id.slice(1, 9);
  const check = id.charCodeAt(9) - 48;
  return twIdCheckDigit(region, body) === check;
}

interface GenerateOptions {
  gender?: Gender | 'random';
  region?: string | 'random';
}

export function generateTwId(opts: GenerateOptions = {}): GeneratedTwId {
  const region =
    opts.region && opts.region !== 'random' ? opts.region.toUpperCase() : pick(REGION_LETTERS);
  const gender: Gender =
    opts.gender && opts.gender !== 'random' ? opts.gender : pick(['male', 'female']);

  const genderDigit = gender === 'male' ? '1' : '2';
  let body = genderDigit;
  for (let i = 0; i < 7; i++) body += String(randInt(0, 9));

  const id = region + body + twIdCheckDigit(region, body);

  return { id, region, regionName: REGION_NAMES[region] ?? '未知', gender };
}

export function generateTwIds(count: number, opts: GenerateOptions = {}): GeneratedTwId[] {
  return Array.from({ length: count }, () => generateTwId(opts));
}
