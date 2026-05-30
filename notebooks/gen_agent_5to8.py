"""產生 agent 軌道 lessons 05–08 的 notebook（手刻 AI Agent）。

用法：
    notebooks/.venv/bin/python notebooks/gen_agent_5to8.py
這些 notebook 要載 Qwen（CUDA-only），本機不執行，留到 Colab T4 跑。
提交前清掉輸出：
    jupyter nbconvert --clear-output --inplace notebooks/agent/from-scratch/0{5,6,7,8}-*.ipynb
"""

from _agent_shared import INSTALL, KB_SRC, LOAD_SRC
from _nbgen import build_notebook, code, md

DIR = "agent/from-scratch"

# L07/L08 共用的精簡工具 + ReAct 執行器（前四課的成果濃縮版），以字串注入。
EXECUTOR_SRC = '''
from datetime import datetime, timezone, timedelta


def get_current_time() -> str:
    return datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")


def calculator(expression: str) -> str:
    if not re.fullmatch(r"[0-9+\\-*/(). %]+", expression or ""):
        return "錯誤：只接受數字與 + - * / ( ) . %"
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"錯誤：{e}"


TOOLS = {"get_current_time": get_current_time, "calculator": calculator}
REACT_SYSTEM = """你是會用工具、一步步推理的助手。工具：
- get_current_time()：現在台北時間，無參數。
- calculator(expression)：算式，例 {"expression": "15-9"}。
格式（一次一步）：
Thought: 推理
Action: 工具名
Action Input: JSON
我會回 Observation。足夠時改用：
Thought: 推理
Final Answer: 答案"""


def parse_action(text):
    m = re.search(r"Action:\\s*([A-Za-z_]\\w*)", text)
    if not m:
        return None, None
    args, ma = {}, re.search(r"Action Input:\\s*(\\{.*\\})", text, re.DOTALL)
    if ma:
        try:
            args = json.loads(ma.group(1))
        except Exception:
            args = {}
    return m.group(1), args


def run_react(question, max_steps=5, verbose=False):
    pad = ""
    for _ in range(max_steps):
        msg = [{"role": "system", "content": REACT_SYSTEM},
               {"role": "user", "content": f"問題：{question}\\n\\n{pad}"}]
        r = chat(msg, max_new_tokens=256).split("Observation")[0].strip()
        if verbose:
            print(r)
        if "Final Answer:" in r:
            return r.split("Final Answer:")[-1].strip()
        name, args = parse_action(r)
        obs = "（沒解析到 Action）" if not name else (
            TOOLS[name](**args) if name in TOOLS else f"沒有 {name} 這支工具")
        pad += f"{r}\\nObservation: {obs}\\n"
    return "（達到最大步數）"
'''


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 記憶與狀態管理

到目前為止 agent 是**金魚腦**：每問一題就開一段新對話，答完即忘。這課給它記憶。

