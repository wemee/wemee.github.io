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

/** Format a number for display, trimming -0 and excessive precision. */
export function formatNumber(n: number, precision = 2): string {
  if (Object.is(n, -0)) n = 0;
  if (Math.abs(n) < 1e-10) return "0";
  const fixed = n.toFixed(precision);
  return fixed.replace(/\.?0+$/, "") || "0";
}
