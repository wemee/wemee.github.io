# Fishbanks 開發筆記

## Git 版本保護現況

| 名稱 | 指向 | 用途 |
|---|---|---|
| `fishbanks-v1-original` (tag) | `c6f2367` | 中文化原版的最後狀態，永久書籤 |
| `main` | `33f7ce8` | 原版 + CLAUDE.md（無程式碼變動） |
| `fishbanks-refactor` (branch) | 從 main 分出 | bug 修正與重構工作分支 |

## 退回原版的指令備忘

| 想做的事 | 指令 |
|---|---|
| 查看 tag 的描述 | `git tag -n3 fishbanks-v1-original` |
| 看一下原版的某個檔案長怎樣 | `git show fishbanks-v1-original:public/fishbanks/mainlib.js` |
| 把整個 fishbanks 資料夾還原成原版 | `git checkout fishbanks-v1-original -- public/fishbanks/` |
| 完全放棄重構分支 | `git switch main && git branch -D fishbanks-refactor` |
| 重構分支某個 commit 反悔 | `git revert <hash>`（保留歷史的反向修補） |
| 看「原版 vs 現在」的差異 | `git diff fishbanks-v1-original HEAD -- public/fishbanks/` |
| 看「原版 vs 現在」改了哪些檔 | `git diff --stat fishbanks-v1-original HEAD -- public/fishbanks/` |

## Commit 慣例

重構分支上，**每一類修改一個 commit**，方便客戶要求時可單獨 `git revert`。例如：

```
fix: correct comma-operator bug in initializeGame
fix: CSV report missing last team in year-header row
fix: getRevokeShips() missing team parameter
fix: remove duplicate resetGameYear definition
refactor: declare loop variables to prevent global leak
refactor: replace eval() with bracket notation in decisionslib
chore: remove dead registration key validation
```

## 已知 bug 與重構清單

（依優先順序，逐項完成後在前面打勾）

### 🔴 真實的 bug（全部完成 ✅）

- [x] `mainlib.js:539` comma operator 誤用：`totalCatchDeep, totalCatchCoast = 0;` 只設了第二個變數 — `85f17fa`
- [x] `mainlib.js:1657` CSV 報表標頭少一隊（`<teams` 應為 `<=teams`），最後一隊資料會錯位 — `8804baa`
- [x] `mainlib.js:183` `getRevokeShips()` 沒收 team 參數，卻引用了未定義的 `t` — `94099ea`
- [x] `mainlib.js:288 / 301` `resetGameYear` 重複定義兩次 — `aa56f2e`
- [x] 大量未宣告 loop 變數洩漏成 frameset 全域 — `6a9431e`
  - 實際修了：`readCookie` 的 `offset` / `end`、`saveGame` 的 `t`、`generateTeamCSVReport` 的 `y` / `t`、`generateOperatorCSVReport` 的 `y`、`resumeGameToYear` 的 `t`
  - 原 review 提到的 `mainlib.js:519` `nn` 與 `table()` 的 `y` 經驗證**已在** `var l, y, nn;` 宣告（line 511），是 review 誤判，未實際修改

### 🟡 已淘汰 API / 風險中等

- [x] `escape()` / `unescape()` / `toGMTString()` — 隨 cookie helpers 一起刪除（這些 API 只在 `writeCookie`/`readCookie` 用到，而那兩個函式在拔掉註冊碼後變成死代碼）— `4a23031`
- [x] `decisionslib.js` 48 處 `eval("the_form.XxxFld" + t + "Fld.value")` → `the_form["XxxFld" + t + "Fld"].value` — `d609da6`（原預估 60 處，實際 48）
- [x] 拔掉註冊碼機制（`teamslib.js` 寫死 + `mainlib.js:1207` `validateKey` + `badkey.html` + `key.txt` 全部移除）— `4a23031`
- [ ] 每個 .js 加 `'use strict';`

### 🟢 體質改善

