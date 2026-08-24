# /physics/rf/ — 電波專區技術交接

> 檔名前面的 `_` 是必要的，理由見 `../_CLAUDE.md`。

## 定位

電波專區是物理專區的子專區，也是這個網站的**個人護城河**：使用者 2008 年的碩論做車載隨意網路
（VANET）的路由層，2026-08 寫了 LoRa/Meshtastic 兩篇文章。中文世界幾乎沒有互動式的電波傳播內容，
而這裡的每一頁都能接回既有的數學頁：

| 章 | 課 | 兌現的數學 |
|---|---|---|
| Ch1 把訊號送出去 | `link-budget` | dB、平方反比 |
| | `antenna` | `math/fourier` + `physics/uncertainty`（陣列因子＝孔徑的傅立葉變換） |
| Ch2 真實世界的破壞 | `fresnel` | `physics/double-slit`（繞射） |
| | `multipath` | `probstat/lln-clt` + `distributions`（Rayleigh 來自 CLT） |
| Ch3 極限與網路 | `shannon` | `probstat/entropy`（容量的單位是 bit） |
| | `mesh` | 兩篇 LoRa 部落格文章 |

`mesh` 那頁就是 memory 裡延後很久的「Mesh 模擬器」，它是
[當年我們拼命避免廣播風暴](/blog/meshtastic-broadcast-storm) 那篇文章的可操作版本。

## 檔案

```
src/lib/rf/
├── radio.ts               # 純函式：FSPL、菲涅耳、刀鋒繞射、香農、雜訊底、四組真實系統參數
├── InverseSquareScene.ts  # 專區首頁熱身（線性 vs dB）
├── LinkBudgetScene.ts
├── AntennaArrayScene.ts
├── FresnelScene.ts
├── MultipathScene.ts      # 內含 FadingChart（第二個 canvas）
├── ShannonScene.ts
├── MeshSim.ts             # 無頭模擬器，MeshScene 與批次比較共用
└── MeshScene.ts           # 動畫 + ComparisonChart
src/pages/physics/rf/*.astro
scripts/rf-check/          # npm run check:rf
```

樣式沿用 `src/styles/physics.css`（`.phy-*`），沒有另開一份。

## 真實系統的數字都是可查證的

`radio.ts` 的 `RADIO_PRESETS` 不是憑感覺填的，改動前請先驗算：

- **LoRa SF11/250 kHz**：速率 `11 × 250000 / 2¹¹ × 4/5 = 1074 bps`；
  靈敏度 `−174 + 10log₁₀(250k) + 6 (NF) + (−17.5) (SF11 解調門檻) = −131.5 dBm`。
- 四個系統的實際速率**全都低於各自的香農容量**（17% / 39% / 61% / 22%），
  這是 `check:rf` 在驗的事。如果有人改了參數讓某個系統超過容量，那頁的主張就垮了。

## 三個模型上的關鍵決定（都被驗證推翻過一次）

### 1. 多路徑：幾何決定相位，K 因子決定振幅

第一版用 `1/(L₁+L₂)` 當散射路徑振幅 —— 每個反射都幾乎跟直視路徑一樣強，K 因子被釘在 0 dB 附近，
「打開 LOS 看長條圖偏離 Rayleigh」這個教學步驟**完全看不出效果**。

第二版改成物理上更正確的兩次擴散 `1/(L₁L₂)` —— 結果更糟：接收機剛好經過某個散射體時那條路徑
獨大，中央極限定理失去足夠多的可比項，包絡的 `E[r]` 從 0.886 掉到 0.17，根本不是 Rayleigh。

最後採用**教科書的 Clarke 模型**：幾何只決定每條路徑的相位（λ/2 週期與都卜勒都來自這裡），
散射路徑的總功率由使用者設定的 **K 因子**決定。這同時也是最誠實的教法 —— 真實世界的 K 也是
量出來的，不是推導出來的。`check:rf` 驗證 NLOS 的 `E[r] ≈ √π/2 = 0.8862`。

