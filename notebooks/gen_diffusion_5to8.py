"""產生 diffusion 軌道 lessons 05–08 的 notebook（文字條件 + Stable Diffusion）。

用法：
    notebooks/.venv/bin/python notebooks/gen_diffusion_5to8.py

比照其他軌道：**無輸出提交**，留 Colab T4 跑。L06–L08 用 diffusers 的
**sd-turbo**(快、免 gating、T4 跑得動)。
"""

from _diffusion_shared import INSTALL_CLIP, INSTALL_DIFFUSERS
from _nbgen import build_notebook, code, md

DIR = "diffusion/from-scratch"


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 文字條件：一句話如何導引生成

到目前為止,我們的迷你擴散模型只會**隨機**生數字——沒辦法叫它「生一個 7」。真正的 Stable Diffusion 能聽懂「一隻在沙灘上的柯基」,靠的是**文字條件(text conditioning)**。

## 兩個關鍵零件

> 1. **文字編碼器(CLIP)**:把一句 prompt 變成一個向量。CLIP 的神奇之處是它讓**文字向量和影像向量活在同一個空間**——「貓」的文字向量,會靠近貓的圖片向量。
> 2. **交叉注意力(cross-attention)**:在 U-Net 去噪的每一步,把這個文字向量「注入」進去,引導生成往 prompt 描述的方向走。

