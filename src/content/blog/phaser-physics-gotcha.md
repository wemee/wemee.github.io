---
title: "Phaser Arcade Physics 的隱藏陷阱：為什麼 bounce=1 不等於完全彈性碰撞"
pubDate: 2026-01-14
description: "深入研究 Phaser 3 Arcade Physics 的碰撞機制。揭露動能損失的根本原因，以及如何自訂碰撞邏輯來實現真正的完全彈性碰撞。"
author: "wemee (with AI assistant)"
tags: ["phaser", "physics", "debugging", "gotcha"]
image: "/images/blog/phaser-physics-gotcha.png"
---

## 前言：一個「不可能」的現象

為了測試 Phaser 3 的物理引擎，我建立了一個簡單的碰撞場景：
- 18 顆球體隨機運動
- 無重力、無摩擦力
- 球與球、球與牆壁都設定為**完全彈性碰撞**

理論上，這是一個**封閉系統**，總動能應該守恆。

但實際觀察到的現象：

| 時間 | 總動能 |
|------|--------|
| 開始 | ~500,000 |
| 5 秒後 | ~100,000 |
| 30 秒後 | ~1,000 |

動能竟然流失了 **99.8%**！

![物理碰撞預期 vs 現實](/images/blog/phaser-physics-gotcha.png)

## 我的設定哪裡有問題嗎？

檢查程式碼，設定看起來完全正確：

```typescript
ball.setBounce(1, 1);           // 完全彈性
ball.setCollideWorldBounds(true); // 牆壁碰撞
ball.setDrag(0);                 // 無空氣阻力
ball.setFriction(0, 0);          // 無摩擦力

this.physics.add.collider(balls, balls); // 球與球碰撞
```

那問題出在哪裡？

## 根本原因：Projection Method

經過深入研究，我發現了真相：

> **Phaser Arcade Physics 使用 Projection-based Separation（投影分離法）處理物體間碰撞，這個演算法「不保證」動量/能量守恆。**

### Arcade Physics 的碰撞處理流程

1. **偵測重疊**：判斷兩個物體的碰撞框是否交疊
2. **分離物體**：將物體「推開」到不重疊的位置
3. **計算新速度**：根據 `bounce` 和 `mass` 調整速度向量

這個流程的問題在於第 2 步和第 3 步**不是基於物理公式計算**的。它是一種近似解法，追求的是「看起來合理」而非「物理正確」。

### `bounce = 1` 的真正意義

| 情境 | 行為 |
|------|------|
| 撞牆壁 | ✅ 速度完全反射，正常運作 |
| 撞另一個物體 | ⚠️ 使用近似演算法，會損失能量 |

所以 `bounce = 1` 對牆壁有效，但對物體間碰撞**不保證完全彈性**。

## 驗證：查看 Phaser 原始碼

在 Phaser 的 GitHub 倉庫中，碰撞處理的核心邏輯位於 `SeparateX` 和 `SeparateY` 函數。這些函數使用的是經驗公式，而非完整的二維彈性碰撞公式：

$$
v_1' = \frac{(m_1 - m_2)v_1 + 2m_2 v_2}{m_1 + m_2}
$$

$$
v_2' = \frac{(m_2 - m_1)v_2 + 2m_1 v_1}{m_1 + m_2}
$$

Arcade Physics 沒有完整實作這個公式。

## 解決方案

### 方案 A：自訂碰撞處理（推薦）

使用 `processCallback` 攔截碰撞，自己實作物理公式：

```typescript
this.physics.add.collider(balls, balls, null, (ball1, ball2) => {
    this.handleElasticCollision(ball1, ball2);
    return false; // 阻止預設處理
});
```

```typescript
private handleElasticCollision(
    obj1: Phaser.Physics.Arcade.Sprite,
    obj2: Phaser.Physics.Arcade.Sprite
): void {
    const body1 = obj1.body as Phaser.Physics.Arcade.Body;
    const body2 = obj2.body as Phaser.Physics.Arcade.Body;
    
    // 計算碰撞法向量
    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    
    // 相對速度在法向量上的投影
    const dvx = body1.velocity.x - body2.velocity.x;
    const dvy = body1.velocity.y - body2.velocity.y;
    const dvn = dvx * nx + dvy * ny;
    
    // 如果物體正在分離，不處理
    if (dvn < 0) return;
    
    // 彈性碰撞公式
    const m1 = body1.mass;
    const m2 = body2.mass;
    const impulse = (2 * dvn) / (m1 + m2);
    
    body1.velocity.x -= impulse * m2 * nx;
    body1.velocity.y -= impulse * m2 * ny;
    body2.velocity.x += impulse * m1 * nx;
    body2.velocity.y += impulse * m1 * ny;
    
    // 手動分離物體避免重疊
    const overlap = (body1.halfWidth + body2.halfWidth) - dist;
    if (overlap > 0) {
        const separateX = (overlap / 2 + 1) * nx;
        const separateY = (overlap / 2 + 1) * ny;
        body1.x -= separateX;
        body1.y -= separateY;
        body2.x += separateX;
        body2.y += separateY;
    }
}
```

### 方案 B：改用 Matter.js

Phaser 3 內建支援 Matter.js 物理引擎，它是基於約束求解器的真正物理模擬：

```typescript
const config = {
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0 },
            debug: true
        }
    }
};
```

Matter.js 的碰撞處理更精確，但效能開銷較大。

## 結論：選擇適合的工具

| 引擎 | 適用場景 | 物理精確度 |
|------|----------|------------|
| **Arcade Physics** | 平台遊戲、射擊遊戲 | 近似（足夠遊戲用） |
| **Matter.js** | 物理解謎、模擬器 | 精確 |
| **自訂邏輯** | 特定需求 | 取決於實作 |

對於熱血系列風格的動作遊戲，Arcade Physics 的預設行為**完全足夠**——我們不需要完美的物理，只需要「手感好」的碰撞回饋。

但如果你正在做物理教學展示或模擬器，就需要自訂碰撞邏輯或改用 Matter.js。

## 學到的教訓

1. **文檔說的「完全彈性」不一定是物理學定義的完全彈性**
2. **遊戲引擎優先考慮的是「手感」而非「精確」**
3. **深入研究原始碼是解決疑難雜症的最佳方法**

---

**展示工具**：[基礎碰撞物理測試](/game/collision/)

*本文由 AI 協助撰寫，基於真實踩坑經驗。*

