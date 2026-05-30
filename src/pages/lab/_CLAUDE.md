# 程式實驗室 `/lab` — 交接文件

給未來的 Claude session：這份文件說明 `/lab` 程式學習區的架構，讓你不用重新推導就能接續開發。

## 這是什麼

「教程入口 + 預覽」區。真正的動手教學在 **Google Colab**——每堂課對應一個 repo 裡的 `.ipynb`，網頁只放 TL;DR、預覽圖與一顆「Open in Colab」按鈕。

**核心設計：GitHub-backed Colab。** notebook 是 repo 裡的檔案（單一真相來源），Colab 透過 `colab.research.google.com/github/wemee/wemee.github.io/blob/main/notebooks/...` 直接從 GitHub 開檔。完全不經過任何人的 Google Drive，零 drift。

> ⚠️ **Colab badge 只有在 notebook 已 push 到 `main` 後才會通**（Colab 抓的是 GitHub `main` 上的檔）。在 feature branch 上的 notebook，badge（寫死指向 main）會 404。

## 資訊架構（4 層，泛用、不綁語言）

```
區段 Section   /lab/                          列出所有「軌道」
軌道 Track     /lab/python/                   可以是語言(python) 或技術(web、git、llm…)
模組 Module    /lab/python/matplotlib/        一門課
課程 Lesson    /lab/python/matplotlib/01-basics   單篇
```

## 檔案地圖

```
notebooks/                          ← 真相來源，commit 進 repo（不進 dist）
  .venv/                            ← 本機產預覽圖/執行 notebook 的 venv（已 gitignore）
  gen_previews.py                   ← 預覽圖產生腳本（每課一個函式；save() 吃 out_dir 支援多軌道）
  _nbgen.py                         ← notebook 產生器共用工具（build_notebook/md/code）
  gen_sklearn_1to4.py               ← 用 _nbgen 組裝 sklearn 01–04 的 .ipynb
  gen_sklearn_5to8.py               ← 同上，05–08
  python/matplotlib/
    01-basics.ipynb … 08-pandas-numpy.ipynb
  ml/scikit-learn/
    01-worldview.ipynb … 08-end-to-end.ipynb

src/content/lab/                    ← content collection（純 .md，frontmatter 驅動）
  python/matplotlib/
    01-basics.md … 08-pandas-numpy.md
  ml/scikit-learn/
    01-worldview.md … 08-end-to-end.md

src/data/labTracks.ts               ← 軌道/模組中介資料（title、icon、描述、color）
src/lib/lab.ts                      ← colabUrl/githubUrl 組裝、getLessons、colorMap

src/components/lab/
  ColabBadge.astro                  ← Open in Colab + GitHub 連結
  LessonCard.astro                  ← 課程卡（預覽縮圖 + 難度標籤）
  ModuleCard.astro / TrackCard.astro
  LabBreadcrumb.astro
  LabLessonLayout.astro             ← 課程頁版型（hero + 預覽 + badge + prose + 上/下課）

src/pages/lab/
  index.astro                       ← /lab/        列軌道（讀 labTracks）
  [track]/index.astro               ← 列模組
  [track]/[module]/index.astro      ← 列課程（getLessons）
  [track]/[module]/[lesson].astro   ← render 課程 .md

public/lab/python/matplotlib/       ← 預覽圖 webp（由 gen_previews.py 產出）
public/lab/ml/scikit-learn/         ← 同上
```

## 內容 schema（`src/content.config.ts` 的 `lab` collection）

```
title, description（TL;DR，同時餵 SEO 與卡片）,
track, module, order（模組內排序）,
notebook（相對 notebooks/ 的路徑）, preview（webp 路徑）,
difficulty（入門|進階|專題）, tags[], updated?, draft?
```

軌道/模組的 metadata 不放 frontmatter，集中在 `labTracks.ts`。課程靠 `track`/`module` id 對應回去。

## 如何擴充

