# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope (read first)

**此為獨立專案，請忽略上層目錄 `wemee.github.io/CLAUDE.md` 的所有內容。** 雖然這個目錄目前實際位於 `wemee.github.io/public/fishbanks/`，但 fishbanks 本身是獨立維護的舊式靜態網頁應用，與外層的 Astro 5 / React 19 / Tailwind 專案完全無關，**不適用** 外層 CLAUDE.md 中描述的目錄結構、build 流程、TypeScript GameCore/Agent 架構、ml-training 規範等。所有規範以本檔為準。

## Project overview

**漁人的榮耀**（"Fishers' Glory"）是 MIT Dennis L. Meadows 教授 *Fishbanks Ltd. 8.02* (© 2004, 2008) 的中文改版，由社團法人台灣海洋環境教育推廣協會（TAMEE）取得授權後在地化、擴充。原作以 BASIC 撰寫；目前這份是 JavaScript 移植版（原作者 Michael Gildersleeve），中文化與功能擴充由蔡至勇實作。

是一個模擬「共有財的悲劇」(the tragedy of the commons) 的角色扮演教學遊戲：多個玩家分組經營漁船公司，買賣船隻、競標、決定漁場、應對魚群再生與枯竭。

## Tech stack & build

- **沒有 build / lint / test 系統。** 純靜態 HTML + JavaScript。直接打開 `index.html`（會 redirect 到 `Fishbanks.html`）即可執行。
- 依賴：
  - `files/Chart.js`（已 vendored，用於 graphs 頁的 7 張圖表）
  - 無 npm / package.json / node_modules。修改即生效，不需要編譯。
- 本地開發：任意靜態 server（如 `python3 -m http.server` 或 VSCode Live Server）開到 `index.html`。`file://` 也能跑。

## Architecture (重要 — 必讀)

### SPA shell + history.pushState（2026 重構）

`Fishbanks.html` 是一個 **HTML5 SPA shell**，整個應用的唯一進入點：

```
Fishbanks.html
├── <head>                        ← mainlib.js / files/Chart.js / 六個 *lib.js / files/router.js
├── <body>
│   ├── <div id="app">…</div>     ← 路由把 template 內容塞進這裡
│   └── <template id="tpl-teams">       ← 六個 inline template
│       <template id="tpl-setup">
│       <template id="tpl-decisions">
│       <template id="tpl-reports">
│       <template id="tpl-graphs">
│       <template id="tpl-about">
```

**路由策略**：URL 形如 `?page=decisions`（query string，避開 GitHub Pages 對 clean path 的 404 fallback 需求）。`goto(page)` 用 `history.pushState` 更新 URL，再 `render(page)` 把對應的 template clone 進 `#app`，最後呼叫 `window['init_' + page]()`（如果有定義）。`popstate` listener 處理上一頁/下一頁。

**這帶來幾個關鍵後果**：

1. **所有 lib 載入一次、永久常駐**。各頁的全域函式（`changeShips`、`validateAllFld`、`drawAllGraphs` 等）都在 window scope，跨頁可直接呼叫。
2. **`parent === window`**。原 frameset 時代的 `parent.getTeams()` 等寫法**運行時仍正確**（parent 解析為 window），所以多數既有程式碼不需要動。**但** 同名函式如果同時定義在 mainlib 與 lib 裡會無限遞迴；目前已清掉所有這類 wrapper。
3. **頁面切換不會 reload**。回到一個頁面時，template 重新 clone，`init_<page>()` 重跑、表單欄位從 mainlib globals 重新填值，等於「state 永久、UI 重畫」。
4. **重新整理 SPA shell 會清空 state**（mainlib 內存 + myStorage 都是 in-memory）。

### 遊戲流程

```
teams (開新遊戲、設定組數)
  │ beginGame() → goto('setup')
  ▼
setup (起始條件設定)
  │ startTurn() → goto('reports')
  ▼
reports ⇆ decisions    (主循環，每年一回合)
  │   gotoDecisions() / processDecisions() → executeTurn()
  ├─ graphs   (Chart.js 各隊圖表，年 > 1 時才出按鈕)
  └─ about    (遊戲簡介)
```

關鍵入口函式（皆在 `mainlib.js`）：
- `initializeGame()` — 新局初始化
- `executeTurn()` — 推進一回合，原作叫 `calculate()`
- `resumeGame()` / `resumeGameToYear()` — 從中途恢復
- `saveGame()` — 把當回合狀態寫入 myStorage

### State storage

`mainlib.js` 開頭定義了一個自製的 `Storage` class（line 27），實例為 `myStorage`。**故意不用 `localStorage`** — 註解保留了切換用的舊行（line 36-38）。所以這版「恢復遊戲」並非跨 session 持久化，而是 in-memory 的回合內回復。如果要做永久存檔，要動的就是這裡。

