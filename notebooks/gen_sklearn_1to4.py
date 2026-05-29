"""產生 scikit-learn 模組 lessons 01–04 的 notebook。

用法：
    notebooks/.venv/bin/python notebooks/gen_sklearn_1to4.py
產出後執行嵌出輸出：
    notebooks/.venv/bin/jupyter nbconvert --to notebook --execute --inplace \\
        notebooks/ml/scikit-learn/0{1,2,3,4}-*.ipynb
"""

from _nbgen import build_notebook, code, md

DIR = "ml/scikit-learn"


# ───────────────────────────── Lesson 01 ─────────────────────────────
def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · scikit-learn 的世界觀

歡迎來到 **程式實驗室 → 機器學習 → scikit-learn**。

scikit-learn（簡稱 sklearn）是 Python 機器學習的標準工具箱。它最聰明的地方在於：**幾十種模型，全都長一個樣子**。只要學會一套 `fit` / `predict` / `transform` 的節奏，你換任何模型都不用重學。

這堂課不急著教演算法，先把這個**統一的世界觀**建立起來——之後每一課都是在這個骨架上長出來的。

> 💡 這是一個可執行的 notebook。每個程式碼格子按 ▶️（或 `Shift+Enter`）就會跑。放心改參數、亂玩——你改的是自己的副本，不會動到原檔。
"""
        ),
        md(
            """
## 學習目標

- 理解 sklearn 統一的 **estimator API**：`fit` / `predict` / `transform`
- 分清楚 **監督式** 與 **非監督式** 學習
- 用內建的鳶尾花資料集，跑出你的第一個分類器
- 知道為什麼要把資料切成 **訓練集 / 測試集**
"""
        ),
        md(
            """
## 1. 一個節奏走天下：fit / predict / transform

sklearn 裡每個模型都是一個 **estimator（估計器）** 物件，操作只有三個動詞：

| 方法 | 中文 | 做什麼 |
| --- | --- | --- |
| `model.fit(X, y)` | 訓練 | 給它特徵 `X` 和答案 `y`，讓它從資料中學 |
| `model.predict(X)` | 預測 | 對新的特徵 `X` 給出預測 |
| `model.transform(X)` | 轉換 | 把資料變形（前處理器才有，如標準化） |

換模型時，只有 `model = ...` 那一行要改，`fit` / `predict` 完全不動。這就是 sklearn 的威力——**API 一致，知識可遷移**。
"""
        ),
        md(
            """
## 2. 先認識資料：鳶尾花（iris）

我們用最經典的入門資料集：**鳶尾花**。150 朵花，每朵量了 4 個特徵（花萼/花瓣的長寬），目標是分辨它屬於 3 個品種中的哪一種。
"""
        ),
        code(
            """
from sklearn.datasets import load_iris

iris = load_iris()
X = iris.data        # 特徵：150 列 × 4 欄
y = iris.target      # 答案：每朵花的品種編號 0/1/2

print("特徵形狀 X:", X.shape)
print("特徵名稱:", iris.feature_names)
print("品種名稱:", iris.target_names)
print("\\n前 3 朵花的特徵:\\n", X[:3])
print("前 3 朵花的答案:", y[:3])
"""
        ),
        md(
            """
**慣例**：sklearn 一律用大寫 `X` 表示特徵矩陣（二維：列是樣本、欄是特徵），小寫 `y` 表示目標（一維）。記住這個慣例，看任何 sklearn 程式碼都會順。
"""
        ),
        md(
            """
## 3. 切資料：訓練集 vs 測試集

關鍵原則：**不能用考過的題目評估學生**。如果拿訓練時看過的資料來打分數，模型只要「背答案」就能拿高分，但對新資料毫無用處。

所以我們先切一刀：一部分拿來 `fit`（訓練），另一部分藏起來，最後才拿來驗收。
"""
        ),
        code(
            """
from sklearn.model_selection import train_test_split

# test_size=0.25 → 留 25% 當測試集；random_state 固定隨機種子讓結果可重現
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

print("訓練集:", X_train.shape, "  測試集:", X_test.shape)
"""
        ),
        md(
            """
> `stratify=y` 讓切分後三個品種的比例維持一致——分類問題幾乎都該加。
"""
        ),
        md(
            """
## 4. 你的第一個分類器：K 近鄰（KNN）

KNN 的想法直白到不可思議：**要預測一朵新花是什麼品種，就看離它最近的 K 朵花是什麼**，少數服從多數。

看它怎麼套進 `fit` / `predict` 的節奏：
"""
        ),
        code(
            """
