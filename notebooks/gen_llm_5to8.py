"""產生 llm 軌道 lessons 05–08 的 notebook（訓練、KV cache、SFT、DPO）。

用法：
    notebooks/.venv/bin/python notebooks/gen_llm_5to8.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/llm/from-scratch/0{5,6,7,8}-*.ipynb
"""

from _llm_shared import CORPUS, DATA_SRC, GPT_SRC
from _nbgen import build_notebook, code, md

DIR = "llm/from-scratch"


def data_cell():
    return code('text = """' + CORPUS + '"""' + DATA_SRC)


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 訓練你的迷你 GPT

零件都備齊了——這堂課把語料餵進第 04 課的 `MiniGPT`，**真正訓練它**，然後讓它生成文字。雖然模型很小、語料很少，但你會親眼看到它從亂碼進步到「像那麼回事的中文」。
"""
        ),
        md(
            """
## 學習目標

- 寫出 GPT 的訓練迴圈（取 batch → 算 loss → 更新）
- 訓練迷你 GPT，看 loss 下降
- 讓它**接字**，從一個開頭續寫出唐詩風格的句子
"""
        ),
        data_cell(),
        code(GPT_SRC.strip()),
        md(
            """
## 1. 設定與取 batch

能用 GPU 就用（Colab 開 GPU 會快很多）。`get_batch` 隨機切出「輸入 / 目標（往右一格）」。
"""
        ),
        code(
            """
device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
block_size = 64
batch_size = 32
print("使用裝置:", device)

def get_batch():
    ix = torch.randint(len(data) - block_size - 1, (batch_size,))
    x = torch.stack([data[i:i + block_size] for i in ix])
    y = torch.stack([data[i + 1:i + block_size + 1] for i in ix])
    return x.to(device), y.to(device)
"""
        ),
        md(
            """
## 2. 訓練

跑幾千步，每步就是熟悉的四拍。
"""
        ),
        code(
            """
torch.manual_seed(0)
model = MiniGPT(vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=block_size).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4)

for step in range(3000):
    xb, yb = get_batch()
    _, loss = model(xb, yb)
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 600 == 0 or step == 2999:
        print(f"step {step:4d}　loss {loss.item():.3f}")
"""
        ),
        md(
            """
## 3. 接字！

給一個開頭，讓它一個字一個字續寫。
"""
        ),
        code(
            """
start = torch.tensor([[stoi["春"]]], device=device)
out = model.generate(start, max_new_tokens=80, temperature=0.8)[0].tolist()
print(decode(out))
"""
        ),
        md(
            """
比起第 02 課的 bigram，這隻 GPT 寫出來的東西明顯更連貫、更有唐詩的韻味——因為自注意力讓它記得住前文。它當然還是會胡謅（模型和語料都極小），但**「從零訓練出一個會接字的語言模型」這件事，你已經親手做到了**。

## 小結

- 訓練迴圈與第一個神經網路一模一樣，只是模型換成 GPT。
- loss 下降 = 模型越來越會預測下一個字。
- 自注意力讓生成的文字比 bigram 連貫得多。

## 練習

1. 把 `temperature` 調到 0.3（保守）和 1.2（放飛），生成風格怎麼變？
2. 把 `n_layer` 加到 6、訓練步數加到 6000（建議在 Colab 開 GPU），輸出有變通順嗎？

下一課，讓生成**變快**——認識 LLM 推論的關鍵優化 **KV cache**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-train-gpt.ipynb")


