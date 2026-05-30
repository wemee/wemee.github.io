"""產生 rl 軌道 lessons 05–08 的 notebook（手刻強化學習）。

用法：
    notebooks/.venv/bin/python notebooks/gen_rl_5to8.py

比照 agent 軌道：**無輸出提交**，留到 Colab 執行。L07/L08 用共用的自訂環境
CatchEnv（接水果），定義在 _rl_shared.py 的 CATCH_ENV_SRC。
"""

from _nbgen import build_notebook, code, md
from _rl_shared import CATCH_ENV_SRC, INSTALL_GYM, INSTALL_SB3, PLOT_SRC

DIR = "rl/from-scratch"


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 策略梯度:直接學「策略」

DQN 那一家是先學 **Q 值**,再從 Q 值推出動作。**策略梯度(Policy Gradient)** 走另一條路:**直接把策略 π(a|s) 參數化成一個神經網路**,輸出每個動作的機率,然後——

> **讓「帶來高報酬的動作」機率變大,「帶來低報酬的動作」機率變小。**

這一課手刻最基礎的策略梯度演算法 **REINFORCE**,在 CartPole 上跑。它是 PPO、A2C 這些現代演算法的共同祖先。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_GYM),
        md(
            "## 2. 策略網路\n\n"
            "輸入狀態,輸出每個動作的機率(softmax)。用 `Categorical` 分布**取樣**動作"
            "(不是挑最大),取樣本身就是探索。"
        ),
        code(
            '''
import numpy as np
import torch
import torch.nn as nn
from torch.distributions import Categorical
import gymnasium as gym

device = "cuda" if torch.cuda.is_available() else "cpu"


class PolicyNet(nn.Module):
    def __init__(self, n_obs, n_act):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_obs, 128), nn.ReLU(),
            nn.Linear(128, n_act),
        )

    def forward(self, x):
        return torch.softmax(self.net(x), dim=-1)   # 動作機率分布
'''
        ),
        md(
            "## 3. REINFORCE 訓練迴圈\n\n"
            "做法:跑完**一整回合**,算出每一步的**折扣後報酬 return**,"
            "再用 `loss = −Σ log π(a|s) · return` 更新——報酬越高的動作,被推得越用力。"
            "報酬做標準化能讓訓練穩很多。"
        ),
        code(
            '''
env = gym.make("CartPole-v1")
n_obs = env.observation_space.shape[0]
n_act = env.action_space.n

policy = PolicyNet(n_obs, n_act).to(device)
opt = torch.optim.Adam(policy.parameters(), lr=1e-2)
gamma = 0.99
rewards_hist = []

for ep in range(400):
    s, _ = env.reset()
    log_probs, rewards = [], []
    done = False
    while not done:
        probs = policy(torch.tensor(s, dtype=torch.float32, device=device))
        dist = Categorical(probs)
        a = dist.sample()                       # 取樣動作
        log_probs.append(dist.log_prob(a))
        s, r, terminated, truncated, _ = env.step(int(a))
        rewards.append(r); done = terminated or truncated

    # 算每一步的折扣後 return(從後往前累加)
    returns, G = [], 0.0
    for r in reversed(rewards):
        G = r + gamma * G
        returns.insert(0, G)
    returns = torch.tensor(returns, dtype=torch.float32, device=device)
    returns = (returns - returns.mean()) / (returns.std() + 1e-8)   # 標準化

    loss = -(torch.stack(log_probs) * returns).sum()
    opt.zero_grad(); loss.backward(); opt.step()

    rewards_hist.append(sum(rewards))
    if ep % 40 == 0:
        print(f"ep {ep:3d}  reward {sum(rewards):5.0f}")
print("訓練完成。")
'''
        ),
        md("## 4. 學習曲線"),
        code(PLOT_SRC),
        code('plot_rewards(rewards_hist, window=20, title="REINFORCE on CartPole")'),
        md(
            """
## 小結

- **策略梯度直接學策略** π(a|s),用取樣探索,不經過 Q 值。
- **REINFORCE**:跑完整回合 → 算折扣 return → `−Σ log π · return` 更新。
- **return 標準化**是讓它穩定的小撇步。
- PPO 就是在這個骨架上加了「不要一次更新太多」的護欄——你已經懂它的根。

下一課:當獎勵很稀疏時怎麼辦?認識 **gym wrappers 與獎勵塑形**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-policy-gradient.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 獎勵塑形與環境包裝器

有些環境的獎勵**很稀疏**——比如 MountainCar,小車要爬上山才給獎勵,但隨機亂動幾乎永遠到不了山頂,agent 收不到任何訊號、根本學不動。

兩個救星:
- **環境包裝器 wrapper**:像洋蔥一樣一層層套在環境外,改觀察、改獎勵、限制步數,而**不動原環境**。
- **獎勵塑形 reward shaping**:自己加一點「中途獎勵」引導 agent,把稀疏訊號變稠密。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_GYM),
        md(
            "## 2. 內建包裝器:統計與步數限制\n\n"
            "`RecordEpisodeStatistics` 自動記錄每回合長度與報酬;"
            "`TimeLimit` 設定步數上限。包裝器可以一層層疊。"
        ),
        code(
            '''
import numpy as np
import gymnasium as gym
from gymnasium.wrappers import RecordEpisodeStatistics, TimeLimit

env = gym.make("MountainCar-v0")
env = TimeLimit(env, max_episode_steps=200)
env = RecordEpisodeStatistics(env)

obs, info = env.reset(seed=0)
print("觀察:[位置, 速度] =", obs)
print("原始獎勵設計:每一步 -1,到山頂才結束 → 非常稀疏")
'''
        ),
        md(
            "## 3. 自訂 RewardWrapper:加中途獎勵\n\n"
            "繼承 `gym.RewardWrapper`,改寫 `reward()`。這裡用「能量」(位置高度 + 速度平方)"
            "當塑形訊號:車子爬越高、衝越快,就多給一點獎勵,引導它學會來回擺盪蓄能。"
        ),
        code(
            '''
class EnergyShaping(gym.Wrapper):
    """把稀疏的 MountainCar 獎勵,加上一點基於『能量』的中途獎勵。"""

    def step(self, action):
        obs, reward, terminated, truncated, info = self.env.step(action)
        position, velocity = obs
        # 位置越高(越接近山頂 0.5)+ 速度越大 → 額外獎勵
        shaping = (position + 0.5) + 10.0 * (velocity ** 2)
        return obs, reward + shaping, terminated, truncated, info


base = TimeLimit(gym.make("MountainCar-v0"), max_episode_steps=200)
shaped = EnergyShaping(base)

# 比較:同樣隨機亂走,塑形後每回合拿到的訊號稠密多了
def run(env):
    obs, _ = env.reset(seed=0); total, done = 0.0, False
    while not done:
        obs, r, terminated, truncated, _ = env.step(env.action_space.sample())
        total += r; done = terminated or truncated
    return total

print("原始獎勵總和  :", round(run(base), 1))
print("塑形後獎勵總和:", round(run(shaped), 1), "← 中途就有訊號可學")
'''
        ),
        md(
            "## 4. ObservationWrapper:改觀察\n\n"
            "同理,`ObservationWrapper` 可以正規化觀察值——很多演算法吃正規化後的輸入更穩。"
        ),
        code(
            '''
class NormalizeObs(gym.ObservationWrapper):
    """把 MountainCar 的觀察(位置、速度)線性縮放到大約 0~1。"""

    def observation(self, obs):
        low, high = self.observation_space.low, self.observation_space.high
        return (obs - low) / (high - low)


norm_env = NormalizeObs(gym.make("MountainCar-v0"))
obs, _ = norm_env.reset(seed=0)
print("正規化後的觀察:", np.round(obs, 3))
'''
        ),
        md(
            """
## 小結

- **Wrapper 像洋蔥**,一層層套在環境外改行為,不動原環境:`TimeLimit`、`RewardWrapper`、`ObservationWrapper`…
- **獎勵塑形**把稀疏訊號變稠密,讓 agent 學得動——但要小心別塑形成「鑽漏洞」的壞策略。
- 這些是把 RL 用在**真實問題**上的關鍵手藝。

下一課:把整套合起來——**親手把一個小遊戲包成 gymnasium 環境**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-reward-shaping.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 自訂環境:把小遊戲包成 gymnasium

前六課都在用別人寫好的環境。這一課反過來:**自己刻一個**。只要實作 gymnasium 的標準介面,任何遊戲都能變成 RL 環境,接上 stable-baselines3 訓練。

我們做一個 **接水果(Catch)** 小遊戲:底部一塊木板,接住從上方掉下來的水果。麻雀雖小,五臟俱全——`observation_space`、`action_space`、`reset`、`step`、`render` 一個不少。
"""
        ),
        md("## 1. 安裝"),
        code(INSTALL_GYM),
        md(
            "## 2. 一個 gymnasium 環境長什麼樣\n\n"
            "繼承 `gym.Env`,定義五件事:\n"
            "- `observation_space` / `action_space`:規格\n"
            "- `reset()`:回到初始狀態,回 `(obs, info)`\n"
            "- `step(action)`:走一步,回 `(obs, reward, terminated, truncated, info)`\n"
            "- `render()`:畫出當前畫面"
        ),
        code(CATCH_ENV_SRC),
        md("## 3. 手動玩幾步,看 render\n\n`U` 是木板,`*` 是水果。先用隨機動作跑,印出畫面。"),
        code(
            '''
env = CatchEnv(grid_size=5)
obs, _ = env.reset(seed=0)
print("初始觀察 [paddle, fruit_x, fruit_y]:", obs)
print(env.render())
print("-" * 12)

for _ in range(4):
    obs, r, term, trunc, _ = env.step(env.action_space.sample())
    print(env.render())
    print(f"reward={r}")
    print("-" * 12)
'''
        ),
        md(
            "## 4. 用官方檢查器驗證介面\n\n"
            "`check_env` 會幫你抓出 space、回傳值型別等常見錯誤——自訂環境必跑。"
        ),
        code(
            '''
from gymnasium.utils.env_checker import check_env

check_env(CatchEnv())      # 沒有報錯就代表介面合規
print("CatchEnv 通過 gymnasium 介面檢查 ✓")
'''
        ),
        md(
            """
## 小結

- 自訂環境 = 實作 `gym.Env` 的五件套:兩個 space + `reset` / `step` / `render`。
- 觀察設計要讓 agent「看得到做決定需要的資訊」(這裡:木板與水果的相對位置)。
- `check_env` 驗證介面合規,接下來才能交給任何演算法訓練。

下一課(壓軸):用 stable-baselines3 **訓練 agent 學會玩這個接水果遊戲**,並聊聊怎麼把它搬進瀏覽器。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-custom-env.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 端到端實戰:訓練 agent 玩接水果

整條軌道的收尾。我們把前面所有東西串起來:拿第 07 課自訂的 **CatchEnv**,用 **stable-baselines3** 訓練一個真的會接水果的 agent,評估它、存檔,最後聊聊**怎麼把訓練好的模型搬進瀏覽器**——這正是本站遊戲區 RL 的做法。
"""
        ),
        md("## 1. 安裝 + 載入環境"),
        code(INSTALL_SB3),
        code(CATCH_ENV_SRC),
        md(
            "## 2. 包上 TimeLimit,組成訓練環境\n\n"
            "CatchEnv 不會自然結束,用 `TimeLimit` 給每回合 200 步上限,方便統計與訓練。"
        ),
        code(
            '''
import numpy as np
import gymnasium as gym
from gymnasium.wrappers import TimeLimit
from stable_baselines3 import PPO


def make_env():
    return TimeLimit(CatchEnv(grid_size=5), max_episode_steps=200)


# 訓練前先量一個「隨機策略」基準,等下好對照
def avg_reward(model=None, episodes=30):
    env = make_env()
    scores = []
    for _ in range(episodes):
        obs, _ = env.reset()
        done, total = False, 0.0
        while not done:
            if model is None:
                action = env.action_space.sample()
            else:
                action, _ = model.predict(obs, deterministic=True)
            obs, r, term, trunc, _ = env.step(int(action))
            done = term or trunc; total += r
        scores.append(total)
    return float(np.mean(scores))


baseline = avg_reward(None)
print(f"隨機策略基準:每 200 步淨得分 {baseline:.1f}")
'''
        ),
        md("## 3. 訓練 PPO\n\n約幾分鐘(T4 更快)。`total_timesteps` 拉高會更強。"),
        code(
            '''
model = PPO("MlpPolicy", make_env(), verbose=0)
model.learn(total_timesteps=100_000)
print("訓練完成。")
'''
        ),
        md("## 4. 評估:跟基準比，進步多少"),
        code(
            '''
trained = avg_reward(model)
print(f"隨機策略 :{baseline:6.1f}")
print(f"訓練後   :{trained:6.1f}   ← 接到水果越多分越高")
'''
        ),
        md("## 5. 看 agent 實際玩一回合\n\n`U` 木板會主動移到 `*` 水果正下方去接。"),
        code(
            '''
env = make_env()
obs, _ = env.reset(seed=1)
for step in range(8):
    action, _ = model.predict(obs, deterministic=True)
    obs, r, term, trunc, _ = env.step(int(action))
    print(env.render())
    print(f"step {step}  action={int(action)}  reward={r}")
    print("-" * 12)
'''
        ),
        md(
            "## 6. 存檔與載入\n\n"
            "訓練好的模型可存成檔案,日後直接載入推論,不用重訓。"
        ),
        code(
            '''
model.save("catch_ppo")
loaded = PPO.load("catch_ppo")
print("已存檔並重新載入:", loaded)
'''
        ),
        md(
            """
## 7. 從 Colab 到瀏覽器:本站怎麼做

你訓練的 agent 現在活在 Python 裡。本站的**遊戲區**把同樣的流程搬上線,讓 RL agent 直接在你的瀏覽器裡玩遊戲。關鍵幾招:

- **遊戲邏輯只寫一份(TypeScript)**:遊戲的 `GameCore` 用 TypeScript 寫,瀏覽器直接用;Python 訓練時則用 **PyMiniRacer(V8)** 跑同一份 JS,確保訓練與線上行為 100% 一致——遊戲規則不會有兩套。
- **Gymnasium 包裝**:Python 端寫一個 `gym.Env` 把那份 JS 的 `reset/step` 包起來(就像你這課對 CatchEnv 做的),交給 stable-baselines3 訓練。
- **匯出權重給瀏覽器**:訓練好的策略網路權重匯出成 JSON / TF.js 格式,前端載入後即可在瀏覽器即時推論。

> 想看真實版本,翻 repo 的 `ml-training/` 與遊戲區的 `GameCore` 架構。你這條軌道學的每一塊——環境介面、PPO 訓練、存檔——都是那套上線流程的縮影。

## 軌道小結

你從**完全不懂 RL**,一路手刻到能訓練 agent 玩自製遊戲:

1. RL 世界觀與 gymnasium 介面
2. 手刻 Q-learning(表格法)
3. 手刻 DQN(神經網路逼近)
4. stable-baselines3(站在巨人肩上)
5. 手刻策略梯度 REINFORCE
6. 獎勵塑形與環境包裝器
7. 自訂 gymnasium 環境
8. 端到端訓練 + 上線思路

**原理你手刻過、工具你也會用**——這正是把 RL 用在真實問題上需要的兩種底氣。🎮
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-project.ipynb")


if __name__ == "__main__":
    print("產生 rl lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
