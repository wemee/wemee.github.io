export interface EigenPreset {
  id: string;
  label: string;
  hint: string;
  matrix: number[][]; // 3×3 symmetric
}

export const EIGEN_PRESETS: EigenPreset[] = [
  {
    id: 'identity',
    label: '單位矩陣',
    hint: 'A = I — 每個向量都是特徵向量，特徵值都是 1。沒有「特殊方向」。',
    matrix: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'axisStretch',
    label: '沿軸拉伸',
    hint: 'A = diag(3, 1, 0.5) — 對角矩陣的特徵向量就是 X/Y/Z 軸，特徵值就是對角項。',
    matrix: [
      [3, 0, 0],
      [0, 1, 0],
      [0, 0, 0.5],
    ],
  },
  {
    id: 'tiltedStretch',
    label: '傾斜拉伸',
    hint: '把拉伸軸轉 30°，特徵向量也跟著轉。注意特徵值還是同樣那組，但方向不再是 X/Y 軸。',
    matrix: [
      [2.5, 0.866, 0],
      [0.866, 1.5, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'covariance',
    label: '類 covariance',
    hint: '正定矩陣（所有 λ > 0）。PCA 把資料的 covariance 矩陣丟給這算式，找出主成分。',
    matrix: [
      [4, 1, 0.5],
      [1, 2, 0.3],
      [0.5, 0.3, 1],
    ],
  },
  {
    id: 'mixedSign',
    label: '有正有負',
    hint: '有一個負特徵值 — 沿那個方向，矩陣把向量「翻過來」。',
    matrix: [
      [2, 0, 0],
      [0, -1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'singular',
    label: '退化 (det = 0)',
    hint: '有一個 λ = 0，代表這個矩陣把該方向「壓扁」。Rank 2，不可逆。',
    matrix: [
      [2, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
];
