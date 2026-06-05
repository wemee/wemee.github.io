// Test-only credit card number generator.
//
// Produces Luhn-valid numbers in real-looking brand formats so engineers can
// exercise form validation, masking, and brand-detection logic. These are NOT
// real accounts — they pass the checksum but are not issued by any bank.

export type CardBrand = 'visa' | 'mastercard' | 'jcb' | 'amex';

export interface GeneratedCard {
  brand: CardBrand;
  /** Raw digits, no separators. */
  number: string;
  /** Digits grouped for display (e.g. "4111 1111 1111 1111"). */
  numberSpaced: string;
  cvv: string;
  /** Two-digit month, "01"–"12". */
  expMonth: string;
  /** Four-digit year. */
  expYear: string;
  /** "MM/YY" convenience form. */
  expShort: string;
}

interface BrandConfig {
  label: string;
  prefixes: string[];
  length: number;
  cvvLength: number;
  /** Group sizes for display formatting. */
  groups: number[];
}

export const CARD_BRANDS: Record<CardBrand, BrandConfig> = {
  visa: { label: 'Visa', prefixes: ['4'], length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
  mastercard: {
    label: 'Mastercard',
    prefixes: ['51', '52', '53', '54', '55'],
    length: 16,
    cvvLength: 3,
    groups: [4, 4, 4, 4],
  },
  jcb: { label: 'JCB', prefixes: ['3528', '3538', '3548', '3558', '3568'], length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
  amex: { label: 'American Express', prefixes: ['34', '37'], length: 15, cvvLength: 4, groups: [4, 6, 5] },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function randomDigits(count: number): string {
  let out = '';
  for (let i = 0; i < count; i++) out += String(randInt(0, 9));
  return out;
}

/**
 * Compute the Luhn check digit for a numeric payload (the number without its
 * final check digit). Returns a single digit as a string.
 */
export function luhnCheckDigit(payload: string): string {
  let sum = 0;
  // The check digit will sit one position to the right of `payload`'s last
  // char, so doubling starts on `payload`'s rightmost digit.
  let shouldDouble = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let n = payload.charCodeAt(i) - 48;
    if (shouldDouble) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    shouldDouble = !shouldDouble;
  }
  return String((10 - (sum % 10)) % 10);
}

/** True when `number` (including its trailing check digit) passes Luhn. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false;
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1);
}

function group(number: string, groups: number[]): string {
  const parts: string[] = [];
  let i = 0;
  for (const size of groups) {
    parts.push(number.slice(i, i + size));
    i += size;
  }
  // Trailing digits beyond the defined groups (defensive; shouldn't happen).
  if (i < number.length) parts.push(number.slice(i));
  return parts.join(' ');
}

export function generateCard(brand: CardBrand): GeneratedCard {
  const cfg = CARD_BRANDS[brand];
  const prefix = pick(cfg.prefixes);
  const payload = prefix + randomDigits(cfg.length - 1 - prefix.length);
  const number = payload + luhnCheckDigit(payload);

  const now = new Date();
  const expMonth = String(randInt(1, 12)).padStart(2, '0');
  const expYear = String(now.getFullYear() + randInt(1, 5));

  return {
    brand,
    number,
    numberSpaced: group(number, cfg.groups),
    cvv: randomDigits(cfg.cvvLength),
    expMonth,
    expYear,
    expShort: `${expMonth}/${expYear.slice(-2)}`,
  };
}

const ALL_BRANDS: CardBrand[] = ['visa', 'mastercard', 'jcb', 'amex'];

/**
 * Generate `count` cards. Pass a specific brand, or "random" to vary the brand
 * per card.
 */
export function generateCards(brand: CardBrand | 'random', count: number): GeneratedCard[] {
  return Array.from({ length: count }, () =>
    generateCard(brand === 'random' ? pick(ALL_BRANDS) : brand)
  );
}
