---
title: "從原生 Canvas 到 Phaser 3：2D 遊戲引擎技術選型全記錄"
pubDate: 2026-01-14
description: "記錄在 Astro 網站中導入 2D 遊戲引擎的完整決策過程。從現有的原生 Canvas 遊戲出發，分析為何選擇 Phaser 3，以及它如何滿足製作熱血風格遊戲的需求。"
author: "wemee (with AI assistant)"
tags: ["phaser", "game-dev", "architecture", "decision-making"]
image: "/images/blog/phaser-tech-selection.png"
---

## 前言：為什麼需要遊戲引擎？

我的網站上已經有兩款用原生 Canvas API 開發的小遊戲：**打磚塊 (Breakout)** 和 **下樓梯 (Stairs)**。它們運作良好，每款約 600 行 TypeScript，甚至都有 AI 自動遊玩功能。

但當我開始構想更有野心的目標——製作類似**熱血物語**、**熱血高校躲避球部**這類經典像素動作遊戲時，我意識到原生 Canvas 的局限性：

- **Sprite Animation**：需要自己管理動畫幀、狀態切換
- **Tilemap System**：場景地圖拼接需要從零建構
- **Collision Detection**：複雜的碰撞判定邏輯
- **Camera System**：畫面跟隨角色的實作
- **Audio Management**：背景音樂與音效的同步

這些功能都可以自己寫，但等於是在「重新發明輪子」。

![技術選型比較圖](/images/blog/phaser-tech-selection.png)

## 候選引擎比較

我評估了以下幾個主流選項：

### 1. 繼續使用原生 Canvas API

| 優點 | 缺點 |
|------|------|
| 零依賴、極致輕量 | 工作量巨大 |
| 完全掌控 | 每個功能都要自己實作 |
| 現有遊戲已經在用 | 維護成本高 |

**結論**：適合簡單遊戲，不適合複雜專案。

### 2. PixiJS

| 優點 | 缺點 |
|------|------|
| Bundle Size 小 (~50KB) | 只是渲染引擎 |
| WebGL 效能優秀 | 物理、音效需自己整合 |
| 業界廣泛使用 | 學習曲線較陡 |

**結論**：適合已有完整架構的團隊。

### 3. Kaboom.js

| 優點 | 缺點 |
|------|------|
| 語法極簡 | 生態系較小 |
| 快速原型開發 | 文檔相對較少 |
| 輕量 (~40KB) | 社群不夠活躍 |

**結論**：適合 Game Jam，長期專案有風險。

### 4. Phaser 3

| 優點 | 缺點 |
|------|------|
| 功能最完整 | 相對較大 (~200KB) |
| 原生 Tilemap 支援 | 學習內容較多 |
| 完整 TypeScript 支援 | — |
| 社群活躍、範例 1700+ | — |

**結論**：最適合我的目標。

## 為什麼最終選擇 Phaser 3？

關鍵決策因素：

### 1. Tilemap 原生支援

Phaser 3 可以直接讀取 **Tiled Map Editor** 輸出的 JSON 檔案。這對於製作熱血系列那種有街道、學校、商店的場景至關重要。

### 2. 完整的動畫系統

```typescript
// 建立動畫只需幾行程式碼
this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
});
```

### 3. 兩種物理引擎

- **Arcade Physics**：輕量級，適合平台遊戲
- **Matter.js**：精確物理模擬，適合物理解謎

### 4. 活躍的社群

官方範例超過 1700 個，幾乎涵蓋所有常見需求。遇到問題很容易找到解答。

## 與 Astro 的整合

在 Astro 專案中使用 Phaser 3 非常簡單：

```bash
npm install phaser@3
```

然後在頁面的 `<script>` 區塊中初始化遊戲：

```typescript
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 480,
    height: 320,
    parent: 'game-canvas',
    scene: [BootScene, GameScene]
};

new Phaser.Game(config);
```

## 結語

技術選型沒有絕對的對錯，只有**適合與否**。對於想要製作具有一定複雜度的 2D 遊戲，Phaser 3 提供了最完整的開箱即用體驗。

下一篇文章，我將分享如何設計一個**可擴展的遊戲架構**，讓多款遊戲共用核心邏輯，同時保持各自的獨立性。

---

*本文由 AI 協助撰寫，基於真實開發決策過程。*
