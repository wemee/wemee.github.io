---
title: "用 diffusers 跑 Stable Diffusion"
description: "手刻迷你版讓你懂了原理，現在站上巨人肩膀：用 Hugging Face diffusers 跑真正的 Stable Diffusion，打一句話生一張圖。用 sd-turbo——一步生圖、免費 T4 跑得順、免授權手續。"
track: diffusion
module: from-scratch
order: 6
notebook: diffusion/from-scratch/06-stable-diffusion.ipynb
preview: /lab/diffusion/from-scratch/06-stable-diffusion.webp
difficulty: 進階
tags: [diffusion, diffusers, stable-diffusion, text2img]
---

手刻迷你版讓你懂了原理。現在站上巨人肩膀:用 Hugging Face 的 **diffusers** 套件,跑一個真正的 **Stable Diffusion**,打一句話生一張圖。

我們用 **sd-turbo**——一個蒸餾過的高速版本,**一步就能生圖**,免費 T4 也跑得順,而且不需要任何授權手續。

## 這堂課你會學到

- 用 `AutoPipelineForText2Image` 一行組好整條管線(CLIP 文字編碼器 + U-Net + VAE 解碼器)
- 打一句 prompt,生出一張圖(sd-turbo:`num_inference_steps=1`、`guidance_scale=0.0`)
- 一次生多張、換不同 prompt,感受 **prompt engineering** 的威力
- 認出管線內部 = 你前五課學的所有零件組起來

## 你已經認得裡面每個零件

當 `pipe(prompt)` 跑起來時,內部發生的事你全學過:**CLIP**(05 課)把 prompt 編碼成向量 → **U-Net**(03 課)在向量引導下,從噪聲反覆**去噪**(02–04 課)→ **VAE 解碼器**把結果還原成清晰影像。Stable Diffusion 不是黑魔法,是你手刻過的機制,放大到幾十億參數、在數十億張圖上訓練的結果。

## prompt engineering 是一門手藝

同一個模型,prompt 寫得好不好,結果天差地遠。加上風格詞(oil painting、photorealistic)、光線(golden hour)、鏡頭(wide shot)、品質詞,都會顯著改變輸出。這是用好生成模型的核心技能——值得多試、多累積你自己的「咒語庫」。

> 💡 sd-turbo 為速度犧牲了一點品質與可控性(例如不太吃 negative prompt)。要更高品質可換 SDXL 等更大模型,但會更慢、更吃記憶體。教學與快速迭代,turbo 是最佳選擇。下一課,學會**控制**生成。
