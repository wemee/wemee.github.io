---
title: "從靜態 HTML 遷移到 Astro 框架：踩坑紀錄與心得"
pubDate: 2026-01-09
description: "記錄將個人 GitHub Pages 網站從純靜態 HTML 遷移到 Astro 框架的完整過程，包含遇到的問題與解決方案。"
author: "wemee (with AI assistant)"
tags: ["astro", "github-pages", "web-development", "migration"]
---

## 前言

今天花了幾個小時，把我的個人網站 [wemee.github.io](https://wemee.github.io) 從純靜態 HTML 遷移到了 Astro 框架。這篇文章記錄了整個過程中遇到的問題和解決方案。

## 為什麼要遷移？

原本的網站結構很單純，就是一堆 `.html` 檔案散落在各個資料夾：

```
├── index.html
├── math/
│   ├── gcd.html
│   ├── lcm.html
│   └── ...
├── game/
│   └── stairs.html
└── fishbanks/
    └── ...
```

問題在於：
- **沒有共用元件**：每個頁面都要複製貼上同樣的 `<head>` 和導覽列
- **維護困難**：改一個 CSS 連結就要改所有檔案
- **無法使用現代工具**：沒有 TypeScript、沒有組件化、沒有 hot reload

## 遷移過程

### 1. 初始化 Astro 專案

```bash
npm create astro@latest -- ./ --template minimal
```

建立 `astro.config.mjs`、`package.json`、`tsconfig.json` 等設定檔。

### 2. 建立共用元件

把重複的程式碼抽出來：

- **`src/layouts/BaseLayout.astro`**：共用頁面骨架，包含 Bootstrap CSS/JS
- **`src/components/Navbar.astro`**：共用導覽列

這樣每個頁面只需要：

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Navbar from '@/components/Navbar.astro';
---
<BaseLayout title="頁面標題">
  <Navbar />
  <!-- 頁面內容 -->
</BaseLayout>
```

### 3. 處理靜態資源

有些檔案不適合轉成 Astro 元件：
- **第三方函式庫**（如 `jsQR.min.js`）
- **Web Worker**（如 `prime-worker.js`）
- **大型獨立專案**（如 `fishbanks/` 整個資料夾）

這些直接放到 `public/` 目錄，Astro 會原封不動複製到輸出。

## 踩過的坑

### 坑 1：`is:inline` 問題

當 `<script>` 標籤引用 `public/` 目錄的檔案時，Astro 會報錯：

```
<script src="/math/prime/main.js"> references an asset in the "public/" directory. 
Please add the "is:inline" directive to keep this asset from being bundled.
```

**解決方案**：加上 `is:inline` 指令，並確保裡面是純 JavaScript（不是 TypeScript）：

```astro
<script is:inline src="/math/prime/main.js"></script>
<script is:inline>
  // 這裡只能用純 JavaScript，不能用 TypeScript 語法
</script>
```

### 坑 2：開發模式 vs 預覽模式

- `npm run dev`：開發模式，有 hot reload，但 `public/` 目錄的 `index.html` 不會自動作為目錄預設檔案
- `npm run preview`：預覽模式，顯示建構後的靜態檔案，行為與生產環境一致

如果訪問 `/fishbanks/` 出現 404，試試改用 `npm run build && npm run preview`。

### 坑 3：GitHub Actions 觸發分支錯誤（最大的坑！）

這是讓我卡最久的問題。

我建立了 `.github/workflows/deploy.yml`，但 push 後 Actions 完全沒有觸發。花了很久才發現：

```yaml
# 錯誤設定
on:
  push:
    branches: [master]  # ← 問題在這裡！

# 正確設定
on:
  push:
    branches: [main]    # ← 我的分支叫 main，不是 master
```

**教訓**：永遠先確認分支名稱！

### 坑 4：GitHub Pages Source 設定

即使有了 workflow 檔案，還需要去 GitHub 儲存庫設定：

1. Settings → Pages
2. Build and deployment → Source
3. 選擇「**GitHub Actions**」（不是「Deploy from a branch」）

## 遷移成果

現在的網站架構：

```
src/
├── layouts/
│   └── BaseLayout.astro    # 共用 Layout
├── components/
│   └── Navbar.astro        # 共用導覽列
├── pages/
│   ├── index.astro         # 首頁
│   ├── math/               # 數學工具
│   ├── game/               # 遊戲
│   ├── tools/              # 工具
│   └── blog/               # 部落格（新增！）
└── content/
    └── blog/               # 部落格文章 (Markdown)
```

**好處**：
- ✅ 修改導覽列只需要改一個檔案
- ✅ Hot reload 讓開發體驗大幅提升
- ✅ TypeScript 支援
- ✅ Content Collections 讓部落格管理變簡單
- ✅ 自動建構與部署

## 結語

整體來說，Astro 的遷移過程比預期順利。最大的問題反而是 GitHub Actions 的分支設定錯誤，完全是自己的疏忽。

如果你也有類似的靜態網站想要現代化，Astro 是個很好的選擇。它保留了靜態網站的簡單性，同時提供了現代框架的開發體驗。

---

*本文由 AI 協助撰寫，紀錄真實的遷移過程。*
