"""產生 rl 軌道 lessons 01–04 的 notebook（手刻強化學習）。

用法：
    notebooks/.venv/bin/python notebooks/gen_rl_1to4.py

這些 notebook 比照 agent 軌道：**無輸出提交**，留到 Colab 執行（CartPole/FrozenLake
純 CPU 也能跑，但安裝套件與訓練在 Colab 最省事）。build_notebook 只寫 JSON、不執行，
所以產出天生就沒有輸出，不需要再 clear-output。
"""

from _nbgen import build_notebook, code, md
from _rl_shared import INSTALL_GYM, INSTALL_SB3, PLOT_SRC

DIR = "rl/from-scratch"


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 強化學習的世界觀：第一個 gym 環境

歡迎來到 **強化學習 → 手刻強化學習**。

前面的軌道裡，模型都是看著「正確答案」學的（監督式）。強化學習換一種學法:**沒有人告訴 agent 正確動作,它只能在環境裡試錯,靠獎勵訊號自己摸索出好策略**——就像學騎腳踏車。

> **RL 的世界 = Agent ⇄ Environment**:agent 看到**狀態(state)**、做出**動作(action)**、收到**獎勵(reward)** 與**新狀態**,如此反覆。目標:最大化長期累積獎勵。

這一課先用經典的 **CartPole**(平衡一根桿子)把這個迴圈跑起來,認識 gymnasium 的標準介面。
"""
        ),
        md("## 1. 安裝 gymnasium\n\ngymnasium 是 OpenAI Gym 的後繼者,RL 環境的事實標準。"),
        code(INSTALL_GYM),
        md(
            "## 2. 建立環境,看看它的「規格」\n\n"
            "每個環境都用兩個 space 描述自己:**觀察空間**(agent 看得到什麼)與"
            "**動作空間**(agent 能做什麼)。"
        ),
        code(
            '''
import gymnasium as gym

env = gym.make("CartPole-v1")
print("觀察空間 observation_space:", env.observation_space)  # 4 個連續數值
print("動作空間 action_space    :", env.action_space)        # 2 個離散動作(左推/右推)

obs, info = env.reset(seed=0)
print("初始觀察:", obs)
'''
        ),
        md(
            "## 3. 跑一回合「隨機策略」\n\n"
            "agent 還沒學任何東西,先讓它**隨機亂動**,感受 reset → step 的節奏。"
            "`step(action)` 回傳五元組:`obs, reward, terminated, truncated, info`。"
        ),
        code(
            '''
obs, info = env.reset(seed=0)
total_reward, steps = 0.0, 0
while True:
    action = env.action_space.sample()              # 隨機挑一個動作
    obs, reward, terminated, truncated, info = env.step(action)
    total_reward += reward
    steps += 1
    if terminated or truncated:                     # 桿子倒了 or 撐到上限
        break
print(f"隨機策略撐了 {steps} 步,累積獎勵 {total_reward}")
# CartPole 每撐一步 +1。隨機亂動通常十幾二十步桿子就倒——這就是「還沒學會」的樣子。
'''
        ),
        md(
            "## 4. 重點:那個迴圈\n\n"
            "把上面那段抽象成一句話,就是所有 RL 的骨架:"
        ),
        code(
            '''
# RL 的萬用骨架(虛擬碼)
# obs = env.reset()
# while not done:
#     action = policy(obs)      # ← 這條軌道的全部努力,就是把這個 policy 學好
#     obs, reward, done, ... = env.step(action)
print("agent ⇄ environment:看狀態 → 選動作 → 拿獎勵 → 看新狀態,反覆。")
'''
        ),
        md(
            """
## 小結

- **RL = agent 在 environment 裡試錯**,靠 reward 學策略,沒有標準答案。
- gymnasium 用 `observation_space` / `action_space` 描述環境,用 `reset()` / `step()` 互動。
- `step()` 回傳 `obs, reward, terminated, truncated, info` 五元組。
- 隨機策略撐不久——下一課開始,我們讓 agent **真的學習**。

