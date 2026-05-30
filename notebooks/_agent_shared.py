"""agent 軌道共用素材：Qwen 載入樣板 + RAG 知識庫。

跟 _llm_shared 一樣，把「每個 notebook 都要重複的程式」以字串形式集中維護一份，
再注入各 notebook 的 code cell，讓每個 notebook 都自成一體（Colab 可獨立開啟）。

agent notebook 要載 Qwen（transformers + bitsandbytes 4-bit，CUDA-only），
本機 Mac 跑不動 → 比照動畫課，用 nbconvert --clear-output 提交，留到 Colab T4 執行。
"""

# 安裝相依套件（每個 notebook 開頭跑一次）。
INSTALL = '%pip install -q -U "transformers>=4.45" accelerate bitsandbytes'

# 載入 Qwen 並定義 chat() 助手——這段注入每一課，是整條軌道的引擎。
LOAD_SRC = '''
import json, re
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"   # 想更強可換 Qwen2.5-3B-Instruct，T4 也裝得下

_bnb = BitsAndBytesConfig(
    load_in_4bit=True,                    # 4-bit 量化：模型體積砍約 75%
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID, quantization_config=_bnb, device_map="auto", torch_dtype=torch.float16,
)
model.eval()
print(f"已載入 {MODEL_ID}（4-bit）於 {model.device}")


@torch.no_grad()
def chat(messages, max_new_tokens=512, temperature=0.0):
    """LLM 的唯一介面：丟一串 messages，回模型吐的純文字。

    messages = [{"role": "system"|"user"|"assistant", "content": "..."}]
    temperature=0 → 貪婪解碼（穩定、可重現），>0 → 取樣（多樣）。
    整條軌道只透過這個函式碰模型；要換成別的模型/API，改這裡就好。
    """
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    gen = dict(max_new_tokens=max_new_tokens, pad_token_id=tokenizer.eos_token_id)
    if temperature > 0:
        gen.update(do_sample=True, temperature=temperature, top_p=0.9)
    else:
        gen.update(do_sample=False)
    out = model.generate(**inputs, **gen)
    reply = out[0][inputs.input_ids.shape[1]:]
    return tokenizer.decode(reply, skip_special_tokens=True).strip()
'''

# L06 RAG 用的內嵌知識庫：事實型短卡片（零下載、自成一體）。
# 刻意放「帶具體數字」的事實——小模型容易記錯，正好凸顯 RAG 的價值。
KB_SRC = '''
# 內嵌知識庫：每張卡片一段事實短文（真實世界資料，零下載）。
KB = [
    "玉山是台灣最高峰，主峰海拔 3952 公尺，位於玉山國家公園，橫跨南投、嘉義、高雄。",
    "台灣最長的河流是濁水溪，全長約 186.6 公里，發源於合歡山，向西流入台灣海峽。",
    "日月潭是台灣最大的天然湖泊，位於南投縣魚池鄉，潭面海拔約 748 公尺。",
    "台灣本島面積約 36,197 平方公里，是世界第 38 大島嶼，南北長約 394 公里。",
    "台北101 樓高 508 公尺、地上 101 層，2004 年完工，曾是世界第一高樓直到 2010 年。",
    "台灣高鐵全長約 350 公里，連接南港與左營，最高營運時速 300 公里，2007 年通車。",
    "台灣的氣候北部為副熱帶、南部為熱帶，每年 5 到 6 月有梅雨季，夏秋多颱風。",
    "澎湖群島由約 90 座島嶼組成，位於台灣海峽中央，以玄武岩柱狀節理地形聞名。",
    "台灣原住民族目前官方認定有 16 族，人口約佔總人口的 2.5%，阿美族是人數最多的一族。",
    "蘭嶼位於台東外海，是達悟族（雅美族）的居住地，以拼板舟與飛魚文化著稱。",
]
'''