- [x] 刪 `mainlib.js:1141-1191` `original_calcSalvageValue`（dead code）— `c60e767`（−52 行）
- [x] 清理 `// Deprecated` 註解的舊變數 — `639f4ea`（commented-out fishPrice/price/priceDeep/priceCoast/fishSalesPrice 全刪、`getFishSalesPrice` 無 caller 刪；`setFishSalesPrice` 仍被 setuplib.js 呼叫故保留並維持 Deprecated 標籤）
- [x] 補上 `UntitledFrame-1.html`（避免 console 404）— `b0eaa3f`
- [x] 英文 alert 訊息中文化（mainlib / decisionslib / setuplib / graphslib 共 35+ 處）— `18afcf1`，順便修正兩處 "mast" → "must" 的 typo
- [x] 移除 jQuery 1.7.1 依賴 — `d7ac1be`（`decisionslib.js` 兩個 jQuery 用法改成 `Element.closest/nextElementSibling/querySelector` + `focusin` 事件；連同 setup.html / decisions.html 的 `<script>` tag 與 `files/jquery-1.7.1.min.js` 全刪。setuplib.js 也順手把 commented-out 的 jQuery 死代碼清掉）

### 🕰 v1 中文化原版並存

從 tag `fishbanks-v1-original` (commit `c6f2367`) 用 `git archive | tar` 倒進 `public/fishbanks/v1/`（~780KB，完整自包含 jQuery 1.7.1 / key.txt / badkey.html / 舊 frameset 6 子頁）。新版改動不會碰到，v1 永久凍結。

URL：
- 新版 SPA：`/fishbanks/Fishbanks.html`（首頁）
- v1 原版 frameset：`/fishbanks/v1/Fishbanks.html`（顯式 path 因為 Astro dev 不 auto-serve directory index；GitHub Pages 通常會但寫死最保險）

切換連結放在 teams + about 兩個 pre-game 頁面的頁尾（淺灰小字 + 點線下底，不搶 CTA）。**setup 故意跳過**因為使用者可能已調整起始參數，誤觸會丟掉。**in-game 頁面也沒有**因為這個切換等於整局放棄，beforeunload guard 也擋不住 cross-document 連結。

未對稱：v1 那邊沒有「回新版」連結（不改舊版的承諾）；想回新版改 URL 即可。

驗證：6 個檢查 (v1 entry redirect / teams 有連結 / setup 無 / about 有 / reports 無 / 同分頁點擊跳轉) 全 PASS；happy-path 28/28 仍 PASS。

### 🛡 防誤觸 unload guard

`myStorage` 是 in-memory JS 物件（非 localStorage），所以 F5 / 關分頁 / 投影機線拔到 / 瀏覽器當 = 整局 N 年快照一起丟。`router.js` 加 `beforeunload` listener：當 `?page=reports|decisions|graphs` 時攔下 unload 跳瀏覽器原生「離開此頁面？」提示。pre-game 頁面（teams/setup/about）正常 refresh，in-app `goto()` 走 pushState 不觸發。

驗證：6 個頁面 × refresh + 1 個 in-app goto 串切 = 7/7 PASS（prompt 行為符合預期）；happy-path 28/28 仍 PASS。

⚠️ 這只擋誤觸，不是持久化。要真正續局（隔天接著上、跨 session）得另開議題上 localStorage（會牽動存檔格式 + 清檔入口 + 28 個 verify 重驗）。

### 🐛 Fuzz Harness 抓到的 7 個 bug — `de4295b`

5 分鐘 headless Playwright fuzz（隨機 fill / click / goto / back / refresh / forward），第一輪跑 6591 iterations 抓到 6 個 unique signatures，分析得 3 個獨立根因（A、B、C）。修完再跑找到 2 個（D、E）；修完再跑找到 1 個（G）；過程中還意外撞到 1 個讓 Chromium hang 7 小時的 hang-bug（F）。

| ID | Bug | 既有 / 新增 | 修法 |
|---|---|---|---|
| A | `var regenerationCoastal;` 宣告但全程用 `regenerationCoast`（無 al）| 既有，refactor 暴露 | 改宣告為 `regenerationCoast` |
| B | `graphslib.js` 7 處 `if (xxxJSON == "")` 抓不到 undefined | 既有，refactor 放大 | 改 `if (!xxxJSON)` |
| C | Chart.js v4 strict canvas reuse | **新增**（Chart.js 升級副作用） | 加 `destroyAllCharts()` |
| D | `var fishDensityCoastal;` 同 A pattern | 既有，refactor 暴露 | 改宣告為 `fishDensityCoast` |
| E | `saveGame` 30+ 個 `JSON.parse(myStorage.getItem(k))` 沒 guard | 既有，refactor 暴露 | 開頭 `resetAllData()` bootstrap |
| F | `processDecisions` 內 ContinuousForYear 無上界，貼 8 位數會跑 1 億年 | 既有，與 SPA 無關 | clamp 至 1-100 年 |
| G | `resumeGameToYear` 同 B + `data = allData[year]` 可能 null | 既有，refactor 暴露 | 兩個 guard |