下一課:手刻 **Q-learning**,用一張表學會走迷宮。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-worldview.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 手刻 Q-learning:一張表學會走迷宮

最經典、也最好懂的 RL 演算法。核心是一張 **Q 表**:`Q[狀態, 動作]` = 「在這個狀態做這個動作,預期能拿到多少長期獎勵」。學會這張表,策略就是「每一步挑 Q 值最大的動作」。

我們用 **FrozenLake**(在結冰湖面從起點走到終點、別掉進冰洞)來練。先用不打滑版本,讓規律單純。
"""
        ),
        md("## 1. 安裝與建立環境"),
        code(INSTALL_GYM),
        code(
            '''
import numpy as np
import gymnasium as gym

env = gym.make("FrozenLake-v1", is_slippery=False)   # 先不打滑,規律最單純
n_states = env.observation_space.n                   # 16 格
n_actions = env.action_space.n                       # 4 個方向
print(f"{n_states} 個狀態 × {n_actions} 個動作")
'''
        ),
        md(
            "## 2. Q 表 + Q-learning 更新公式\n\n"
            "Q 表初始全 0。每走一步,用 **Bellman 更新**把「實際拿到的獎勵 + 未來最好的預期」"
            "慢慢灌進這格:\n\n"
            "`Q[s,a] ← Q[s,a] + α · ( r + γ·max Q[s',·] − Q[s,a] )`"
        ),
        code(
            '''
Q = np.zeros((n_states, n_actions))
alpha, gamma = 0.8, 0.95          # 學習率、折扣因子(未來獎勵打幾折)
epsilon = 1.0                     # 探索率:一開始全靠亂試
episodes = 2000

for ep in range(episodes):
    s, _ = env.reset()
    done = False
    while not done:
        # epsilon-greedy:有時亂試(探索),有時照目前最好的走(利用)
        if np.random.rand() < epsilon:
            a = env.action_space.sample()
        else:
            a = int(np.argmax(Q[s]))
        s2, r, terminated, truncated, _ = env.step(a)
        done = terminated or truncated
        # Bellman 更新:把 r + 未來最好預期,灌進 Q[s,a]
        Q[s, a] += alpha * (r + gamma * np.max(Q[s2]) - Q[s, a])
        s = s2
    epsilon = max(0.05, epsilon * 0.999)   # 隨著學會,慢慢少亂試
print("訓練完成。epsilon 收斂到", round(epsilon, 3))
'''
        ),
        md("## 3. 把學到的策略畫出來\n\n每一格挑 Q 值最大的方向,看 agent 學到怎麼走。"),
        code(
            '''
arrows = ["←", "↓", "→", "↑"]      # FrozenLake 的動作編號對應方向
policy = np.array([arrows[int(np.argmax(Q[s]))] for s in range(n_states)])
print("學到的策略(4×4):")
print(policy.reshape(4, 4))
'''
        ),
        md("## 4. 驗收:用學到的策略跑 100 回合,看成功率"),
        code(
            '''
wins = 0
for _ in range(100):
    s, _ = env.reset()
    done = False
    while not done:
        s, r, terminated, truncated, _ = env.step(int(np.argmax(Q[s])))
        done = terminated or truncated
    wins += int(r == 1.0)
print(f"成功抵達終點:{wins}/100 回合")   # 不打滑版本,學成後應該接近 100
'''
        ),
        md(
            """
## 小結

- **Q-learning = 學一張 `Q[狀態,動作]` 表**,策略就是挑 Q 值最大的動作。
- 三個關鍵:**Bellman 更新**、**折扣因子 γ**、**epsilon-greedy** 平衡探索與利用。
- 不打滑版本能學到接近 100% 成功。把 `is_slippery=True` 打開會難很多——歡迎自己試。

下一課:狀態一多,表就爆了。我們用**神經網路**取代這張表——手刻一個迷你 DQN。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-q-learning.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 從 Q 表到 DQN:用神經網路逼近 Q

