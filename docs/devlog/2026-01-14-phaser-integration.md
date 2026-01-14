# 遊戲引擎技術選型：導入 Phaser 3

> **日期**：2026-01-14
> **狀態**：進行中

## 📋 背景

為了網站的長遠發展，決定選擇一套統一的 2D 遊戲引擎作為全站共用框架。

### 現有遊戲

目前網站已有兩款遊戲，使用原生 Canvas API 開發：
- **Breakout（打磚塊）**：~650 行 TypeScript，包含 AI 邏輯
- **Stairs（無盡樓梯）**：~565 行 TypeScript，包含 AI 邏輯

這兩款遊戲運作良好，但架構相對簡單。

### 未來目標

希望開發類似任天堂經典遊戲風格的作品：
- **熱血物語**（Downtown Nekketsu Monogatari）
- **熱血高校躲避球部**（Nekketsu Kōkō Dodgeball Bu）

這類遊戲的技術需求：
- Sprite Animation（多幀角色動畫）
- Tilemap System（場景地圖拼接）
- Hitbox / Collision Detection
- Camera System（畫面跟隨）
- Entity Management（多角色管理）
- State Machine（角色狀態機）
- Audio Manager（音效管理）
- Input Combo System（連續技輸入）
- Dialogue System（對話系統）

---

## 🔍 技術評估

### 候選引擎比較

| 引擎 | Bundle Size | 優點 | 缺點 | 評分 |
|------|-------------|------|------|------|
| **Phaser 3** | ~200KB | 功能完整、文檔豐富、Tilemap 原生支援 | 相對較大 | ⭐⭐⭐⭐⭐ |
| **PixiJS** | ~50KB | 渲染效能優秀 | 只是渲染引擎，需自建遊戲邏輯 | ⭐⭐⭐ |
| **原生 Canvas** | 0 | 零依賴 | 工作量巨大 | ⭐⭐ |
| **Kaboom.js** | ~40KB | 語法簡潔 | 生態系較小 | ⭐⭐⭐⭐ |
| **LittleJS** | ~8KB | 超輕量 | 功能不夠完整 | ⭐⭐⭐ |

### 決策結論

選擇 **Phaser 3** 作為統一遊戲引擎，原因：
1. 專為 2D 遊戲設計，內建完整功能
2. Tilemap 原生支援 Tiled Map Editor
3. 完整的 TypeScript 支援
4. 社群活躍，官方範例超過 1700+
5. 支援 WebGL 和 Canvas fallback

---

## 🛠️ 實作計畫

### Phase 1：基礎整合（當前階段）
- [x] 技術選型決策
- [ ] 安裝 Phaser 3 依賴
- [ ] 建立 Phaser + Astro 整合範例
- [ ] 製作簡單的角色移動 Demo

### Phase 2：開發框架
- [ ] 建立共用場景結構（BootScene, MainMenuScene, GameScene）
- [ ] 設計 Entity 基礎類別
- [ ] 實作 InputManager
- [ ] 實作 DialogueSystem

### Phase 3：第一款 Phaser 遊戲
- [ ] 設計遊戲概念
- [ ] 製作角色 Sprite Sheet
- [ ] 建立 Tilemap 場景
- [ ] 實作遊戲邏輯

---

## 📁 專案結構（已實作）

```
src/lib/games/phaser/
├── core/                        # 🌐 全站共用的核心
│   ├── config.ts               # 預設 Phaser 設定
│   ├── PhaserBase.ts           # 遊戲基礎類別
│   └── index.ts                # 核心模組匯出
│
└── games/                       # 🎮 各個遊戲（獨立）
    └── demo/                    # Demo 遊戲
        ├── config.ts           # Demo 專屬設定
        ├── DemoGame.ts         # 遊戲入口
        ├── index.ts            # 模組匯出
        └── scenes/
            ├── BootScene.ts    # 資源載入場景
            └── GameScene.ts    # 主遊戲場景
```

### 架構設計原則

1. **核心分離** (`core/`)
   - 全站共用的 Phaser 預設設定
   - 提供 `PhaserBase` 基礎類別，處理初始化和銷毀邏輯
   - 各遊戲可覆寫預設設定

2. **遊戲獨立** (`games/`)
   - 每個遊戲有自己的資料夾
   - 每個遊戲有專屬的 `config.ts`
   - 場景、角色、資源路徑都是遊戲專屬

---

## 📝 開發日誌

### 2026-01-14
- 完成技術選型討論
- 決定採用 Phaser 3
- 開始整合工作
