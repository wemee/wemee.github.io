# Bootstrap → Tailwind CSS 漸進式遷移計劃

> 📋 **備忘錄目的**: 給新 conversation 的完整上下文，讓 Agent 可以無縫接手遷移工作

---

## 📌 專案背景

- **網站**: wemee.github.io (Astro 靜態網站)
- **目前樣式**: Bootstrap 5 (Bootswatch Solar 主題) + CDN 載入
- **目標**: 逐步遷移至 Tailwind CSS v4
- **已完成**: Sudoku 遊戲已成功遷移至 Tailwind v4

### 關鍵技術決策
- Tailwind v4 使用 `@tailwindcss/vite` plugin
- 設定 `preflight: false` 確保與 Bootstrap 共存
- 使用 CSS `@theme {}` 指令定義 Design Tokens
- 遷移期間兩套樣式系統並存

---

## 📂 網站結構總覽

### Layouts (2 個)
| 檔案 | 狀態 | 說明 |
|------|------|------|
| `BaseLayout.astro` | ❌ Bootstrap | 主站 Layout，載入 Bootstrap CDN |
| `SudokuAppLayout.astro` | ✅ Tailwind | 數獨專用 Layout |

### 核心元件 (2 個)
| 檔案 | 狀態 | 優先級 | 說明 |
|------|------|--------|------|
| `Navbar.astro` | ❌ Bootstrap | 🔴 高 | 全站導航，重度 Bootstrap |
| `Footer.astro` | ❌ Bootstrap | 🟡 中 | 全站頁尾 |

### Pages 分類

#### 1️⃣ 首頁與關於 (低複雜度)
| 頁面 | Bootstrap 使用程度 | 優先建議 |
|------|---------------------|----------|
| `index.astro` | 中 (container, cards) | Phase 2 |
| `about.astro` | 低 (container, btns) | Phase 2 |

#### 2️⃣ 部落格 (中等複雜度)
| 頁面 | Bootstrap 使用程度 | 優先建議 |
|------|---------------------|----------|
| `blog/index.astro` | 中 (cards, btns) | Phase 3 |
| `blog/[...slug].astro` | 中 (container, prose) | Phase 3 |

#### 3️⃣ 數學工具 (高複雜度 - 大量自訂 CSS)
| 頁面 | Bootstrap 使用程度 | 優先建議 |
|------|---------------------|----------|
| `math/index.astro` | 中 (cards) | Phase 3 |
| `math/gcdlcm.astro` | 高 (forms, btns) | Phase 4 |
| `math/fourier.astro` | 高 (forms, cards, canvas) | Phase 4 |
| `math/waveform.astro` | 高 (forms, sliders, canvas) | Phase 4 |
| `math/traffic.astro` | 高 (complex UI) | Phase 4 |
| `math/dot-product.astro` | 高 (svg, forms) | Phase 4 |

#### 4️⃣ 遊戲 (混合狀態)
| 頁面 | Bootstrap 使用程度 | 優先建議 |
|------|---------------------|----------|
| `game/index.astro` | 中 (cards) | Phase 2 |
| `game/sudoku/` | ✅ 已完成 | - |
| `sudoku/` | ✅ 已完成 | - |
| `game/stairs.astro` | 低 (container only) | Phase 3 |
| `game/breakout.astro` | 低 (container, btns) | Phase 3 |
| `game/collision/` | 低 | Phase 3 |
| `game/phaser-demo/` | 低 | Phase 3 |

#### 5️⃣ 工具 (最高複雜度 - 重度 CSS)
| 頁面 | Bootstrap 使用程度 | 複雜度 | 優先建議 |
|------|---------------------|--------|----------|
| `tools/index.astro` | 中 (cards) | 低 | Phase 2 |
| `tools/memo/` | 🔴 極高 | 極高 | Phase 5 |
| `tools/notepad/` | 🔴 極高 | 極高 | Phase 5 |
| `tools/image-lab/` | 🔴 極高 | 極高 | Phase 5 |
| `tools/id-photo/` | 高 | 高 | Phase 5 |
| `tools/qrcode/` | 中 | 中 | Phase 4 |
| `tools/digit-recognition/` | 中 | 中 | Phase 4 |

---

## 🗺️ 遷移策略

### 核心原則
1. **漸進式**: 一次只動一個頁面/元件
2. **可回滾**: 每次變更都可獨立 commit
3. **測試優先**: 每次遷移後必須視覺驗證
4. **共存期**: Bootstrap 和 Tailwind 會共存很長時間

### 遷移順序

```
Phase 1: 基礎設施 (已完成 ✅)
├── 安裝 Tailwind v4
├── 設定 @tailwindcss/vite
├── 建立 global.css (@theme)
└── 驗證 preflight: false 共存

Phase 2: 低風險頁面
├── game/index.astro (遊戲列表)
├── tools/index.astro (工具列表)
├── index.astro (首頁)
└── about.astro (關於頁)

Phase 3: 中等複雜度
├── blog/index.astro
├── blog/[...slug].astro
├── math/index.astro
├── 遊戲頁面 (stairs, breakout, collision, phaser-demo)
└── Navbar.astro (關鍵！)

Phase 4: 高複雜度工具
├── math/* (數學視覺化工具)
├── tools/qrcode
├── tools/digit-recognition
└── Footer.astro

Phase 5: 極高複雜度 (最後處理)
├── tools/memo (重度 CSS 編輯器)
├── tools/notepad (重度 CSS 編輯器)
├── tools/image-lab (圖片編輯器)
└── tools/id-photo (證件照工具)

Phase 6: 移除 Bootstrap
├── 從 BaseLayout.astro 移除 Bootstrap CDN
├── 建立 Tailwind Design System 取代 Bootswatch Solar
└── 最終清理與優化
```

