---
title: "打磚塊遊戲 AI：運用軌跡模擬演算法 (Trajectory Simulation)"
pubDate: 2026-01-10
description: "深入解析經典打磚塊遊戲的 AI 實作。探討如何利用確定性物理系統的特性，透過暴力搜尋 (Brute-force Search) 與軌跡模擬，在有限狀態空間中尋求全域最佳解。"
author: "wemee (with AI assistant)"
tags: ["game-ai", "algorithm", "simulation", "typescript"]
---

## 前言

在重構經典打磚塊遊戲 (Breakout) 時，我嘗試實作一個「上帝視角」的 AI Agent。這篇文章將從演算法的角度，探討如何利用**物理確定性 (Deterministic Physics)** 構建一個近乎完美的自動遊玩系統。

## 問題定義：局部最佳 vs 全域最佳

早期的 AI 實作採用了簡單的**貪婪策略 (Greedy Strategy)**：
1. 找出距離球最近的磚塊。
2. 計算將球打向該磚塊所需的板子偏移量。

這種「眼見即所得」的方法在簡單場景有效，但在複雜地形中經常失效。例如，當目標磚塊被障礙物阻擋，或位於極端角度時，AI 會陷入**局部最佳解 (Local Optimum)** 死循環——不斷嘗試同一個無法到達的路徑。

## 解決方案：基於模擬的狀態空間搜尋

既然遊戲物理引擎是**確定性**的（在這個簡單版本中，沒有隨機干擾），我們完全可以預測未來的狀態。

我們將問題轉化為一個**最佳化問題 (Optimization Problem)**：
> 給定球的落點 $X_{land}$，尋找最佳接球偏移量 $\Delta x$，使得球反彈後獲得的分數 $S$ 最大化。

### 1. 離散化動作空間 (Action Space Discretization)

玩家的動作（接球位置）雖然在像素級是連續的，但為了搜尋效率，我們將其離散化。我在板子寬度範圍內取樣了 9 個關鍵點：

```typescript
// 測試位置：從板子最左側(-0.4)到最右側(0.4)
const testPositions = [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4];
```

### 2. 軌跡模擬 (Trajectory Simulation)

對於每一個候選動作，我們執行一次輕量級的物理模擬。這是一個**時間複雜度為 $O(K \times T)$** 的過程，其中 $K$ 是候選動作數量 (9)，$T$ 是模擬步數 (500)。在現代瀏覽器的 V8 引擎中，這幾乎是瞬間完成的。

```typescript
private simulateBallPath(startX: number, startY: number, dx: number, dy: number): number {
  let score = 0;
  const hitBricks = new Set<number>();
  
  // 模擬未來 500 幀的物理狀態
  for (let step = 0; step < 500; step++) {
    // 更新位置
    x += dx;
    y += dy;
    
    // 處理牆壁碰撞 (完全彈性碰撞)
    if (x < 0 || x > canvasWidth) dx = -dx;
    if (y < 0) dy = -dy;
    
    // 碰撞檢測與分數計算
    const hitIndex = this.checkBrickCollision(x, y);
    if (hitIndex !== -1 && !hitBricks.has(hitIndex)) {
      hitBricks.add(hitIndex);
      score += this.bricks[hitIndex].points;
      // 模擬反彈
      dy = -dy; 
    }
    
    // 終止條件：球回到底部
    if (y > paddleY) break;
  }
  
  return score; // 回傳該路徑的總收益
}
```

### 3. 決策制定

AI 遍歷所有候選動作的模擬收益，選擇 $\text{argmax}(Score)$ 作為最終決策。這本質上是一種**深度優先搜尋 (DFS)** 的變體，只不過搜尋深度被限制在「一次擊球週期」內。

## 成果與效能分析

實裝後，AI 展現了驚人的預判能力：
- **精準打擊**：能利用牆壁反彈攻擊角落的死角。
- **穿透地形**：懂得先打通一條路，進入磚塊上方進行連續反彈。

由於 $K$ 和 $T$ 都很小，每幀計算成本不到 1ms，對於 60FPS 的渲染循環毫無壓力。

## 結語

打磚塊 AI 的成功，歸功於問題的**低維度特性**：
1. **單一決策點**：只有在接球的一瞬間需要做決定。
2. **確定性回饋**：沒有雜訊，Input 必對應固定的 Output。

這是一個完美的「模擬搜尋」應用場景。然而，同樣的方法應用在動態更複雜的遊戲（如下樓梯）時，我們就踢到了鐵板...

---

*本文由 AI 協助撰寫，基於真實開發經驗。*