from sklearn.neighbors import KNeighborsClassifier

# 1. 建立模型
model = KNeighborsClassifier(n_neighbors=5)

# 2. 訓練（只餵訓練集！）
model.fit(X_train, y_train)

# 3. 對測試集預測
y_pred = model.predict(X_test)

# 4. 打分數：預測對幾成？
accuracy = model.score(X_test, y_test)
print(f"測試集準確率：{accuracy:.1%}")
print("前 10 筆預測:", y_pred[:10])
print("前 10 筆答案:", y_test[:10])
"""
        ),
        md(
            """
就這樣，你訓練並評估了第一個機器學習模型。回頭看那四步——之後每一課、每一個模型，骨架都是這個：

```python
model = SomeEstimator(...)   # 換模型只改這行
model.fit(X_train, y_train)  # 訓練
model.predict(X_test)        # 預測
model.score(X_test, y_test)  # 評估
```

**動手試試**：把 `n_neighbors=5` 改成 `1` 或 `15`，重跑看準確率怎麼變。
"""
        ),
        md(
            """
## 5. 監督 vs 非監督

剛剛的鳶尾花有「答案 `y`」可學——這叫 **監督式學習（supervised）**，又分兩類：

- **分類（classification）**：預測類別（哪個品種）→ 本課的 KNN
- **迴歸（regression）**：預測連續數值（房價、溫度）→ 第 03 課

如果資料**沒有答案**，只能靠資料本身的結構找規律（自動分群、降維），那叫 **非監督式學習（unsupervised）**→ 第 06 課。
"""
        ),
        md(
            """
## 小結

- sklearn 每個模型都是 estimator，操作就 `fit` / `predict` / `transform` 三招。
- 特徵叫 `X`（二維）、答案叫 `y`（一維），是不成文慣例。
- 一定要切 **訓練 / 測試集**，用沒看過的資料評估才誠實。
- 換模型只改建立物件那一行，其餘流程不變。

## 練習

1. 把 KNN 換成 `from sklearn.linear_model import LogisticRegression`，其餘程式碼**完全不改**，看是否照跑、準確率多少。（體會 API 一致的好處）
2. 試試 `test_size=0.5`，準確率有變化嗎？想想為什麼。

下一課，我們專心做好**分類**，並把模型的「決策邊界」畫出來看。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-worldview.ipynb")


# ───────────────────────────── Lesson 02 ─────────────────────────────
def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 分類：把決策邊界畫出來

上一課跑了 KNN 分類器。這一課我們深入**分類**：比較兩個最常用的分類器，並且把模型腦中的「**決策邊界**」畫出來——看它到底把空間怎麼切。
"""
        ),
        md(
            """
## 學習目標

- 用 **KNN** 與 **邏輯迴歸（Logistic Regression）** 做分類並比較
- 理解什麼是 **決策邊界（decision boundary）**
- 學會把 2D 決策邊界視覺化（meshgrid + `predict`）
"""
        ),
        md(
            """
## 1. 只取兩個特徵，方便畫圖

鳶尾花有 4 個特徵，但人眼只看得懂 2D。為了把決策邊界畫在平面上，我們先只取**花瓣長度、花瓣寬度**這兩個（它們最有區別力）。
"""
        ),
        code(
            """
import numpy as np
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split

iris = load_iris()
X = iris.data[:, 2:4]   # 只取第 2、3 欄：petal length / petal width
y = iris.target

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)
print("用兩個特徵:", iris.feature_names[2], "/", iris.feature_names[3])
"""
        ),
        md(
            """
## 2. 兩個分類器

- **KNN**：看最近的鄰居投票（上一課介紹過）
- **邏輯迴歸**：別被名字騙了，它是**分類**模型——用一條（或多條）界線把不同類別分開
"""
        ),
        code(
            """
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression

knn = KNeighborsClassifier(n_neighbors=5).fit(X_train, y_train)
logreg = LogisticRegression(max_iter=1000).fit(X_train, y_train)

print(f"KNN   測試準確率：{knn.score(X_test, y_test):.1%}")
print(f"邏輯迴歸 測試準確率：{logreg.score(X_test, y_test):.1%}")
"""
        ),
        md(
            """
## 3. 什麼是決策邊界？

模型其實是把整個特徵空間**畫分成幾塊**，每塊對應一個預測類別。塊與塊之間的分界，就是**決策邊界**。

怎麼畫？做法很機械：在平面上鋪滿密密麻麻的網格點，對**每一個點**問模型「你猜這是什麼品種」，再依答案塗色。塗完，邊界自然就浮現了。
"""
        ),
        code(
            """
