"""產生 llm 軌道 lessons 01–04 的 notebook（從零打造迷你 GPT）。

用法：
    notebooks/.venv/bin/python notebooks/gen_llm_1to4.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/llm/from-scratch/0{1,2,3,4}-*.ipynb
"""

from _llm_shared import CORPUS, DATA_SRC, GPT_SRC
from _nbgen import build_notebook, code, md

DIR = "llm/from-scratch"


def data_cell():
    """載入字元級語料的 code cell。"""
    return code('text = """' + CORPUS + '"""' + DATA_SRC)


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 斷詞 Tokenization

歡迎來到 **大型語言模型 → 從零打造迷你 GPT**。

這個軌道不教你「呼叫 ChatGPT」，而是帶你**親手把一個 GPT 從零刻出來**——從斷詞、注意力、Transformer，一路到訓練、生成、對齊。模型刻意做得很小、功能很爛，**重點是徹底搞懂裡面到底發生什麼事**。

第一步：電腦看不懂文字，只看得懂數字。**Tokenization（斷詞）** 就是把文字切成一個個 token、再對應成數字的過程。它是所有 LLM 的入口。

> 💡 本軌道建議先學完 `ml/pytorch`（需要 PyTorch 基礎）。每格按 ▶️ 執行，建議在 Colab 開（後面訓練可開免費 GPU）。
"""
        ),
        md(
            """
## 學習目標

- 理解 token 是 LLM 的「原子」
- 實作最簡單的**字元級**斷詞：`encode` / `decode`
- understand **BPE（子詞斷詞）** 的核心想法——真實 LLM 用的方法
"""
        ),
        md(
            """
## 1. 字元級斷詞：最簡單的做法

最直接的斷詞：**一個字一個 token**。我們用一小段唐詩當語料，把所有出現過的字收集成「詞表」，每個字配一個編號。
"""
        ),
        data_cell(),
        code(
            """
# 試試編碼與解碼
s = "明月幾時有"
ids = encode(s)
print("原文:", s)
print("編碼:", ids)
print("解碼:", decode(ids), " ← 還原回原文")
"""
        ),
        md(
            """
`encode` 把字串變成數字串、`decode` 變回來。整段語料也被編成一條長長的數字序列 `data`，這就是要餵給模型的東西。

## 2. 真實 LLM 用的是 BPE（子詞斷詞）

字元級簡單，但序列會很長、也學不到「詞」的概念。真實的 GPT 用 **BPE（Byte Pair Encoding）**：從字元開始，**反覆把最常一起出現的相鄰一對合併**成一個新 token，直到詞表夠大。常見的詞變成單一 token，罕見的詞才拆成小塊。

用一個小例子看 BPE 怎麼合併：
"""
        ),
        code(
            """
from collections import Counter

# 把語料當成 token 序列（先以字元為起點），反覆合併最常見的相鄰對
tokens = list(text.replace("\\n", ""))
for step in range(3):
    pairs = Counter(zip(tokens, tokens[1:]))
    best, freq = pairs.most_common(1)[0]
    merged = "".join(best)
    # 合併所有 best 這一對
    new, i = [], 0
    while i < len(tokens):
        if i < len(tokens) - 1 and (tokens[i], tokens[i + 1]) == best:
            new.append(merged); i += 2
        else:
            new.append(tokens[i]); i += 1
    tokens = new
    print(f"第 {step + 1} 次合併：把出現 {freq} 次的「{merged}」併成一個 token")
print("\\n合併後序列開頭:", tokens[:12])
"""
        ),
        md(
            """
看到了嗎——高頻的字對（像詩裡反覆出現的詞）被併成單一 token。真實的 GPT-2/3/4 就是用這套（在位元組層級）跑幾萬次合併，得到 5 萬 ~ 10 萬大小的詞表。

> 本軌道為了簡單，後面一律用**字元級**斷詞——概念一樣，少了 BPE 的工程細節。

## 小結

- Token 是 LLM 的原子；斷詞把文字 ↔ 數字互轉。
- **字元級**：一字一 token，簡單但序列長。
- **BPE**：反覆合併高頻相鄰對，讓常見詞成為單一 token——真實 LLM 的做法。

## 練習

1. 把 `s` 換成語料裡沒有的字（如「貓」），`encode` 會發生什麼事？想想真實 LLM 怎麼處理未知字（提示：BPE 拆成更小單位）。
2. 把 BPE 的合併次數從 3 改成 10，看會併出哪些 token。

下一課，用這些 token 做 LLM 最核心的任務：**預測下一個字**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-tokenization.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 預測下一個字

LLM 的本質出乎意料地單純：**看著前面的文字，預測下一個字**。把這件事做到極致，就成了會寫文章的模型。這堂課建立這個框架，並訓練一個最陽春的 **bigram** 模型當基線。
"""
        ),
        md(
            """
## 學習目標

