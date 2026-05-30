---
title: "端到端實戰 · 做一個圖像生成小工具"
description: "整條軌道的收尾，也是整個 AI/ML 弧線的最後一哩。把生成包成好用的 generate(prompt) 函式、批次比較不同 prompt，最後聊怎麼用 Gradio + Hugging Face Spaces 把它分享成一個任何人能用的網頁工具。"
track: diffusion
module: from-scratch
order: 8
notebook: diffusion/from-scratch/08-project.ipynb
preview: /lab/diffusion/from-scratch/08-project.webp
difficulty: 專題
tags: [diffusion, gradio, deployment, project]
---

整條軌道的收尾,也是整個 AI/ML 教學弧線的最後一哩。把學到的東西包成一個**好用的小工具**:輸入一句 prompt,輸出一張圖,還能批次生成、挑最好的。最後聊怎麼把它**分享上線**。

## 這堂課你會做

- 把生成包成一個乾淨的 **`generate(prompt, n)` 函式**——好工具從好介面開始
- 批次生成、比較不同 prompt,做出創作流程的雛形
- 學會用 **Gradio + Hugging Face Spaces** 把它變成一個任何人都能用的網頁工具

## 從 Colab 到一個真的網頁工具

```python
import gradio as gr
def fn(prompt):
    return pipe(prompt, num_inference_steps=1, guidance_scale=0.0).images[0]
gr.Interface(fn, inputs="text", outputs="image").launch()
```

- **Gradio** 幾行就生出一個有輸入框 + 圖片輸出的網頁介面(Colab 直接 `launch()` 就有公開連結)。
- **Hugging Face Spaces** 免費託管這個 app,變成一個永久網址。
- 這跟 `cv` / `rl` 軌道的「Colab 訓練 → 匯出 → 上線」是同一個精神:**把模型變成別人能用的東西**。

## 軌道小結

你從**加噪/去噪的原理**,一路做到能用、能控制、能上線:

- **生成世界觀**(01)→ **手刻 forward diffusion**(02)→ **手刻去噪 U-Net**(03)→ **DDPM/DDIM 取樣**(04)
- **文字條件 CLIP**(05)→ **diffusers 跑 SD**(06)→ **img2img/inpainting/LoRA 控制**(07)→ **生成工具 + 上線**(08)

**原理你手刻過、工具你也會用、還能做成產品**——這就是生成式 AI 從理解到落地的完整路徑。🎨

## 整個程式實驗室 AI/ML 弧線到此完成

經典 ML → 深度學習 → 從零 LLM → AI Agent → 強化學習 → 電腦視覺 → 資料科學 → 生成式影像。八條軌道、六十四堂課,從第一個分類器到能畫圖的擴散模型——恭喜你走完整條路。🎉
