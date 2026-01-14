---
title: "Phaser 3 架構設計：從單一 Demo 到可擴展的多遊戲框架"
pubDate: 2026-01-14
description: "分享在 Astro 專案中整合 Phaser 3 時的架構重構經驗。探討如何從快速原型演進到符合 SOLID 原則的可維護架構。"
author: "wemee (with AI assistant)"
tags: ["phaser", "architecture", "solid", "typescript", "refactoring"]
image: "/images/blog/phaser-architecture.png"
---

## 前言：第一版的問題

當我第一次將 Phaser 3 整合到網站時，為了快速驗證概念，我把所有東西都放在一起：

```
src/lib/games/phaser/
├── config.ts           # 混雜了全站設定和 Demo 專屬設定
├── PhaserDemo.ts       # 遊戲入口
└── scenes/
    ├── BootScene.ts
    └── GameScene.ts
```

這個架構能跑，但有一個致命問題：**當我想新增第二款遊戲時，設定會打架**。

例如，`config.ts` 裡同時定義了：
- 全站預設的畫面尺寸
- Demo 遊戲的角色動畫幀數

這違反了 **Single Responsibility Principle (SRP)**——一個檔案承擔了太多職責。

![架構設計圖](/images/blog/phaser-architecture.png)

## 重構：核心分離 vs 遊戲獨立

經過思考，我將架構重新設計為兩層：

### 1. 核心層 (`core/`)

全站共用的基礎設施：

```typescript
// core/config.ts - 全站預設設定
export const DEFAULT_GAME_CONFIG = {
    type: Phaser.AUTO,
    pixelArt: true,
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};
```

```typescript
// core/PhaserBase.ts - 遊戲基礎類別
export class PhaserBase {
    protected game: Phaser.Game | null = null;
    
    protected initGame(config: Partial<Phaser.Types.Core.GameConfig>): void {
        const finalConfig = mergeGameConfig({
            parent: this.containerId,
            ...config
        });
        this.game = new Phaser.Game(finalConfig);
    }
    
    destroy(): void {
        this.game?.destroy(true);
    }
}
```

### 2. 遊戲層 (`games/`)

每款遊戲獨立一個資料夾：

```
games/
├── demo/                # Demo 遊戲
│   ├── config.ts       # Demo 專屬設定
│   ├── DemoGame.ts     # 繼承 PhaserBase
│   └── scenes/
│       ├── BootScene.ts
│       └── GameScene.ts
│
└── collision/           # 碰撞物理測試
    ├── config.ts       # Collision 專屬設定
    ├── CollisionGame.ts
    └── scenes/
        └── CollisionScene.ts
```

## 設計原則的實踐

### Single Responsibility (SRP)

- `core/config.ts`：只負責全站預設值
- `games/demo/config.ts`：只負責 Demo 遊戲的設定

### Open-Closed Principle (OCP)

新增遊戲時：
- ✅ 擴展：建立新的 `games/xxx/` 資料夾
- ❌ 修改：不需要動到 `core/` 的任何程式碼

### Dependency Inversion (DIP)

各遊戲依賴**抽象**的 `PhaserBase`，而非具體的 Phaser 初始化邏輯。

## 新增遊戲的標準流程

現在，新增一款遊戲只需要：

```bash
# 1. 建立資料夾結構
mkdir -p src/lib/games/phaser/games/kunio/scenes

# 2. 建立設定檔
touch src/lib/games/phaser/games/kunio/config.ts

# 3. 建立遊戲入口（繼承 PhaserBase）
touch src/lib/games/phaser/games/kunio/KunioGame.ts

# 4. 建立場景
touch src/lib/games/phaser/games/kunio/scenes/GameScene.ts
```

每款遊戲都是**自包含**的模組，可以獨立開發、測試、部署。

## 程式碼範例：遊戲入口

```typescript
// games/collision/CollisionGame.ts
import { PhaserBase } from '../../core';
import { COLLISION_CONFIG } from './config';
import { CollisionScene } from './scenes/CollisionScene';

export class CollisionGame extends PhaserBase {
    start(): void {
        this.initGame({
            width: COLLISION_CONFIG.width,
            height: COLLISION_CONFIG.height,
            scene: [CollisionScene]
        });
    }
}
```

簡潔、清晰、可維護。

## 結語

架構設計是一個**持續演進**的過程。第一版快速驗證概念，發現問題後再重構——這是正常且健康的開發節奏。

關鍵是要有意識地思考：
- 這個設計能支撐未來的擴展嗎？
- 新增功能時，需要修改多少現有程式碼？
- 程式碼的職責是否清晰？

下一篇文章，我將分享在實作物理碰撞測試時踩到的一個大坑——`bounce = 1` 並不等於完全彈性碰撞！

---

*本文由 AI 協助撰寫，基於真實重構經驗。*
