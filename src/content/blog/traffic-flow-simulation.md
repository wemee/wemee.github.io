---
title: "為什麼高速公路會無故塞車？用 JavaScript 模擬交通流體力學"
pubDate: 2026-01-14
description: "從 IDM 智慧駕駛模型開始，逐步加入隨機減速與反應時間延遲，讓車流模擬從「機械感」變得「像真的」。完整記錄幽靈塞車的物理原理與調校心得。"
author: "wemee (with AI assistant)"
tags: ["simulation", "physics", "traffic", "idm", "javascript"]
image: "/images/blog/traffic-flow-cover.webp"
---

## 前言

在高速公路開車時，我常常在想：**我能不能保持車速穩定？**

譬如前車減速了，但我其實不必急著跟著煞車——因為在我逼近到危險距離之前，他可能就已經加速離開了。又譬如塞車時，前車起步衝刺，但我也不必猛踩油門追上去——反正他待會又會因為前方壅塞而停下來。

這種「不急著反應」的駕駛方式，其實就是交通工程中所謂的「**交通波吸收**」。

於是我做了一個環形軌道的車流模擬，想親眼看看：一個佛系駕駛如何默默改善交通？

## 基礎模型：IDM 智慧駕駛模型

首先需要一個「跟車模型」來決定每輛車的加速度。我選擇了 **IDM（Intelligent Driver Model）**，這是德國物理學家 Treiber 在 2000 年提出的模型，至今仍被廣泛使用。

### IDM 核心公式

$$
a = a_{max} \left[ 1 - \left(\frac{v}{v_0}\right)^4 - \left(\frac{s^*(v, \Delta v)}{s}\right)^2 \right]
$$

其中：
- $v$：當前車速
- $v_0$：期望車速（想開多快）
- $s$：與前車的距離
- $\Delta v$：與前車的速度差
- $s^*$：動態安全距離，會根據車速和相對速度調整

### 參數設計

不同類型的駕駛有不同的參數：

| 參數 | 正常車 | 擾動者 | 吸收者 |
|------|--------|--------|--------|
| 安全時距 | 1.5 秒 | 1.0 秒 | 2.5 秒 |
| 最大加速度 | 1.0 m/s² | 1.5 m/s² | 0.6 m/s² |
| 舒適減速度 | 1.5 m/s² | 2.5 m/s² | 1.0 m/s² |
| 最小車距 | 0.08 rad | 0.05 rad | 0.12 rad |

**吸收者**的特點是：保持較大的跟車距離，加減速都比較溫和。這讓他能「吸收」前方傳來的速度波動，不會放大傳給後方。

## 第一版的問題：太機械化

實作完基本的 IDM 模型後，模擬跑起來了，但看起來很假——所有車輛的行為都太一致、太平滑。

真實的交通中，駕駛人會：
1. **偶爾分心減速**：看手機、調冷氣、發呆
2. **反應有延遲**：前車動作後，需要時間才會反應

## 改進一：Nagel-Schreckenberg 隨機減速

這是來自 1992 年的經典元胞自動機模型。核心概念很簡單：**每個時間步，車輛有一定機率隨機減速**。

```typescript
// 隨機減速（Nagel-Schreckenberg 風格）
if (vehicle.velocity > 0.01 && Math.random() < vehicle.randomSlowdownProb * dt * 10) {
  const randomDecel = vehicle.comfortDecel * (0.5 + Math.random());
  vehicle.acceleration -= randomDecel;
}
```

不同駕駛類型的隨機減速機率：
- 正常車：10%
- 擾動者：15%（較不穩定）
- 吸收者：5%（較穩定）

這個小改動讓車流瞬間變得自然許多。你會看到偶爾有車「莫名減速」，然後這個減速波向後傳播——這就是幽靈塞車的起源。

## 改進二：反應時間延遲

真實駕駛不會瞬間反應前車的動作。要模擬這點，需要：

1. **記錄前車歷史狀態**