def lesson_06() -> None:
    kv_src = '''
import torch
import torch.nn as nn
from torch.nn import functional as F

class CachedAttention(nn.Module):
    """支援 KV cache 的因果多頭注意力。"""
    def __init__(self, n_embd, n_head):
        super().__init__()
        self.n_head, self.hd = n_head, n_embd // n_head
        self.qkv = nn.Linear(n_embd, 3 * n_embd)
        self.proj = nn.Linear(n_embd, n_embd)

    def forward(self, x, cache=None):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=2)
        split = lambda t: t.view(B, T, self.n_head, self.hd).transpose(1, 2)
        q, k, v = split(q), split(k), split(v)
        if cache is not None:                       # 接上之前算過的 K,V
            pk, pv = cache
            k = torch.cat([pk, k], dim=2)
            v = torch.cat([pv, v], dim=2)
        new_cache = (k, v)
        Tk = k.size(2)
        att = (q @ k.transpose(-2, -1)) * self.hd ** -0.5
        if T > 1:                                   # 完整輸入（prefill）才需因果遮罩
            mask = torch.tril(torch.ones(T, Tk, device=x.device), diagonal=Tk - T)
            att = att.masked_fill(mask == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).contiguous().view(B, T, C)
        return self.proj(y), new_cache

class CachedBlock(nn.Module):
    def __init__(self, n_embd, n_head):
        super().__init__()
        self.ln1 = nn.LayerNorm(n_embd); self.attn = CachedAttention(n_embd, n_head)
        self.ln2 = nn.LayerNorm(n_embd)
        self.ff = nn.Sequential(nn.Linear(n_embd, 4 * n_embd), nn.GELU(), nn.Linear(4 * n_embd, n_embd))

    def forward(self, x, cache=None):
        a, new = self.attn(self.ln1(x), cache)
        x = x + a
        x = x + self.ff(self.ln2(x))
        return x, new

class MiniGPTKV(nn.Module):
    def __init__(self, vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=64):
        super().__init__()
        self.block_size = block_size
        self.tok_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(block_size, n_embd)
        self.blocks = nn.ModuleList([CachedBlock(n_embd, n_head) for _ in range(n_layer)])
        self.ln_f = nn.LayerNorm(n_embd); self.head = nn.Linear(n_embd, vocab_size)

    def forward(self, idx, caches=None, pos0=0):
        B, T = idx.shape
        pos = torch.arange(pos0, pos0 + T, device=idx.device)
        x = self.tok_emb(idx) + self.pos_emb(pos)
        new_caches = []
        for blk, c in zip(self.blocks, caches or [None] * len(self.blocks)):
            x, nc = blk(x, c)
            new_caches.append(nc)
        return self.head(self.ln_f(x)), new_caches

    @torch.no_grad()
    def generate_naive(self, idx, n):
        for _ in range(n):                          # 每步都重算整段前文
            logits, _ = self(idx[:, -self.block_size:])
            nxt = logits[:, -1, :].argmax(-1, keepdim=True)
            idx = torch.cat([idx, nxt], dim=1)
        return idx

    @torch.no_grad()
    def generate_cached(self, idx, n):
        logits, caches = self(idx)                  # prefill：算一次 prompt
        out = idx
        nxt = logits[:, -1, :].argmax(-1, keepdim=True)
        for _ in range(n):
            out = torch.cat([out, nxt], dim=1)
            pos0 = out.size(1) - 1                   # 只餵「新的那一個 token」
            logits, caches = self(nxt, caches, pos0=pos0)
            nxt = logits[:, -1, :].argmax(-1, keepdim=True)
        return out
'''
    cells = [
        md(
            """
# 06 · 生成與 KV Cache

每次生成一個字，前面的字其實**被重算了一遍又一遍**——這是 LLM 推論最大的浪費。**KV cache** 把算過的 Key/Value 存起來重複利用，是讓 ChatGPT 能即時回應的關鍵工程。這堂課親手實作它。
"""
        ),
        md(
            """
## 學習目標

- 理解自回歸生成為什麼**重複計算**
- 親手實作 **KV cache**：只算新 token 的 K/V，舊的存起來重用
- 驗證「有 cache」與「沒 cache」輸出**完全相同**、但 cache **更快**
"""
        ),
        md(
            """
## 1. 問題：每一步都重算前文

第 05 課的 `generate` 每生成一個字，就把目前整段序列**重新跑一次模型**。但前面那些字的 Key/Value 上一步早就算過了——重算純粹是浪費。序列越長，浪費越誇張。

**KV cache** 的點子：把每一層算過的 K、V 存起來；下一步只需要算**新 token** 的 Q/K/V，再接上快取的舊 K/V 即可。下面是支援 cache 的 GPT：
"""
        ),
        code(kv_src.strip()),
        data_cell(),
        md(
            """
## 2. 驗證：輸出相同、速度更快

用同一個（這裡未特別訓練的）模型，比較 `generate_naive` 與 `generate_cached`。用 **greedy（argmax）** 解碼，兩者應該逐字相同——藉此證明 cache 沒算錯。
"""
        ),
        code(
            """
import time

torch.manual_seed(0)
# block_size 設大一點，容納 prompt + 生成的總長度（KV cache 用絕對位置）
model = MiniGPTKV(vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=256).eval()
prompt = torch.tensor([[stoi["春"]]])
N = 200

t = time.perf_counter()
a = model.generate_naive(prompt, N)
t_naive = time.perf_counter() - t

t = time.perf_counter()
b = model.generate_cached(prompt, N)
t_cached = time.perf_counter() - t

print("兩種方法輸出完全相同:", torch.equal(a, b))   # cache 正確性檢查
print(f"naive  生成 {N} 字：{t_naive * 1000:7.1f} ms")
print(f"cached 生成 {N} 字：{t_cached * 1000:7.1f} ms　→ 約快 {t_naive / t_cached:.1f}×")
"""
        ),
        md(
            """
輸出一字不差，但 cache 版明顯更快——而且**序列越長，差距越大**（naive 的成本隨長度平方成長，cached 接近線性）。真實的 LLM 服務沒有 KV cache 根本不可能即時回應。

> 代價是**記憶體**：cache 要存每一層、每個 token 的 K、V。這也是為什麼長對話很吃顯示記憶體（VRAM）。

## 小結

- 自回歸生成若每步重算前文，浪費巨大。
- **KV cache** 存下舊 token 的 K/V，每步只算新 token → 大幅加速。
- 正確實作下，輸出與 naive 完全一致；代價是記憶體。

## 練習

1. 把 `N` 從 200 加到 500，加速比變大還是變小？為什麼？
2. 想一想：為什麼長對話會「越聊越吃記憶體」？（提示：cache 隨 token 數成長）

下一課，讓模型從「只會接字」進化到「**會照指令回答**」——對齊的第一步 SFT。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-kv-cache.ipynb")


def lesson_07() -> None:
    setup = '''
import torch
torch.manual_seed(0)
poems = """''' + CORPUS + '''"""

# 指令資料集：單位數加法，固定模板（這就是「指令→回應」配對）
pairs = [(a, b) for a in range(10) for b in range(10)]
instr = "".join(f"問：{a}加{b}等於 答：{a + b}。\\n" for a, b in pairs)

# 詞表涵蓋「詩 + 指令」的所有字元
text = poems + instr
chars = sorted(set(text))
vocab_size = len(chars)
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for i, c in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[i] for i in ids)
poem_data = torch.tensor(encode(poems), dtype=torch.long)
instr_data = torch.tensor(encode(instr), dtype=torch.long)
print(f"詞表 {vocab_size}　詩語料 {len(poem_data)} 字　指令語料 {len(instr_data)} 字")
'''
    train_helper = '''
device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
block_size = 48

def train_on(model, data, steps, lr=3e-4):
    data = data.to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    for _ in range(steps):
        ix = torch.randint(len(data) - block_size - 1, (32,))
        x = torch.stack([data[i:i + block_size] for i in ix])
        y = torch.stack([data[i + 1:i + block_size + 1] for i in ix])
        _, loss = model(x, y)
        opt.zero_grad(); loss.backward(); opt.step()
    return loss.item()

def answer(model, q):                      # 餵入「問：a加b等於 答：」，讓它續寫答案
    idx = torch.tensor([encode(q)], device=device)
    out = model.generate(idx, max_new_tokens=6, temperature=0.1)[0].tolist()
    return decode(out)
'''
    cells = [
        md(
            """
# 07 · 對齊 ①：SFT 監督式微調

到上一課為止，我們的 GPT 只會「接字」——你給開頭，它接著胡謅。但 ChatGPT 會**照你的指令回答**。從「會接字」到「會照指令回答」的第一步，就是 **SFT（Supervised Fine-Tuning，監督式微調）**：拿一堆「指令 → 理想回應」的配對，繼續訓練模型。
"""
        ),
        md(
            """
## 學習目標

- 理解 base 模型（只會接字）與對齊後模型（會照指令回答）的差別
- 準備「指令 → 回應」資料集
- 對 base 模型做 SFT，看它學會照格式回答
"""
        ),
        md(
            """
## 1. 準備資料

我們用一個小到能驗證的任務：**單位數加法**，固定模板 `問：a加b等於 答：c。`。這 100 個配對就是我們的「指令資料集」。
"""
        ),
        code(setup),
        code(GPT_SRC.strip().replace("block_size=64", "block_size=48")),
        code(train_helper),
        md(
            """
## 2. Base 模型：只會接字，不會回答

先在「詩」語料上訓練一個 base 模型。它學會寫詩的味道，但你問它算術，它只會continue胡謅。
"""
        ),
        code(
            """
base = MiniGPT(vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=block_size).to(device)
train_on(base, poem_data, steps=1500)
print("Base 模型回答「問：3加4等於 答：」：")
print("  ", answer(base, "問：3加4等於 答："))
print("（base 沒看過指令格式，只會接字、答非所問）")
"""
        ),
        md(
            """
## 3. SFT：在指令資料上繼續訓練

拿同一個模型，**繼續**在「指令 → 回應」配對上訓練。這一步就是 SFT。
"""
        ),
        code(
            """
import copy
sft = copy.deepcopy(base)               # 從 base 出發
train_on(sft, instr_data, steps=2500)   # 在指令資料上微調

print("SFT 後，同樣問題：")
for q in ["問：3加4等於 答：", "問：5加2等於 答：", "問：8加6等於 答："]:
    print("  ", answer(sft, q))
"""
        ),
        md(
            """
微調後，模型**學會了照格式回答**，而且小資料的加法多半答得對（它其實把這 100 題背了起來）。功能很陽春沒關係——重點是你看見了**對齊的第一步**：用「指令→回應」資料，把一個只會接字的 base 模型，調教成會聽指令做事的模型。真實的 ChatGPT 就是用同樣的 SFT（加上海量、多樣的指令資料）煉成的。

## 小結

- **Base 模型**只會接字（語言建模）；**SFT** 教它照「指令→回應」格式回答。
- SFT = 拿配對資料、用一樣的訓練機制繼續微調。
- 這是「對齊（alignment）」的第一步——讓模型做**人類想要**的事。

## 練習

1. 把指令任務換成減法或「你好→你好！很高興見到你」之類的問候，SFT 後它學得會嗎？
2. SFT 步數調太多會怎樣？（提示：它會更死記、對沒見過的題型更不會舉一反三）

最後一課，用 **DPO** 做對齊的第二步：讓模型對齊**人類偏好**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-sft.ipynb")


def lesson_08() -> None:
    setup = '''
import torch, copy
torch.manual_seed(0)
poems = """''' + CORPUS + '''"""
pairs = [(a, b) for a in range(10) for b in range(10)]
instr = "".join(f"問：{a}加{b}等於 答：{a + b}。\\n" for a, b in pairs)
text = poems + instr
chars = sorted(set(text)); vocab_size = len(chars)
stoi = {c: i for i, c in enumerate(chars)}; itos = {i: c for i, c in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[i] for i in ids)
device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
block_size = 48
'''
    cells = [
        md(
            """
# 08 · 對齊 ②：RLHF 與 DPO

SFT 教模型「照格式回答」，但答得**好不好、合不合人類喜好**是另一回事。讓輸出對齊人類偏好，靠的是 **RLHF**（人類回饋強化學習）——ChatGPT 的祕方。這堂課講清楚 RLHF 的概念，並親手實作它的精簡替代品 **DPO**。這是本軌道、也是整條學習線的終點。
"""
        ),
        md(
            """
## 學習目標

- 理解 **RLHF** 的三步驟與它為什麼複雜
- 理解 **DPO** 如何用一個簡單的損失達到類似效果
- 親手在迷你模型上跑 DPO，看它越來越偏好「好的回應」
"""
        ),
        md(
            """
## 1. RLHF：概念

ChatGPT 的對齊靠三步：

1. **SFT**（上一課）——先教會基本的指令跟隨。
2. **訓練獎勵模型（reward model）**——找人對「同一問題的不同回答」排序，訓練一個模型來預測「人類有多喜歡這個回答」。
3. **用 RL（PPO）微調**——讓語言模型去最大化獎勵模型給的分數。

它很有效，但**很複雜**：要訓練額外的獎勵模型、還要跑不穩定的強化學習。

## 2. DPO：把三步併成一步

**DPO（Direct Preference Optimization）** 證明了：你**不需要**獎勵模型、也不需要 RL。只要有一堆「**偏好配對**」——同一個提示下，一個 **chosen（較好）** 回應、一個 **rejected（較差）** 回應——就能用一個簡單的分類損失，直接把模型往「偏好 chosen」的方向推。

DPO 損失（`β` 控制偏離參考模型的程度）：

```
loss = -log σ( β · [ (logπ(chosen) − logπ_ref(chosen)) − (logπ(rejected) − logπ_ref(rejected)) ] )
```

直覺：**提高 chosen 的機率、壓低 rejected 的機率**，同時用一個凍結的參考模型（通常是 SFT 模型）拉住，不讓它跑太偏。
"""
        ),
        code(setup),
        code(GPT_SRC.strip().replace("block_size=64", "block_size=48")),
        md(
            """
## 3. 準備一個 SFT 模型與偏好配對

為了專注在 DPO，這裡快速訓一個會加法的 SFT 模型當起點。偏好配對：同一道題，**chosen = 正確答案**，**rejected = 錯誤答案**。
"""
        ),
        code(
            """
# 快速 SFT（當作 DPO 的起點與參考模型）
instr_data = torch.tensor(encode(instr), dtype=torch.long).to(device)
policy = MiniGPT(vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=block_size).to(device)
opt = torch.optim.AdamW(policy.parameters(), lr=3e-4)
for _ in range(2500):
    ix = torch.randint(len(instr_data) - block_size - 1, (32,))
    x = torch.stack([instr_data[i:i + block_size] for i in ix])
    y = torch.stack([instr_data[i + 1:i + block_size + 1] for i in ix])
    _, loss = policy(x, y)
    opt.zero_grad(); loss.backward(); opt.step()

ref = copy.deepcopy(policy)          # 凍結的參考模型
for p in ref.parameters():
    p.requires_grad = False

# 偏好配對：(prompt, chosen=正確, rejected=錯誤)
prefs = [(f"問：{a}加{b}等於 答：", f"{a + b}。", f"{(a + b + 3) % 19}。")
         for a, b in [(2, 3), (4, 1), (5, 5), (7, 2), (6, 3), (1, 8), (3, 3), (9, 0)]]

def seq_logprob(model, full):
    # 整串序列在 teacher-forcing 下的對數機率總和
    idx = torch.tensor([encode(full)], device=device)
    logits, _ = model(idx[:, :-1])
    logp = torch.log_softmax(logits, dim=-1)
    tgt = idx[:, 1:]
    return logp.gather(-1, tgt.unsqueeze(-1)).squeeze().sum()
"""
        ),
        md(
            """
## 4. 跑 DPO

每步算 chosen / rejected 在 policy 與 ref 下的對數機率，組出 DPO 損失，更新 policy。同時追蹤 **margin = logπ(chosen) − logπ(rejected)**——它變大，代表模型越來越偏好正確答案。
"""
        ),
        code(
            """
import torch.nn.functional as F

beta = 0.1
opt = torch.optim.AdamW(policy.parameters(), lr=1e-4)
margins = []
for step in range(60):
    total = 0.0
    margin_sum = 0.0
    for prompt, chosen, rejected in prefs:
        pc = seq_logprob(policy, prompt + chosen)
        pr = seq_logprob(policy, prompt + rejected)
        with torch.no_grad():
            rc = seq_logprob(ref, prompt + chosen)
            rr = seq_logprob(ref, prompt + rejected)
        logits = beta * ((pc - rc) - (pr - rr))
        total = total - F.logsigmoid(logits)
        margin_sum += (pc - pr).item()
    loss = total / len(prefs)
    opt.zero_grad(); loss.backward(); opt.step()
    margins.append(margin_sum / len(prefs))
    if step % 15 == 0 or step == 59:
        print(f"step {step:2d}　DPO loss {loss.item():.3f}　margin(chosen−rejected) {margins[-1]:+.2f}")
"""
        ),
        code(
            """
import matplotlib.pyplot as plt
plt.plot(margins, lw=2)
plt.xlabel("DPO step"); plt.ylabel("logP(chosen) − logP(rejected)")
plt.title("DPO pushes the model to prefer the 'chosen' answers")
plt.grid(True, alpha=0.3); plt.show()
"""
        ),
        md(
            """
margin 一路往上：模型越來越偏好「正確答案」勝過「錯誤答案」——這正是 DPO 在做的事。我們沒訓練任何獎勵模型、也沒跑 RL，只用一個簡單的損失就把模型往人類偏好推了過去。

## 小結 — 你走完了整條路

- **RLHF**：SFT → 獎勵模型 → RL(PPO)，有效但複雜。
- **DPO**：用「偏好配對」+ 一個分類損失，直接對齊偏好，免獎勵模型、免 RL。
- 對齊 = 讓模型不只「會說話」，更「說人類想聽的話」。

從第 01 課的斷詞，到自注意力、Transformer、訓練、KV cache、SFT、DPO——**你從零親手打造並對齊了一個語言模型**。真實的 GPT 只是把每一塊放大幾百萬倍、資料多幾億倍，原理你已經全部掌握了。

## 練習

1. 把 `beta` 調大（如 0.5），margin 成長與穩定性怎麼變？
2. 把偏好改成「偏好較短的回應」，DPO 能學會嗎？（這正是控制模型「話多話少」的做法之一）
3. 回顧整個軌道：哪一塊是讓 GPT「能看懂上下文」的關鍵？哪一塊讓它「聽得懂指令」？

> 🎓 恭喜走完從零打造 LLM 的旅程。下一個前沿是 **AI Agent**——讓模型不只會說話，還會**用工具、做事情**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-dpo.ipynb")


if __name__ == "__main__":
    print("產生 llm lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