import matplotlib.pyplot as plt

def plot_boundary(ax, model, X, y, title):
    # 鋪一張覆蓋資料範圍的網格
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(np.linspace(x_min, x_max, 300),
                         np.linspace(y_min, y_max, 300))
    # 對每個網格點預測，再 reshape 回網格形狀
    Z = model.predict(np.c_[xx.ravel(), yy.ravel()]).reshape(xx.shape)
    ax.contourf(xx, yy, Z, alpha=0.3, cmap="viridis")
    ax.scatter(X[:, 0], X[:, 1], c=y, cmap="viridis", edgecolor="k", s=30)
    ax.set_title(title)
    ax.set_xlabel("petal length")
    ax.set_ylabel("petal width")

fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), constrained_layout=True)
plot_boundary(axes[0], knn, X, y, "KNN (k=5)")
plot_boundary(axes[1], logreg, X, y, "Logistic Regression")
fig.suptitle("Decision boundaries", fontsize=15, fontweight="bold")
plt.show()
"""
        ),
        md(
            """
看出差別了嗎？

- **KNN** 的邊界**彎彎曲曲**，緊貼著資料——它沒有預設形狀，完全跟著鄰居走。
- **邏輯迴歸** 的邊界是**直線**——它假設類別之間用直線就能分開。

沒有誰絕對比較好：資料若本來就大致線性可分，邏輯迴歸又快又穩；若邊界很不規則，KNN 這類彈性模型更能貼合。

**動手試試**：把 KNN 的 `n_neighbors` 改成 `1`，邊界會變得更破碎（過度貼合每個點）——這正是**過擬合**的長相，第 05 課會談。
"""
        ),
        md(
            """
## 小結

- 分類模型把特徵空間切成數塊，分界就是**決策邊界**。
- 視覺化方法：鋪網格 → 逐點 `predict` → `contourf` 塗色。
- KNN 邊界彈性彎曲、邏輯迴歸邊界是直線——模型的**假設**決定了邊界形狀。

## 練習

1. 加入第三個分類器 `from sklearn.svm import SVC`（`SVC(kernel="rbf")`），畫進第三個子圖比較。
2. 改用另外兩個特徵（花萼 `X = iris.data[:, 0:2]`），哪一組特徵比較好分？

下一課換跑道——從「分類別」改成「預測連續數值」的**迴歸**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-classification.ipynb")


# ───────────────────────────── Lesson 03 ─────────────────────────────
def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 迴歸：預測連續數值

分類是猜「哪一類」，**迴歸（regression）** 是預測「一個數字」——房價、氣溫、銷售額。這一課我們做線性與多項式迴歸，並學會用 **MSE / R²** 評估，用**殘差圖**診斷。
"""
        ),
        md(
            """
## 學習目標

- 用 `LinearRegression` 擬合資料，讀懂 `coef_`（斜率）與 `intercept_`（截距）
- 用 **MSE** 與 **R²** 評估迴歸模型
- 用 `PolynomialFeatures` 擬合非線性關係
- 用**殘差圖**判斷模型好不好
"""
        ),
        md(
            """
## 1. 造一份有雜訊的資料

為了看清楚原理，我們自己造一份「真實關係是直線、但帶雜訊」的資料。
"""
        ),
        code(
            """
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(42)
X = np.linspace(0, 10, 80).reshape(-1, 1)   # 特徵要是二維 (n, 1)
y = 2.5 * X.ravel() + 4 + rng.normal(0, 3, 80)  # 真實關係：y = 2.5x + 4 + 雜訊

plt.scatter(X, y, alpha=0.6)
plt.xlabel("x"); plt.ylabel("y"); plt.title("Raw data")
plt.show()
"""
        ),
        md(
            """
## 2. 線性迴歸

`fit` / `predict` 的節奏跟分類一模一樣。訓練完，模型學到的直線參數就放在 `coef_` 和 `intercept_` 裡。
"""
        ),
        code(
            """
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0)

lin = LinearRegression().fit(X_train, y_train)
print(f"學到的斜率 coef_:    {lin.coef_[0]:.2f}  (真實 2.5)")
print(f"學到的截距 intercept_: {lin.intercept_:.2f}  (真實 4.0)")
"""
        ),
        md(
            """
## 3. 評估：MSE 與 R²

- **MSE（均方誤差）**：預測值與真實值差距平方的平均，**越小越好**（有單位、隨資料尺度變）。
- **R²（決定係數）**：模型解釋了多少比例的變異，**越接近 1 越好**；0 代表跟「直接猜平均」一樣爛。
"""
        ),
        code(
            """