### 新增一堂課（到既有模組）
1. 寫 notebook：`notebooks/<track>/<module>/<NN>-<slug>.ipynb`
   - markdown 與程式碼註解用**繁中**；圖**內**標籤用英文（中文字型在 matplotlib 06 才教）
   - 寫完用 venv 執行嵌入輸出（見下）
2. 在 `gen_previews.py` 加一個 `lesson_NN_slug()` 函式產預覽圖，跑一次
3. 寫內容頁：`src/content/lab/<track>/<module>/<NN>-<slug>.md`（frontmatter `order: NN`、`notebook:`、`preview:`）
4. build 驗證 → commit + **push 到 main**（Colab 才會通）

上/下一課導覽、模組頁卡片都會依 `order` 自動排，**不用手動改任何索引頁**。

### 新增一個模組
在 `labTracks.ts` 對應 track 的 `modules` 陣列加一筆 `{ id, title, icon, description, color }`，然後照上面新增課程。

### 新增一條軌道（例如 web / git / llm）
在 `labTracks.ts` 的 `tracks` 加一筆，附上 `modules`。骨架（路由、卡片、麵包屑）全部複用，零新檔案。記得到 `src/components/Navbar.astro` 的 `lab` 下拉加連結。

## 預覽圖產生流程（本機）

```bash
# venv 已建在 notebooks/.venv（matplotlib + nbconvert + ipykernel + pillow）
# 若不存在：uv venv notebooks/.venv --python 3.13
#          uv pip install --python notebooks/.venv/bin/python matplotlib nbconvert ipykernel pillow

# 產所有預覽圖
notebooks/.venv/bin/python notebooks/gen_previews.py

# 執行 notebook 嵌入輸出（GitHub 渲染用）。需先註冊一次 kernel：
# notebooks/.venv/bin/python -m ipykernel install --user --name wemee-lab
notebooks/.venv/bin/python -m jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.kernel_name=wemee-lab notebooks/<path>.ipynb
```

預覽圖規格：16:10、`FIGSIZE=(10.24,6.40)`、`DPI=110`、白底、webp。

## 慣例與決策

- **圖內文字語言（方案 A）**：matplotlib 01–05 圖內標籤用英文，讓 notebook 在 Colab 一鍵就能跑、不卡中文字型；說明文字與程式碼註解全繁中。中文字型設定留到第 06 課專門教，06 的預覽圖才用中文展示成果。
- **中文字型雷區**：`plt.style.context(...)` 會重設 rcParams（含字型），所以字型設定要放在 style context **裡面**，否則中文變豆腐。`axes.unicode_minus=False` 一定要設，否則負號也變方塊。`gen_previews.py` 的 `lesson_06` 是正確範例。
- **內文用純 `.md`**（不是 MDX）：站上沒裝 `@astrojs/mdx`，blog 也是純 md。結構（hero/badge/預覽）由 `LabLessonLayout` 從 frontmatter 渲染，body 只放散文。若日後課程要在內文嵌互動元件，再評估加 mdx。
- **prose 樣式**：`LabLessonLayout` 用 Tailwind Typography 的 `prose prose-invert` + 一串 `prose-*` 覆寫，對齊站台暗色系。程式碼區塊靠站台既有的 Shiki（勿在此設 `pre` 背景，會重蹈 blog 白塊 bug）。
- **部署**：push 到 `main` 自動觸發 GitHub Pages 部署。notebook 放 repo 根 `notebooks/`，不會進 dist。
- **動畫 notebook 不要嵌輸出**：`FuncAnimation` 的 `to_jshtml()` 會把每幀 base64 內嵌，一個 notebook 可膨脹到 ~16MB。動畫課改用 `nbconvert --clear-output --inplace` 清掉輸出再 commit（動畫本來就該在 Colab 跑才看得到）。靜態圖課才用 `--execute` 嵌入輸出。GIF/mp4 產物已 gitignore（`notebooks/**/*.gif`、`*.mp4`）。
- **多課用 builder 組 notebook，別手寫 JSON**：一次要產多個 notebook 時，別硬刻 `.ipynb` JSON（易錯、難 review）。用 `_nbgen.py` 的 `build_notebook([...cells], rel_path)`，每個 cell 用 `md("…")` / `code("…")` 描述，再跑 `nbconvert --execute --inplace` 嵌出輸出。sklearn 模組的 `gen_sklearn_1to4.py` / `5to8.py` 是範例。記得受 800 行寫檔上限約束，課程多時拆檔。
- **sklearn 在 venv**：`uv pip install --python notebooks/.venv/bin/python scikit-learn`（venv 由 uv 管，沒有 pip，別用 `python -m pip`）。執行 notebook 時 kernelspec 寫 `python3` 即可，不必指定 `wemee-lab`。