### 2. 多路徑：統計取樣與顯示取樣必須分開

軌跡有 160 m，λ/2 只有 16 cm。原本用 900 點鋪滿全長（間距 0.178 m），比 λ/2 還大 ——
**畫出來的起伏是混疊，不是衰落**，而課程正好叫讀者去看那個週期性。

現在拆成三組取樣，各有各的任務：

- `STAT_SAMPLES = 900`（全長，間距 > λ/2）→ 直方圖。間距大於 λ/2 反而是對的，
  這樣每個取樣點近似獨立，Rayleigh 擬合才有意義。
- `WINDOW_SAMPLES = 640`（接收機周圍 ±3.2 m，每半波長約 12 點）→ 顯示用的功率剖面，
  畫面上還畫了一把 λ/2 的尺讓讀者對照。
- `FADE_SCAN_SAMPLES = 7000` → 只用來找最深的那個零點。

順帶的好處：移動接收機時只需要重算視窗，不必重算整個場，效能好很多。

### 3. Mesh：退避時間必須跟空中時間成比例

`naive` / `dedupe` 的退避原本寫死 `rnd() * 20` ms。這讓「把空中時間縮小 10 倍假裝是 Wi-Fi」
這個實驗變得沒有意義（退避沒跟著縮，比例整個跑掉），而課程裡就有這一步。

改成 `rnd() * airtimeMs * 0.06` 之後，**同時縮放空中時間與 CW，結果不變**（`check:rf` 有驗，
送達率漂移 < 0.2 個百分點）。這也讓頁面可以誠實地說：這個模型只在乎比例，不在乎絕對時間。

## MeshSim 的模型範圍

模擬：半雙工、任何重疊的可聽見發送都造成碰撞、hop limit、四種轉送策略。
`meshtastic` 模式的退避是 `CW × (1 − 距離/半徑)` —— 越遠退避越短，也就是拿距離當 SNR 的代理，
對應 Meshtastic 實際使用的 SNR 排序競爭視窗。

**沒有模擬**：捕獲效應（所以碰撞數字偏悲觀）、CSMA defer（所以看不到 exposed terminal 的浪費）、
節點移動、ACK 與重傳。這些都寫在頁面的「這個模型沒有處理的事」裡，不要在程式裡偷偷補一半。

比較用 `compareModes()`：四種策略跑在**完全相同的佈點集合**上再平均。單一次的結果幾乎只反映
運氣（源節點剛好落在連通性好的位置與否），拿來比較會得出隨機的結論。

## 內容上的紅線

使用者自己寫過 [那篇 Meshtastic 文章](/blog/meshtastic-broadcast-storm)，裡面明確**推翻**了
「Meshtastic 放任廣播風暴」這個常見說法。正確的說法是：

> 它保留了 1999 年那套廣播抑制術（重複抑制、轉送前先聽、hop limit、SNR 決定的競爭視窗），
> 但把整個路由層丟掉了。

而它敢丟掉路由層的理由是**空中時間**（LongFast 1.07 kbps，一個 16 bytes 封包佔 354 ms，
比 802.11g 慢五萬倍）加上**節點幾乎不動**。改這頁的文字前先讀那篇，不要把已經被推翻的說法寫回去。

## 待辦

- ~~`/math/nbody` 與 `/math/traffic` 仍掛在數學底下~~ — 2026-08-24 已搬進 `/physics/`，
  轉址設定見 `astro.config.mjs`。
- ~~navbar 的物理下拉已經有 15 項~~ — 已縮到專區層級（4 項）。新增專區才加，
  單一課程不要加回去，理由見 `../_CLAUDE.md`。
- 可能的後續：都會區路徑損耗模型（Hata / COST-231）、OFDM 與頻率選擇性衰落、
  LoRa chirp 展頻本身的解調過程。
