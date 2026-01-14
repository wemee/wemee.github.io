# Phaser 3 Arcade Physics 研究報告

> **日期**：2026-01-14
> **目的**：調查碰撞測試中動能逐漸損失的原因

---

## 🐛 問題現象

在「基礎碰撞」測試中觀察到：
- 初始總動能約 **500,000**
- 數秒後降至 **1,000** 以下
- 球體幾乎停止移動

設定已使用：
- `setBounce(1, 1)` — 應為完全彈性
- `setDrag(0)` — 無空氣阻力
- `setFriction(0, 0)` — 無摩擦力

---

## 🔍 根本原因分析

### Arcade Physics 的設計限制

Phaser 3 的 Arcade Physics 是一個 **輕量級物理引擎**，設計目標是「街機風格遊戲」，而非物理模擬。

關鍵發現：

| 屬性 | 預期行為 | 實際行為 |
|------|----------|----------|
| `bounce = 1` | 牆壁碰撞完全反彈 ✅ | 牆壁碰撞正常 |
| `bounce = 1` | 物體間碰撞能量守恆 ❌ | **使用 Projection Method，不保證能量守恆** |

### Projection Method 的問題

Arcade Physics 使用 **Projection-based Separation（投影分離法）** 處理物體間碰撞：

1. 偵測兩物體重疊
2. 將物體「推開」到不重疊位置
3. 根據 `bounce` 和 `mass` 計算新速度

這個方法的問題：
- **不是基於動量守恆公式計算**
- 多物體碰撞時會產生數值誤差累積
- 高速碰撞或密集物體時不穩定

### `slideFactor` 的影響

Arcade Physics 有一個較少人知道的屬性 `slideFactor`（預設值 = 1）：
- 控制被推動時保留多少速度
- 即使設為 1，碰撞解析過程仍會損失能量

---

## ✅ 解決方案

### 方案 A：自訂碰撞處理（推薦）

使用 `processCallback` 攔截碰撞，實作真正的彈性碰撞公式：

```typescript
this.physics.add.collider(balls, balls, null, (ball1, ball2) => {
    // 使用物理公式計算碰撞後速度
    const m1 = ball1.body.mass;
    const m2 = ball2.body.mass;
    const v1 = ball1.body.velocity.clone();
    const v2 = ball2.body.velocity.clone();
    
    // 一維彈性碰撞公式（需擴展到二維）
    const newV1 = v1.scale(m1 - m2).add(v2.scale(2 * m2)).scale(1 / (m1 + m2));
    const newV2 = v2.scale(m2 - m1).add(v1.scale(2 * m1)).scale(1 / (m1 + m2));
    
    ball1.setVelocity(newV1.x, newV1.y);
    ball2.setVelocity(newV2.x, newV2.y);
    
    return false; // 阻止預設碰撞處理
});
```

### 方案 B：使用 Matter.js

Phaser 3 內建支援 Matter.js 物理引擎：
- 更精確的物理模擬
- 真正的動量守恆
- 但效能較差，設定較複雜

### 方案 C：簡化場景

如果只需要展示效果：
- 減少球體數量
- 降低初始速度
- 定期「補充」能量

---

## 📝 結論

| 引擎 | 優點 | 缺點 | 適用場景 |
|------|------|------|----------|
| **Arcade Physics** | 輕量、快速、易用 | 不保證能量守恆 | 平台遊戲、射擊遊戲 |
| **Matter.js** | 精確、支援複雜形狀 | 較慢、設定複雜 | 物理解謎、模擬器 |

**建議**：對於熱血風格遊戲，Arcade Physics 足夠使用。對於物理展示，需自訂碰撞邏輯或改用 Matter.js。

---

## 🔧 下一步行動

1. 實作自訂彈性碰撞公式（方案 A）
2. 驗證動能守恆
3. 更新碰撞測試程式
