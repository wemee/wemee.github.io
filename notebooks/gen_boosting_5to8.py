"""產生 ml/boosting 模組 lessons 05–08 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_boosting_5to8.py
執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/boosting/0{5,6,7,8}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/boosting"


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 超參數調校

XGBoost 有一大把旋鈕，手動試到死也試不完。這堂課用 **隨機搜尋（RandomizedSearchCV）** 系統性地找好設定，並認識更聰明的 **Optuna** 是什麼。
"""
        ),
        md(
            """
## 學習目標

- 知道 boosting 該優先調哪些參數
- 用 `RandomizedSearchCV` 在參數空間裡有效率地搜尋
- 知道 grid / random / 貝氏（Optuna）搜尋的差別
"""
        ),
        md(
            """
## 1. 該調哪些參數？（優先序）

1. `learning_rate` + `n_estimators`（一對，配 early stopping）
2. `max_depth`、`min_child_weight`（樹的複雜度）
3. `subsample`、`colsample_bytree`（隨機性）
4. `reg_lambda`、`reg_alpha`（正則化）

## 2. 隨機搜尋

參數組合是天文數字，grid search 全試不切實際。**隨機搜尋**在範圍內隨機抽 N 組來試，用同樣預算通常找到更好的解。
"""
        ),
        code(
            """
import numpy as np
from scipy.stats import randint, uniform
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import RandomizedSearchCV
from xgboost import XGBClassifier

X, y = load_breast_cancer(return_X_y=True)

param_dist = {
    "n_estimators": randint(100, 600),
    "max_depth": randint(2, 7),
    "learning_rate": uniform(0.01, 0.3),
    "subsample": uniform(0.6, 0.4),
    "colsample_bytree": uniform(0.6, 0.4),
}
search = RandomizedSearchCV(
    XGBClassifier(eval_metric="logloss", random_state=42),
    param_dist, n_iter=25, cv=5, scoring="roc_auc", random_state=42, n_jobs=-1,
)
search.fit(X, y)
print("最佳 AUC:", round(search.best_score_, 4))
print("最佳參數:")
for k, v in search.best_params_.items():
    print(f"  {k}: {round(v, 3) if isinstance(v, float) else v}")
"""
        ),
        md(
            """
## 3. 更聰明的搜尋：Optuna

random search 是亂槍打鳥；**貝氏最佳化**（如 `optuna` 套件）會根據已試過的結果，**聰明地**決定下一組要試什麼，用更少次數找到更好的解。Kaggle 高手幾乎都用 Optuna。本課不展開（需另裝套件），但你該知道它存在——在 Colab 裡 `pip install optuna` 即可玩。

## 小結

- 調參優先序：學習率/樹數 → 樹複雜度 → 隨機性 → 正則化。
- `RandomizedSearchCV` 比 grid search 更划算。
- 進階用 **Optuna**（貝氏最佳化），用更少嘗試找到更好的參數。

## 練習

1. 把 `n_iter` 從 25 加到 60，最佳 AUC 有提升嗎？代價是什麼？
2. 在 Colab 裝 `optuna`，用它調同一個 XGBoost，比較找到的 AUC。

下一課，認識另外兩個 boosting 庫：**LightGBM 與 CatBoost**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-tuning.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · LightGBM 與 CatBoost

XGBoost 不是唯一的 boosting 庫。**LightGBM**（微軟）以速度著稱，**CatBoost**（Yandex）擅長類別特徵。這堂課比較它們，讓你知道何時該用哪個。
"""
        ),
        md(
            """
## 學習目標

- 用 `LGBMClassifier` 訓練，體會它的速度
- 理解 LightGBM 的 leaf-wise 生長與 XGBoost 的差異
- 知道 CatBoost 的定位（雖然本課不安裝）
"""
        ),
        md(
            """
## 1. 速度對決：XGBoost vs LightGBM

造一份比較大的資料，比較兩者的訓練時間與準確率。
"""
        ),
        code(
            """
import time
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

X, y = make_classification(n_samples=40000, n_features=50, n_informative=15, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

def bench(model, name):
    t = time.perf_counter()
    model.fit(X_train, y_train)
    dt = time.perf_counter() - t
    print(f"{name:<12} 訓練 {dt:5.2f}s   測試準確率 {model.score(X_test, y_test):.3f}")

bench(XGBClassifier(n_estimators=300, max_depth=6, eval_metric="logloss", random_state=42), "XGBoost")
bench(LGBMClassifier(n_estimators=300, max_depth=6, verbose=-1, random_state=42), "LightGBM")
"""
        ),
        md(
            """
LightGBM 通常明顯更快，準確率相近——資料越大差距越明顯。

## 2. 差在哪？level-wise vs leaf-wise

- **XGBoost（level-wise）**：一層一層長，整棵樹平衡。
- **LightGBM（leaf-wise）**：每次挑「最能降低 loss 的那片葉子」往下長，樹會比較不平衡但成長更有效率 → 更快、常更準，但小資料較容易過擬合（用 `num_leaves`、`min_child_samples` 控制）。

## 3. CatBoost 的定位

CatBoost（本課不裝，Colab 可 `pip install catboost`）的招牌是**原生處理類別特徵**——你不用自己做 One-Hot，丟字串欄位進去就行，還用「ordered boosting」減少過擬合。**資料有很多類別欄位時，CatBoost 常是首選。**

## 選用速查

| 情境 | 建議 |
| --- | --- |
| 通用、生態最成熟 | XGBoost |
| 資料大、要快 | LightGBM |
| 很多類別特徵 | CatBoost |

## 小結

- 三大 boosting 庫 API 都跟 sklearn 一致，可互換試。
- LightGBM 用 **leaf-wise** 生長，通常更快。
- CatBoost 原生吃類別特徵，省去 One-Hot。

## 練習

1. 把資料量加到 `n_samples=200000`，XGBoost 與 LightGBM 的時間差距變多大？
2. 調 LightGBM 的 `num_leaves`（如 15 vs 255），對小資料的過擬合有何影響？

下一課，學會用 **SHAP** 真正解釋模型的每一個預測。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-lightgbm.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · SHAP：解釋每一個預測

`feature_importances_` 只告訴你「整體哪些特徵重要」，但說不出**方向**，也無法解釋**單一一筆預測**為什麼是這個結果。**SHAP** 補上這塊——它是目前模型解釋的黃金標準。
"""
        ),
        md(
            """
## 學習目標

- 知道內建特徵重要性的侷限
- 用 `shap.TreeExplainer` 算出 SHAP values
- 讀 **beeswarm 摘要圖**（全域）與**單筆解釋**（局部）
"""
        ),
        md(
            """
## 1. 先訓練一個模型

用乳癌資料訓練 XGBoost，等下來解釋它。
"""
        ),
        code(
            """
import shap
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

data = load_breast_cancer()
X_train, X_test, y_train, y_test = train_test_split(
    data.data, data.target, test_size=0.2, random_state=42, stratify=data.target
)
model = XGBClassifier(n_estimators=200, max_depth=3, eval_metric="logloss", random_state=42)
model.fit(X_train, y_train)

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
print("SHAP values 形狀:", shap_values.shape, "(每筆樣本、每個特徵都有一個貢獻值)")
"""
        ),
        md(
            """
## 2. 全域：beeswarm 摘要圖

每個點是「一筆樣本的一個特徵」。橫軸是 SHAP 值（把預測往哪推、推多少），顏色是特徵值高低。一眼看出**哪些特徵重要、高值是把預測往哪推**。
"""
        ),
        code(
            """
shap.summary_plot(shap_values, X_test, feature_names=data.feature_names, show=True)
"""
        ),
        md(
            """
比起長條圖，beeswarm 多了**方向**資訊：例如某特徵「值越大（紅）越把預測推向惡性」這種洞察，內建 importance 給不了。

## 3. 局部：解釋單一一筆預測

SHAP 能把**一筆**預測拆解成「從基準值出發，每個特徵各推了多少」。這在要對單一個案交代理由時（為什麼這位病人被判為高風險）極有價值。
"""
        ),
        code(
            """
import numpy as np

i = 0  # 解釋測試集第一筆
contrib = shap_values[i]
order = np.argsort(np.abs(contrib))[::-1][:6]
print(f"第 {i} 筆預測機率: {model.predict_proba(X_test[i:i+1])[0, 1]:.3f}")
print("貢獻最大的 6 個特徵（正值推向良性、負值推向惡性）:")
for j in order:
    print(f"  {data.feature_names[j]:<28} SHAP={contrib[j]:+.3f}  (值={X_test[i, j]:.1f})")
"""
        ),
        md(
            """
## 小結

- 內建 importance 只有全域、沒方向、不能解釋單筆。
- **SHAP** 給每筆樣本、每個特徵一個貢獻值，可加總回預測。
- **beeswarm** 看全域與方向；**單筆 SHAP** 解釋個別預測。

## 練習

1. 換成 `LGBMClassifier`，SHAP 摘要圖的重要特徵排序一樣嗎？
2. 挑一筆模型預測錯的樣本，用單筆 SHAP 看它被哪些特徵帶偏。

最後一課，把整個模組串成一個 **Kaggle 風格的完整專案**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-shap.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 實戰：Kaggle 風格完整專案

把前七課全部串起來，走一遍表格資料競賽的標準流程：資料 → 切分 → XGBoost + early stopping → 調參 → 測試集驗收 → SHAP 解讀。這是 boosting 模組的收尾。
"""
        ),
        md(
            """
## 學習目標

- 串起 boosting 的完整工作流程
- 用驗證集 + early stopping + 隨機搜尋產出一個調好的模型
- 在測試集誠實驗收，並用 SHAP 交出洞察
"""
        ),
        md(
            """
## 1. 資料與切分

用一份合成的表格資料（模擬真實競賽：有資訊特徵、也有雜訊特徵）。先把測試集鎖起來。
"""
        ),
        code(
            """
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(
    n_samples=8000, n_features=30, n_informative=12, n_redundant=6,
    weights=[0.7, 0.3], random_state=7,
)
feat_names = [f"f{i}" for i in range(X.shape[1])]

X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.2, random_state=7, stratify=y)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=0.2, random_state=7, stratify=y_tmp)
print("train/val/test:", X_train.shape[0], X_val.shape[0], X_test.shape[0])
"""
        ),
        md(
            """
## 2. 調參（隨機搜尋）
"""
        ),
        code(
            """
from scipy.stats import randint, uniform
from sklearn.model_selection import RandomizedSearchCV
from xgboost import XGBClassifier

param_dist = {
    "n_estimators": randint(200, 500),
    "max_depth": randint(3, 7),
    "learning_rate": uniform(0.02, 0.2),
    "subsample": uniform(0.7, 0.3),
    "colsample_bytree": uniform(0.7, 0.3),
}
search = RandomizedSearchCV(
    XGBClassifier(eval_metric="logloss", random_state=7),
    param_dist, n_iter=20, cv=4, scoring="roc_auc", random_state=7, n_jobs=-1,
)
search.fit(X_train, y_train)
print("CV 最佳 AUC:", round(search.best_score_, 4))
"""
        ),
        md(
            """
## 3. 用最佳參數 + early stopping 重訓，並驗收
"""
        ),
        code(
            """
from sklearn.metrics import classification_report, roc_auc_score

best = XGBClassifier(
    **search.best_params_, eval_metric="logloss",
    early_stopping_rounds=30, random_state=7,
)
best.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
print(f"最佳樹數（early stopping）：{best.best_iteration}\\n")

y_pred = best.predict(X_test)
y_proba = best.predict_proba(X_test)[:, 1]
print(classification_report(y_test, y_pred))
print(f"測試集 AUC: {roc_auc_score(y_test, y_proba):.4f}")
"""
        ),
        md(
            """
## 4. 用 SHAP 交出洞察
"""
        ),
        code(
            """
import shap

explainer = shap.TreeExplainer(best)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test, feature_names=feat_names, show=True)
"""
        ),
        md(
            """
## 小結：表格資料的致勝流程

1. **切 train/val/test** —— 測試集鎖到最後
2. **隨機搜尋（或 Optuna）** 找好參數
3. **最佳參數 + early stopping** 重訓，`best_iteration` 拿最佳樹數
4. **測試集驗收** —— classification report + AUC
5. **SHAP** 交出可解釋的洞察

梯度提升是表格資料競賽的王者——你現在有完整的骨架了。

## 練習（綜合）

1. 把模型換成 `LGBMClassifier`，整條流程能否照跑？AUC 差多少？
2. 用 SHAP 找出最沒用的幾個特徵，移除它們重訓，AUC 會掉嗎？
3. 挑戰：把這套流程套到一個真實的 Kaggle 表格資料集。

下一個模組，我們離開樹模型，跳進**深度學習**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-kaggle.ipynb")


if __name__ == "__main__":
    print("產生 boosting lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
