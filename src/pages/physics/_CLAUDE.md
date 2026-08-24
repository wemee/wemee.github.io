# /physics/ — 物理專區技術交接

> 檔名前面的 `_` 是必要的。`src/pages/` 底下叫 `CLAUDE.md` 的檔案會變成公開路由並被寫進 sitemap。

## 這個專區的定位

物理專區是**數學專區的應用層**，不是另一個 PhET。選題的唯一標準是「能不能兌現站上既有的數學頁」，
所以每一課都在 `mathSections.ts` 的 `supplements` 裡掛了明確的回連，index 卡片也標了「用到：」。
新增課程前先問：它接得回 linalg / calculus / probstat / fourier 的哪一頁？接不回去就先別做。

| 章 | 課 | 兌現的數學頁 |
|---|---|---|
| Ch1 從古典到統計 | `coupled-oscillator` | `linalg/eigen` |
| | `ising` | `probstat/markov` + `probstat/entropy` |
| Ch2 波動作為橋樑 | `uncertainty` | `fourier` + `waveform` |
| | `double-slit` | （承 uncertainty） |
| Ch3 量子的硬骨頭 | `tunneling` | （承 uncertainty） |
| | `bell` | `probstat/distributions` + `lln-clt` |

## 檔案分布

```
src/
├── pages/physics/
│   ├── index.astro              # 專區首頁 + 共振熱身（對應 probstat 的擲骰子）
│   └── {slug}.astro             # 6 課，全部用 MathLessonLayout
├── lib/physics/
│   ├── fft.ts                   # 手寫 radix-2 複數 FFT，uncertainty 與 tunneling 共用
│   ├── ResonanceScene.ts        # index 熱身
│   ├── CoupledOscillatorScene.ts
│   ├── IsingScene.ts            # 內含 MagnetizationChart（第二個 canvas）
│   ├── UncertaintyScene.ts
│   ├── DoubleSlitScene.ts
│   ├── TunnelingScene.ts
│   └── BellScene.ts
├── styles/physics.css           # .phy-* 前綴，鏡射 probstat.css
└── lib/math/mathSections.ts     # PHYSICS section 住在這裡（見下）
scripts/physics-check/           # npm run check:physics
```

## 共用基礎設施（沿用，沒有另開一套）

- **`MathLessonLayout.astro`** — 麵包屑、章節 eyebrow、標題、`MathPageNav`。物理頁多傳一個
  `currentPage="physics"`（預設值是 `'math'`，所以 18 頁數學課完全不用改）。
- **`mathSections.ts`** — 課程順序、prev/next、補充閱讀的唯一真相來源。檔案路徑仍在
  `src/lib/math/` 底下純粹是歷史原因；裡面沒有任何 `/math/` 專屬邏輯，URL 前綴由 `indexHref` 帶。
  物理頁不直接 import 它，是 layout 幫忙查的。
- **`Canvas2DBase`** — DPR 縮放、ResizeObserver、rAF 去重的 `scheduleRender()`。

## 新增一課的步驟

1. 在 `mathSections.ts` 的 `PHYSICS.pages` 加一筆（順序就是 prev/next 的順序），
   並在 `PHYSICS.supplements` 加對應的 key，就算是空陣列。
2. 寫 `src/lib/physics/{Name}Scene.ts`，`extends Canvas2DBase`。
3. 寫 `src/pages/physics/{slug}.astro`，用 `<MathLessonLayout section="physics" currentPage="physics" …>`。
4. `src/components/Navbar.astro` 的物理 dropdown 手動加一行。
5. `src/pages/physics/index.astro` 的 `lessons` 陣列加卡片（含 `uses` 回連）。
6. 在 `scripts/physics-check/run.ts` 加數值檢查（見下面「為什麼有這個 harness」）。

## 為什麼有 `npm run check:physics`

每一頁都在做**可驗證的量化主張**：高斯波包的 Δx·Δp 剛好 0.5、Ising 在 T_c 的 E/N 是 −√2、
CHSH 的 S 是 2√2、穿隧的 R + T = 1。這些用眼睛看 canvas 是驗不出來的。

這個 harness 用一個極小的 DOM stub（`domstub.ts`）讓**真正的 scene 類別**在 Node 底下跑，
沒有複製任何邏輯。TypeScript 的 `private` 只在編譯期存在，所以檢查透過 `any` 的方括號存取摸進內部 ——
這是刻意的，好處是 production 類別裡不必留任何測試用的後門。

它抓到過三個真的缺陷（都不是視覺 pass 找得到的）：

1. **共振預設太尖** — 原本用 V₀ = w = 3，共振峰在能量軸上比波包自己的 ΔE 還窄，
   量到的 T 只有 0.67，但頁面上寫「T ≈ 1」。改成 V₀ = w = 2 之後 T = 0.9585。
   這件事現在寫進了 `TunnelingScene.PRESETS` 的註解與課程步驟裡，因為它本身就是好教材。
