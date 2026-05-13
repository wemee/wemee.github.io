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
  - `files/jquery-1.7.1.min.js`（已 vendored）
  - `files/Chart.js`（已 vendored，用於 graphs.html）
  - 無 npm / package.json / node_modules。修改即生效，不需要編譯。
- 本地開發：任意靜態 server（如 `python3 -m http.server` 或 VSCode Live Server）開到 `index.html`。直接 `file://` 也能跑，但部分瀏覽器對 frameset/cookie 處理可能受限。

## Architecture (重要 — 必讀)

### Frameset 架構

`Fishbanks.html` 是一個 **XHTML frameset**，這是整個應用的進入點：

```
Fishbanks.html (frameset, 載入 mainlib.js — 所有 global state 都掛在這層)
├── UntitledFrame-1.html  (1px 寬的空 frame；這個檔案實際不存在於 repo，瀏覽器會顯示 404，但不影響功能 — 是原作者刻意的設計遺跡)
└── MainFrame             (循環切換 teams/setup/decisions/reports/graphs/about/badkey.html)
```

**這帶來幾個關鍵後果：**

1. **所有遊戲狀態都是 frameset 父視窗的全域變數**（在 `mainlib.js` 中宣告）。子頁面透過 `parent.xxx()` 存取，例如 `parent.getTeams()`、`parent.setBankBal(t, b)`。**不要把狀態移到子頁面**，會在切頁時被銷毀。
2. 子頁面之間切換用 `location.replace('xxx.html')`（保留 frame、清掉子頁本身的 history）。
3. 重新整理 frameset 父頁會清空全部 state；只有透過子頁的 `location.replace` 切頁才會保留 state。

### 遊戲流程（子頁面切換圖）

```
teams.html (開新遊戲、設定組數)
   │  beginGame() → setup.html
   ▼
setup.html (起始條件設定)
   │  startTurn() → reports.html (or initializeGame)
   ▼
reports.html ⇆ decisions.html   (主循環，每年一回合)
   │             gotoDecisions() / executeTurn()
   ├─ graphs.html  (各隊圖表)
   └─ about.html   (遊戲簡介)
```

關鍵入口函式（全部在 `mainlib.js`）：
- `initializeGame()` — 新局初始化（line 532）
- `executeTurn()` — 推進一回合，原作叫 `calculate()`（line 616）
- `resumeGame()` / `resumeGameToYear()` — 從中途恢復（line 1952 / 1785）
- `validateKey()` — 註冊碼驗證（line 1211）

### State storage

`mainlib.js` 開頭定義了一個自製的 `Storage` class（line 27），實例為 `myStorage`。**故意不用 `localStorage`** — 註解保留了切換用的舊行（line 36-38）。所以這版「恢復遊戲」並非跨 session 持久化，而是 in-memory 的回合內回復。如果要做永久存檔，要動的就是這裡。

### 1-based arrays（BASIC 遺風）

從 BASIC 移植而來，**所有 team-indexed 陣列的 index 0 都是棄用的**，team 編號從 1 開始：
```js
shipsToDeep[1]   // team 1 的遠洋船數
shipsToDeep[0]   // 永遠忽略
```
新增 team-indexed 陣列時請維持這個慣例，否則計算迴圈（`for (t = 1; t <= teams; t++)`）會錯位。

### 註冊碼

teamslib.js line 18 **硬編碼**了註冊碼 `18QN-6JJX-1JH9-K0VN`（同 `key.txt`）。這顆 key 通過 `validateKey()` 的 regex + 字元 checksum 驗證（mainlib.js line 1211），實質上已經把驗證流程繞過。改動驗證邏輯前先確認這顆 key 仍能通過。

### 魚價計算的三處對應

`mainlib.js` 開頭註解明確標示：

> 魚價計算要改三個地方：`initializeGame`、`executeTurn`、`resumeGame`

修改魚價公式或加新規則時，**這三個函式必須一起改**，否則新局、推進、恢復三種路徑會出現不一致的價格。

## File responsibilities

| 檔案 | 用途 |
|---|---|
| `mainlib.js` (~2000 行) | Frameset parent 載入；所有 global state、getter/setter、`initializeGame`/`executeTurn`/`resume*`/`validateKey`/CSV report 產生器都在這裡 |
| `files/teamslib.js` | 開新遊戲頁，key 驗證 |
| `files/setuplib.js` | 起始條件編輯 |
| `files/decisionslib.js` | 主要的回合決策表單；方向鍵在 input 間導航；觸發 `executeTurn` |
| `files/reportslib.js` | 報表頁切換（個別隊伍、operator、全部、CSV） |
| `files/graphslib.js` | Chart.js 圖表 |
| `files/aboutlib.js` | 遊戲簡介 |
| `files/main.css` / `mainprt.css` / `print.css` | 螢幕 / 列印 樣式 |
| `images/5.jpg`, `banner*.gif` | 頁面 banner |

## Coding conventions in this codebase

- **jQuery 1.7.1** 是現役工具，不要假設可以用較新的 jQuery API 或現代 ES（避免 `let` / `const` / 箭頭函式 / template literals 以保留風格一致；但若新增獨立模組可以放寬）。
- 註解和變數名混用英文 + 繁體中文（原始英文註解保留、新增功能用繁中註解）。**請延續這個風格**，不要把現有的中文註解翻成英文。
- 函式以 `getXxx` / `setXxx` 大量包裝全域變數 — 這是 frameset 跨頁存取的必要包裝，新增 global state 時也請補上 getter/setter。
- 部分檔案有以 `// Deprecated` 標註的舊邏輯（例如單一魚價 → 近遠海分開後的舊 `fishPrice` 陣列），保留以利對照原作；要清就一次清乾淨，不要半改半留。