---

## ⚙️ 技術細節

### 現有 Bootstrap 依賴 (BaseLayout.astro)
```html
<!-- CSS -->
<link href="https://cdn.jsdelivr.net/npm/bootswatch@5.3.0/dist/solar/bootstrap.min.css" rel="stylesheet">

<!-- JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
```

### 需要 Bootstrap JS 的元件
- Navbar dropdown (下拉選單)
- Modal (彈窗) - 部分工具使用
- Collapse (摺疊) - 部分頁面使用

### Tailwind v4 配置位置
- `astro.config.mjs`: Vite plugin 設定
- `tailwind.config.mjs`: 主題設定 (preflight: false)
- `src/styles/global.css`: @theme 設定與 Design Tokens

### 已建立的 Sudoku Design Tokens
```css
@theme {
  --color-sudoku-bg: #073642;
  --color-sudoku-cell-bg: #002b36;
  --color-sudoku-cell-bg-selected: #268bd2;
  --color-sudoku-text: #93a1a1;
  --color-sudoku-text-user: #2aa198;
  /* ... 更多 */
}
```

---

## 🎨 Design System 對照表 (Bootswatch Solar → Tailwind)

| Bootstrap Class | Tailwind 對應 | 說明 |
|-----------------|---------------|------|
| `container` | `max-w-7xl mx-auto px-4` | 容器 |
| `row` | `grid` or `flex` | 行 |
| `col-*` | `grid-cols-*` or `w-*` | 欄 |
| `btn btn-primary` | 自訂 `btn-*` | 按鈕 |
| `card` | 自訂 `card` | 卡片 |
| `text-muted` | `text-gray-500` | 次要文字 |
| `bg-dark` | `bg-gray-900` | 深色背景 |
| `form-control` | 自訂 `input` | 表單控件 |

### Bootswatch Solar 色彩對照
| Solar 名稱 | Hex 值 | Tailwind Token 建議 |
|------------|--------|---------------------|
| Base03 | #002b36 | `--color-base-900` |
| Base02 | #073642 | `--color-base-800` |
| Base01 | #586e75 | `--color-base-600` |
| Base0 | #839496 | `--color-base-500` |
| Base1 | #93a1a1 | `--color-base-400` |
| Base2 | #eee8d5 | `--color-base-100` |
| Base3 | #fdf6e3 | `--color-base-50` |
| Yellow | #b58900 | `--color-accent-yellow` |
| Orange | #cb4b16 | `--color-accent-orange` |
| Red | #dc322f | `--color-accent-red` |
| Magenta | #d33682 | `--color-accent-magenta` |
| Violet | #6c71c4 | `--color-accent-violet` |
| Blue | #268bd2 | `--color-accent-blue` |
| Cyan | #2aa198 | `--color-accent-cyan` |
| Green | #859900 | `--color-accent-green` |

---

## 📋 單頁遷移 Checklist

每個頁面遷移時使用此清單：

```markdown
## [頁面名稱] 遷移

### 準備
- [ ] 檢視目前頁面截圖 (作為對照)
- [ ] 列出所有使用的 Bootstrap classes
- [ ] 識別是否需要 Bootstrap JS 功能

### 遷移
- [ ] 建立備份分支
- [ ] 將 Bootstrap classes 轉換為 Tailwind
- [ ] 移除 inline styles (改用 Tailwind)
- [ ] 確保 import global.css

### 驗證
- [ ] 桌面版視覺對照
- [ ] 手機版響應式測試
- [ ] 互動功能測試
- [ ] 無 console 錯誤

### 完成
- [ ] Git commit
- [ ] 更新遷移進度文件
```

---

## ⚠️ 風險與注意事項

### 高風險區域
1. **Navbar dropdown**: 需要 Bootstrap JS 或改用 Tailwind Headless UI
2. **Modal 彈窗**: tools/memo, tools/notepad 使用 Bootstrap modal
3. **Form 控件**: 數學工具有大量表單，需統一樣式
4. **Canvas 工具**: 確保 CSS 不影響 Canvas 渲染

### 建議策略
- **Navbar**: 最後再動，或考慮保留 Bootstrap Navbar
- **Modal**: 考慮使用 Headless UI Dialog 或純 CSS modal
- **漸進式**: 先處理純展示頁，再處理互動頁

---

## 📁 相關文件位置

```
/src/
├── layouts/
│   ├── BaseLayout.astro          # 主站 Layout (Bootstrap)
│   └── SudokuAppLayout.astro     # 數獨 Layout (Tailwind)
├── components/
│   ├── Navbar.astro              # 導航 (Bootstrap)
│   └── Footer.astro              # 頁尾 (Bootstrap)
├── styles/
│   └── global.css                # Tailwind @theme
├── pages/
│   ├── sudoku/                   # ✅ 已遷移
│   ├── game/sudoku/              # ✅ 已遷移
│   └── ...                       # ❌ 待遷移
├── astro.config.mjs              # Vite + Tailwind 設定
└── tailwind.config.mjs           # Tailwind 主題設定
```

---

## 🚀 下一步行動

1. **開新 conversation** 執行 Phase 2
2. **先從 `game/index.astro` 開始** (低風險、已熟悉)
3. **建立 global Design System** (統一色彩變數)
4. **逐頁遷移並驗證**

---

*最後更新: 2026-01-17*
*建立者: Antigravity Agent*