- **短期記憶**：把每回合訊息累積在 list，每次都帶上 → 記得前面說過什麼。
- **Scratchpad**：ReAct 的 Thought/Action/Observation，就是解任務的草稿紙。
- **長期記憶**：對話太長會撐爆 context window → 請模型把舊對話**摘要**，騰出空間。
"""
        ),
        md("## 1. 載入模型"),
        code(INSTALL),
        code(LOAD_SRC),
        md(
            "## 2. 一個 `Memory` 類別\n\n"
            "累積對話；當太長時，把較舊的對話交給模型**摘要**，用摘要換掉逐字歷史。"
        ),
        code(
            '''
class Memory:
    def __init__(self, system, max_turns=6):
        self.system = system
        self.history = []          # [{"role","content"}, ...]
        self.summary = ""
        self.max_turns = max_turns

    def add(self, role, content):
        self.history.append({"role": role, "content": content})

    def messages(self):
        sys = self.system
        if self.summary:
            sys += "\\n\\n先前對話摘要：" + self.summary
        return [{"role": "system", "content": sys}] + self.history

    def maybe_summarize(self):
        if len(self.history) <= self.max_turns:
            return
        old, keep = self.history[:-2], self.history[-2:]   # 最近一回合保留逐字
        text = "\\n".join(f'{m["role"]}: {m["content"]}' for m in old)
        s = chat([{"role": "user",
                   "content": "用三句話摘要對話重點與已知事實：\\n" + text}],
                 max_new_tokens=200)
        self.summary = (self.summary + " " + s).strip()
        self.history = keep
        print("  〔已摘要舊對話 → 騰出 context〕")
'''
        ),
        md("## 3. 多回合對話：它記得住嗎？"),
        code(
            '''
mem = Memory("你是友善的繁體中文助手。", max_turns=4)


def say(u):
    mem.add("user", u)
    r = chat(mem.messages())
    mem.add("assistant", r)
    mem.maybe_summarize()
    print("你：", u, "\\n助手：", r, "\\n")


say("我叫小明，最喜歡爬山。")
say("根據我的喜好，推薦一個週末活動。")   # 應該扣到「爬山」
say("我剛剛說我叫什麼名字？")             # 測短期記憶
'''
        ),
        md(
            """
## 小結

- **短期記憶**＝累積 messages；**scratchpad**＝任務草稿；**長期記憶**＝摘要壓縮。
- **context window 有限**，主動摘要是長對話 agent 撐得久的祕訣。
- 摘要會遺失細節——這是「記得久」與「記得準」的取捨。

下一課：給 agent **RAG**，讓它查得到它沒學過的事實。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-memory.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · RAG Agent：讓 agent 查得到事實

LLM 會用一樣自信的語氣瞎掰它沒學過的事實。**RAG（檢索增強生成）** 治這個病：別讓模型憑記憶答，**先檢索**外部知識庫、**再根據資料**回答。
"""
        ),
        md("## 1. 載入模型 + embedding 模型\n\n多語 embedding 模型 CPU 就能跑。"),
        code(INSTALL + '\n%pip install -q sentence-transformers'),
        code(LOAD_SRC),
        md("## 2. 內嵌的小知識庫\n\n刻意放帶具體數字的事實——小模型容易記錯。"),
        code(KB_SRC),
        md(
            "## 3. 手刻 embedding 檢索\n\n"
            "把每張卡片與問題轉成向量，算**餘弦相似度**取最相近的 top-k。"
            "向量正規化後，內積就是餘弦相似度。"
        ),
        code(
            '''
import numpy as np
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
kb_vecs = embedder.encode(KB, normalize_embeddings=True)   # 每張卡片一個向量


def retrieve(query, k=2):
    q = embedder.encode([query], normalize_embeddings=True)[0]
    scores = kb_vecs @ q                                   # 餘弦相似度
    top = np.argsort(-scores)[:k]
    return [KB[i] for i in top]


print(retrieve("台灣最高的山多高？"))
'''
        ),
        md("## 4. 對照：沒 RAG vs 有 RAG"),
        code(
            '''
q = "玉山主峰的海拔到底是幾公尺？"

# 沒 RAG：模型憑記憶，可能瞎掰
print("【沒 RAG】", chat([{"role": "user", "content": q}]))
'''
        ),
        code(
            '''
# 有 RAG：先檢索，再要求模型根據資料作答並標注出處
docs = retrieve(q)
ctx = "\\n".join(f"[{i+1}] {d}" for i, d in enumerate(docs))
prompt = f"""只根據以下資料回答問題，並標注你用了哪一條（例如 [1]）。
若資料中沒有答案，就說不知道。

資料：
{ctx}