from sklearn.metrics import mean_squared_error, r2_score

y_pred = lin.predict(X_test)
print(f"MSE: {mean_squared_error(y_test, y_pred):.2f}")
print(f"R² : {r2_score(y_test, y_pred):.3f}")

# 把擬合的直線畫上去
plt.scatter(X, y, alpha=0.5, label="data")
plt.plot(X, lin.predict(X), color="red", lw=2, label="linear fit")
plt.xlabel("x"); plt.ylabel("y"); plt.legend(); plt.title("Linear regression")
plt.show()
"""
        ),
        md(
            """
## 4. 非線性？用多項式特徵

如果真實關係是彎的，直線就不夠用了。技巧是：把特徵 `x` 擴充成 `x, x², x³…`，再丟給**同一個**線性迴歸——它就能擬合曲線。`PolynomialFeatures` + `LinearRegression` 用 `Pipeline` 串起來（下一課詳談 Pipeline）。
"""
        ),
        code(
            """
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

# 造一份彎的資料
y_curve = 0.5 * X.ravel()**2 - 3 * X.ravel() + 5 + rng.normal(0, 4, 80)

poly = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
poly.fit(X, y_curve)

xs = np.linspace(0, 10, 200).reshape(-1, 1)
plt.scatter(X, y_curve, alpha=0.5, label="data")
plt.plot(xs, poly.predict(xs), color="red", lw=2, label="degree-2 fit")
plt.xlabel("x"); plt.ylabel("y"); plt.legend(); plt.title("Polynomial regression")
plt.show()
print(f"多項式擬合 R²: {poly.score(X, y_curve):.3f}")
"""
        ),
        md(
            """
## 5. 殘差圖：模型的健康檢查

**殘差 = 真實值 − 預測值**。把殘差對預測值畫散布圖：

- **健康**：殘差隨機散在 0 附近、沒有形狀 → 模型抓住了規律。
- **有問題**：殘差出現曲線、喇叭狀等模式 → 模型漏掉了某些結構（例如該用非線性卻用了直線）。
"""
        ),
        code(
            """
residuals = y_test - y_pred
plt.scatter(y_pred, residuals, alpha=0.7)
plt.axhline(0, color="red", ls="--")
plt.xlabel("predicted"); plt.ylabel("residual (true - pred)")
plt.title("Residual plot")
plt.show()
"""
        ),
        md(
            """
## 小結

- 迴歸預測連續數值，流程與分類相同（`fit`/`predict`）。
- 線性迴歸的參數在 `coef_` / `intercept_`。
- 評估用 **MSE**（越小越好）和 **R²**（越接近 1 越好）。
- 非線性關係 → `PolynomialFeatures` 擴充特徵。
- **殘差圖**沒有形狀，才代表模型擬合得好。

## 練習

1. 把多項式 `degree` 從 2 一路加到 10，觀察 R² 與曲線——degree 太高會發生什麼事？（提示：過擬合）
2. 改用 sklearn 內建真實資料 `from sklearn.datasets import load_diabetes`，跑線性迴歸看 R²。

下一課，我們把 `StandardScaler`、`Pipeline` 講清楚——這是讓模型發揮實力、又不會作弊的關鍵。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-regression.ipynb")


# ───────────────────────────── Lesson 04 ─────────────────────────────
def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 前處理與 Pipeline

真實資料很少能直接餵給模型——數值尺度差很多、有文字類別欄位。這一課學會用 **StandardScaler** 標準化、用 **Pipeline** 把前處理和模型綁成一體，並避開新手最常踩的**資料洩漏**陷阱。
"""
        ),
        md(
            """
## 學習目標

- 理解為什麼很多模型需要**特徵標準化**
- 用 `StandardScaler` 標準化，並只在訓練集上 `fit`
- 用 `Pipeline` 把「前處理 + 模型」串成一個物件
- 用 `ColumnTransformer` + `OneHotEncoder` 處理混合型欄位
"""
        ),
        md(
            """
## 1. 為什麼要標準化？

像 KNN 這種**靠距離**的模型，特徵尺度會嚴重影響結果。假設一個特徵範圍是 0~1、另一個是 0~10000，那後者會完全主宰距離計算，前者等於被忽略。

**標準化**把每個特徵變成「平均 0、標準差 1」，讓大家站在同一個尺度上公平競爭。
"""
        ),
        code(
            """
import numpy as np
from sklearn.datasets import load_wine
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

wine = load_wine()
X, y = wine.data, wine.target
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

