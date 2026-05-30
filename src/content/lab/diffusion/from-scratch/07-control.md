---
title: "控制生成 · img2img、inpainting、LoRA"
description: "純文字生圖像擲骰子。真正用在創作上需要控制：img2img（在起始圖上變化）、inpainting（只重繪局部）、LoRA（風格外掛）。三招把擲骰子般的生成變成可控的創作工具。"
track: diffusion
module: from-scratch
order: 7
notebook: diffusion/from-scratch/07-control.ipynb
preview: /lab/diffusion/from-scratch/07-control.webp
difficulty: 進階
tags: [diffusion, img2img, inpainting, lora]
---

純文字生圖(text2img)像擲骰子——同一句 prompt 每次都不一樣。真正用在創作上,你需要**控制**。這課介紹三招業界最常用的控制手段。

## 三招控制術

> - **img2img**:給一張**起始圖** + prompt,讓模型在它的基礎上變化(保留構圖、換風格)。
> - **inpainting**:只重繪圖片的**局部**(用遮罩指定),其餘不動(去除路人、換背景)。
> - **LoRA**:用少量圖**微調**出一個風格/角色的小外掛,掛上去就能穩定生成特定風格。

## 這堂課你會學到

- 實作 **img2img**:用 `strength` 控制變化幅度,把一張草圖變成精緻畫作
- 理解 **inpainting** 的遮罩機制(白=重繪、黑=保留)與適用場景
- 認識 **LoRA**:為什麼一個幾 MB 的小外掛,能讓幾 GB 的大模型穩定產出特定風格

## 從「擲骰子」到「可控創作」

text2img 適合發想,但設計師要的是**可控**:客戶說「就這張,但換成日落」,你需要 img2img;「把這個路人去掉」,你需要 inpainting;「全系列都用這個角色」,你需要 LoRA。這三招是生成式 AI 真正進入商業創作流程的關鍵——它們把不可預測的生成,變成設計師手裡的工具。

## LoRA:社群生態的引擎

LoRA 之所以重要,是因為它讓**個人化變得便宜**:不用重訓整個模型(要海量算力),只要少量圖、幾分鐘,就能教會模型一個新畫風或新角色,產物只有幾 MB,方便分享。Civitai、Hugging Face 上海量的社群風格,絕大多數都是 LoRA——這是開源生成生態最有活力的一塊。

> 💡 還有更精準的控制工具 **ControlNet**(用線稿、深度圖、姿勢骨架精確指定構圖),是 img2img 的進階版。掌握了本課三招,你已經能做出可控、可商用的生成流程。下一課壓軸,把它包成一個小工具並聊上線。