問題：{q}"""
print("【有 RAG】", chat([{"role": "user", "content": prompt}]))
'''
        ),
        md(
            "## 5. 把檢索包成工具，接回 ReAct\n\n"
            "不是每題都要查。把 `retrieve` 當成一支工具，讓 agent **自己決定何時查**"
            "——就是第 04 課的工具路由，多註冊一支 `retrieve` 而已。"
        ),
        code(
            '''
# 概念示意：retrieve 就是一支會回傳文件字串的工具
def retrieve_tool(query: str) -> str:
    return " | ".join(retrieve(query, k=2))


print(retrieve_tool("澎湖的地形特色"))
# 接回第 04 課的 REGISTRY，agent 即可在需要時自己呼叫 retrieve。
'''
        ),
        md(
            """
## 小結

- **RAG = 先檢索、再 grounding**，把「憑記憶」換成「靠資料」，治幻覺、附出處。
- 檢索靠 **embedding 餘弦相似度**，幾行 numpy 手刻。
- 把 `retrieve` 包成工具接回 ReAct，agent 就會**自己決定何時查資料**。

下一課：複雜任務拆給**多個代理**協作。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-rag.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 多代理協作：Planner + Executor

複雜任務一個 agent 容易迷路。人類會**先列計畫、再一步步做**。我們把它搬給 agent：

- **Planner**：把任務拆成有序子步驟（只規劃、不執行）。
- **Executor**：前幾課的 ReAct 工具 agent，一次專心做一步。
- **Orchestrator**：串流程、累積結果、彙整答案。
"""
        ),
        md("## 1. 載入模型 + 執行器（前四課成果濃縮）"),
        code(INSTALL),
        code(LOAD_SRC),
        code(EXECUTOR_SRC),
        md("## 2. Planner：把任務拆成有序步驟"),
        code(
            '''
def plan(task):
    p = chat([{"role": "user",
               "content": f"把任務拆成 2-4 個有序步驟，每行一步、用「1. 」開頭，"
                          f"不要解釋：\\n{task}"}], max_new_tokens=200)
    return re.findall(r"\\d+\\.\\s*(.+)", p)


print(plan("查現在幾點，並算出再過 90 分鐘是幾點幾分"))
'''
        ),
        md("## 3. Orchestrator：逐步交給 executor，再彙整"),
        code(
            '''
def orchestrate(task, verbose=True):
    steps = plan(task)
    if verbose:
        print("📋 計畫：")
        for i, s in enumerate(steps, 1):
            print(f"  {i}. {s}")
    results = []
    for i, s in enumerate(steps, 1):
        r = run_react(s)
        results.append(f"步驟{i}（{s}）→ {r}")
        if verbose:
            print(f"\\n✅ 步驟 {i} 結果：{r}")
    final = chat([{"role": "user",
                   "content": "根據各步驟結果，彙整成給使用者的最終答案：\\n"
                              + "\\n".join(results)}])
    return final


print("\\n🎯 最終答案：", orchestrate("查現在幾點，並算出『分鐘』數字乘以 60 是多少"))
'''
        ),
        md(
            "## 4. Sidebar：Reflection（自我批評再修正）\n\n"
            "多代理的近親：同一個 agent **先答、再自我批評、再修正**。一寫一改、自我迭代。"
        ),
        code(
            '''
Q = "用一句話說明為什麼天空是藍色的。"
draft = chat([{"role": "user", "content": Q}])
critique = chat([{"role": "user",
                  "content": f"指出這個回答可以更好的地方（簡短）：\\n{draft}"}])
revised = chat([{"role": "user",
                 "content": f"問題：{Q}\\n初版：{draft}\\n批評：{critique}\\n"
                            f"請根據批評給出更好的一句話回答。"}])
print("初版：", draft, "\\n批評：", critique, "\\n改進：", revised)
'''
        ),
        md(
            """
## 小結

- **Planner + Executor + Orchestrator**：一個負責拆、一個負責做、一個負責合。
- 分工**降低每個 agent 的認知負擔**，解單一 agent 扛不動的複雜任務。
- **Reflection** 是近親：自答、自評、自改。

下一課：把全部零件組成一個**能用的研究助理**，並接軌真實世界 API。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-multi-agent.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 實戰專案 · 接軌真實世界

