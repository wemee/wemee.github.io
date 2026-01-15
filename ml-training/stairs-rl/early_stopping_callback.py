"""
Early Stopping Callback for RL Training

連續 N 次評估沒有提升超過指定百分比，就停止訓練
"""

from stable_baselines3.common.callbacks import BaseCallback
import numpy as np


class EarlyStoppingByImprovement(BaseCallback):
    """
    Early stopping callback based on minimum improvement threshold

    在連續 max_no_improvement_evals 次評估中，
    如果平均獎勵沒有提升超過 min_improvement_pct，就停止訓練。

    這個 callback 需要與 EvalCallback 配合使用，
    通過 callback_after_eval 參數傳入。

    Args:
        max_no_improvement_evals: 連續多少次評估沒達到改善門檻就停止
        min_improvement_pct: 最小改善百分比（例如 1.0 表示 1%）
        min_evals: 至少評估幾次才開始檢查（預設 2）
        verbose: 是否顯示詳細資訊
    """

    def __init__(
        self,
        max_no_improvement_evals: int = 3,
        min_improvement_pct: float = 1.0,
        min_evals: int = 2,
        verbose: int = 1
    ):
        super().__init__(verbose)
        self.max_no_improvement_evals = max_no_improvement_evals
        self.min_improvement_pct = min_improvement_pct
        self.min_evals = min_evals

        self.best_mean_reward = -np.inf
        self.no_improvement_count = 0
        self.eval_count = 0

    def _on_step(self) -> bool:
        """
        這個方法會在 EvalCallback 評估後被調用

        Returns:
            True: 繼續訓練
            False: 停止訓練
        """
        # 需要從 parent (EvalCallback) 獲取最新的評估結果
        # EvalCallback 會設定 self.parent.last_mean_reward
        if not hasattr(self, 'parent') or self.parent is None:
            return True

        # 獲取最新的評估獎勵
        if not hasattr(self.parent, 'last_mean_reward'):
            return True

        mean_reward = self.parent.last_mean_reward
        self.eval_count += 1

        # 至少評估 min_evals 次才開始檢查
        if self.eval_count < self.min_evals:
            self.best_mean_reward = max(self.best_mean_reward, mean_reward)
            if self.verbose > 0:
                print(f"[EarlyStop] 評估 #{self.eval_count}: {mean_reward:.2f} (預熱階段)")
            return True

        # 計算改善幅度
        if self.best_mean_reward > -np.inf and self.best_mean_reward != 0:
            improvement_pct = ((mean_reward - self.best_mean_reward) / abs(self.best_mean_reward)) * 100
        else:
            improvement_pct = np.inf if mean_reward > self.best_mean_reward else 0

        if self.verbose > 0:
            print(f"\n{'='*60}")
            print(f"[EarlyStop] 評估 #{self.eval_count}")
            print(f"  當前平均獎勵: {mean_reward:.2f}")
            print(f"  最佳平均獎勵: {self.best_mean_reward:.2f}")
            if self.best_mean_reward > -np.inf and self.best_mean_reward != 0:
                print(f"  改善幅度: {improvement_pct:+.2f}%")
            print(f"  需要改善: ≥{self.min_improvement_pct}%")
            print(f"  連續無改善: {self.no_improvement_count}/{self.max_no_improvement_evals}")

        # 檢查是否有足夠的改善
        if mean_reward > self.best_mean_reward * (1 + self.min_improvement_pct / 100):
            # 有足夠的改善
            if self.verbose > 0:
                print(f"  ✅ 達到改善門檻！重置計數器")
            self.best_mean_reward = mean_reward
            self.no_improvement_count = 0
        else:
            # 沒有足夠的改善
            # 但如果有任何改善，仍然更新 best_mean_reward
            if mean_reward > self.best_mean_reward:
                self.best_mean_reward = mean_reward
                if self.verbose > 0:
                    print(f"  ⚠️  有改善但未達 {self.min_improvement_pct}% 門檻")
            else:
                if self.verbose > 0:
                    print(f"  ⚠️  沒有改善")
            self.no_improvement_count += 1

        if self.verbose > 0:
            print(f"{'='*60}\n")

        # 檢查是否需要停止
        if self.no_improvement_count >= self.max_no_improvement_evals:
            if self.verbose > 0:
                print(f"\n{'='*60}")
                print(f"🛑 Early Stopping 觸發！")
                print(f"  連續 {self.max_no_improvement_evals} 次評估")
                print(f"  沒有提升超過 {self.min_improvement_pct}%")
                print(f"  最佳平均獎勵: {self.best_mean_reward:.2f}")
                print(f"  總訓練步數: {self.num_timesteps}")
                print(f"{'='*60}\n")
            return False

        return True
