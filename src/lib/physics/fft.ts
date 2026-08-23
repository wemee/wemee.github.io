/**
 * Minimal in-place radix-2 complex FFT.
 *
 * Written by hand rather than pulled from npm: the two pages that need it
 * (uncertainty, tunneling) use a single fixed power-of-two length, and a
 * general-purpose FFT package would ship far more than the ~60 lines below
 * into a bundle whose budget is measured in tens of kB.
 *
 * Convention: `re`/`im` are parallel Float64Arrays of length n (a power of 2)
 * and are transformed in place. `sign = -1` is the forward transform
 * (x → X, no scaling), `sign = +1` the inverse (scaled by 1/n by ifft()).
 * That matches the physics convention where the forward transform carries
 * e^{-ikx}, so k-space arrays come out in "standard order": index 0 is k = 0,
 * indices 1…n/2-1 are positive k, and n/2…n-1 are the negative ones.
 */

/** Bit-reversal permutation, applied in place. */
function bitReverse(re: Float64Array, im: Float64Array, n: number): void {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
}

function transform(re: Float64Array, im: Float64Array, sign: -1 | 1): void {
  const n = re.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of two, got ${n}`);
  }
  bitReverse(re, im, n);

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const ar = re[i + j];
        const ai = im[i + j];
        const br = re[i + j + half] * cr - im[i + j + half] * ci;
        const bi = re[i + j + half] * ci + im[i + j + half] * cr;
        re[i + j] = ar + br;
        im[i + j] = ai + bi;
        re[i + j + half] = ar - br;
        im[i + j + half] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Forward transform, in place, unscaled. */
export function fft(re: Float64Array, im: Float64Array): void {
  transform(re, im, -1);
}

/** Inverse transform, in place, scaled by 1/n. */
export function ifft(re: Float64Array, im: Float64Array): void {
  transform(re, im, 1);
  const n = re.length;
  const inv = 1 / n;
  for (let i = 0; i < n; i++) {
    re[i] *= inv;
    im[i] *= inv;
  }
}

/**
 * Angular wavenumbers for an n-point grid of spacing dx, in the same index
 * order the FFT produces: [0, 1, …, n/2-1, -n/2, …, -1] × 2π/(n·dx).
 */
export function fftFreqs(n: number, dx: number): Float64Array {
  const k = new Float64Array(n);
  const d = (2 * Math.PI) / (n * dx);
  for (let i = 0; i < n; i++) {
    k[i] = (i < n / 2 ? i : i - n) * d;
  }
  return k;
}

/**
 * Reorder an fft-order array so index 0 holds the most negative frequency and
 * the last index the most positive — i.e. what you want to plot on an axis.
 * Returns a new array; the input is untouched.
 */
export function fftShift(a: Float64Array): Float64Array {
  const n = a.length;
  const half = n >> 1;
  const out = new Float64Array(n);
  out.set(a.subarray(half), 0);
  out.set(a.subarray(0, half), n - half);
  return out;
}
