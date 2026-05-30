"""產生 agent 軌道 lessons 01–04 的 notebook（手刻 AI Agent）。

用法：
    notebooks/.venv/bin/python notebooks/gen_agent_1to4.py
這些 notebook 要載 Qwen（CUDA-only），本機不執行，留到 Colab T4 跑。
提交前清掉輸出：
    jupyter nbconvert --clear-output --inplace notebooks/agent/from-scratch/0{1,2,3,4}-*.ipynb
"""

from _agent_shared import INSTALL, LOAD_SRC
from _nbgen import build_notebook, code, md

DIR = "agent/from-scratch"

# 多課共用的工具定義（時鐘 + 計算機），以字串注入。
TOOLS_SRC = '''
from datetime import datetime, timezone, timedelta


def get_current_time() -> str:
    """回傳台北現在時間（模型沒有時鐘，這是它拿不到的真實世界資訊）。"""
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")


def calculator(expression: str) -> str:
    """安全地算一個算式。只允許數字與 + - * / ( ) . %。"""
    if not re.fullmatch(r"[0-9+\\-*/(). %]+", expression or ""):
        return "錯誤：只接受數字與 + - * / ( ) . %"
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"錯誤：{e}"
'''

# 解析模型輸出裡的 Action / Action Input（L02–L04 共用）。
PARSE_SRC = '''
def parse_action(text):
    """從模型輸出抓出 (工具名, 參數dict)；抓不到回 (None, None)。"""
    m_name = re.search(r"Action:\\s*([A-Za-z_]\\w*)", text)
    if not m_name:
        return None, None
    args = {}
    m_args = re.search(r"Action Input:\\s*(\\{.*\\})", text, re.DOTALL)
    if m_args:
        try:
            args = json.loads(m_args.group(1))
        except Exception:
            args = {}
    return m_name.group(1), args
'''


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 什麼是 Agent？載入本地 Qwen

歡迎來到 **AI Agent → 手刻 AI Agent**。

上一條軌道你**從零刻了一個迷你 GPT**，徹底懂了 LLM 內部。但那隻太小、做不了事。這條軌道換目標：**讓模型真的去做事情**——所以換一個「真正能用」的模型，並在它外面**親手刻一圈控制邏輯**。那圈邏輯就是 Agent。

> **Agent = LLM（推理引擎）+ 工具（tools）+ 迴圈（loop）。**

> 💡 Colab 記得開 **T4 GPU**：執行階段 → 變更執行階段類型 → T4 GPU。本軌道零框架，每一圈迴圈都你自己寫。
"""
        ),
        md("## 1. 安裝相依套件\n\n第一次跑約 1–2 分鐘。"),
        code(INSTALL),
        md(
            "## 2. 用 4-bit 量化載入 Qwen\n\n"
            "`bitsandbytes` 把模型砍成 4-bit，1.5B 量化後只吃 1–2GB 顯示記憶體，免費 T4 綽綽有餘。"
            "整條軌道只透過 `chat()` 這一個函式碰模型。"
        ),
        code(LOAD_SRC),
        md("## 3. 跟模型對話\n\nLLM 只會做一件事：給它一串訊息，它接著吐一串文字。"),
        code(
            """
reply = chat([{"role": "user", "content": "用一句話解釋什麼是大型語言模型。"}])
print(reply)
"""
        ),
        md("### 它背過的東西，答得出來"),
        code(
            """
print(chat([{"role": "user", "content": "2 的 10 次方是多少？"}]))
"""
        ),
        md(
            "### 但它碰不到的世界，只能瞎掰\n\n"
            "模型沒有時鐘——它的世界停在訓練資料那一刻。問它現在幾點，它只會編一個。"
        ),
        code(
            """
print(chat([{"role": "user", "content": "現在台北時間幾點幾分？請只回答時間。"}]))
# ☝️ 這個時間是模型瞎掰的，不是真的。這個「答不出來」正是整條軌道的起點。
"""
        ),
        md(
            """
## 小結

- **Agent = LLM + 工具 + 迴圈**。LLM 只會「文字進、文字出」。
- 我們用 **4-bit 量化**在免費 T4 上載入了 Qwen，封裝成 `chat()`。
- 模型**背過的**答得出來，**碰不到的真實世界**（時間、計算、查資料）只能瞎掰。

下一課：教模型在卡住時，改成**呼叫一個工具**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-what-is-agent.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · Tool Calling 的本質

「模型會呼叫工具」聽起來很神奇。拆穿了，它只是四步，而且**每一步都是我們寫的**：

1. **描述工具**：system prompt 告訴模型有哪些工具、用什麼格式呼叫。
2. **模型吐結構化文字**：它判斷要用工具時，就照約定吐出來——它沒真的執行任何東西。
3. **我們解析 + 執行**：用 Python 解析那段文字，真的去呼叫對應函式。
4. **把結果餵回去**：把工具回傳值塞回對話，請模型給最終答案。

