"""rl 軌道共用素材：安裝字串 + 自訂環境 + 繪圖小工具。

跟 _llm_shared / _agent_shared 一樣，把「每個 notebook 都會重複的程式」集中成字串，
再注入各 notebook 的 code cell，讓每個 notebook 自成一體（Colab 可獨立開啟）。

rl 軌道大多是輕量、純 CPU 就能跑的程式（CartPole、FrozenLake、小型 DQN），
但安裝 gymnasium / stable-baselines3 與訓練迴圈在 Colab 跑最省事；
比照 agent 軌道，notebook **無輸出提交**，輸出留到 Colab 執行時產生。
"""

# 基礎環境：gymnasium + 經典控制題（CartPole / MountainCar / Acrobat）。
INSTALL_GYM = '%pip install -q -U "gymnasium[classic-control]"'

# 進階：stable-baselines3（DQN / PPO 等現成演算法）。
INSTALL_SB3 = '%pip install -q -U "stable-baselines3>=2.0" "gymnasium[classic-control]"'

# 畫學習曲線的小工具（每回合報酬 + 滑動平均），多課共用。圖內文字用英文（Plan A）。
PLOT_SRC = '''
import numpy as np
import matplotlib.pyplot as plt


def plot_rewards(rewards, window=50, title="Learning curve"):
    """畫每回合報酬與滑動平均，一眼看出 agent 有沒有在進步。"""
    plt.figure(figsize=(8, 4))
    plt.plot(rewards, alpha=0.3, label="episode reward")
    if len(rewards) >= window:
        ma = np.convolve(rewards, np.ones(window) / window, mode="valid")
        plt.plot(range(window - 1, len(rewards)), ma, lw=2.2,
                 label=f"moving avg ({window})")
    plt.xlabel("episode"); plt.ylabel("reward"); plt.title(title)
    plt.legend(); plt.grid(alpha=0.3); plt.tight_layout(); plt.show()
'''

# L07 / L08 共用的自訂環境：接水果（Catch）。
# 一個底部木板接住從上掉落的水果的小遊戲——夠簡單、訓練快、又有畫面，
# 拿來示範「如何把一個遊戲包成 gymnasium 環境」最合適。純 Python、零外部資產。
CATCH_ENV_SRC = '''
import numpy as np
import gymnasium as gym
from gymnasium import spaces


class CatchEnv(gym.Env):
    """接水果：底部木板接住掉落的水果。這是我們親手刻的 gymnasium 環境。

    觀察 observation：[paddle_x, fruit_x, fruit_y]，三者都正規化到 0~1。
    動作 action：0=左移、1=不動、2=右移。
    獎勵 reward：接到 +1、漏接 -1，其餘步為 0。
    回合 episode：不自然結束，靠 TimeLimit 包裝器設定步數上限。
    """

    metadata = {"render_modes": ["ansi"]}

    def __init__(self, grid_size=5, render_mode=None):
        super().__init__()
        self.grid = grid_size
        self.render_mode = render_mode
        self.action_space = spaces.Discrete(3)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(3,), dtype=np.float32
        )

    def _obs(self):
        n = self.grid - 1
        return np.array(
            [self.paddle / n, self.fruit_x / n, self.fruit_y / n], dtype=np.float32
        )

    def _spawn_fruit(self):
        self.fruit_x = int(self.np_random.integers(0, self.grid))
        self.fruit_y = self.grid - 1

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.paddle = self.grid // 2
        self._spawn_fruit()
        return self._obs(), {}

    def step(self, action):
        # 木板依動作左右移（action-1 → -1/0/+1），夾在邊界內。
        self.paddle = int(np.clip(self.paddle + (action - 1), 0, self.grid - 1))
        self.fruit_y -= 1
        reward = 0.0
        if self.fruit_y <= 0:                       # 水果落到底了，結算這顆
            reward = 1.0 if self.paddle == self.fruit_x else -1.0
            self._spawn_fruit()                     # 立刻補一顆新的，遊戲繼續
        return self._obs(), reward, False, False, {}

    def render(self):
        rows = []
        for y in range(self.grid - 1, -1, -1):
            row = ["."] * self.grid
            if y == self.fruit_y:
                row[self.fruit_x] = "*"
            if y == 0:
                row[self.paddle] = "U"
            rows.append(" ".join(row))
        return "\\n".join(rows)
'''
