// 程式實驗室的「軌道 / 模組」中介資料。
// 軌道刻意泛用——可以是語言 (python) 也可以是技術 (web、git、llm…)。
// 課程本身放在 content collection (src/content/lab)，靠 track / module id 對應回這裡。

export interface LabModule {
  id: string;
  title: string;
  icon: string;
  description: string;
  /** colorMap 的 key，見 src/lib/lab.ts */
  color: string;
}

export interface LabTrack {
  id: string;
  title: string;
  icon: string;
  description: string;
  color: string;
  modules: LabModule[];
}

export const tracks: LabTrack[] = [
  {
    id: 'python',
    title: 'Python',
    icon: '🐍',
    description: '從資料視覺化到資料科學——用真正的 Python 環境動手學',
    color: 'info',
    modules: [
      {
        id: 'matplotlib',
        title: 'matplotlib 資料視覺化',
        icon: '📊',
        description: '從第一張圖到出版級圖表——畫線、配色、子圖、座標軸與中文字型',
        color: 'info',
      },
    ],
  },
  {
    id: 'ml',
    title: '機器學習',
    icon: '🤖',
    description: '用 scikit-learn 動手做監督式與非監督式學習——從第一個分類器到完整實戰流程',
    color: 'success',
    modules: [
      {
        id: 'scikit-learn',
        title: 'scikit-learn 入門',
        icon: '🧠',
        description: '統一的 fit/predict 節奏、分類與迴歸、Pipeline、模型評估、樹模型到端到端實戰',
        color: 'success',
      },
      {
        id: 'boosting',
        title: '梯度提升與集成學習',
        icon: '🌲',
        description: 'XGBoost、LightGBM、early stopping、調參與 SHAP 解釋——表格資料競賽的王者',
        color: 'success',
      },
      {
        id: 'pytorch',
        title: '深度學習入門（PyTorch）',
        icon: '🔥',
        description: '從 tensor、autograd 到 CNN、遷移學習與部署——親手搭神經網路，借 Colab 免費 GPU',
        color: 'success',
      },
    ],
  },
];

export const getTrack = (id: string): LabTrack | undefined =>
  tracks.find((t) => t.id === id);

export const getModule = (
  trackId: string,
  moduleId: string
): LabModule | undefined => getTrack(trackId)?.modules.find((m) => m.id === moduleId);
