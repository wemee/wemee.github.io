# 數獨大事業 - 會議與靈感記錄

## 2026-01-16: 架構重構 (Architecture Refactoring Decision)

### 對齊共識
- **「大事業」的定義**：不是商業規模或未來藍圖，而是 **工程品質**。
- **目標**：SOLID 原則、高內聚低耦合、可測試、可維護。把這個數獨工具的「內功」練到極致。

### 發現的問題 (Code Smells)
| 問題 | 違反原則 | 說明 |
| :--- | :--- | :--- |
| `gameStore.ts` 過於肥大 | SRP (單一職責) | Store 混雜了狀態管理與業務邏輯 |
| 沒有定義 Interface | DIP (依賴反轉) | Store 直接依賴具體實作 `generateSudoku()` |
| 邏輯難以單元測試 | Testability | 邏輯綁在 Zustand Store，無法獨立測試 |
| Tailwind 與 Bootstrap 共存 | Separation of Concerns | 增加全站複雜度與 CSS 衝突風險 |

### 決策 (Decisions)
1.  **放棄 TailwindCSS**：改用 **CSS Modules** (`.module.css`) 達到樣式隔離。
2.  **抽出 `SudokuEngine` 類別**：封裝所有業務邏輯，不依賴 React/Zustand。
3.  **Store 薄層化**：只負責持有 state 和轉發 action。
4.  **定義 Interfaces**：`ISudokuGenerator`、`ISudokuSolver`，符合 DIP。
5.  **專用 Layout**：建立 `SudokuAppLayout.astro`，不載入 Bootstrap。

### 技術棧調整
- ~~TailwindCSS~~ → **CSS Modules**
- 新增：`SudokuEngine` 類別
- 新增：`interfaces.ts` 定義抽象介面

---

## 2026-01-16: 專案啟動 (Kickoff)

### 決策 (Decisions)
- **專案定位**：不只是小遊戲，而是「大事業」。強調互動美學與智能輔助。
- **資料夾結構**：
    - 文檔：`project_docs/sudoku/`
    - 頁面：`src/pages/sudoku/`
    - 邏輯：`src/lib/sudoku/`
- **技術棧**：Astro + React + ~~Tailwind~~ CSS Modules + Zustand

### 待辦事項 (Action Items)
- [x] 建立資料夾結構
- [x] 建立 Blueprint 文檔
- [x] 核心資料結構 (types, constants)
- [x] Generator 與 Solver (MVP)
- [ ] **架構重構 (進行中)**

---

## 靈感池 (Brainstorming)
*   **想法 1 (Magic Lens)**: 利用 Image Lab 的經驗，做一個很酷的掃描特效，像 Terminator 的視角一樣辨識數字。
*   **想法 2 (Zen Mode)**: 考慮加入白噪音或環境音效，讓解題過程更沉浸。
*   **想法 3 (Social)**: 每日挑戰 (Daily Challenge) 讓大家玩同一個盤面，比速度或步數。
