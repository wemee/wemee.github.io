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

- [ ] 刪 `mainlib.js:1149-1197` `original_calcSalvageValue`（dead code）
- [ ] 清理 `// Deprecated` 註解的舊變數
- [ ] 補上 `UntitledFrame-1.html`（避免 console 404）
- [ ] 英文 alert 訊息中文化（`mainlib.js:5, 161, 164` 等）
- [ ] 評估移除 jQuery 1.7.1 依賴（只在 `decisionslib.js` 用 keyup/focus）

### 🔵 大重構（暫不動）

- [ ] HTML5 已將 `<frameset>` 標為 obsolete — 未來總有一天要改成單頁 + history.pushState
- [ ] 行動裝置支援（沒有 viewport meta、固定 560px 寬度、frameset 在手機體驗差）
- [ ] Chart.js 1.0.2 → 4.x（breaking change，工程量大）