上一課的 Q 表有個致命傷:**狀態一多就爆**。CartPole 的觀察是 4 個連續數值,組合無限多,根本列不成表。

**DQN(Deep Q-Network)** 的點子:既然列不成表,就用一個**神經網路**來逼近這個函式——輸入狀態,輸出每個動作的 Q 值。這一課我們**親手刻一個迷你 DQN**,把它在 CartPole 上練起來。
"""
        ),
        md("## 1. 安裝(torch 在 Colab 已內建)"),
        code(INSTALL_GYM),
        md(
            "## 2. Q 網路 + 經驗回放\n\n"
            "兩個 DQN 的關鍵工程:\n"
            "- **Q 網路**:一個小 MLP,吃 4 維狀態、吐 2 個動作的 Q 值。\n"
            "- **經驗回放 replay buffer**:把走過的 `(s,a,r,s',done)` 存起來,訓練時隨機抽一批,"
            "打散相關性、讓訓練穩定。"
        ),
        code(
            '''
import random
from collections import deque

import numpy as np
import torch
import torch.nn as nn
import gymnasium as gym

device = "cuda" if torch.cuda.is_available() else "cpu"


class QNet(nn.Module):
    def __init__(self, n_obs, n_act):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_obs, 64), nn.ReLU(),
            nn.Linear(64, 64), nn.ReLU(),
            nn.Linear(64, n_act),
        )

    def forward(self, x):
        return self.net(x)


buffer = deque(maxlen=10000)   # 經驗回放
'''
        ),
        md(
            "## 3. 訓練迴圈\n\n"
            "用 **target network**(一個慢半拍的 Q 網路複本)算目標值,避免「自己追自己」發散;"
            "epsilon 從 1 衰減到 0.05。"
        ),
        code(
            '''
env = gym.make("CartPole-v1")
n_obs = env.observation_space.shape[0]
n_act = env.action_space.n

q = QNet(n_obs, n_act).to(device)
target = QNet(n_obs, n_act).to(device)
target.load_state_dict(q.state_dict())
opt = torch.optim.Adam(q.parameters(), lr=1e-3)

gamma, eps = 0.99, 1.0
batch_size = 64
rewards_hist = []

for ep in range(300):
    s, _ = env.reset()
    done, ep_reward = False, 0.0
    while not done:
        # epsilon-greedy 選動作
        if random.random() < eps:
            a = env.action_space.sample()
        else:
            with torch.no_grad():
                a = int(q(torch.tensor(s, dtype=torch.float32, device=device)).argmax())
        s2, r, terminated, truncated, _ = env.step(a)
        done = terminated or truncated
        buffer.append((s, a, r, s2, float(done)))
        s = s2; ep_reward += r

        # 從回放抽一批,做一次梯度更新
        if len(buffer) >= batch_size:
            batch = random.sample(buffer, batch_size)
            bs, ba, br, bs2, bd = map(np.array, zip(*batch))
            bs = torch.tensor(bs, dtype=torch.float32, device=device)
            bs2 = torch.tensor(bs2, dtype=torch.float32, device=device)
            ba = torch.tensor(ba, device=device).long()
            br = torch.tensor(br, dtype=torch.float32, device=device)
            bd = torch.tensor(bd, dtype=torch.float32, device=device)
            q_sa = q(bs).gather(1, ba.unsqueeze(1)).squeeze(1)
            with torch.no_grad():
                target_val = br + gamma * target(bs2).max(1).values * (1 - bd)
            loss = nn.functional.mse_loss(q_sa, target_val)
            opt.zero_grad(); loss.backward(); opt.step()

    eps = max(0.05, eps * 0.97)
    rewards_hist.append(ep_reward)
    if ep % 20 == 0:
        target.load_state_dict(q.state_dict())     # 定期同步 target network
        print(f"ep {ep:3d}  reward {ep_reward:5.0f}  eps {eps:.2f}")
print("訓練完成。")
'''
        ),
        md("## 4. 畫學習曲線\n\n報酬一路往上爬,就代表 agent 真的學會平衡桿子了。"),
        code(PLOT_SRC),
        code('plot_rewards(rewards_hist, window=20, title="Hand-crafted DQN on CartPole")'),
        md(
            """