## 模組現況

全部 8 課/模組，皆已上線完整：

- **`python/matplotlib`**：01 入門 → 06 樣式與中文字型 → 07 動畫 → 08 與 pandas/numpy。
- **`ml/scikit-learn`**：世界觀 → 分類/決策邊界 → 迴歸 → Pipeline → 評估 → 非監督 → 樹模型 → 端到端實戰。
- **`ml/boosting`**：集成概念 → 梯度提升直覺 → XGBoost → early stopping → 調參 → LightGBM → SHAP → Kaggle 實戰。需 `xgboost`/`lightgbm`/`shap`。
- **`ml/pytorch`**：tensor/autograd → 神經網路 → 訓練迴圈 → CNN → 正則化 → GPU → 遷移學習 → 部署。需 `torch`/`torchvision`；用 MNIST/CIFAR/FashionMNIST（執行時下載到 `notebooks/**/data/`，已 gitignore）。
- **`llm/from-scratch`**（獨立 `llm` 軌道）：tokenization → 預測下一字 → 自注意力 → Transformer → 訓練 → KV cache → SFT → DPO。從零手刻迷你 GPT。共用素材在 `notebooks/_llm_shared.py`（唐詩語料 `CORPUS` + 模型原始碼 `GPT_SRC`，以字串注入各 notebook）。
- **`agent/from-scratch`**（獨立 `agent` 軌道）：什麼是 agent/載入 Qwen → tool calling 本質 → 手刻 ReAct 迴圈 → 多工具與路由 → 記憶與摘要 → RAG agent → 多代理(planner+executor) → 實戰專案+免費 API sidebar。**手刻為主、本地 Qwen 為主、零框架。** 共用素材在 `notebooks/_agent_shared.py`（`LOAD_SRC` Qwen 4-bit 載入 + `chat()` 助手、`KB_SRC` 台灣常識 RAG 知識庫、`INSTALL`，以字串注入各 notebook）。

  ⚠️ **這軌道的 notebook 要載 Qwen（transformers + bitsandbytes 4-bit，CUDA-only），本機 Mac 跑不動。** 比照動畫課用 `--clear-output` 提交、留到 **Colab T4** 執行；提交時不嵌輸出。產生器：`gen_agent_1to4.py` / `gen_agent_5to8.py`（用 `_nbgen` builder）。預覽圖在 `gen_previews.py` 的 `agent_01`…`agent_08`（概念圖，本機 matplotlib 產，用繁中；✓/✗ 在 Heiti TC 缺字，改用 √/×）。

- **`rl/from-scratch`**（獨立 `rl` 軌道，2026-05-30 建置）：RL 世界觀 → 手刻 Q-learning → 手刻 DQN →
  stable-baselines3 → 手刻策略梯度 REINFORCE → 獎勵塑形/wrappers → 自訂環境(CatchEnv) → 端到端訓練 PPO。
  **手刻為主 + 必要時用 SB3。** 共用素材 `notebooks/_rl_shared.py`、產生器 `gen_rl_1to4.py`/`gen_rl_5to8.py`。
  notebook **無輸出提交**，留 Colab 跑（裝 gymnasium/SB3 + 訓練）。**已上線**（feat 7598b2f）；owner Colab 驗證 02/03/08 皆成功。

