# 數獨大事業計畫書 (Sudoku Master Plan)

## 0. 核心願景 (Vision)
這不僅僅是一個數獨遊戲，而是一個結合 **「極致互動美學」** 與 **「智能輔助」** 的數獨平台。
我們的目標是解決傳統數獨 App 的痛點：介面單調、缺乏引導、廣告過多。
我們要打造的是數獨界的 "Linear" 或 "Arc"，流暢、優雅、強大。

## 1. 差異化特色 (Unique Selling Points)
我們將從以下幾個維度建立護城河：

### A. 極致美學 (Aesthetics) ✨
*   **動態互動：** 點擊數字時，相關聯的行、列、九宮格會有優雅的光影流動 (Micro-interactions)。
*   **主題系統：** 預設深色模式 (Cyberpunk/Neon) 與 禪模式 (Zen/Paper)，滿足不同情境。
*   **無干擾設計：** 介面極簡化，專注於數字與邏輯本身。

### B. 智能導師 (AI Logic) 🧠
*   **邏輯化提示：** 不只是「填入 5」，而是告訴你「因為这一行已經有 5 了，所以這裡只能是...」。
*   **視覺化推理：** 當使用提示時，高亮相關格子，展示 X-Wing, Naked Pairs 等高階技巧的邏輯線。

### C. 魔法功能 (Magic Features) 🪄
*   **OCR 掃描 (Magic Lens)：** 拍下報紙上的殘局，瞬間數位化，開始解題或獲得提示。
*   **智能筆記 (Auto Pencil)：** 自動標記所有可能的候選數 (Candidates)，隨填寫自動更新，省去繁瑣操作（可依照難度開關）。

## 2. 技術架構 (Technical Stack)

| Component | Choice | Reason |
| :--- | :--- | :--- |
| **Framework** | **Astro + React** | 沿用現有架構，Astro 處理靜態骨架與 SEO，React 處理複雜的盤面互動狀態。 |
| **State Mgmt** | **Zustand** | 輕量級狀態管理，適合處理盤面、歷史紀錄 (Undo/Redo)、設定。 |
| **Styling** | **TailwindCSS** | 快速打造自定義 Design System，配合 CSS Variables 實現多主題切換。 |
| **Logic/Algo** | **TypeScript** | 核心生成與求解算法。若遇效能瓶頸可考慮 Rust (Wasm)，但 TS 對數獨通常足夠。 |
| **OCR** | **Tesseract.js** | 前端純 Web 實作 OCR，保護隱私且無需後端。 |

## 3. 開發階段規劃 (Roadmap)

### Phase 1: MVP (Minimum Viable Product)
- [ ] 基礎設施：專案結構、Types 定義
- [ ] 核心邏輯：Grid 生成、驗證
- [ ] 介面實作：互動盤面、數字鍵盤
- [ ] 基礎遊戲循環：開始、遊玩、勝利

### Phase 2: Polish (體驗優化)
- [ ] 筆記模式 (Note Mode)
- [ ] 歷史紀錄 (Undo/Redo)
- [ ] UI 動畫與音效 (Sound FX)
- [ ] 勝利結算畫面

### Phase 3: Advanced (大事業功能)
- [ ] 智能提示算子 (Solver logic for hints)
- [ ] OCR 掃描功能
- [ ] PWA 離線支援
