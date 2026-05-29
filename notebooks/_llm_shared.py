"""llm 軌道共用素材：中文語料 + 迷你 GPT 模型原始碼。

語料與模型程式碼以「字串」形式注入各 notebook 的 code cell，
讓每個 notebook 都自成一體（Colab 可獨立開啟），又只在這裡維護一份。
"""

# 公有領域的唐詩，字元級語料。刻意小——迷你模型幾分鐘就能學會接字。
CORPUS = """床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。
春眠不覺曉，處處聞啼鳥。夜來風雨聲，花落知多少。
白日依山盡，黃河入海流。欲窮千里目，更上一層樓。
紅豆生南國，春來發幾枝。願君多采擷，此物最相思。
空山不見人，但聞人語響。返景入深林，復照青苔上。
千山鳥飛絕，萬徑人蹤滅。孤舟蓑笠翁，獨釣寒江雪。
松下問童子，言師采藥去。只在此山中，雲深不知處。
人閒桂花落，夜靜春山空。月出驚山鳥，時鳴春澗中。
君自故鄉來，應知故鄉事。來日綺窗前，寒梅著花未。
獨坐幽篁裡，彈琴復長嘯。深林人不知，明月來相照。
山中相送罷，日暮掩柴扉。春草明年綠，王孫歸不歸。
功蓋三分國，名成八陣圖。江流石不轉，遺恨失吞吳。
前不見古人，後不見來者。念天地之悠悠，獨愴然而涕下。
葡萄美酒夜光杯，欲飲琵琶馬上催。醉臥沙場君莫笑，古來征戰幾人回。
秦時明月漢時關，萬里長征人未還。但使龍城飛將在，不教胡馬度陰山。
朝辭白帝彩雲間，千里江陵一日還。兩岸猿聲啼不住，輕舟已過萬重山。
故人西辭黃鶴樓，煙花三月下揚州。孤帆遠影碧空盡，唯見長江天際流。
月落烏啼霜滿天，江楓漁火對愁眠。姑蘇城外寒山寺，夜半鐘聲到客船。
獨在異鄉為異客，每逢佳節倍思親。遙知兄弟登高處，遍插茱萸少一人。
日照香爐生紫煙，遙看瀑布掛前川。飛流直下三千尺，疑是銀河落九天。
國破山河在，城春草木深。感時花濺淚，恨別鳥驚心。
岐王宅裡尋常見，崔九堂前幾度聞。正是江南好風景，落花時節又逢君。
渭城朝雨浥輕塵，客舍青青柳色新。勸君更盡一杯酒，西出陽關無故人。
清明時節雨紛紛，路上行人欲斷魂。借問酒家何處有，牧童遙指杏花村。
千里黃雲白日曛，北風吹雁雪紛紛。莫愁前路無知己，天下誰人不識君。
"""

# 字元級語料載入 + 編碼工具（注入到需要的 notebook）。
DATA_SRC = '''
import torch

# 字元級詞表：每個不同的字 = 一個 token
chars = sorted(set(text))
vocab_size = len(chars)
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for i, c in enumerate(chars)}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[i] for i in ids)

data = torch.tensor(encode(text), dtype=torch.long)
print(f"語料長度 {len(text)} 字，詞表大小 {vocab_size}")
'''

# 迷你 GPT（nanoGPT 風格）。L4 組裝、L5/L7/L8 重用。
GPT_SRC = '''
import torch
import torch.nn as nn
from torch.nn import functional as F

class MultiHeadAttention(nn.Module):
    """因果多頭自注意力（一次算完所有 head）。"""
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        assert n_embd % n_head == 0
        self.n_head = n_head
        self.head_dim = n_embd // n_head
        self.qkv = nn.Linear(n_embd, 3 * n_embd)   # 一次產生 Q,K,V
        self.proj = nn.Linear(n_embd, n_embd)
        self.drop = nn.Dropout(dropout)
        self.register_buffer("mask",
            torch.tril(torch.ones(block_size, block_size)).view(1, 1, block_size, block_size))

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=2)
        q = q.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        att = (q @ k.transpose(-2, -1)) * self.head_dim ** -0.5
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))  # 因果遮罩
        att = F.softmax(att, dim=-1)
        y = (att @ v).transpose(1, 2).contiguous().view(B, T, C)
        return self.drop(self.proj(y))

class Block(nn.Module):
    """Transformer block：注意力 + 前饋，各帶殘差與 LayerNorm。"""
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        self.ln1 = nn.LayerNorm(n_embd)
        self.attn = MultiHeadAttention(n_embd, n_head, block_size, dropout)
        self.ln2 = nn.LayerNorm(n_embd)
        self.ff = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd), nn.GELU(),
            nn.Linear(4 * n_embd, n_embd), nn.Dropout(dropout),
        )

    def forward(self, x):
        x = x + self.attn(self.ln1(x))   # 殘差連接
        x = x + self.ff(self.ln2(x))
        return x

class MiniGPT(nn.Module):
    def __init__(self, vocab_size, n_embd=128, n_head=4, n_layer=3, block_size=64, dropout=0.1):
        super().__init__()
        self.block_size = block_size
        self.tok_emb = nn.Embedding(vocab_size, n_embd)   # token 嵌入
        self.pos_emb = nn.Embedding(block_size, n_embd)   # 位置嵌入
        self.blocks = nn.Sequential(*[Block(n_embd, n_head, block_size, dropout) for _ in range(n_layer)])
        self.ln_f = nn.LayerNorm(n_embd)
        self.head = nn.Linear(n_embd, vocab_size)         # 預測下一個 token

    def forward(self, idx, targets=None):
        B, T = idx.shape
        pos = torch.arange(T, device=idx.device)
        x = self.tok_emb(idx) + self.pos_emb(pos)
        x = self.ln_f(self.blocks(x))
        logits = self.head(x)
        loss = None
        if targets is not None:
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0):
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.block_size:]      # 只看最近 block_size 個 token
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / temperature   # 取最後一步
            probs = F.softmax(logits, dim=-1)
            nxt = torch.multinomial(probs, 1)         # 依機率抽樣
            idx = torch.cat([idx, nxt], dim=1)
        return idx
'''
