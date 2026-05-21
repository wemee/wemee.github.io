export interface BasisPreset {
  id: string;
  label: string;
  hint: string;
  basis: number[][]; // 3×3
}

const c30 = Math.cos(Math.PI / 6);
const s30 = Math.sin(Math.PI / 6);
const c45 = Math.cos(Math.PI / 4);
const s45 = Math.sin(Math.PI / 4);
const inv2sqrt2 = 1 / Math.sqrt(2);

export const BASIS_PRESETS: BasisPreset[] = [
  {
    id: 'standard',
    label: '標準基底',
    hint: 'B = I — 新基底跟標準完全一樣，座標不變。',
    basis: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'rotZ30',
    label: '繞 Z 旋轉 30°',
    hint: '正交基底 — B⁻¹ = Bᵀ。在 X-Y 平面內把基底逆時針轉 30°。',
    basis: [
      [c30, -s30, 0],
      [s30, c30, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'rotZ45',
    label: '繞 Z 旋轉 45°',
    hint: '正交基底。看新基底下的座標怎麼變 — 同一個向量，數字不同。',
    basis: [
      [c45, -s45, 0],
      [s45, c45, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'tiltedOrtho',
    label: '對角正交基底',
    hint: '把 b₁ 拉成 (1,1,0)/√2，b₂ 拉成 (-1,1,0)/√2 — X-Y 平面內傾斜 45° 的正交基底。',
    basis: [
      [inv2sqrt2, -inv2sqrt2, 0],
      [inv2sqrt2, inv2sqrt2, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'shear',
    label: '剪切基底',
    hint: 'B 的欄向量不互相垂直 — 這是「斜的」基底。B⁻¹ ≠ Bᵀ。',
    basis: [
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'scaled',
    label: '縮放基底',
    hint: 'b₁ = (2,0,0), b₂ = (0,0.5,0) — 新基底「拉長 X、壓 Y」。座標會跟著倒過來縮放。',
    basis: [
      [2, 0, 0],
      [0, 0.5, 0],
      [0, 0, 1],
    ],
  },
  {
    id: 'singular',
    label: '退化（不可逆）',
    hint: 'b₃ = (1,1,0) 跟 b₁、b₂ 共平面 — det(B)=0，三個向量撐不起 3D 空間。',
    basis: [
      [1, 0, 1],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
];