```typescript
interface Vehicle {
  // ... 其他屬性
  reactionTime: number;  // 反應時間（秒）
  leaderHistory: { gap: number; velocity: number; time: number }[];
}
```

2. **對「過去」的資訊反應**

```typescript
private getDelayedLeaderState(vehicle: Vehicle, leader: Vehicle) {
  const targetTime = this.simulationTime - vehicle.reactionTime;

  // 找到最接近目標時間的歷史記錄
  for (let i = vehicle.leaderHistory.length - 1; i >= 0; i--) {
    if (vehicle.leaderHistory[i].time <= targetTime) {
      return vehicle.leaderHistory[i];
    }
  }
  // 如果沒有足夠的歷史，使用當前狀態
  return { gap: this.getGap(vehicle, leader), velocity: leader.velocity };
}
```

反應時間的設定：
- 正常車：0.5 秒
- 擾動者：0.3 秒（較激進）
- 吸收者：0.8 秒（較保守，但因為距離遠，所以安全）

### 個體差異

每輛車的參數還會加入 ±20% 的隨機變異，讓同類型的車也有個性差異：

```typescript
randomSlowdownProb: params.randomSlowdownProb * (0.8 + Math.random() * 0.4),
reactionTime: params.reactionTime * (0.8 + Math.random() * 0.4),
```

## 幽靈塞車的形成

加入這些改進後，你會在模擬中清楚看到：

1. **某輛車隨機減速**（可能是分心）
2. **後車延遲反應**，等到距離很近才煞車
3. **後車需要更大幅度的減速**來維持安全距離
4. **減速波向後傳播**，逐漸放大
5. **最後面的車完全停止**，即使最初只是輕微減速

這就是「幽靈塞車」（Phantom Traffic Jam）——明明沒有事故、沒有施工，就是莫名其妙塞住了。

## 吸收者的作用

調高吸收者比例後，觀察「速度波動（標準差）」指標會下降。

吸收者為什麼有效？

1. **較大的跟車距離**：有更多緩衝空間，不需要急煞
2. **較緩的加減速**：不會放大速度波動
3. **較長的反應時間**：聽起來是壞事，但配合大車距，反而讓行為更平滑

研究顯示，只需約 **5% 的車輛**採用吸收策略，就能顯著改善整體交通流量。

## 調校心得

### 參數敏感度

- **隨機減速機率**：太高會讓車流完全崩潰，太低則看不出自然的波動
- **反應時間**：太長會頻繁碰撞，太短則回到機械感
- **擾動頻率**：需要搭配擾動強度一起調整

### 碰撞處理

由於有反應延遲，車輛可能會「撞上」前車。需要加入軟碰撞處理：

```typescript
const softGap = 0.06;    // 開始減速的距離
const minSafeGap = 0.03; // 最小安全車距

if (gap < softGap && vehicle.velocity > leader.velocity) {
  // 接近中：漸進減速
  const urgency = 1 - (gap - minSafeGap) / (softGap - minSafeGap);
  vehicle.velocity = Math.max(leader.velocity, targetVelocity);
}
```

## 參考資料

這個模擬的理論基礎來自：

1. **IDM 模型**：[traffic-simulation.de](https://traffic-simulation.de/info/info_IDM.html)
2. **Nagel-Schreckenberg 模型**：[Wikipedia](https://en.wikipedia.org/wiki/Nagel-Schreckenberg_model)
3. **交通流體力學綜述**：[arXiv:2104.02583](https://arxiv.org/pdf/2104.02583)

## 結語

這個專案讓我深刻體會到：**複雜的巨觀行為可以從簡單的微觀規則湧現**。

每輛車只遵守簡單的跟車規則，但當幾十輛車一起模擬，就會自然產生塞車波、幽靈堵塞等現象。而只要有少數「佛系駕駛」，就能顯著改善整體流量。

下次開高速公路時，也許可以試試看當個吸收者？

---

**工具連結**：[交通流體力學模擬](/math/traffic/)
