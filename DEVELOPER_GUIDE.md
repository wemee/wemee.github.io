# 開發者指南 (Developer Guide)

本文件紀錄了如何啟動與關閉此 Astro 專案的開發環境。

## 1. 啟動開發伺服器

開啟終端機 (Terminal)，進入專案根目錄後執行以下指令：

```bash
npm run dev -- --port 4321 --host
```

### 參數說明：
- `npm run dev`：執行 Astro 開發模式。
- `--`：確保後面的參數能正確傳遞給 Astro。
- `--port 4321`：指定使用 4321 端口。
- `--host`：允許局域網外部連接（方便手機測試）。

## 2. 為什麼不能用 `python3 -m http.server`？

在開發過程中 **不能** 直接用 Python 的伺服器取代 `npm run dev`，原因如下：
- **需要編譯**：Astro 的 `.astro` 檔案需要經由 Node.js 進行即時編譯，瀏覽器才看得懂。Python Server 只會傳送原始碼，導致網頁無法運作。
- **Hot Reload**：`npm run dev` 支援存檔即時更新，Python Server 則無此功能。

**例外情況**：如果您執行了 `npm run build` 並產生了 `dist/` 資料夾，您可以在 `dist` 目錄內使用 Python Server 來預覽最終成品。

---

## 3. 關閉服務

### 正常關閉（推薦）
在運行服務的終端機視窗中直接按下快捷鍵：
`Ctrl + C`

### 強制關閉（若端口被佔用）
如果服務沒關好導致 4321 端口被佔用，可以執行：
```bash
lsof -ti:4321 | xargs kill -9
```

---

## 3. 常用路徑
- **遊戲頁面**：`src/pages/game/`
- **部落格文章**：`src/content/blog/`
- **共用組件**：`src/components/`
