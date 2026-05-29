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
  .venv/                            ← 本機產預覽圖用的 venv（已 gitignore）
  gen_previews.py                   ← 預覽圖產生腳本（每課一個函式）
  python/matplotlib/
    01-basics.ipynb … 06-style-fonts.ipynb

src/content/lab/                    ← content collection（純 .md，frontmatter 驅動）
  python/matplotlib/
    01-basics.md … 06-style-fonts.md

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

## 第一個模組現況

`python/matplotlib`：6 課全上線（01 入門 → 06 樣式與中文字型）。curriculum 與每課重點見各 `.md` frontmatter 與 module 頁。

## 未來想加（backlog）

- matplotlib：07 動畫 `FuncAnimation`、08 與 pandas/numpy 結合
- 新軌道：web（HTML/CSS/JS）、git、llm/api 等。`/html-css-/` 是一個保留的舊網址轉址（被 iThome 文章外連），**勿刪**，與本區無關。
