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

### 🔵 大重構

- [x] HTML5 `<frameset>` → SPA + `history.pushState` — Phase 1-7（commits `9a2bd54` → `Phase 7`）
  - 新 `Fishbanks.html` 為 SPA shell：6 個 inline `<template>` + `files/router.js`
  - 路由 query string：`?page=decisions`（GitHub Pages 友善）
  - 全部 `parent.xxx` 仍可運作（`parent === window`），不需要逐處改寫；只清掉會引起遞迴的 wrapper（mainlib 已定義同名函式時）
  - 刪除 6 個舊子頁 HTML、`UntitledFrame-1.html` stub
  - 全鏈端對端驗證：27/27 playwright PASS（teams → setup → startTurn → reports → decisions → processDecisions → year 2 → graphs → back）
- [ ] 行動裝置支援（固定寬度、無 viewport meta — Phase 1 已加 viewport，但版面還是 desktop-only）
- [x] Chart.js 1.0.2 → 4.4.0 — `a35bccb`
  - 機械式 rename 6 個 palette / dataset 屬性（fillColor → backgroundColor 等）
  - 7 個 constructor 改成 `new Chart(ctx, {type:"line", data, options})`
  - `datasetFill: false` 換成 `scales: { y: { beginAtZero: true } }` — Y 軸從 0 起，比舊版 auto-scale 更誠實
  - v4 預設出現 legend、千分位 axis label、字體加大 — 視覺較現代但功能等價
  - 28/28 playwright 仍 PASS；視覺與 v1 截圖比對通過