## 小結

- **DQN = 用神經網路取代 Q 表**,解決連續/巨大狀態空間。
- 兩個讓訓練穩定的關鍵:**經驗回放** 與 **target network**。
- 親手刻一遍,你就懂了現成函式庫底下到底在做什麼。

下一課:同樣的事,用 **stable-baselines3** 一行搞定——並比較手刻與現成的差別。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-dqn.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 站在巨人肩上:stable-baselines3

手刻 DQN 讓你懂了原理,但真正做專案時,沒人會每次重寫訓練迴圈。**stable-baselines3 (SB3)** 把 DQN、PPO、A2C 等演算法封裝成幾行就能用、又經過嚴格調校的實作。

這一課:用 SB3 在 CartPole 上訓練,**一行 `model.learn()`** 取代上一課整個迴圈;並看 TensorBoard 監控訓練。
"""
        ),
        md("## 1. 安裝 stable-baselines3"),
        code(INSTALL_SB3),
        md(
            "## 2. 用 PPO 訓練 CartPole\n\n"
            "PPO(Proximal Policy Optimization)是目前最常用的通用演算法,穩、好調。"
            "建立模型 → `learn()` → 完成,就這樣。"
        ),
        code(
            '''
import gymnasium as gym
from stable_baselines3 import PPO

env = gym.make("CartPole-v1")
model = PPO("MlpPolicy", env, verbose=0, tensorboard_log="./tb_cartpole")
model.learn(total_timesteps=30_000)      # 上一課整個迴圈,濃縮成這一行
print("訓練完成。")
'''
        ),
        md("## 3. 評估:跑 20 回合看平均撐多久\n\nCartPole-v1 滿分 500,學成後應該常常頂到上限。"),
        code(
            '''
import numpy as np

scores = []
for _ in range(20):
    obs, _ = env.reset()
    done, total = False, 0.0
    while not done:
        action, _ = model.predict(obs, deterministic=True)   # 用學到的策略
        obs, r, terminated, truncated, _ = env.step(int(action))
        done = terminated or truncated
        total += r
    scores.append(total)
print(f"平均得分:{np.mean(scores):.1f}  (滿分 500)")
'''
        ),
        md(
            "## 4. 換一行就換演算法\n\n"
            "SB3 的價值:介面統一。想試 DQN?把 `PPO` 換成 `DQN` 就好,其餘不動。"
        ),
        code(
            '''
from stable_baselines3 import DQN

dqn = DQN("MlpPolicy", gym.make("CartPole-v1"), verbose=0)
dqn.learn(total_timesteps=30_000)
print("DQN 也訓練完成——同一套介面,換演算法只改一個名字。")
'''
        ),
        md(
            "## 5. TensorBoard:看訓練過程\n\n"
            "訓練時 SB3 已把指標寫進 `./tb_cartpole`。在 Colab 用下面兩行就能看互動圖表"
            "(獎勵、loss、explained variance…)。"
        ),
        code(
            '''
# 在 Colab 執行這兩行,會內嵌 TensorBoard 面板
%load_ext tensorboard
%tensorboard --logdir ./tb_cartpole
'''
        ),
        md(
            """
## 小結

- **SB3 把演算法封裝好**:建立模型 → `learn()` → `predict()`,訓練迴圈不用自己寫。
- **介面統一**:PPO / DQN / A2C 換一個名字就換演算法。
- **TensorBoard** 是 RL 的儀表板,訓練不順時先看它。
- 手刻(懂原理)+ SB3(做專案),兩個都要會。

下一課:回到手刻,認識另一大家族——**策略梯度**,直接學「策略」而不是學 Q 值。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-stable-baselines3.ipynb")


if __name__ == "__main__":
    print("產生 rl lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
