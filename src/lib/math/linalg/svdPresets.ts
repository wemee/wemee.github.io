export interface SVDPreset {
  id: string;
  label: string;
  hint: string;
  matrix: number[][]; // 3×3 (any matrix, doesn't have to be symmetric)
}

const c45 = Math.cos(Math.PI / 4);
const s45 = Math.sin(Math.PI / 4);

export const SVD_PRESETS: SVDPreset[] = [
  {
    id: 'identity',
    label: '單位矩陣',
    hint: 'A = I：U = V = I，σ = (1, 1, 1)。最簡單的情況。',
    matrix: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'axisStretch',
    label: '沿軸拉伸',
    hint: 'A = diag(3, 1.5, 0.5)：對角矩陣的奇異值就是對角項的絕對值，U 與 V 都是 I。',
    matrix: [
      [3, 0, 0],
      [0, 1.5, 0],
      [0, 0, 0.5],
    ],
  },
  {
    id: 'rotation',
    label: '旋轉 45°',
    hint: '純旋轉：σ = (1, 1, 1)。注意 U 跟 V 都不是 I，但 Σ 是。旋轉沒有「主軸」。',
    matrix: [
      [c45, -s45, 0],
      [s45, c45, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'rotateAndStretch',
    label: '旋轉 + 拉伸',
    hint: '先沿 X-Y 對角拉伸，再旋轉 — 一般的不對稱矩陣。U 跟 V 都不是 I。',
    matrix: [
      [2, 1, 0],
      [1, 1, 0],
      [0, 0, 0.8],
    ],
  },
  {
    id: 'shear',
    label: '剪切',
    hint: '剪切矩陣 — 跡 = 3 但 det = 1；SVD 揭露它把空間怎麼拉伸壓縮。',
    matrix: [
      [1, 2, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'rank2',
    label: 'Rank 2 (一個 σ = 0)',
    hint: '矩陣秩 2 — 第三個奇異值 = 0，代表它把 3D 空間壓到 2D 平面。',
    matrix: [
      [2, 1, 0],
      [1, 2, 0],
      [0, 0, 0],
    ],
  },
  {
    id: 'illConditioned',
    label: '條件數大',
    hint: 'σ_max 比 σ_min 大很多 — 數值上「近乎不可逆」，求逆會放大誤差。',
    matrix: [
      [10, 0, 0],
      [0, 1, 0],
      [0, 0, 0.01],
    ],
  },
];