把前七課全部組起來：一個**迷你研究助理**——會查資料(RAG)、會算數、記得住對話、會多步推理。最後一個選修 sidebar，只改 `chat()` 一個函式，就把本地 Qwen 換成免費 API。
"""
        ),
        md("## 1. 載入所有零件"),
        code(INSTALL + '\n%pip install -q sentence-transformers'),
        code(LOAD_SRC),
        code(KB_SRC),
        code(EXECUTOR_SRC),
        md("## 2. 把 RAG 檢索也加進工具箱\n\n研究助理 = 第 04 課路由 + 第 06 課 RAG。"),
        code(
            '''
import numpy as np
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
kb_vecs = embedder.encode(KB, normalize_embeddings=True)


def retrieve(query: str) -> str:
    q = embedder.encode([query], normalize_embeddings=True)[0]
    top = np.argsort(-(kb_vecs @ q))[:2]
    return " | ".join(KB[i] for i in top)


# 把 retrieve 註冊進工具箱 + prompt（沿用 EXECUTOR 的 TOOLS / REACT_SYSTEM）
TOOLS["retrieve"] = retrieve
globals()["REACT_SYSTEM"] = REACT_SYSTEM.replace(
    "格式（一次一步）",
    '- retrieve(query)：查台灣常識知識庫，例 {"query": "玉山多高"}。\\n格式（一次一步）')
'''
        ),
        md("## 3. 跑一個「查 + 算」綜合問題"),
        code(
            '''
print(run_react("玉山的海拔（公尺）減去台北101 的高度（公尺）是多少？", verbose=True))
# agent 會：retrieve 查玉山 → retrieve 查台北101 → calculator 相減 → Final Answer
'''
        ),
        md(
            "## 4. 選修 sidebar：接軌真實世界（免費 API）\n\n"
            "因為一切都透過 `chat()`，要換更強的模型**只改這一個函式**，agent 其餘程式一行不動。\n\n"
            "- **Gemini 2.5 Flash**：1,500 req/天、免卡、支援 function calling。\n"
            "- ⚠️ 各自申請自己的 key，用 Colab secrets / 環境變數帶入，**別寫死在 notebook**。"
        ),
        code(
            '''
# 取消註解即可改用 Gemini（需先 %pip install -q google-generativeai 並設好金鑰）
# import os, google.generativeai as genai
# genai.configure(api_key=os.environ["GEMINI_API_KEY"])
# _g = genai.GenerativeModel("gemini-2.5-flash")
#
# def chat(messages, max_new_tokens=512, temperature=0.0):
#     """同樣的介面：messages 進、文字出。把多輪訊息攤平成一段 prompt。"""
#     prompt = "\\n".join(f'{m["role"]}: {m["content"]}' for m in messages)
#     resp = _g.generate_content(
#         prompt, generation_config={"temperature": temperature,
#                                    "max_output_tokens": max_new_tokens})
#     return resp.text.strip()
#
# 換上去後，前面所有 run_react / orchestrate 完全不用改，立刻感覺 tool calling 變穩。
print("把上面那段取消註解、設好 GEMINI_API_KEY，就能一鍵換模型。")
'''
        ),
        md(
            """
## 終點，也是起點

你把**工具、ReAct、路由、記憶、RAG、多代理**全部組成了一個能用的 agent。

從 `ml` 的第一個分類器，到 `llm` 從零刻出的迷你 GPT，再到這條軌道**手刻一個會用工具、會做事的 agent**——你走完了「經典 ML → 深度學習 → 從零打造 LLM → AI Agent」整條學習弧線。

真實世界的 agent 框架（LangGraph、AutoGen…）只是把你親手寫過的這些零件做得更工整。**底層原理，你已經全部刻過一遍了。**

> 🎓 恭喜走完整條 AI/ML 學習線。下一步：拿這套骨架，去打造一個真正解決你自己問題的 agent。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-project.ipynb")


if __name__ == "__main__":
    print("產生 agent lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