curriculum 與每課重點見各 `.md` frontmatter 與 module 頁。**`agent` 軌道已上線**（commit 2018d00 推 main、線上部署）；owner 在 Colab T4 驗證 01/03/06 三課皆成功跑出輸出（涵蓋最易出包點：Qwen 載入、ReAct 格式、RAG+sentence-transformers），其餘五課同模式視為全軌道可跑。

## Road map — AI/ML 教學線（2026-05-29 與 owner 拍板）

教學弧線：**經典 ML → 深度學習 → 從零打造 LLM → AI Agent**。`ml` 軌道專注「模型訓練」主軸（M1–M3）；
LLM 與 Agent 因為夠大、性質不同，**各自獨立成軌道**。每模組做完整版（~8 課），比照 sklearn。
**M1–M3、`llm`、`agent` 四條軌道皆已建置完成（整條弧線到位）。`agent` 僅剩 Colab 執行驗證 + push 兩步。**

### `ml` 軌道（模型訓練主軸）— ✅ 全部完成
- **M1 `scikit-learn` 入門** — ✅ 已上線完整。
- **M2 `boosting` 梯度提升與集成學習** — ✅ 已上線。接續 M1 第 07 課（決策樹/隨機森林 bagging 已教過），
  主打 boosting：概念 → XGBoost → early stopping/調參 → LightGBM → SHAP → Kaggle 實戰。
- **M3 `pytorch` 深度學習入門** — ✅ 已上線。tensor/autograd → 神經網路 → 訓練迴圈 →
  CNN/MNIST → 正則化 → GPU → 遷移學習（CIFAR-10）→ 部署（save/load + ONNX/TF.js 概念）。

### `llm` 軌道（從零打造迷你 GPT，再對齊它）— ✅ 已上線
Karpathy「build GPT from scratch」路線：**不求強，求徹底理解內部機制**。模型刻意小（字元級、~30 萬參數），
Colab/MPS 幾分鐘跑完。tokenization → 預測下一字 → 自注意力 → Transformer → 訓練（唐詩語料）→
KV cache → SFT（單位數加法指令）→ DPO。
- **決策落地**：對齊（7–8）套在自刻的迷你 GPT 上；第 8 課實作走 DPO（RLHF/PPO 只講概念）。
- **實作要點**：共用素材在 `_llm_shared.py`；L6 的 KV-cache 模型 `block_size` 要 ≥ prompt+生成長度
  （位置嵌入用絕對位置，否則 index 越界）；以 greedy 解碼驗證 naive 與 cached 輸出逐字相同。

### `agent` 軌道（AI Agent）— ✅ 已建置（2026-05-30）
自刻的迷你 GPT 太弱、無法 tool calling，故本軌道用「真正能用的模型」。與 owner 拍板的取向：
**手刻為主（零框架，自寫 ReAct/路由/記憶/RAG）＋ 本地 Qwen 為主（零金鑰）。**
- **主線模型**：Colab 本地 **Qwen2.5-1.5B-Instruct**（4-bit `bitsandbytes` 跑免費 T4；想更強換 3B）。
- **選修「接軌真實世界」**（第 8 課 sidebar）：**Gemini 2.5 Flash 免費層**（1,500 req/天、免卡、function
  calling）或 **Groq**。各自申請 free key、用 secrets/env 帶入，**別寫死**。因一切走 `chat()` 抽象，換模型只改該函式。
- **8 課課綱**：① 什麼是 agent/載入 Qwen ② tool calling 本質 ③ 手刻 ReAct 迴圈 ④ 多工具與路由
  ⑤ 記憶與摘要 ⑥ RAG agent ⑦ 多代理(planner+executor，reflection 留 sidebar) ⑧ 實戰專案+免費 API。
- **L06 RAG 決策**：用內嵌台灣常識知識庫(`KB_SRC`，零下載、帶具體數字凸顯幻覺)＋ `sentence-transformers`
  多語 embedding ＋ 手刻 numpy 餘弦檢索。**未用唐詩語料**（詩不適合事實檢索）。