真正碰到時鐘、碰到世界的，是步驟 3 裡**你寫的 Python**。
"""
        ),
        md("## 1. 載入模型"),
        code(INSTALL),
        code(LOAD_SRC),
        md("## 2. 定義第一個工具：一支真正的時鐘"),
        code(TOOLS_SRC),
        code('print("現在真實時間：", get_current_time())'),
        md(
            "## 3. 教模型用約定格式呼叫工具\n\n"
            "我們約定：需要工具時，輸出 `Action: 工具名` 與 `Action Input: {JSON 參數}`。"
        ),
        code(
            '''
SYSTEM = """你是一個會使用工具的助手。你有以下工具：

- get_current_time()：回傳現在的台北時間，不需要參數。

當你需要工具時，嚴格用這個格式輸出（不要說別的）：
Action: 工具名稱
Action Input: JSON 參數（沒有參數就寫 {})

不需要工具時，直接回答即可。"""
'''
        ),
        code(PARSE_SRC),
        md("## 4. 第一輪：讓模型決定要不要用工具"),
        code(
            '''
question = "現在台北時間幾點？"
messages = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": question}]
reply = chat(messages)
print("模型第一次輸出：\\n" + reply)
'''
        ),
        md("## 5. 解析 → 執行 → 餵回 → 最終答案\n\n把四步串完。"),
        code(
            '''
TOOLS = {"get_current_time": get_current_time}

name, args = parse_action(reply)
if name in TOOLS:
    observation = TOOLS[name](**args)            # 步驟 3：真的執行
    print(f"執行 {name}() → {observation}")
    messages.append({"role": "assistant", "content": reply})
    messages.append({"role": "user",
                     "content": f"Observation: {observation}\\n請根據這個結果回答原問題。"})
    final = chat(messages)                        # 步驟 4：餵回拿最終答案
    print("\\n最終答案：\\n" + final)
else:
    print("模型沒呼叫工具，直接回答：\\n" + reply)
'''
        ),
        md(
            """
## 小結

- Tool calling = **結構化文字 + 你寫的解析器**，沒有魔法。
- 我們手刻完了「描述 → 吐字 → 解析執行 → 餵回」一輪。
- 但這只跑了**一輪、一個工具**。真實任務要連續好幾步。

下一課：把這一輪一般化成 **ReAct 迴圈**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-tool-calling.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 手刻 ReAct 迴圈

整條軌道的**靈魂課**。上一課只跑一輪；真實任務常是多步的——「現在到下午三點還有幾小時」要先**查時間**再**算差**。需要一個迴圈。

**ReAct** 把每一步拆成三段，反覆進行直到收斂：

```
Thought（想）→ Action（做）→ Observation（看）→ … → Final Answer
```
"""
        ),
        md("## 1. 載入模型與工具"),
        code(INSTALL),
        code(LOAD_SRC),
        code(TOOLS_SRC),
        code(PARSE_SRC),
        md("## 2. ReAct 的 system prompt\n\n約定 Thought / Action / Final Answer 的格式。"),
        code(
            '''
REACT_SYSTEM = """你是一個會使用工具、一步步推理的助手。可用工具：

- get_current_time()：回傳現在台北時間，無參數。
- calculator(expression)：計算算式字串，例如 {"expression": "15-9"}。

請嚴格依這個格式，一次只走一步：

Thought: 你的推理
Action: 工具名稱
Action Input: JSON 參數

我會以 Observation 回覆工具結果，然後你再繼續下一個 Thought。
當資訊足夠時，改用這個格式收尾：

Thought: 最後推理
Final Answer: 給使用者的答案"""
'''
        ),
        md(
            "## 3. 手刻迴圈\n\n"
            "兩個工程細節：**停止條件**（看到 `Final Answer:` 就收工）與 **`max_steps` 護欄**"
            "（防止模型鬼打牆無限迴圈）。並把模型輸出在 `Observation` 處截斷，"
            "不讓它自己幻想工具結果。"
        ),
        code(
            '''
TOOLS = {"get_current_time": get_current_time, "calculator": calculator}


def run_react(question, max_steps=6, verbose=True):
    scratchpad = ""
    for step in range(1, max_steps + 1):
        messages = [{"role": "system", "content": REACT_SYSTEM},
                    {"role": "user", "content": f"問題：{question}\\n\\n{scratchpad}"}]
        reply = chat(messages, max_new_tokens=256)
        reply = reply.split("Observation")[0].strip()   # 別讓模型自己幻想觀察
        if verbose:
            print(f"--- 第 {step} 步 ---\\n{reply}")
        if "Final Answer:" in reply:
            return reply.split("Final Answer:")[-1].strip()
        name, args = parse_action(reply)
        if name is None:
            obs = "（沒解析到 Action，請用正確格式，或給 Final Answer）"
        elif name not in TOOLS:
            obs = f"沒有名為 {name} 的工具。"
        else:
            obs = TOOLS[name](**args)
        if verbose:
            print(f"Observation: {obs}\\n")
        scratchpad += f"{reply}\\nObservation: {obs}\\n"
    return "（達到最大步數仍未完成）"
'''
        ),
        md("## 4. 丟一個需要連續兩步的問題"),
        code(
            '''
answer = run_react("現在台北時間的『小時』數字，加上 100 是多少？")
print("\\n========\\n最終答案：", answer)
'''
        ),
        md(
            """