這課聚焦第一個零件,親手見證 **CLIP 把文字與影像對齊**——這是文字生圖的地基。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_CLIP),
        md(
            "## 2. 載入 CLIP\n\n"
            "CLIP 同時有「看圖」和「讀字」兩個編碼器,輸出可以直接比較的向量。"
        ),
        code(
            '''
import torch
from transformers import CLIPModel, CLIPProcessor

device = "cuda" if torch.cuda.is_available() else "cpu"
clip = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
print("CLIP 載入完成。")
'''
        ),
        md("## 3. 文字與影像在同一個空間\n\n給一張圖、幾句描述,CLIP 會告訴你哪句最配——證明文字與影像被對齊到同一空間。"),
        code(
            '''
import requests
from PIL import Image

url = "https://raw.githubusercontent.com/jacobgil/pytorch-grad-cam/master/examples/both.png"
image = Image.open(requests.get(url, stream=True).raw).convert("RGB")
captions = ["a photo of a cat", "a photo of a dog", "a photo of a car"]

inputs = proc(text=captions, images=image, return_tensors="pt", padding=True).to(device)
with torch.no_grad():
    logits = clip(**inputs).logits_per_image.softmax(dim=1)[0]
for cap, p in zip(captions, logits):
    print(f"{cap:24s} {p.item():.1%}")
# CLIP 不需訓練就能說出圖裡有什麼——文字與影像確實對齊了。
'''
        ),
        md(
            "## 4. 這跟生成有什麼關係?\n\n"
            "文字生圖時,prompt 先被 CLIP 編碼成向量,再透過 cross-attention 注入 U-Net 的每一步去噪——"
            "讓「往哪去噪」被這句話牽引。我們手刻的去噪器只差這一塊;下一課直接用 diffusers,"
            "看完整的文字生圖跑起來。"
        ),
        code(
            '''
print("文字生圖 = 你手刻的去噪過程(02–04) + 文字向量透過 cross-attention 的引導。")
print("下一課:用 diffusers 一次看完整版。")
'''
        ),
        md(
            """
## 小結

- **文字條件**靠兩塊:CLIP(把 prompt 變向量)+ cross-attention(把向量注入去噪)。
- **CLIP 讓文字與影像活在同一向量空間**:不需微調就能判斷「圖裡是什麼」。
- 你前四課手刻的去噪器,加上這個文字引導,就是 Stable Diffusion 的骨架。

下一課:用 **diffusers** 跑真正的 **Stable Diffusion**,打一句 prompt 生一張圖。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-text-conditioning.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 用 diffusers 跑 Stable Diffusion

手刻迷你版讓你懂了原理。現在站上巨人肩膀:用 Hugging Face 的 **diffusers** 套件,跑一個真正的 **Stable Diffusion**,打一句話生一張圖。

我們用 **sd-turbo**——一個蒸餾過的高速版本,**一步就能生圖**,免費 T4 也跑得順,而且不需要任何授權手續。
"""
        ),
        md("## 1. 安裝 diffusers"),
        code(INSTALL_DIFFUSERS),
        md(
            "## 2. 載入 Stable Diffusion 管線\n\n"
            "`AutoPipelineForText2Image` 自動組好整條管線(CLIP 文字編碼器 + U-Net + VAE 解碼器)。"
            "首次會下載權重(約 2–3GB)。"
        ),
        code(
            '''
import torch
from diffusers import AutoPipelineForText2Image

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo", torch_dtype=torch.float16
).to("cuda")
print("Stable Diffusion (sd-turbo) 載入完成。")
'''
        ),
        md(
            "## 3. 打一句話,生一張圖\n\n"
            "sd-turbo 的用法:`num_inference_steps=1`、`guidance_scale=0.0`(它是為單步蒸餾設計的)。"
        ),
        code(
            '''
import matplotlib.pyplot as plt

prompt = "a cute corgi puppy sitting on a beach at sunset, photorealistic"
image = pipe(prompt, num_inference_steps=1, guidance_scale=0.0).images[0]

plt.figure(figsize=(5, 5)); plt.imshow(image); plt.axis("off")
plt.title(prompt, fontsize=9); plt.show()
'''
        ),
        md("## 4. 一次生好幾張、換不同 prompt\n\nprompt 是門藝術(prompt engineering)。多試幾句,感受描述如何左右結果。"),
        code(
            '''
prompts = [
    "an astronaut riding a horse on mars, digital art",
    "a cozy cabin in a snowy forest, oil painting",
    "a bowl of ramen, food photography, steam rising",
]
fig, axes = plt.subplots(1, 3, figsize=(12, 4))
for ax, p in zip(axes, prompts):
    img = pipe(p, num_inference_steps=1, guidance_scale=0.0).images[0]
    ax.imshow(img); ax.axis("off"); ax.set_title(p, fontsize=8)
plt.tight_layout(); plt.show()
'''
        ),
        md(
            """
## 小結

- **diffusers** 把 Stable Diffusion 封裝成幾行:載入管線 → 給 prompt → 拿圖。
- **sd-turbo** 單步生圖,免費 T4 也很快,適合教學與快速迭代。
- 管線內部 = 你前五課學的東西(CLIP 文字編碼 + U-Net 去噪 + VAE 解碼)組起來。
- **prompt engineering** 是用好生成模型的關鍵技藝。

下一課:不只憑空生圖,還要**控制**它——img2img、inpainting 與 LoRA。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-stable-diffusion.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 控制生成：img2img、inpainting、LoRA

純文字生圖(text2img)像擲骰子——同一句 prompt 每次都不一樣。真正用在創作上,你需要**控制**。這課介紹三招業界最常用的控制手段。

> - **img2img**:給一張**起始圖** + prompt,讓模型在它的基礎上變化(保留構圖、換風格)。
> - **inpainting**:只重繪圖片的**局部**(用遮罩指定),其餘不動(去除路人、換背景)。
> - **LoRA**:用少量圖**微調**出一個風格/角色的小外掛,掛上去就能穩定生成特定風格。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_DIFFUSERS),
        md(
            "## 2. img2img:在一張圖的基礎上變化\n\n"
            "`strength` 控制變化幅度(0=幾乎不變,1=幾乎重畫)。sd-turbo 下 `steps×strength` 要 ≥ 1。"
        ),
        code(
            '''
import torch
import matplotlib.pyplot as plt
from diffusers import AutoPipelineForImage2Image
from diffusers.utils import load_image

pipe = AutoPipelineForImage2Image.from_pretrained(
    "stabilityai/sd-turbo", torch_dtype=torch.float16
).to("cuda")

init = load_image(
    "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg"
).resize((512, 512))
out = pipe("a fantasy landscape, vibrant oil painting", image=init,
           num_inference_steps=2, strength=0.6, guidance_scale=0.0).images[0]

fig, ax = plt.subplots(1, 2, figsize=(9, 4.5))
ax[0].imshow(init); ax[0].set_title("起始圖"); ax[0].axis("off")
ax[1].imshow(out); ax[1].set_title("img2img 後"); ax[1].axis("off")
plt.tight_layout(); plt.show()
'''
        ),
        md(
            "## 3. inpainting:只重繪局部(概念)\n\n"
            "inpainting 用一張**遮罩**(白=要重繪、黑=保留),搭配專門的 inpaint 模型。流程示意如下:"
        ),
        code(
            '''
# inpainting 流程示意(需 inpaint 專用權重,Colab 上可換成 sd 系列 inpaint 模型):
# from diffusers import AutoPipelineForInpainting
# pipe = AutoPipelineForInpainting.from_pretrained(
#     "stabilityai/stable-diffusion-2-inpainting", torch_dtype=torch.float16).to("cuda")
# result = pipe(prompt="a cat sitting on the bench",
#               image=init_image, mask_image=mask).images[0]
print("inpainting:用遮罩指定『只重畫這塊』,其餘像素原封不動——修圖、去路人、換背景的利器。")
'''
        ),
        md(
            "## 4. LoRA:幫模型加一個風格外掛(概念)\n\n"
            "LoRA 用少量圖訓練出一個**很小的權重補丁**(幾 MB),掛上基礎模型就能穩定生成特定角色/畫風,"
            "不用重訓整個幾 GB 的模型。這是社群分享風格的主流格式。"
        ),
        code(
            '''
# 掛載一個 LoRA 外掛(示意):
# pipe.load_lora_weights("some-author/some-style-lora")
# image = pipe("a portrait in <that-style>", num_inference_steps=1, guidance_scale=0.0).images[0]
print("LoRA = 風格/角色的小外掛(幾 MB),掛上基礎模型即可,不必重訓大模型。")
print("Civitai / Hugging Face 上有海量社群 LoRA 可下載。")
'''
        ),
        md(
            """
## 小結

- **img2img**:在起始圖上變化,`strength` 控制幅度——保構圖、換風格。
- **inpainting**:用遮罩只重繪局部,其餘不動——精準修圖。
- **LoRA**:少量圖訓練的小權重外掛,讓模型穩定產出特定風格/角色,免重訓大模型。
- 這三招把擲骰子般的生成,變成**可控的創作工具**。

下一課(壓軸):把這些組成一個**自己的圖像生成小工具**,並聊怎麼分享上線。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-control.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 端到端實戰：做一個圖像生成小工具

整條軌道的收尾,也是整個 AI/ML 教學弧線的最後一哩。把學到的東西包成一個**好用的小工具**:輸入一句 prompt,輸出一張圖,還能批次生成、挑最好的。最後聊怎麼把它**分享上線**。
"""
        ),
        md("## 1. 安裝與載入"),
        code(INSTALL_DIFFUSERS),
        code(
            '''
import torch
from diffusers import AutoPipelineForText2Image

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo", torch_dtype=torch.float16
).to("cuda")
print("生成器就緒。")
'''
        ),
        md(
            "## 2. 把生成包成一個函式\n\n"
            "好工具從好介面開始:一個 `generate(prompt, n)` 函式,把細節藏起來。"
        ),
        code(
            '''
import matplotlib.pyplot as plt


def generate(prompt, n=4):
    """給一句 prompt,生 n 張圖並排顯示。"""
    imgs = [pipe(prompt, num_inference_steps=1, guidance_scale=0.0).images[0] for _ in range(n)]
    fig, axes = plt.subplots(1, n, figsize=(3 * n, 3))
    for ax, im in zip(axes, imgs):
        ax.imshow(im); ax.axis("off")
    plt.suptitle(prompt, fontsize=11); plt.tight_layout(); plt.show()
    return imgs


_ = generate("a steaming cup of coffee on a wooden desk, cozy morning light", n=4)
'''
        ),
        md("## 3. 批次比較不同 prompt\n\n同一個工具,快速試不同點子——這就是創作流程的雛形。"),
        code(
            '''
for p in ["a robot reading a book in a library, cinematic",
          "a watercolor painting of cherry blossoms"]:
    generate(p, n=4)
'''
        ),
        md(
            """
## 4. 從 Colab 到一個真的網頁工具

要把它變成別人能用的工具,業界最快的路是 **Gradio + Hugging Face Spaces**:

```python
# import gradio as gr
# def fn(prompt):
#     return pipe(prompt, num_inference_steps=1, guidance_scale=0.0).images[0]
# gr.Interface(fn, inputs="text", outputs="image").launch()
```

- **Gradio** 幾行就生出一個有輸入框 + 圖片輸出的網頁介面(在 Colab 直接 `launch()` 就有公開連結)。
- **Hugging Face Spaces** 可以免費託管這個 app,變成一個任何人都能用的永久網址。
- 這跟 `cv` / `rl` 軌道的「Colab 訓練 → 匯出 → 上線」是同一個精神:**把模型變成別人能用的東西**。

## 軌道小結

你從**加噪/去噪的原理**,一路做到能用、能控制、能上線:

- **生成世界觀**(01)→ **手刻 forward diffusion**(02)→ **手刻去噪 U-Net**(03)→ **DDPM/DDIM 取樣**(04)
- **文字條件 CLIP**(05)→ **diffusers 跑 SD**(06)→ **img2img/inpainting/LoRA 控制**(07)→ **生成工具 + 上線**(08)

**原理你手刻過、工具你也會用、還能做成產品**——這就是生成式 AI 從理解到落地的完整路徑。🎨

## 整個程式實驗室 AI/ML 弧線到此完成

經典 ML → 深度學習 → 從零 LLM → AI Agent → 強化學習 → 電腦視覺 → 資料科學 → 生成式影像。恭喜你走完整條路。🎉
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-project.ipynb")


if __name__ == "__main__":
    print("產生 diffusion lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