2. **貝爾頁的操作指示是錯的** — 原本叫讀者把 Bob 的 b 移到 0° 說「S 會掉到 2 以下」，
   實際上那樣 S = 2.414，仍然違反。正確做法是把 b′ 移到跟 b 一樣（S = 1.414）。
3. **穿隧的障礙只有畫面寬度的 1%** — 課程叫讀者「看牆內的指數衰減」，但那根本看不到。
   因此加了下方的「障礙區放大」面板。

## 各頁實作上的關鍵決定

### coupled-oscillator
線性系統，用**解析解**逐點求值，沒有積分器也就沒有累積誤差。
軌跡面板不需要 history buffer —— 每個像素欄位直接代自己的 t 進公式。
「各質量的局部能量」把耦合彈簧的位能平分給兩顆，這是**約定不是定律**，頁面上有寫明。

### ising
- 96×96、週期性邊界、Metropolis 單格翻轉。
- ΔE 只有五個可能值，所以 `boltzmann` 是查表，不是每次呼叫 `exp()`。
- 磁化用**整數 `magSum`** 累加。曾經寫成從 `magnetization * N` 反推，那會在幾千次掃描後累積浮點誤差。
- 自動掃描是逐幀推進的狀態機，每個溫度**先跑 60 次掃描平衡再開始平均**。
  沒平衡就讀數，是做出一張會騙人的相變圖最快的方法。
- 已知限制：單格翻轉在 T_c 附近有臨界慢化。要更漂亮的曲線得換 Wolff / Swendsen–Wang 整塊翻轉。

### uncertainty
「方形波包」其實是超高斯 `exp(−(x/w)^8)`，不是真的矩形。真矩形的傅立葉變換是 sinc，
`⟨k²⟩` 在數學上發散，在有限格子上算出來的 Δp 會**隨格子大小改變** —— 那個數字沒有意義。

### double-slit
是**從已知分布抽樣**，不解波動方程。頁面第一段就講明了。
如果哪天改成直接畫曲線，這頁想證明的事就被抹掉了。
累積落點畫在固定解析度的離屏「底片」canvas 上，5 萬顆光子只花一次 `drawImage`。

### tunneling
- split-step Fourier + Strang 分裂，**天生么正**，所以機率總和恆為 1，不靠事後歸一化。
- 吸收邊界是必要的：FFT 讓格子變週期性，跑出右邊的波會從左邊繞回來污染反射率。
  被海綿吸走的機率**記在正確的那一側**，R + T 才會加回 1。
- 模擬值與課本平面波公式**本來就不會相等**，因為波包有 ΔE。兩個數字並排顯示就是要讓這個落差看得見。

### bell
- 三種產生器：量子 / 局域隱變數 / 最佳古典策略。
- 「局域隱變數」（共同偏振角 λ）的理論值**剛好是 2.000**（12 批次 200k 對，平均 1.99975 ± 0.00278）。
  所以讀者會看到 2.01 之類的讀數 —— 判定邏輯要求超出 **3σ** 才顯示「違反」，課程步驟裡也講了這件事。
- 每一對都**獨立隨機**挑測量角度。這不是裝飾，CHSH 假設兩邊的選擇自由且與 λ 無關。
- 頁面明確拒絕「觀測需要意識」「可以超光速傳訊」兩種常見誤解，也列出偵測 / 局域性 / 自由選擇三個實驗漏洞。

## 待辦與已知取捨

- **`/math/nbody` 與 `/math/traffic` 已於 2026-08-24 搬進 `/physics/`**（頁面與 lib 都搬了：
  `src/lib/physics/nbody/`、`src/lib/physics/TrafficSimulator.ts`）。舊網址在
  `astro.config.mjs` 的 `MOVED_TO_PHYSICS` 留了轉址，**那兩條要長期保留** —— 舊網址已被索引，
  也散在部落格文章與站外連結裡。Astro 產生的轉址頁同時帶了 `noindex` 與 `canonical`，
  對純靜態主機來說已經是最好的做法；sitemap 用同一份 map 過濾掉它們。
- **navbar 深度規則**：物理 dropdown 只列到**專區層級**（兩個專區 + 兩個獨立模擬器），
  比照 `/lab/` 的做法。曾經列出全部 12 課，選單直接變成 sitemap。新增專區或獨立模擬器才加進去，
  單一課程一律不加 —— ⌘K 搜尋找單一課程比捲選單快。
  **數學那邊 26 項的瘦身尚未執行**，是另一件待辦。

- **rAF 與瀏覽器 QA**：所有 scene 都靠 `requestAnimationFrame`。Chrome 視窗被遮住時
  `visibilityState` 會變 `hidden`，rAF **完全不跑**，畫面與數字都會凍在初始值。
  用 Playwright 做視覺驗證時，`browser_take_screenshot` 會強制產生一幀，可以拿來救。
  但動態物理量請用 `npm run check:physics`，不要靠瀏覽器。
