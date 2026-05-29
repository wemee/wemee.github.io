"""產生 ml/boosting 模組 lessons 01–04 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_boosting_1to4.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/boosting/0{1,2,3,4}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/boosting"


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 從單棵樹到集成

歡迎來到 **機器學習 → 梯度提升與集成學習**。

第 sklearn 07 課你看過：單一決策樹容易過擬合，而**隨機森林**種很多棵樹投票，又穩又準。這堂課把「集成」的兩大門派講清楚——**bagging** 與 **boosting**，後者正是 XGBoost 這類神器的核心。

> 💡 本系列接續 scikit-learn 模組。建議先跑完 sklearn 第 07 課（樹模型）再來。每格按 ▶️ 執行。
"""
        ),
        md(
            """
## 學習目標

- 複習單棵樹的問題，理解為什麼要「集成」
- 分清楚 **bagging（並行投票）** 與 **boosting（逐步糾錯）**
- 親手比較單棵樹 / 隨機森林 / 梯度提升的表現
"""
        ),
        md(
            """
## 1. 三個模型，同一份資料

我們用乳癌資料集，把三種模型擺在一起比：一棵樹、一片森林（bagging）、一串提升樹（boosting）。
"""
        ),
        code(
            """
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

X, y = load_breast_cancer(return_X_y=True)

models = {
    "單棵決策樹": DecisionTreeClassifier(random_state=0),
    "隨機森林 (bagging)": RandomForestClassifier(n_estimators=200, random_state=0),
    "梯度提升 (boosting)": GradientBoostingClassifier(random_state=0),
}
for name, m in models.items():
    s = cross_val_score(m, X, y, cv=5)
    print(f"{name:<22} 準確率 {s.mean():.3f} ± {s.std():.3f}")
"""
        ),
        md(
            """
兩種集成都電爆單棵樹。但它們「集成」的方式完全相反——這是本模組的核心分野。

## 2. Bagging vs Boosting

| | Bagging（隨機森林） | Boosting（梯度提升） |
| --- | --- | --- |
| 樹怎麼長 | **並行**，各自獨立 | **序列**，一棵接一棵 |
| 每棵樹看什麼 | 隨機抽的資料子集 | 前面所有樹**還沒做好**的部分 |
| 在對付什麼 | 降低 **variance**（過擬合） | 降低 **bias**（欠擬合） |
| 比喻 | 一群專家各自投票取平均 | 一個學徒不斷修正自己的錯誤 |

- **Bagging**：種一堆「各看一部分、容易過擬合」的深樹，平均掉它們的雜訊 → 穩。
- **Boosting**：種一串「很淺、很弱」的樹，每棵專門修正前面累積的殘餘錯誤 → 準。

下一課，我們把 boosting「逐步糾錯」的機制親手拆開來看。

## 小結

- 集成 = 很多弱模型合起來變強。
- **Bagging** 並行、降 variance（隨機森林）；**Boosting** 序列、降 bias（梯度提升）。
- 兩者都遠勝單棵樹，但機制相反。

## 練習

1. 把 `GradientBoostingClassifier` 的 `n_estimators` 從預設改成 500，準確率與訓練時間怎麼變？
2. 換 `load_wine` 資料集，三種模型的排名一樣嗎？
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-ensembles.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 梯度提升的直覺：逐步糾錯

「梯度提升」聽起來嚇人，核心其實一句話：**每棵新樹，專門去擬合前面所有樹加起來還沒修好的「殘差」**。這堂課用一個一維迴歸的例子，把這個過程一輪一輪畫給你看。
"""
        ),
        md(
            """
## 學習目標

- 理解 boosting = **不斷擬合殘差**
- 親眼看到「加一棵樹、誤差就縮小一點」
- 理解 **learning rate（學習率）** 在控制什麼
"""
        ),
        md(
            """
## 1. 手動做三輪 boosting

造一條彎曲的資料。第 0 步先用「全體平均」當最爛的預測，看殘差；然後種一棵淺樹去擬合殘差，加回去；再看新的殘差……重複。
"""
        ),
        code(
            """
import numpy as np
import matplotlib.pyplot as plt
from sklearn.tree import DecisionTreeRegressor

rng = np.random.default_rng(0)
X = np.linspace(0, 10, 120).reshape(-1, 1)
y = np.sin(X).ravel() + 0.3 * X.ravel() + rng.normal(0, 0.3, 120)

pred = np.full_like(y, y.mean())   # 第 0 步：全部猜平均
lr = 0.5                            # 學習率：每棵樹只採納一半

fig, axes = plt.subplots(1, 3, figsize=(13, 4), constrained_layout=True)
for step, ax in enumerate(axes):
    residual = y - pred                              # 目前還沒修好的部分
    stump = DecisionTreeRegressor(max_depth=2).fit(X, residual)
    pred = pred + lr * stump.predict(X)              # 把新樹的修正加回去
    ax.scatter(X, y, s=12, alpha=0.4, label="data")
    ax.plot(X, pred, color="red", lw=2.2, label="prediction")
    ax.set_title(f"After {step + 1} tree(s),  MSE={np.mean((y - pred) ** 2):.3f}")
    ax.legend(fontsize=8)
fig.suptitle("Boosting = fitting residuals, step by step", fontsize=15, fontweight="bold")
plt.show()
"""
        ),
        md(
            """
看那條紅線：每加一棵淺樹，它就更貼合資料一點、MSE 就掉一點。這就是 boosting——**一群弱樹，靠接力修正，疊成一個強模型**。

## 2. learning rate 在做什麼？

上面的 `lr=0.5` 讓每棵樹只採納一半的修正。學習率小（如 0.1）→ 每步更保守、需要更多棵樹，但通常**更不容易過擬合、最終更準**。這是 boosting 最重要的旋鈕之一，下一課用 XGBoost 會再遇到。
"""
        ),
        code(
            """
from sklearn.ensemble import GradientBoostingRegressor

# sklearn 已經把上面那套流程包好了
gbr = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=2)
gbr.fit(X, y)
plt.scatter(X, y, s=12, alpha=0.4)
plt.plot(X, gbr.predict(X), color="red", lw=2.2)
plt.title("GradientBoostingRegressor (100 trees)")
plt.show()
print(f"100 棵樹的 MSE: {np.mean((y - gbr.predict(X)) ** 2):.3f}")
"""
        ),
        md(
            """
## 小結

- 梯度提升 = 每棵新樹擬合「目前的殘差」，逐步把誤差糾正掉。
- **learning rate** 控制每棵樹採納多少修正；小學習率 + 多棵樹通常更穩更準。
- `GradientBoostingRegressor` / `Classifier` 把整套流程包好了。

## 練習

1. 把手動範例的 `lr` 改成 0.1 和 1.0，比較三輪後的 MSE 與紅線的樣子。
2. 把 sklearn 版的 `learning_rate` 調到 0.01，要幾棵樹（`n_estimators`）才追得上原本的 MSE？

下一課，換上工業界最常用的利器：**XGBoost**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-gradient-boosting.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · XGBoost 上手

sklearn 的 `GradientBoosting` 概念清楚，但慢。工業界與 Kaggle 競賽真正在用的是 **XGBoost**——更快、內建正則化、會自己處理缺值。這堂課讓你跑出第一個 XGBoost 模型。
"""
        ),
        md(
            """
## 學習目標

- 用 `XGBClassifier`（sklearn 風格 API）訓練模型
- 知道 XGBoost 相較 sklearn GBDT 的三個賣點
- 認識最常調的三個參數：`n_estimators` / `learning_rate` / `max_depth`
"""
        ),
        md(
            """
## 1. 第一個 XGBoost

XGBoost 提供與 sklearn 一模一樣的 `fit` / `predict` 介面——你已經會了。
"""
        ),
        code(
            """
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = XGBClassifier(
    n_estimators=300, learning_rate=0.1, max_depth=3,
    eval_metric="logloss", random_state=42,
)
model.fit(X_train, y_train)
print(f"XGBoost 測試準確率：{model.score(X_test, y_test):.3f}")
"""
        ),
        md(
            """
## 2. XGBoost 比 sklearn GBDT 強在哪？

- **速度**：用了二階梯度資訊與工程最佳化，大資料快非常多。
- **正則化**：內建 L1/L2（`reg_alpha` / `reg_lambda`）抑制過擬合——sklearn GBDT 沒有。
- **缺值處理**：自動學習缺值該往左還是往右走，不用你補值。

## 3. 三個最常調的參數

| 參數 | 控制 | 直覺 |
| --- | --- | --- |
| `n_estimators` | 樹的數量 | 越多越強，但會過擬合 |
| `learning_rate` | 每棵樹的步幅 | 越小越穩，但要配更多樹 |
| `max_depth` | 每棵樹多深 | 越深越能抓交互作用，也越容易過擬合 |

`learning_rate` 與 `n_estimators` 是一對：學習率減半，樹大約要加倍。下一課專門處理「樹該種幾棵」這個過擬合問題。
"""
        ),
        code(
            """
import numpy as np
import matplotlib.pyplot as plt

# 看 XGBoost 認為哪些特徵重要
data = load_breast_cancer()
imp = model.feature_importances_
order = np.argsort(imp)[::-1][:8]
plt.barh(range(len(order)), imp[order][::-1], color="tab:purple")
plt.yticks(range(len(order)), np.array(data.feature_names)[order][::-1], fontsize=9)
plt.xlabel("importance"); plt.title("XGBoost feature importances")
plt.tight_layout(); plt.show()
"""
        ),
        md(
            """
## 小結

- `XGBClassifier` / `XGBRegressor` 用的是你熟悉的 sklearn 介面。
- XGBoost 三大賣點：**快、內建正則化、自動處理缺值**。
- 最常調：`n_estimators`、`learning_rate`、`max_depth`。

## 練習

1. 把 `max_depth` 從 3 改成 8，訓練準確率與測試準確率分別怎麼變？
2. 改用 `XGBRegressor` 在 `load_diabetes` 上做迴歸，看 R²。

下一課，學會用 **early stopping** 自動決定樹該種幾棵。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-xgboost.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 過擬合控制與 early stopping

樹種太少會欠擬合、太多會過擬合。手動試很煩——**early stopping** 讓 XGBoost 自己盯著驗證集，一旦不再進步就停。這堂課也順道認識幾個關鍵的正則化旋鈕。
"""
        ),
        md(
            """
## 學習目標

- 用驗證集畫出「訓練 vs 驗證」的學習曲線，看見過擬合
- 用 `early_stopping_rounds` 自動挑最佳樹數
- 認識 `subsample` / `colsample_bytree` / `reg_lambda` 等抑制過擬合的參數
"""
        ),
        md(
            """
## 1. 先把資料切成三份

調參時要用**驗證集**，測試集留到最後。
"""
        ),
        code(
            """
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

X, y = load_breast_cancer(return_X_y=True)
X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=0.25, random_state=42, stratify=y_tmp)
print("train/val/test:", X_train.shape[0], X_val.shape[0], X_test.shape[0])
"""
        ),
        md(
            """
## 2. Early stopping：讓模型自己喊停

設一個很大的 `n_estimators`，再給 `early_stopping_rounds`——連續這麼多輪驗證分數沒進步，就停在最佳點。
"""
        ),
        code(
            """
model = XGBClassifier(
    n_estimators=1000, learning_rate=0.1, max_depth=3,
    eval_metric="logloss", early_stopping_rounds=20, random_state=42,
)
model.fit(X_train, y_train, eval_set=[(X_train, y_train), (X_val, y_val)], verbose=False)
print(f"設定上限 1000 棵，實際最佳停在第 {model.best_iteration} 棵")
print(f"測試準確率：{model.score(X_test, y_test):.3f}")
"""
        ),
        code(
            """
import matplotlib.pyplot as plt

# 畫出訓練 vs 驗證的 logloss 曲線
results = model.evals_result()
plt.plot(results["validation_0"]["logloss"], label="train")
plt.plot(results["validation_1"]["logloss"], label="validation")
plt.axvline(model.best_iteration, color="gray", ls="--", label="best iteration")
plt.xlabel("number of trees"); plt.ylabel("logloss"); plt.legend()
plt.title("Train keeps dropping, validation bottoms out → overfitting")
plt.show()
"""
        ),
        md(
            """
經典的過擬合長相：訓練 logloss 一路向下，驗證 logloss 觸底後反彈。early stopping 幫你停在驗證的谷底。

## 3. 其他正則化旋鈕

| 參數 | 做什麼 |
| --- | --- |
| `subsample` | 每棵樹只用部分資料（如 0.8）→ 增加隨機性、抗過擬合 |
| `colsample_bytree` | 每棵樹只用部分特徵 |
| `reg_lambda` / `reg_alpha` | L2 / L1 正則化，懲罰過大的葉子權重 |
| `min_child_weight` | 葉子最少要有多少樣本，越大越保守 |

## 小結

- 切出**驗證集**，用學習曲線就能看見過擬合。
- `early_stopping_rounds` + `eval_set` 自動挑最佳樹數，`best_iteration` 拿得到。
- `subsample` / `colsample_bytree` / `reg_lambda` 等是抑制過擬合的常用旋鈕。

## 練習

1. 把 `learning_rate` 調到 0.01，`best_iteration` 會變大還是變小？為什麼？
2. 加上 `subsample=0.7, colsample_bytree=0.7`，驗證曲線的谷底有變嗎？

下一課，系統性地**調參**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-overfitting.ipynb")


if __name__ == "__main__":
    print("產生 boosting lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
