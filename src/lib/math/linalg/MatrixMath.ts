/**
 * Pure 4×4 matrix math — no DOM, no Three.js dependency.
 * Row-major convention: M[row][col]. Translation lives in M[*][3].
 */

export type Matrix4 = number[][]; // 4×4, M[row][col]
export type Vector3 = [number, number, number];
export type Vector4 = [number, number, number, number];

export function identity4(): Matrix4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

export function cloneMatrix4(m: Matrix4): Matrix4 {
  return m.map((row) => [...row]);
}

/** Multiply M · v (column-vector convention). */
export function applyMatrix4ToVec4(m: Matrix4, v: Vector4): Vector4 {
  const [x, y, z, w] = v;
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3] * w,
    m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3] * w,
    m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3] * w,
    m[3][0] * x + m[3][1] * y + m[3][2] * z + m[3][3] * w,
  ];
}

/** Transform a point [x,y,z] with implicit w=1, returning the 3-vector after perspective divide. */
export function transformPoint(m: Matrix4, p: Vector3): Vector3 {
  const [rx, ry, rz, rw] = applyMatrix4ToVec4(m, [p[0], p[1], p[2], 1]);
  const w = rw === 0 ? 1 : rw;
  return [rx / w, ry / w, rz / w];
}

/** Multiply two 4×4 matrices: A · B (column-vector convention). */
export function multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
  const out: Matrix4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[i][k] * b[k][j];
      out[i][j] = sum;
    }
  }
  return out;
}

/** Determinant of a 3×3 matrix. */
export function determinant3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/** Inverse of a 3×3 matrix. Returns null if singular. */
export function inverse3(m: number[][]): number[][] | null {
  const det = determinant3(m);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * inv,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * inv,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * inv,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * inv,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * inv,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * inv,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * inv,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * inv,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * inv,
    ],
  ];
}

/** Multiply a 3×3 matrix by a 3-vector. */
export function applyMatrix3ToVec3(m: number[][], v: Vector3): Vector3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** Determinant of 4×4 via cofactor expansion along the first row. */
export function determinant4(m: Matrix4): number {
  const det3 = (a: number[][]): number =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);

  const minor = (skipCol: number): number[][] => {
    const rows: number[][] = [];
    for (let r = 1; r < 4; r++) {
      const row: number[] = [];
      for (let c = 0; c < 4; c++) {
        if (c !== skipCol) row.push(m[r][c]);
      }
      rows.push(row);
    }
    return rows;
  };

  return (
    m[0][0] * det3(minor(0)) -
    m[0][1] * det3(minor(1)) +
    m[0][2] * det3(minor(2)) -
    m[0][3] * det3(minor(3))
  );
}

export interface EigenResult3 {
  eigenvalues: [number, number, number];
  /** Columns are eigenvectors corresponding to eigenvalues. */
  eigenvectors: number[][]; // 3×3
  converged: boolean;
  sweeps: number;
}

/**
 * Eigendecomposition of a 3×3 symmetric matrix via classical Jacobi rotation.
 * Eigenvalues sorted in descending order; eigenvector columns reordered to match.
 * Input must be symmetric; non-symmetric input is symmetrized via (A + Aᵀ)/2.
 */
export function jacobiEigenSymmetric3(a: number[][], maxSweeps = 50, tol = 1e-10): EigenResult3 {
  const A: number[][] = [
    [a[0][0], (a[0][1] + a[1][0]) / 2, (a[0][2] + a[2][0]) / 2],
    [(a[1][0] + a[0][1]) / 2, a[1][1], (a[1][2] + a[2][1]) / 2],
    [(a[2][0] + a[0][2]) / 2, (a[2][1] + a[1][2]) / 2, a[2][2]],
  ];
  const V: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  let converged = false;
  let sweep = 0;
  for (sweep = 0; sweep < maxSweeps; sweep++) {
    // Find largest off-diagonal magnitude
    let p = 0;
    let q = 1;
    let maxOff = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > maxOff) { p = 0; q = 2; maxOff = Math.abs(A[0][2]); }
    if (Math.abs(A[1][2]) > maxOff) { p = 1; q = 2; maxOff = Math.abs(A[1][2]); }

    if (maxOff < tol) {
      converged = true;
      break;
    }

    // Rotation angle to zero A[p][q]
    let theta: number;
    if (Math.abs(A[p][p] - A[q][q]) < 1e-14) {
      theta = Math.PI / 4 * Math.sign(A[p][q] || 1);
    } else {
      theta = 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);
    }
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Apply A' = Rᵀ A R
    const App = c * c * A[p][p] + 2 * c * s * A[p][q] + s * s * A[q][q];
    const Aqq = s * s * A[p][p] - 2 * c * s * A[p][q] + c * c * A[q][q];
    A[p][p] = App;
    A[q][q] = Aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < 3; i++) {
      if (i !== p && i !== q) {
        const Aip = A[i][p];
        const Aiq = A[i][q];
        A[i][p] = c * Aip + s * Aiq;
        A[p][i] = A[i][p];
        A[i][q] = -s * Aip + c * Aiq;
        A[q][i] = A[i][q];
      }
    }

    // Update V: V = V·R
    for (let i = 0; i < 3; i++) {
      const Vip = V[i][p];
      const Viq = V[i][q];
      V[i][p] = c * Vip + s * Viq;
      V[i][q] = -s * Vip + c * Viq;
    }
  }

  const eigenvalues: [number, number, number] = [A[0][0], A[1][1], A[2][2]];

  // Sort eigenvalues descending; permute eigenvector columns to match.
  const indices = [0, 1, 2].sort((i, j) => eigenvalues[j] - eigenvalues[i]);
  const sortedVals: [number, number, number] = [
    eigenvalues[indices[0]],
    eigenvalues[indices[1]],
    eigenvalues[indices[2]],
  ];
  const sortedVecs: number[][] = [
    [V[0][indices[0]], V[0][indices[1]], V[0][indices[2]]],
    [V[1][indices[0]], V[1][indices[1]], V[1][indices[2]]],
    [V[2][indices[0]], V[2][indices[1]], V[2][indices[2]]],
  ];

  return {
    eigenvalues: sortedVals,
    eigenvectors: sortedVecs,
    converged,
    sweeps: sweep,
  };
}

/** Format a number for display, trimming -0 and excessive precision. */
export function formatNumber(n: number, precision = 2): string {
  if (Object.is(n, -0)) n = 0;
  if (Math.abs(n) < 1e-10) return "0";
  const fixed = n.toFixed(precision);
  return fixed.replace(/\.?0+$/, "") || "0";
}