## 小結

- **ReAct = Thought → Action → Observation** 反覆，把只會吐字的 LLM 變成**會多步推理、自己用工具**的 agent。
- 手刻迴圈必備：**停止條件**（`Final Answer:`）與 **`max_steps` 護欄**。
- 在 `Observation` 處截斷模型輸出，避免它幻想結果。

下一課：把兩支寫死的工具，升級成**一整箱可擴充、會路由**的工具系統。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-react-loop.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 多工具與工具路由

真實 agent 動輒十幾支工具、還常常要新增。這課把工具系統升級成**註冊表（registry）**：工具即資料，prompt 自動生成；並處理「模型亂呼叫」的健壯性。
"""
        ),
        md("## 1. 載入模型與基礎工具"),
        code(INSTALL),
        code(LOAD_SRC),
        code(TOOLS_SRC),
        code(PARSE_SRC),
        md(
            "## 2. Tool Registry：工具即資料\n\n"
            "每支工具登記 name / description / 函式。新增工具只要註冊一筆。"
        ),
        code(
            '''
def word_count(text: str) -> str:
    """回傳一段文字的字元數。"""
    return f"{len(text or '')} 個字元"


REGISTRY = [
    {"name": "get_current_time", "fn": lambda: get_current_time(),
     "description": "回傳現在台北時間，無參數。"},
    {"name": "calculator", "fn": calculator,
     "description": '計算算式，參數 {"expression": "3+4*2"}。'},
    {"name": "word_count", "fn": word_count,
     "description": '計算文字字元數，參數 {"text": "你好"}。'},
]
TOOLS = {t["name"]: t["fn"] for t in REGISTRY}
'''
        ),
        md("## 3. 從 registry 自動生成工具說明\n\n新增工具，prompt 自己更新，不用改別處。"),
        code(
            '''
def build_tools_prompt(registry):
    lines = [f"- {t['name']}：{t['description']}" for t in registry]
    return "\\n".join(lines)


REACT_SYSTEM = f"""你是一個會使用工具、一步步推理的助手。可用工具：

{build_tools_prompt(REGISTRY)}

格式（一次一步）：
Thought: 推理
Action: 工具名稱
Action Input: JSON 參數

我會以 Observation 回覆。資訊足夠時改用：
Thought: 最後推理
Final Answer: 答案"""
print(REACT_SYSTEM)
'''
        ),
        md(
            "## 4. 健壯的迴圈：把錯誤當 Observation 餵回\n\n"
            "模型一定會偶爾**幻覺工具名、給錯參數**。健壯做法不是崩潰，"
            "而是把錯誤當成一種觀察餵回去，讓模型**下一步自我修正**。"
        ),
        code(
            '''
def route(name, args):
    """工具路由：把模型選的 name 對應到實際函式；出錯回錯誤訊息（當 Observation）。"""
    if name not in TOOLS:
        avail = ", ".join(TOOLS)
        return f"沒有名為 {name} 的工具。可用的是：{avail}"
    try:
        return str(TOOLS[name](**args))
    except TypeError as e:
        return f"參數錯誤：{e}"
    except Exception as e:
        return f"執行錯誤：{e}"


def run_agent(question, max_steps=6, verbose=True):
    scratchpad = ""
    for step in range(1, max_steps + 1):
        messages = [{"role": "system", "content": REACT_SYSTEM},
                    {"role": "user", "content": f"問題：{question}\\n\\n{scratchpad}"}]
        reply = chat(messages, max_new_tokens=256).split("Observation")[0].strip()
        if verbose:
            print(f"--- 第 {step} 步 ---\\n{reply}")
        if "Final Answer:" in reply:
            return reply.split("Final Answer:")[-1].strip()
        name, args = parse_action(reply)
        obs = "（沒解析到 Action）" if name is None else route(name, args)
        if verbose:
            print(f"Observation: {obs}\\n")
        scratchpad += f"{reply}\\nObservation: {obs}\\n"
    return "（達到最大步數仍未完成）"
'''
        ),
        md("## 5. 讓 agent 自己路由"),
        code('print(run_agent("『人工智慧』這四個字加起來有幾個字元，再乘以 3 是多少？"))'),
        md(
            """
## 小結

- **Tool registry**：工具即資料，prompt 從 registry 自動生成，新增工具零改動。
- **工具路由**：把模型選的 name 對應到實際函式。
- **健壯性**：幻覺工具名 / 參數錯誤，都當成 **Observation 餵回**，讓模型自我修正。

下一課：給 agent **記憶**，讓它記得住對話、撐得久。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-tool-routing.ipynb")


if __name__ == "__main__":
    print("產生 agent lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