### 1-based arrays（BASIC 遺風）

從 BASIC 移植而來，**所有 team-indexed 陣列的 index 0 都是棄用的**，team 編號從 1 開始：

```js
shipsToDeep[1]   // team 1 的遠洋船數
shipsToDeep[0]   // 永遠忽略
```

新增 team-indexed 陣列時請維持這個慣例，否則計算迴圈（`for (t = 1; t <= teams; t++)`）會錯位。

### 魚價計算的三處對應

`mainlib.js` 開頭註解明確標示：

> 魚價計算要改三個地方：`initializeGame`、`executeTurn`、`resumeGame`

修改魚價公式或加新規則時，**這三個函式必須一起改**，否則新局、推進、恢復三種路徑會出現不一致的價格。

## Template / init_<page> 模式

每頁的 `<template id="tpl-X">` 只放靜態 HTML（不能放 `<script>`，因為 clone 不會執行）。動態欄位用兩種方式處理：

- **單一輸入**：直接寫 `<input name="...">` 在 template；`init_<page>()` 用 `document.FormName.FieldName.value = ...` 填初值。
- **per-team 重複的 row**：給 `<tr id="...">` 一個 placeholder，`init_<page>()` 用 `insertAdjacentHTML('beforeend', ...)` 把 N 隊的 cell 接上去。

跨頁 navigation 一律用 `goto('xxx')`，**不要**用 `location.replace('xxx.html')`（會 404）。

## File responsibilities

| 檔案 | 用途 |
|---|---|
| `Fishbanks.html` | SPA shell：六個 inline template + script 載入順序 |
| `mainlib.js` (~1900 行) | 所有 global state、getter/setter、`initializeGame`/`executeTurn`/`resume*`、CSV report 產生器、Chart 顏色表 |
| `files/router.js` | `goto(page)` / `render(page)` / popstate / DOMContentLoaded 初始路由 |
| `files/teamslib.js` | 開新遊戲頁；`init_teams` + `beginGame` + `aboutGame` |
| `files/setuplib.js` | 起始條件編輯；`init_setup` + 各欄位 validator + `startTurn` |
| `files/decisionslib.js` | 主要的回合決策表單；`init_decisions` 用 `appendDecRow` helper 建 D1-D15 row；方向鍵在 input 間導航（vanilla DOM）；`processDecisions` 觸發 `executeTurn` |
| `files/reportslib.js` | 報表頁切換（個別隊伍、operator、全部、CSV） |
| `files/graphslib.js` | Chart.js 七張圖表 + 對應資料表 |
| `files/aboutlib.js` | 遊戲簡介（只有 `proceed()` 一個 navigation 函式） |
| `files/main.css` / `mainprt.css` / `print.css` | 螢幕 / 列印 樣式 |
| `files/Chart.js` | Chart.js 1.0.2，vendored |
| `images/5.jpg`, `banner*.gif` | 頁面 banner |

## Coding conventions in this codebase

- **不使用 jQuery / ES6+**。保留 BASIC 移植風格：`var`、`function` 宣告、字串拼接（避免 `let` / `const` / 箭頭函式 / template literals）。**新增獨立模組**（如 router.js）可以放寬。
- 註解和變數名混用英文 + 繁體中文（原始英文註解保留、新增功能用繁中註解）。**請延續這個風格**，不要把現有的中文註解翻成英文。
- 函式以 `getXxx` / `setXxx` 大量包裝全域變數 — 雖然 SPA 後不再有跨 frame 存取的需要，但這個 convention 保留以利程式碼一致與未來工具支援。
- 部分檔案有以 `// Deprecated` 標註的舊邏輯（例如 `setFishSalesPrice` 是被 `fishSalesPriceFunction` 取代但仍被 setuplib 呼叫的半淘汰 API）。要清就一次清乾淨，不要半改半留。

## 驗證

`/tmp/fb-pw/verify.js` 是 headless Playwright 端對端 suite（27 個檢查），覆蓋從開新遊戲到推進兩年的完整流程，包括：

- shell + 路由（title 切換、popstate、deep link）
- 每頁 template 渲染與動態填值
- `changeShips` / `updateAuctionShipsTotal` 等決策表單邏輯
- ArrowRight 鍵盤導航（vanilla DOM，無 jQuery）
- `processDecisions` → `executeTurn` → `advanceGameYear` → graphs 全鏈

要跑：本機 `npm run dev`（外層 Astro 專案）開到 `http://localhost:4321/fishbanks/Fishbanks.html`，然後 `cd /tmp/fb-pw && node verify.js`。
