---
title: "手刻 Forward Diffusion · 加噪的數學"
description: "真正的擴散模型用精心設計的加噪排程，而且有個漂亮性質：任何一步 x_t 都能從原圖一步算出來，不必跑 t 次迴圈。親手實作 beta 排程與 closed-form 的 q_sample。"
track: diffusion
module: from-scratch
order: 2
notebook: diffusion/from-scratch/02-forward-diffusion.ipynb
preview: /lab/diffusion/from-scratch/02-forward-diffusion.webp
difficulty: 進階
tags: [diffusion, forward-process, noise-schedule, math]
---

上一課的「線性混入噪聲」只是示意。真正的擴散模型用一套精心設計的**加噪排程**,而且有個漂亮的性質:**任何一步 `x_t` 都能從原圖 `x_0` 一步算出來**,不必真的跑 t 次迴圈。

## 核心公式

> 定義每步的噪聲量 `β_t`,令 `α_t = 1 − β_t`、`ᾱ_t = α_1·α_2···α_t`(連乘)。則:
>
> **x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε** ,其中 ε 是標準高斯噪聲。
>
> t 越大,`ᾱ_t` 越接近 0 → 原圖成分越少、噪聲越多,最後變純雪花。

## 這堂課你會學到

- 建立**線性 β 排程**,算出 `α` 與連乘的 `ᾱ`(`alphabars`)
- 親手實作 closed-form 的 **`q_sample`**:一步生出任意 t 的加噪圖
- 觀察 `ᾱ_t` 從 ~1 一路降到 ~0,對應圖從清晰到雪花
- 理解為什麼這個性質讓**訓練能高效進行**

## closed form 為什麼關鍵?

如果加噪只能一步步跑,訓練時要生一張 `x_200` 就得跑 200 次,慢到不可行。closed-form 公式讓你**隨機抽一個 t、一步就生出對應的 `x_t`**——這正是下一課訓練迴圈的核心:每次隨機挑時間步、瞬間加噪、要模型把噪聲預測回來。數學的優雅直接換來工程的可行。

> 💡 `β` 排程的設計(線性、cosine…)會影響生成品質,是擴散模型的一個調校點。我們用最簡單的線性排程,先把機制跑通。下一課,訓練 U-Net 學會反向去噪。
