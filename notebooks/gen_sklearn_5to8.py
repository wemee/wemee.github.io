"""產生 scikit-learn 模組 lessons 05–08 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_sklearn_5to8.py
產出後執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/scikit-learn/0{5,6,7,8}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/scikit-learn"


# ───────────────────────────── Lesson 05 ─────────────────────────────
def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 模型評估：別只看準確率

「準確率 95%」聽起來很棒，但若 100 個病人裡只有 5 個生病，模型**全猜沒病**也有 95%。準確率會騙人。這一課學會用**交叉驗證**估得更穩，用**混淆矩陣、precision / recall、ROC** 看清模型真正的能力。
"""
        ),
        md(
            """
## 學習目標

- 用 **交叉驗證（cross-validation）** 得到更可靠的分數
- 讀懂 **混淆矩陣**
- 理解 **precision（精確率）/ recall（召回率）/ F1**
- 畫 **ROC 曲線** 並算 **AUC**
"""
        ),
        md(
            """
## 1. 交叉驗證：一次切分不夠看

只切一次訓練/測試，分數會受「剛好切到哪些資料」影響。**K-fold 交叉驗證**把資料切成 K 份，輪流拿其中 1 份當測試、其餘訓練，跑 K 次取平均——分數更穩、還附帶一個波動範圍。
"""
        ),
        code(
            """
from sklearn.datasets import load_breast_cancer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

data = load_breast_cancer()
X, y = data.data, data.target   # 二元分類：0=惡性, 1=良性

model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000))
scores = cross_val_score(model, X, y, cv=5)   # 5 折

print("5 折各自的準確率:", scores.round(3))
print(f"平均 {scores.mean():.3f} ± {scores.std():.3f}")
"""
        ),
        md(
            """
## 2. 混淆矩陣：對在哪、錯在哪

準確率只給一個數字，**混淆矩陣**告訴你錯誤的型態：把真實 vs 預測的每種組合數出來。對醫療、詐欺這類問題，「把生病的誤判成健康」遠比反過來嚴重——混淆矩陣才看得到這件事。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import ConfusionMatrixDisplay

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)
model.fit(X_train, y_train)

ConfusionMatrixDisplay.from_estimator(
    model, X_test, y_test, display_labels=data.target_names, cmap="Blues"
)
plt.title("Confusion matrix")
plt.show()
"""
        ),
        md(
            """
## 3. Precision / Recall / F1

從混淆矩陣可以算出三個關鍵指標（針對「陽性」類別）：

- **Precision（精確率）**：模型說陽性的，有幾成真的是陽性？（不要亂喊狼）
- **Recall（召回率）**：真正的陽性，被抓出幾成？（不要漏掉病人）
- **F1**：precision 與 recall 的調和平均，兩者的平衡。

`classification_report` 一次全給你。
"""
        ),
        code(
            """
from sklearn.metrics import classification_report

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred, target_names=data.target_names))
"""
        ),
        md(
            """
## 4. ROC 曲線與 AUC

分類器內部其實是輸出「陽性機率」，再用 0.5 當門檻判定。**ROC 曲線**把門檻從 0 掃到 1，畫出每個門檻下的表現；曲線下面積 **AUC** 越接近 1 越好（0.5 等於亂猜）。它不受門檻選擇影響，是比較模型的好工具。
"""
        ),
        code(
            """
from sklearn.metrics import RocCurveDisplay, roc_auc_score

RocCurveDisplay.from_estimator(model, X_test, y_test)
plt.plot([0, 1], [0, 1], "k--", alpha=0.4)   # 亂猜的對角線
plt.title("ROC curve")
plt.show()

y_proba = model.predict_proba(X_test)[:, 1]
print(f"AUC: {roc_auc_score(y_test, y_proba):.3f}")
"""
        ),
        md(
            """
## 小結

- **交叉驗證**比單次切分更可靠，還給你分數的波動範圍。
- **混淆矩陣**揭露錯誤的型態，不只一個總分。
- **Precision** 看「喊得準不準」、**Recall** 看「抓得全不全」、**F1** 取平衡。
- **ROC / AUC** 跨所有門檻評估，不受 0.5 預設影響。

## 練習

1. 把模型換成 `RandomForestClassifier`，比較它和邏輯迴歸的 AUC。
2. 把分類門檻從 0.5 改成 0.3（用 `y_proba >= 0.3`），recall 和 precision 怎麼變？想想醫療場景該調高還調低。

下一課進入**非監督式學習**：沒有答案，照樣能分群、降維。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-evaluation.ipynb")


# ───────────────────────────── Lesson 06 ─────────────────────────────
def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 非監督式學習：分群與降維

前面都有「答案 `y`」可學。但真實世界常常**沒有標籤**——只有一堆資料，要自己找出結構。這一課用 **KMeans** 自動分群、用 **PCA** 把高維資料壓到 2D 看清楚。
"""
        ),
        md(
            """
## 學習目標

- 用 `KMeans` 把沒有標籤的資料自動分群
- 用「手肘法」挑選分群數 K
- 用 `PCA` 降維，把高維資料視覺化在平面上
- 理解 `explained_variance_ratio_`（每個主成分保留多少資訊）
"""
        ),
        md(
            """
## 1. KMeans 分群

KMeans 的目標：把資料分成 K 群，讓每筆資料都靠近自己那群的中心。注意——我們**完全不給它 `y`**，它純粹從特徵的分布找結構。
"""
        ),
        code(
            """
import numpy as np
from sklearn.datasets import load_iris
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

iris = load_iris()
X = StandardScaler().fit_transform(iris.data)   # 分群前先標準化
y_true = iris.target                            # 只拿來最後對照，不參與訓練

km = KMeans(n_clusters=3, random_state=42, n_init=10)
labels = km.fit_predict(X)     # 沒有 y！直接給分群標籤

print("分群結果（前 20 筆）:", labels[:20])
print("真實品種（前 20 筆）:", y_true[:20])
"""
        ),
        md(
            """
> 分群標籤的「編號」是任意的（群 0 不一定對應品種 0），重點是**哪些資料被分到同一群**。
"""
        ),
        md(
            """
## 2. 該分幾群？手肘法

真實情境你不知道 K 該設多少。**手肘法**：對不同 K 畫出「群內離散程度（inertia）」，曲線從陡降轉平緩的「手肘」處，通常就是好的 K。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt

ks = range(1, 9)
inertias = [KMeans(n_clusters=k, random_state=42, n_init=10).fit(X).inertia_ for k in ks]

plt.plot(list(ks), inertias, marker="o")
plt.xlabel("number of clusters (K)")
plt.ylabel("inertia")
plt.title("Elbow method")
plt.show()
"""
        ),
        md(
            """
## 3. PCA：把 4 維壓到 2 維

鳶尾花有 4 個特徵，畫不出來。**PCA（主成分分析）** 找出資料變異最大的幾個方向，用它們當新座標軸——我們取前 2 個主成分，就能把 4 維資料投影到平面上，而且盡量保留原本的結構。
"""
        ),
        code(
            """
from sklearn.decomposition import PCA

pca = PCA(n_components=2)
X_2d = pca.fit_transform(X)

ratio = pca.explained_variance_ratio_
print(f"前 2 個主成分保留的資訊比例: {ratio.round(3)}  (合計 {ratio.sum():.1%})")

fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), constrained_layout=True)
axes[0].scatter(X_2d[:, 0], X_2d[:, 1], c=labels, cmap="viridis", s=30)
axes[0].set_title("KMeans clusters")
axes[1].scatter(X_2d[:, 0], X_2d[:, 1], c=y_true, cmap="viridis", s=30)
axes[1].set_title("True species")
for ax in axes:
    ax.set_xlabel("PC1"); ax.set_ylabel("PC2")
fig.suptitle("PCA projection (4D → 2D)", fontsize=15, fontweight="bold")
plt.show()
"""
        ),
        md(
            """
兩張圖長得很像——代表 KMeans 在**完全沒看答案**的情況下，分出來的群幾乎就對應到真實品種。這就是非監督式學習的魅力：從資料本身浮現結構。

> 前 2 個主成分就保留了約 96% 的資訊，所以這張 2D 投影很有代表性。
"""
        ),
        md(
            """
## 小結

- 非監督式學習不需要標籤 `y`，從特徵分布找結構。
- `KMeans` 自動分群；**手肘法**幫你挑分群數 K。
- `PCA` 降維，把高維資料壓到能視覺化的 2D，`explained_variance_ratio_` 告訴你保留多少資訊。
- 分群標籤的編號是任意的，看的是「分組」而非「對應到哪個答案」。

## 練習

1. 把 KMeans 的 `n_clusters` 改成 2 或 4，PCA 圖上的分群怎麼變？
2. PCA 改成 `n_components=3`，印出三個主成分各自的 `explained_variance_ratio_`。

下一課回到監督式，認識威力強大又好解讀的**樹模型**，並看模型告訴你「哪些特徵最重要」。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-unsupervised.ipynb")


# ───────────────────────────── Lesson 07 ─────────────────────────────
def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 樹模型與特徵重要性

決策樹用一連串「是非題」做判斷，**人看得懂、還會告訴你哪些特徵最重要**。把很多棵樹合起來投票，就是橫掃各種表格資料競賽的**隨機森林**。這一課把這條線走完。
"""
        ),
        md(
            """
## 學習目標

- 訓練 `DecisionTreeClassifier` 並把樹**畫出來**
- 觀察 `max_depth` 如何造成**過擬合**
- 用 `RandomForestClassifier` 提升表現
- 讀 `feature_importances_`，知道模型最看重哪些特徵
"""
        ),
        md(
            """
## 1. 決策樹：一連串是非題

決策樹就是不斷問「某個特徵 > 某個值嗎？」把資料一分為二，直到每個葉子夠純。最棒的是它能**直接畫出來**，每個判斷都看得懂。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree

wine = load_wine()
X, y = wine.data, wine.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

tree = DecisionTreeClassifier(max_depth=2, random_state=42).fit(X_train, y_train)

fig, ax = plt.subplots(figsize=(12, 5))
plot_tree(tree, feature_names=wine.feature_names, class_names=wine.target_names,
          filled=True, rounded=True, fontsize=9, ax=ax)
ax.set_title("Decision tree (max_depth=2)")
plt.show()
print(f"測試準確率: {tree.score(X_test, y_test):.1%}")
"""
        ),
        md(
            """
順著樹從上往下讀：每個節點是一個是非題，往左或往右，最後落到某個葉子，那就是預測的類別。完全透明——這在需要**解釋決策**的場景（醫療、金融）非常重要。
"""
        ),
        md(
            """
## 2. max_depth 與過擬合

樹可以一直長到把訓練資料背得滾瓜爛熟（訓練準確率 100%），但那通常是在**背雜訊**，對新資料反而變差——這就是**過擬合**。我們掃不同深度，同時看訓練和測試準確率。
"""
        ),
        code(
            """
depths = range(1, 12)
train_acc, test_acc = [], []
for d in depths:
    t = DecisionTreeClassifier(max_depth=d, random_state=42).fit(X_train, y_train)
    train_acc.append(t.score(X_train, y_train))
    test_acc.append(t.score(X_test, y_test))

plt.plot(list(depths), train_acc, marker="o", label="train")
plt.plot(list(depths), test_acc, marker="s", label="test")
plt.xlabel("max_depth"); plt.ylabel("accuracy"); plt.legend()
plt.title("Deeper tree → overfitting")
plt.show()
"""
        ),
        md(
            """
看到了嗎：訓練準確率隨深度一路衝到 100%，但測試準確率到某個深度就停滯甚至下滑——兩條線拉開的縫隙，就是過擬合的程度。
"""
        ),
        md(
            """
## 3. 隨機森林：三個臭皮匠

單一棵樹容易過擬合、也不穩。**隨機森林**種很多棵「看資料不同子集、用特徵不同子集」的樹，最後投票——大幅降低過擬合，表現通常一棒打趴單棵樹，是表格資料的常勝軍。
"""
        ),
        code(
            """
from sklearn.ensemble import RandomForestClassifier

forest = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_train, y_train)
print(f"單棵樹（深度不限）測試準確率: "
      f"{DecisionTreeClassifier(random_state=42).fit(X_train, y_train).score(X_test, y_test):.1%}")
print(f"隨機森林（200 棵）測試準確率: {forest.score(X_test, y_test):.1%}")
"""
        ),
        md(
            """
## 4. 特徵重要性：模型最看重什麼？

樹模型會記錄每個特徵對「把資料分乾淨」貢獻了多少，加總就是 `feature_importances_`。這是它的一大賣點——不只給預測，還告訴你**為什麼**。
"""
        ),
        code(
            """
import numpy as np

importances = forest.feature_importances_
order = np.argsort(importances)[::-1]   # 由大到小

plt.figure(figsize=(9, 5))
plt.bar(range(len(importances)), importances[order])
plt.xticks(range(len(importances)),
           np.array(wine.feature_names)[order], rotation=60, ha="right")
plt.ylabel("importance"); plt.title("Feature importances (Random Forest)")
plt.tight_layout()
plt.show()

print("最重要的 3 個特徵:")
for i in order[:3]:
    print(f"  {wine.feature_names[i]:<28} {importances[i]:.3f}")
"""
        ),
        md(
            """
## 小結

- 決策樹用是非題分類，**可以畫出來、人看得懂**。
- `max_depth` 太大會**過擬合**：訓練分數高、測試分數差。
- **隨機森林**集合多棵樹投票，更穩更準，是表格資料的首選。
- `feature_importances_` 告訴你模型最看重哪些特徵。

## 練習

1. 調 `n_estimators`（50 / 200 / 500），準確率與訓練時間怎麼變？
2. 把森林的特徵重要性和**單棵深樹**的比較，排序一樣嗎？

最後一課，我們把前七課的所有招式串成一條**完整的實戰流程**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-trees.ipynb")


# ───────────────────────────── Lesson 08 ─────────────────────────────
def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 完整流程實戰

前七課的招式，這一課全部串起來，走一遍**真實的機器學習流程**：理解資料 → 切分 → 用 Pipeline 前處理 → 交叉驗證 → **GridSearch 調參** → 在測試集驗收 → 解讀結果。這就是你拿到一份新資料時該有的工作節奏。
"""
        ),
        md(
            """
## 學習目標

- 串起完整流程：資料 → Pipeline → 調參 → 評估
- 用 `GridSearchCV` 自動尋找最佳超參數
- 在被藏起來的測試集上做**最終、誠實的**驗收
- 解讀混淆矩陣與特徵重要性，產出結論
"""
        ),
        md(
            """
## 1. 認識資料

用乳癌診斷資料集：569 筆腫瘤切片，每筆 30 個數值特徵，要判斷**惡性 / 良性**。這是個典型的二元分類醫療問題。
"""
        ),
        code(
            """
import numpy as np
import pandas as pd
from sklearn.datasets import load_breast_cancer

data = load_breast_cancer()
df = pd.DataFrame(data.data, columns=data.feature_names)
df["target"] = data.target

print("資料形狀:", df.shape)
print("\\n類別分布（0=惡性, 1=良性）:")
print(df["target"].value_counts())
df.head()
"""
        ),
        md(
            """
## 2. 切分：先把測試集藏起來

第一步永遠是把測試集鎖進保險箱——接下來所有調參、驗證都只能用訓練集，測試集到最後一刻才開封。
"""
        ),
        code(
            """
from sklearn.model_selection import train_test_split

X = data.data
y = data.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print("訓練集:", X_train.shape, "  測試集:", X_test.shape)
"""
        ),
        md(
            """
## 3. 組裝 Pipeline + GridSearch 調參

把「標準化 + 隨機森林」組成 Pipeline，再用 `GridSearchCV` 在訓練集上做交叉驗證、自動試各種超參數組合，挑出最好的。**整個調參過程完全不碰測試集**。
"""
        ),
        code(
            """
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", RandomForestClassifier(random_state=42)),
])

# 要搜尋的超參數網格（語法：步驟名__參數名）
param_grid = {
    "clf__n_estimators": [100, 300],
    "clf__max_depth": [None, 5, 10],
}

grid = GridSearchCV(pipe, param_grid, cv=5, scoring="roc_auc", n_jobs=-1)
grid.fit(X_train, y_train)

print("最佳參數:", grid.best_params_)
print(f"交叉驗證最佳 AUC: {grid.best_score_:.3f}")
"""
        ),
        md(
            """
## 4. 最終驗收：開封測試集

調參全部結束，現在才第一次、也是唯一一次用測試集。`grid` 會自動用最佳參數的模型來預測。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, ConfusionMatrixDisplay, roc_auc_score

best = grid.best_estimator_
y_pred = best.predict(X_test)
y_proba = best.predict_proba(X_test)[:, 1]

print(classification_report(y_test, y_pred, target_names=data.target_names))
print(f"測試集 AUC: {roc_auc_score(y_test, y_proba):.3f}\\n")

ConfusionMatrixDisplay.from_estimator(
    best, X_test, y_test, display_labels=data.target_names, cmap="Blues"
)
plt.title("Final confusion matrix (test set)")
plt.show()
"""
        ),
        md(
            """
> 在醫療場景，左下角那格——**把惡性誤判成良性**——是最危險的錯誤。看報告時 recall（惡性類別）要特別留意。
"""
        ),
        md(
            """
## 5. 解讀：哪些特徵在說話？

模型不是黑盒。掏出特徵重要性，看它根據什麼下判斷——這往往是交付成果時最有價值的洞察。
"""
        ),
        code(
            """
importances = best.named_steps["clf"].feature_importances_
order = np.argsort(importances)[::-1][:10]   # 取前 10 名

plt.figure(figsize=(9, 5))
plt.barh(range(len(order)), importances[order][::-1])
plt.yticks(range(len(order)), np.array(data.feature_names)[order][::-1], fontsize=9)
plt.xlabel("importance"); plt.title("Top 10 features")
plt.tight_layout()
plt.show()
"""
        ),
        md(
            """
## 小結：機器學習的標準工作流程

恭喜你走完整個 scikit-learn 模組！把這條流程刻進肌肉記憶：

1. **理解資料** —— 形狀、類別分布、有沒有缺值
2. **切分** —— 測試集先藏好，絕不偷看
3. **Pipeline** —— 前處理 + 模型綁成一體，自動防資料洩漏
4. **交叉驗證 + 調參** —— 只在訓練集上用 `GridSearchCV` 找最佳設定
5. **最終驗收** —— 測試集只開封一次，看混淆矩陣 / report / AUC
6. **解讀** —— 用特徵重要性等工具產出洞察，而非只丟一個分數

## 練習（綜合）

1. 把 `RandomForestClassifier` 換成 `LogisticRegression`（記得 `max_iter` 調大），整條流程不動就能比較兩個模型。
2. 在 `param_grid` 多加一個超參數（如 `clf__min_samples_leaf`），看最佳組合與 AUC 有沒有提升。
3. 挑戰：用你自己的 CSV 資料，套用同一條六步流程。

這就是資料科學家每天在做的事——你已經有完整的骨架了。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-end-to-end.ipynb")


if __name__ == "__main__":
    print("產生 sklearn lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