- 理解語言模型 = 「給定前文，預測下一個 token」的機率模型
- 用 `get_batch` 切出「輸入 / 目標」訓練樣本
- 訓練一個 bigram 模型並讓它生成文字（雖然很笨）
"""
        ),
        data_cell(),
        md(
            """
## 1. 訓練樣本長什麼樣？

每個位置的「目標」就是它的**下一個字**。輸入 `data[i:i+T]`、目標 `data[i+1:i+T+1]`——整段往右挪一格。
"""
        ),
        code(
            """
import torch

block_size = 8   # 一次看幾個字
def get_batch(batch_size=32):
    ix = torch.randint(len(data) - block_size - 1, (batch_size,))
    x = torch.stack([data[i:i + block_size] for i in ix])
    y = torch.stack([data[i + 1:i + block_size + 1] for i in ix])   # 往右挪一格
    return x, y

xb, yb = get_batch(1)
print("輸入:", decode(xb[0].tolist()))
print("目標:", decode(yb[0].tolist()), " ← 每個位置要預測的『下一個字』")
"""
        ),
        md(
            """
## 2. 最陽春的模型：bigram

bigram 只看「當下這個字」來猜下一個字——用一張 `vocab × vocab` 的查表（`nn.Embedding`）。它沒有上下文概念，所以很笨，但足以示範整個**訓練 → 生成**流程。
"""
        ),
        code(
            """
import torch.nn as nn
from torch.nn import functional as F

torch.manual_seed(0)

class Bigram(nn.Module):
    def __init__(self, V):
        super().__init__()
        self.table = nn.Embedding(V, V)   # table[i] = 看到字 i 後，下一個字的分數

    def forward(self, idx, targets=None):
        logits = self.table(idx)
        loss = None
        if targets is not None:
            B, T, C = logits.shape
            loss = F.cross_entropy(logits.view(B * T, C), targets.view(B * T))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, n):
        for _ in range(n):
            logits, _ = self(idx)
            probs = F.softmax(logits[:, -1, :], dim=-1)
            idx = torch.cat([idx, torch.multinomial(probs, 1)], dim=1)
        return idx

model = Bigram(vocab_size)
opt = torch.optim.AdamW(model.parameters(), lr=1e-2)
for step in range(3000):
    xb, yb = get_batch()
    _, loss = model(xb, yb)
    opt.zero_grad(); loss.backward(); opt.step()
print(f"訓練後 loss：{loss.item():.3f}")
"""
        ),
        code(
            """
# 從「春」開始，生成 60 個字
start = torch.tensor([[stoi["春"]]])
out = model.generate(start, 60)[0].tolist()
print(decode(out))
"""
        ),
        md(
            """
結果像「有點中文味、但不通順」的字串——這完全合理：bigram 只看前一個字，記不住上下文。但**訓練 → 生成**的骨架已經完整。要讓它變聰明，模型得學會「往前看更多字」——這正是**自注意力**要解決的問題。

## 小結

- 語言模型 = 給定前文、預測下一個 token 的機率模型。
- 訓練樣本：目標是輸入「往右挪一格」。
- bigram 只看前一個字，生成必然不通順——需要上下文。

## 練習

1. 把 `start` 換成別的字開頭，看生成有何不同。
2. 印出 `model.table.weight` 中「春」那一列分數最高的幾個字——它學到「春」後面常接什麼了嗎？

下一課，認識讓模型「看見上下文」的關鍵機制：**自注意力**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-next-token.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 自注意力 Self-Attention

bigram 笨在「只看前一個字」。**自注意力**讓每個位置能**回頭看前面所有字**，並自己決定「該注意誰」。這是 Transformer 的心臟，也是整個 LLM 革命的引擎。這堂課從零把單頭注意力刻出來。
"""
        ),
        md(
            """
## 學習目標

- 理解自注意力要解決什麼：讓 token 之間互相「溝通」
- 親手實作 **Query / Key / Value** 與縮放點積注意力
- 理解**因果遮罩**：預測時不能偷看未來
"""
        ),
        md(
            """
## 1. 直覺：Q / K / V

每個 token 產生三個向量：

- **Query（查詢）**：我想找什麼樣的資訊？
- **Key（鍵）**：我有什麼樣的資訊？
- **Value（值）**：如果你需要我，我給你這個內容。

每個位置用自己的 Query 去和**所有位置的 Key** 比對（點積），算出「該多注意誰」的權重，再用權重把大家的 Value 加權平均起來。這樣每個 token 就「吸收」了它該關注的上下文。
"""
        ),
        code(
            """
import torch
import torch.nn as nn
from torch.nn import functional as F

torch.manual_seed(0)
B, T, C = 1, 6, 16        # 1 句、6 個 token、每個 16 維
head_size = 16
x = torch.randn(B, T, C)  # 假裝這是 6 個 token 的嵌入

key = nn.Linear(C, head_size, bias=False)
query = nn.Linear(C, head_size, bias=False)
value = nn.Linear(C, head_size, bias=False)