驗證：修完後 5 分鐘 fuzz 6579 iterations / 0 errors / 0 unique signatures，happy-path 28/28 verify 仍 PASS。

### 🧪 Playwright 驗證

`/tmp/fb-pw/verify.js`（headless chromium，需要 `npm run dev` + `npm i -D playwright` + `npx playwright install chromium`）

跑過 21 個檢查全 PASS：

決策表單熱區（eval → bracket）：
- `changeShips()` 5 處 eval — ShipsAvail 即時更新正確
- `updateShipsToHarbor()` — `value = total` assign 路徑正確
- `updateAuctionShipsTotal()` — 4 隊 sum 迴圈正確

jQuery → vanilla DOM：
- 右箭頭從 `AuctionShips1Fld` → `AuctionShips2Fld`（`closest/nextElementSibling/querySelector` 替換正確）
- focusin 自動選取 input 文字（focusin 事件替換 `$(doc).on('focus', ...)`）
- `typeof window.$` 和 `typeof window.jQuery` 都是 `undefined`

回歸面：
- `validateKey` / `keyError` / `writeCookie` / `readCookie` 全部 `typeof === 'undefined'`
- 0 個 pageerror，0 個 404（UntitledFrame-1.html stub 補上後）
- 0 個非預期 console error

Fuzz harness 在同目錄 `/tmp/fb-pw/fuzz.js`：

```bash
FUZZ_DURATION_MS=300000 node fuzz.js   # 5 分鐘隨機操作（預設）
FUZZ_SEED=12345 node fuzz.js           # 用指定 seed reproduce
```

每個 error 依 stack 分類為 NEW / CHART / EXISTING / UNKNOWN，輸出統計與每個 signature 的觸發次數。

⚠️ `/tmp/` 是暫存目錄，重開機會清空。若要保留 harness，請從 `/tmp/fb-pw/` 複製到永久位置。

### 🔵 大重構

- [x] HTML5 `<frameset>` → SPA + `history.pushState` — Phase 1-7（commits `9a2bd54` → `Phase 7`）
  - 新 `Fishbanks.html` 為 SPA shell：6 個 inline `<template>` + `files/router.js`
  - 路由 query string：`?page=decisions`（GitHub Pages 友善）
  - 全部 `parent.xxx` 仍可運作（`parent === window`），不需要逐處改寫；只清掉會引起遞迴的 wrapper（mainlib 已定義同名函式時）
  - 刪除 6 個舊子頁 HTML、`UntitledFrame-1.html` stub
  - 全鏈端對端驗證：27/27 playwright PASS（teams → setup → startTurn → reports → decisions → processDecisions → year 2 → graphs → back）
- [x] 投影/平板友善（Plan A：固定 px → max-width，圖表包 chart-wrap div 等比縮放）
  - 主要使用情境是「講師投影 + 全班分組」，學生不在自己裝置編輯，所以只做「不會被切掉」而非完整 mobile rebuild
  - 5 個外層 wrapper（teams/setup/decisions/about 的 600px、reports 的 768px、graphs 的 1080px）改成 `max-width:Npx; width:100%`
  - 7 個 chart canvas 包進 `<div class="chart-wrap">`（max-width:400px, width:100%），Chart.js v4 自動 responsive 跟著縮
  - 加 `body { padding:8px; box-sizing:border-box }` + `img { max-width:100%; height:auto }` 兩條全域規則讓 banner 跟著縮
  - 驗證：3 viewport (iPad 直 768 / 橫 1024 / 投影機 1280) × 6 頁 = 18 個組合 0 overflow；happy-path 28/28 verify 仍 PASS
- [ ] 完整 mobile rebuild（手機編輯）— 暫不做，需要把 N 隊 × D1-D18 的 table 改成 per-team 卡片/accordion 才能塞進手機，目前使用情境不需要
- [x] Chart.js 1.0.2 → 4.4.0 — `a35bccb`
  - 機械式 rename 6 個 palette / dataset 屬性（fillColor → backgroundColor 等）
  - 7 個 constructor 改成 `new Chart(ctx, {type:"line", data, options})`
  - `datasetFill: false` 換成 `scales: { y: { beginAtZero: true } }` — Y 軸從 0 起，比舊版 auto-scale 更誠實
  - v4 預設出現 legend、千分位 axis label、字體加大 — 視覺較現代但功能等價
  - 28/28 playwright 仍 PASS；視覺與 v1 截圖比對通過