print("標準化前，前 3 個特徵的範圍差很大:")
print("  各特徵平均:", X_train[:, :3].mean(axis=0).round(2))
print("  各特徵標準差:", X_train[:, :3].std(axis=0).round(2))

scaler = StandardScaler().fit(X_train)   # 只 fit 訓練集！
X_train_scaled = scaler.transform(X_train)
print("\\n標準化後:")
print("  各特徵平均:", X_train_scaled[:, :3].mean(axis=0).round(2))
print("  各特徵標準差:", X_train_scaled[:, :3].std(axis=0).round(2))
"""
        ),
        md(
            """
## 2. 致命陷阱：資料洩漏（data leakage）

注意上面 `scaler.fit(X_train)` —— **只用訓練集**算平均和標準差，**絕不碰測試集**。

如果你先對全部資料做標準化再切分，測試集的資訊（平均、標準差）就「洩漏」進了訓練過程。評估出來的分數會虛高，上線後現出原形。

> 鐵則：**任何 `fit` 都只能看訓練集。** 測試集只能被 `transform`，永遠不被 `fit`。
"""
        ),
        md(
            """
## 3. Pipeline：把步驟綁成一個物件

手動「先 scaler 再 model」很容易忘記、或不小心對測試集 `fit`。`Pipeline` 幫你把多個步驟串成單一 estimator——對它呼叫 `fit`，它會自動依序 `fit_transform` 前面每一步、最後 `fit` 模型；呼叫 `predict` 時則只 `transform`。**資料洩漏自動被擋掉**。
"""
        ),
        code(
            """
from sklearn.pipeline import Pipeline
from sklearn.neighbors import KNeighborsClassifier

# 不做標準化的 KNN（對照組）
raw_knn = KNeighborsClassifier().fit(X_train, y_train)

# 用 Pipeline 串「標準化 + KNN」
pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("knn", KNeighborsClassifier()),
])
pipe.fit(X_train, y_train)   # scaler 只在 train 上 fit，自動防洩漏

print(f"沒標準化的 KNN：{raw_knn.score(X_test, y_test):.1%}")
print(f"有標準化的 KNN：{pipe.score(X_test, y_test):.1%}")
"""
        ),
        md(
            """
看到標準化讓準確率大幅提升了吧——這就是前處理的價值。而且整條 `pipe` 現在就是一個普通 estimator，可以直接丟進交叉驗證、GridSearch（後面幾課會用到）。
"""
        ),
        md(
            """
## 4. 混合型欄位：ColumnTransformer

真實資料常常**數值欄 + 文字類別欄**混在一起。數值要標準化，類別要做 **One-Hot 編碼**（把「紅/綠/藍」變成三個 0/1 欄位）。`ColumnTransformer` 讓你對不同欄位套不同處理。
"""
        ),
        code(
            """
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

# 一份迷你的混合型資料
df = pd.DataFrame({
    "age":    [25, 42, 31, 58, 29],
    "income": [40, 80, 55, 95, 47],
    "city":   ["Taipei", "Tainan", "Taipei", "Kaohsiung", "Tainan"],
})

pre = ColumnTransformer([
    ("num", StandardScaler(), ["age", "income"]),          # 數值欄 → 標準化
    ("cat", OneHotEncoder(sparse_output=False), ["city"]),  # 類別欄 → One-Hot
])

result = pre.fit_transform(df)
print("轉換後（前 2 欄是標準化數值，後 3 欄是 city 的 One-Hot）:")
print(result.round(2))
print("\\n產生的欄位名稱:", list(pre.get_feature_names_out()))
"""
        ),
        md(
            """
`ColumnTransformer` 一樣可以放進 `Pipeline`，組成「混合前處理 + 模型」的完整流程——這正是第 08 課實戰會用的骨架。
"""
        ),
        md(
            """
## 小結

- 靠距離的模型（KNN、SVM…）對特徵尺度敏感，需要**標準化**。
- **資料洩漏鐵則**：任何 `fit` 只看訓練集，測試集只能 `transform`。
- `Pipeline` 把前處理 + 模型綁成一個 estimator，自動防洩漏。
- `ColumnTransformer` 對數值欄、類別欄分別套用不同前處理。

## 練習

1. 把 `pipe` 裡的 `KNeighborsClassifier()` 換成 `SVC()`，標準化對 SVM 的幫助有多大？
2. 在 `ColumnTransformer` 範例多加一個類別欄（例如 `gender`），確認 One-Hot 欄位數正確增加。

下一課，我們認真談**評估**：交叉驗證、混淆矩陣、precision / recall、ROC。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-preprocessing.ipynb")


if __name__ == "__main__":
    print("產生 sklearn lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
