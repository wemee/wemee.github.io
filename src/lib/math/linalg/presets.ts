import type { Matrix4 } from "./MatrixMath";

export interface MatrixPreset {
  id: string;
  label: string; // Chinese display name
  hint: string;  // one-line teaching hint
  matrix: Matrix4;
}

const c45 = Math.cos(Math.PI / 4);
const s45 = Math.sin(Math.PI / 4);

export const PRESETS: MatrixPreset[] = [
  {
    id: "identity",
    label: "單位矩陣",
    hint: "什麼都不變 — 所有向量保持原樣，這是「不做事」的矩陣。",
    matrix: [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "translate",
    label: "平移",
    hint: "右邊一欄 (M03, M13, M23) 控制平移，把所有點往 (2, 1, 0) 移動。",
    matrix: [
      [1, 0, 0, 2],
      [0, 1, 0, 1],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "scale",
    label: "縮放",
    hint: "對角線控制各軸縮放。X 放大 2 倍、Y 壓成一半、Z 不變。",
    matrix: [
      [2, 0, 0, 0],
      [0, 0.5, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "rotateX",
    label: "繞 X 旋轉 45°",
    hint: "Y-Z 平面內旋轉，X 軸保持不變。注意 sin 與 cos 的符號位置。",
    matrix: [
      [1, 0, 0, 0],
      [0, c45, -s45, 0],
      [0, s45, c45, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "rotateY",
    label: "繞 Y 旋轉 45°",
    hint: "X-Z 平面內旋轉。注意 sin 的位置與 Rx 不同 — 這是右手座標系的慣例。",
    matrix: [
      [c45, 0, s45, 0],
      [0, 1, 0, 0],
      [-s45, 0, c45, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "rotateZ",
    label: "繞 Z 旋轉 45°",
    hint: "X-Y 平面內旋轉，最常用 — 圖學裡的 2D 旋轉就是這個的退化。",
    matrix: [
      [c45, -s45, 0, 0],
      [s45, c45, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "shear",
    label: "剪切",
    hint: "把 Y 拉斜成 X 方向 — M01 = 1 表示「Y 每多 1，X 就多 1」。",
    matrix: [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
  {
    id: "reflect",
    label: "鏡射 (YZ 平面)",
    hint: "對 YZ 平面鏡射 — X 變號。行列式變成 -1，代表「翻過去了」。",
    matrix: [
      [-1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
  },
];