- **檔案**：內容頁 `src/content/lab/agent/from-scratch/0[1-8]-*.md`；notebook 產生器
  `notebooks/gen_agent_1to4.py`、`gen_agent_5to8.py`＋共用 `notebooks/_agent_shared.py`；
  預覽 `gen_previews.py` 的 `agent_01`…`agent_08`。軌道註冊在 `src/data/labTracks.ts`、navbar 已加連結。
- **上線狀態**：notebook 本機跑不動（CUDA-only），**無輸出提交**留 Colab T4 跑。已 push main（2018d00）、
  線上部署；owner 已在 Colab T4 驗證 01/03/06（最易出包點）皆成功。⚠️ 別從 Colab「儲存回 GitHub」——
  會嵌輸出、覆蓋無輸出版、與 `gen_agent_*.py` 產生 drift 且讓本機 main 落後。

### 免費資源研究結論（2026-05，已查證）
- Colab 免費 T4 = **15GB VRAM**；BitsAndBytes 4-bit 砍 ~75% VRAM，Qwen 0.5B–3B 都裝得下；Qwen 在 CJK/中文是開源最強。
- **Gemini 免費層** 支援 function calling、1,500 req/天、免信用卡、無到期；**Groq 免費層** 1,000 req/天、也支援 function calling。每人各自 key → 額度足夠教學。
- 故 LLM 軌道走「從零自刻」（非用現成模型）；Agent 軌道用本地 Qwen 或免費 API，皆可行。

## Road map — 第二階段：補完機器學習地圖（2026-05-30 與 owner 拍板）

第一階段弧線（經典 ML → 深度學習 → 從零 LLM → AI Agent）完成後，owner 決定**四條全做、依序完成**。
建置順序與理由如下，每條 8 課、比照既有模式（GitHub-backed Colab + `gen_*.py` + 預覽圖，零新基礎建設）。

**順序：RL → CV → 資料科學 → Diffusion**（owner 2026-05-30 確認）。
**進度:RL ✅ 已上線驗證(2026-05-30);下一個 → CV 電腦視覺。**
- RL 先：補齊 ML 第三支柱，且站上 `ml-training/`（stable-baselines3/gymnasium/GameCore/PyMiniRacer）現成，
  末課能訓練 agent 玩自家遊戲，綜效最大、趁 agent 脈絡尚熱。
- CV 次：接 `pytorch` 軌道往視覺深挖，預覽圖最好做。
- 資料科學三：當整個 lab 入門坡道，橋接 `matplotlib` → `sklearn`，做完深水區再鋪入口。
- Diffusion 壓軸：最進階、算力最吃緊、領域變最快，放最後最新鮮。

### 🎮 RL 強化學習軌道 — ✅ 已建置（2026-05-30）
取向比照其他軌道：**手刻為主 + 必要時用 SB3**。tabular 先手刻、深度 RL 用 stable-baselines3。
- **8 課課綱**：① RL 世界觀/CartPole ② 手刻 Q-learning（FrozenLake）③ Q-table → DQN（手刻簡版）
  ④ stable-baselines3 DQN/PPO + TensorBoard ⑤ 策略梯度：手刻 REINFORCE ⑥ 獎勵塑形 & gym wrappers
  ⑦ 自訂環境（CatchEnv 接水果）⑧ 端到端：訓練 PPO 玩接水果 + 上線思路（呼應 `ml-training/` 流程）。
- **L07/L08 自訂環境決策**：原規劃「把站上遊戲包成 env（接 `GameCore`/PyMiniRacer）」改為**純 Python 自刻
  CatchEnv（接水果）**——Colab 連 live JS 太脆弱（要 host 編譯後的 GameCore.js）。改用自成一體的小遊戲教
  `gym.Env` 五件套，L08 prose 再講真實版（PyMiniRacer 跑同份 JS + TF.js 匯出）銜接遊戲區。共用素材
  `_rl_shared.py`（`INSTALL_GYM`/`INSTALL_SB3`、`PLOT_SRC` 學習曲線、`CATCH_ENV_SRC`）；產生器
  `gen_rl_1to4.py`/`gen_rl_5to8.py`；預覽 `gen_previews.py` 的 `rl_01`…`rl_08`。