q, k, v = query(x), key(x), value(x)
att = q @ k.transpose(-2, -1) * head_size ** -0.5   # 縮放點積：每個位置對每個位置的分數
print("注意力分數矩陣形狀:", att.shape, "(每個 token 對每個 token)")
"""
        ),
        md(
            """
## 2. 因果遮罩：不能偷看未來

預測第 3 個字時，模型只能看第 1、2、3 個字——**絕不能看到後面的答案**。我們用一個下三角遮罩，把「未來」的分數設成 `-inf`，softmax 後就變成 0。
"""
        ),
        code(
            """
tril = torch.tril(torch.ones(T, T))
att = att.masked_fill(tril == 0, float("-inf"))   # 未來位置設成 -inf
att = F.softmax(att, dim=-1)                       # 每一列加總為 1
out = att @ v                                       # 用權重加權平均 Value

print("注意力權重（每列總和=1，右上角為0=看不到未來）:")
print(att[0].detach().round(decimals=2))
print("\\n輸出形狀:", out.shape)
"""
        ),
        code(
            """
import matplotlib.pyplot as plt

plt.imshow(att[0].detach(), cmap="viridis")
plt.colorbar(label="attention weight")
plt.xlabel("attends to (key position)"); plt.ylabel("query position")
plt.title("Causal self-attention weights (lower-triangular)")
plt.show()
"""
        ),
        md(
            """
看那張圖：左下三角有值、右上三角全 0——每個位置只能注意自己與前面的位置。這就是 GPT 能「邊讀邊預測、又不作弊」的關鍵。

## 小結

- 自注意力讓每個 token 回頭看前文，自己決定該注意誰。
- **Q·K** 算注意力分數 →（縮放）→ 遮罩 → softmax → 加權 **V**。
- **因果遮罩**確保預測時看不到未來的字。

## 練習

1. 把 `head_size` 的縮放 `** -0.5` 拿掉，softmax 後的權重會變得多極端？（這就是為什麼要「縮放」點積）
2. 把因果遮罩拿掉，觀察權重矩陣變成完整方陣——這適合翻譯，但不適合「預測下一個字」。

下一課，把多個注意力頭和前饋層**組裝成完整的 Transformer**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-self-attention.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 組裝 Transformer

有了自注意力這顆心臟，這堂課把它和其他零件組裝成一個完整的 **GPT**：多頭注意力、前饋層、殘差連接、LayerNorm，堆成 Transformer block，再疊成模型。
"""
        ),
        md(
            """
## 學習目標

- 理解 **多頭注意力**：多個注意力頭平行看不同面向
- 認識 block 的四大件：注意力、前饋、**殘差連接**、**LayerNorm**
- 組出完整的 `MiniGPT`，數一數參數量
"""
        ),
        md(
            """
## 1. 一個 Transformer block 的四大件

- **多頭注意力**：把上一課的單頭複製成好幾頭，各自學不同的關注模式，再合併。
- **前饋網路（FFN）**：每個位置各自過一個小 MLP，做非線性轉換。
- **殘差連接**（`x = x + ...`）：讓梯度好傳、深層也訓得動。
- **LayerNorm**：穩定每層的數值分布，訓練更順。

下面是完整的迷你 GPT。讀 `MultiHeadAttention`（上一課的單頭 ×N）、`Block`（四大件）、`MiniGPT`（嵌入 + 疊 block + 輸出頭）：
"""
        ),
        code(GPT_SRC.strip()),
        md(
            """
## 2. 建一個模型，數參數

先載入語料拿到詞表大小，再把模型建起來。它現在還沒訓練——下一課才餵資料。
"""
        ),
        data_cell(),
        code(
            """
torch.manual_seed(0)
model = MiniGPT(vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=64)
n_params = sum(p.numel() for p in model.parameters())
print(f"MiniGPT 參數量：{n_params:,}  (真實 GPT-3 是 1750 億，我們這隻是它的百萬分之一)")

# 跑一次 forward 確認形狀正確
x = data[:64].unsqueeze(0)
logits, _ = model(x)
print("輸出 logits 形狀:", logits.shape, "= (batch, 序列長, 詞表大小)")
"""
        ),
        md(
            """
每個位置都吐出一個「詞表大小」的分數向量——也就是對「下一個字是誰」的預測。架構齊全了，但權重還是隨機的。

## 小結

- **多頭注意力** = 多個單頭平行，看不同關注面向後合併。
- Transformer block = 注意力 + 前饋 + **殘差** + **LayerNorm**。
- `MiniGPT` = token/位置嵌入 → 疊 N 個 block → 輸出頭，預測每個位置的下一個字。

## 練習

1. 把 `n_layer` 從 3 改成 6、`n_embd` 改成 192，參數量變多少？
2. 對照第 03 課：`MultiHeadAttention` 裡哪幾行對應「Q·K → 縮放 → 遮罩 → softmax → 加權 V」？

下一課，餵語料、開始**訓練**這隻迷你 GPT，讓它學會接字。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-transformer.ipynb")


if __name__ == "__main__":
    print("產生 llm lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