- **顏色**：軌道用 `primary`（blue，先前未被任何軌道用過）。軌道在 `labTracks.ts`、navbar 已加連結。
- **提交策略**：notebook 比照 agent 走**無輸出提交**（`build_notebook` 只寫 JSON 不執行，天生無輸出，
  免 clear-output）。CartPole/FrozenLake 純 CPU 也能跑，但裝 gymnasium/SB3 + 訓練在 Colab 最省事，故統一
  留 Colab 驗證。本機僅產預覽圖（matplotlib 已有，免裝 gymnasium）。
- **上線狀態**：**已上線**（feat 7598b2f push main、線上部署）；owner 在 Colab 驗證 **02/03/08** 三課皆成功
  （涵蓋最易出包點：gymnasium 介面、torch 手刻 DQN 訓練迴圈、SB3 安裝 + PPO 訓練），其餘五課同模式視為全軌道可跑。
  ⚠️ 同樣別從 Colab 存回 GitHub。
- **L03 教學增補**（commit 23be175，owner 回報曲線崩潰後加）：03-dqn 的 notebook + 內容頁都加了一段
  「曲線爬到頂又崩 = DQN 災難性遺忘,非 overfitting」sidebar（主因:replay buffer 被好回合洗掉失敗樣本、
  Q 值過度估計、訓練過頭沒早停),當第 04 課 SB3 的鉤子。這是很受用的教學點,CV/後續軌道遇到類似「反直覺
  但正確」的現象也值得這樣補。
- **預覽圖雷**：`⇄`(U+21C4) 與 emoji `🎮`(U+1F3AE) 在 Heiti TC 缺字 → 改用純文字；沿用既有 √/× 替代 ✓/✗。

### 📷 CV 電腦視覺軌道
假設已學 `pytorch`，直接做視覺專屬內容（避免與 pytorch 的 CNN 基礎重疊）。
- 課綱：① 影像即張量/torchvision transforms ② 手刻 CNN（CIFAR-10）③ 遷移學習（預訓練 ResNet 微調）
  ④ 資料增強 & 過擬合 ⑤ 物件偵測入門（YOLO 現成模型推論）⑥ 影像分割概念 + 預訓練模型 ⑦ Grad-CAM
  可解釋性（呼應 sklearn 的 SHAP）⑧ 端到端：自選資料集影像分類器 + 推論 demo。

### 📊 資料科學實戰軌道
入門坡道，橋接 `matplotlib` → `sklearn`，服務最廣受眾、門檻最低。
- 課綱：① 資料科學流程/載入真實公開資料 ② 資料清理（缺失/型別/離群）③ EDA（groupby/pivot/相關）
  ④ 視覺化說故事（接 matplotlib）⑤ 特徵工程 ⑥ 統計檢定/A-B test 直覺 ⑦ 分析 → sklearn baseline
  ⑧ 端到端：真實資料集從問題到結論完整報告。

### 🎨 Diffusion 生成式影像軌道
**手刻迷你版 + diffusers 實用**並行，沿用「功能爛沒關係、重在機制」哲學。
- 課綱：① 生成模型世界觀（VAE/GAN → diffusion）② 手刻 forward diffusion 加噪（MNIST）③ 手刻迷你
  U-Net 去噪生成 ④ 取樣 DDPM/DDIM ⑤ 文字條件 CLIP/text embedding（概念）⑥ diffusers 跑 SD text2img
  ⑦ img2img/inpainting/LoRA 概念 ⑧ 端到端：自製圖像生成小工具。
- 注意：手刻 MNIST 迷你版可本機/T4 跑；SD 推論 CUDA-only，比照 agent 走無輸出提交、留 Colab T4。

### 其他 backlog
- 新軌道：web（HTML/CSS/JS）、git 等。骨架全部複用，照「如何新增一條軌道」做。
- `/html-css-/` 是一個保留的舊網址轉址（被 iThome 文章外連），**勿刪**，與本區無關。
