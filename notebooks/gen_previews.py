"""產生程式實驗室課程卡的預覽圖（webp）。

本機工具，commit 進 repo 以便日後重生。每個 lesson 一個函式，
產出代表該課核心概念的圖，存到 public/lab/<track>/<module>/<slug>.webp。

用法：
    notebooks/.venv/bin/python notebooks/gen_previews.py
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # 無視窗後端
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "lab" / "python" / "matplotlib"
OUT_DIR_ML = ROOT / "public" / "lab" / "ml" / "scikit-learn"
OUT_DIR_BOOST = ROOT / "public" / "lab" / "ml" / "boosting"
OUT_DIR_PT = ROOT / "public" / "lab" / "ml" / "pytorch"
OUT_DIR_LLM = ROOT / "public" / "lab" / "llm" / "from-scratch"
OUT_DIR_AGENT = ROOT / "public" / "lab" / "agent" / "from-scratch"
OUT_DIR_RL = ROOT / "public" / "lab" / "rl" / "from-scratch"
OUT_DIR_CV = ROOT / "public" / "lab" / "cv" / "deep-vision"
OUT_DIR_DS = ROOT / "public" / "lab" / "ds" / "data-analysis"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR_ML.mkdir(parents=True, exist_ok=True)
OUT_DIR_BOOST.mkdir(parents=True, exist_ok=True)
OUT_DIR_PT.mkdir(parents=True, exist_ok=True)
OUT_DIR_LLM.mkdir(parents=True, exist_ok=True)
OUT_DIR_AGENT.mkdir(parents=True, exist_ok=True)
OUT_DIR_RL.mkdir(parents=True, exist_ok=True)
OUT_DIR_CV.mkdir(parents=True, exist_ok=True)
OUT_DIR_DS.mkdir(parents=True, exist_ok=True)

# 重用 notebook 執行時下載的資料集（絕對路徑，不受 cwd 影響）
PT_DATA = str(ROOT / "notebooks" / "ml" / "pytorch" / "data")

# 卡片是 16:10；輸出夠清晰即可
FIGSIZE = (10.24, 6.40)
DPI = 110


def save(fig, slug: str, out_dir: Path = OUT_DIR) -> None:
    path = out_dir / f"{slug}.webp"
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  ✓ {path.relative_to(ROOT)}")


def _cjk_font() -> str | None:
    installed = {f.name for f in font_manager.fontManager.ttflist}
    for c in ["Noto Sans CJK TC", "PingFang TC", "Heiti TC", "Arial Unicode MS", "Microsoft JhengHei"]:
        if c in installed:
            return c
    return None


def lesson_01_basics() -> None:
    """一張 Figure、兩個 Axes——直接點題本課的心智模型。"""
    x = np.linspace(0, 2 * np.pi, 200)
    fig, axes = plt.subplots(1, 2, figsize=FIGSIZE)
    axes[0].plot(x, np.sin(x), color="tab:blue", lw=2.2)
    axes[0].set_title("sin(x)", fontsize=15)
    axes[0].set_xlabel("x")
    axes[1].plot(x, np.cos(x), color="tab:orange", lw=2.2)
    axes[1].set_title("cos(x)", fontsize=15)
    axes[1].set_xlabel("x")
    for ax in axes:
        ax.grid(True, alpha=0.3)
    fig.suptitle("One Figure, Two Axes", fontsize=18, fontweight="bold")
    save(fig, "01-basics")


def lesson_02_line_styles() -> None:
    """多條線 + 圖例 + 樣式。"""
    x = np.linspace(0, 2 * np.pi, 200)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(x, np.sin(x), color="tab:blue", lw=2.5, label="sin(x)")
    ax.plot(x, np.cos(x), color="tab:orange", lw=2.5, label="cos(x)")
    ax.plot(x, np.sin(x) * np.cos(x), color="tab:green", lw=2.5, ls="--", label="sin·cos")
    ax.set_title("Color · linestyle · legend", fontsize=17, fontweight="bold")
    ax.legend(fontsize=13)
    ax.grid(True, alpha=0.3)
    save(fig, "02-line-styles")


def lesson_03_plot_zoo() -> None:
    """四種圖型一次看：scatter / bar / hist / boxplot。"""
    rng = np.random.default_rng(42)
    fig, axes = plt.subplots(2, 2, figsize=FIGSIZE, constrained_layout=True)

    h = rng.normal(170, 8, 80)
    w = 0.9 * h - 90 + rng.normal(0, 5, 80)
    axes[0][0].scatter(h, w, alpha=0.6, color="tab:blue")
    axes[0][0].set_title("scatter")

    axes[0][1].bar(["Py", "JS", "Go", "Rust", "C++"], [42, 38, 21, 18, 25], color="tab:green")
    axes[0][1].set_title("bar")

    axes[1][0].hist(rng.normal(72, 12, 500), bins=20, color="tab:orange", edgecolor="white")
    axes[1][0].set_title("hist")

    axes[1][1].boxplot(
        [rng.normal(60, 10, 100), rng.normal(75, 5, 100), rng.normal(70, 20, 100)],
        tick_labels=["A", "B", "C"],
    )
    axes[1][1].set_title("boxplot")

    fig.suptitle("The Plot Zoo", fontsize=18, fontweight="bold")
    save(fig, "03-plot-zoo")


def lesson_04_subplots() -> None:
    """GridSpec：上方寬圖 + 下方兩小圖。"""
    x = np.linspace(0, 10, 200)
    fig = plt.figure(figsize=FIGSIZE, constrained_layout=True)
    gs = fig.add_gridspec(2, 2)
    ax_top = fig.add_subplot(gs[0, :])
    ax_bl = fig.add_subplot(gs[1, 0])
    ax_br = fig.add_subplot(gs[1, 1])
    ax_top.plot(x, np.sin(x), color="tab:blue", lw=2.2)
    ax_top.set_title("spans full width")
    ax_bl.scatter(x, np.sin(x), s=8, color="tab:green")
    ax_bl.set_title("bottom-left")
    ax_br.hist(np.sin(x), bins=15, color="tab:orange", edgecolor="white")
    ax_br.set_title("bottom-right")
    fig.suptitle("GridSpec Layout", fontsize=18, fontweight="bold")
    save(fig, "04-subplots")


def lesson_05_axes_ticks() -> None:
    """線性 vs 對數軸，並標註重點。"""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    x = np.arange(1, 11)
    y = 2.0**x
    ax1.plot(x, y, marker="o", color="tab:blue")
    ax1.set_title("linear y-axis")
    ax1.grid(True, alpha=0.3)
    ax2.plot(x, y, marker="o", color="tab:red")
    ax2.set_yscale("log")
    ax2.set_title("log y-axis (straight line!)")
    ax2.grid(True, alpha=0.3, which="both")
    fig.suptitle("Log Scale & Ticks", fontsize=18, fontweight="bold")
    save(fig, "05-axes-ticks")


def lesson_06_style_fonts() -> None:
    """套 style + colormap + 中文字型，展示最終成果。"""
    font = _cjk_font()

    # 注意：style context 會重設 rcParams（含字型），所以字型設定要放在 context 內，
    # 否則中文標籤會被 style 帶回預設西文字型而變豆腐。
    with plt.style.context("seaborn-v0_8"):
        if font:
            plt.rcParams["font.sans-serif"] = [font]
        plt.rcParams["axes.unicode_minus"] = False

        fig, axes = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)

        months = np.arange(1, 13)
        revenue = [12, 19, 15, 25, 22, 30, 28, 35, 33, 40, 38, 45]
        axes[0].plot(months, revenue, marker="o", color="tab:red", lw=2.5)
        axes[0].set_title("每月銷售額", fontsize=15)
        axes[0].set_xlabel("月份")
        axes[0].set_ylabel("營收（萬元）")

        rng = np.random.default_rng(7)
        n = 300
        xx, yy = rng.normal(0, 1, n), rng.normal(0, 1, n)
        dist = np.sqrt(xx**2 + yy**2)
        sc = axes[1].scatter(xx, yy, c=dist, cmap="viridis", s=30)
        fig.colorbar(sc, ax=axes[1], label="距離")
        axes[1].set_title("用顏色表達第三維", fontsize=15)

        title_font = {"fontsize": 18, "fontweight": "bold"}
        if font:
            title_font["fontfamily"] = font
        fig.suptitle("樣式 · 配色 · 中文字型", **title_font)
        save(fig, "06-style-fonts")


def lesson_07_animation() -> None:
    """靜態縮圖用「殘影」暗示動畫：同一條波的多個相位疊加、由淡到深。"""
    x = np.linspace(0, 2 * np.pi, 200)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    n = 8
    for k in range(n):
        alpha = 0.12 + 0.88 * k / (n - 1)
        ax.plot(x, np.sin(x + k * 0.35), color="tab:blue", alpha=alpha, lw=2.2)
    ax.set_ylim(-1.3, 1.3)
    ax.set_xlabel("x")
    ax.grid(True, alpha=0.3)
    ax.set_title("Animation: a traveling wave", fontsize=17, fontweight="bold")
    save(fig, "07-animation")


def lesson_08_pandas_numpy() -> None:
    """左：pandas 風格多線時序；右：numpy 相關矩陣熱圖。代表接上真實資料。"""
    rng = np.random.default_rng(0)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)

    months = np.arange(1, 13)
    for name, color in [("Store A", "tab:blue"), ("Store B", "tab:orange"), ("Store C", "tab:green")]:
        series = rng.integers(20, 90, 12).cumsum() / 10
        ax1.plot(months, series, marker="o", color=color, label=name)
    ax1.set_title("df.plot(): monthly revenue")
    ax1.set_xlabel("Month")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    corr = np.array([
        [1.0, 0.8, 0.1, -0.3, 0.0],
        [0.8, 1.0, 0.2, -0.2, 0.1],
        [0.1, 0.2, 1.0, 0.4, -0.5],
        [-0.3, -0.2, 0.4, 1.0, 0.3],
        [0.0, 0.1, -0.5, 0.3, 1.0],
    ])
    im = ax2.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
    fig.colorbar(im, ax=ax2, label="correlation", fraction=0.046)
    labels = list("ABCDE")
    ax2.set_xticks(range(5), labels)
    ax2.set_yticks(range(5), labels)
    ax2.set_title("numpy 2D: heatmap")

    fig.suptitle("matplotlib + pandas / numpy", fontsize=18, fontweight="bold")
    save(fig, "08-pandas-numpy")


# ═══════════════════════ 機器學習 / scikit-learn ═══════════════════════
# 預覽圖一律英文標籤（Plan A）。每張代表該課核心成果。


def ml_01_worldview() -> None:
    """鳶尾花散布圖（依品種上色）——第一個分類器的舞台。"""
    from sklearn.datasets import load_iris

    iris = load_iris()
    X, y = iris.data, iris.target
    fig, ax = plt.subplots(figsize=FIGSIZE)
    sc = ax.scatter(X[:, 2], X[:, 3], c=y, cmap="viridis", s=55, edgecolor="k")
    ax.set_xlabel("petal length (cm)", fontsize=12)
    ax.set_ylabel("petal width (cm)", fontsize=12)
    ax.set_title("Your first classifier: the iris dataset", fontsize=17, fontweight="bold")
    ax.legend(sc.legend_elements()[0], list(iris.target_names), title="species")
    ax.grid(True, alpha=0.3)
    save(fig, "01-worldview", OUT_DIR_ML)


def _boundary(ax, model, X, y, title):
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(np.linspace(x_min, x_max, 300), np.linspace(y_min, y_max, 300))
    Z = model.predict(np.c_[xx.ravel(), yy.ravel()]).reshape(xx.shape)
    ax.contourf(xx, yy, Z, alpha=0.3, cmap="viridis")
    ax.scatter(X[:, 0], X[:, 1], c=y, cmap="viridis", edgecolor="k", s=28)
    ax.set_title(title, fontsize=14)
    ax.set_xlabel("petal length")
    ax.set_ylabel("petal width")


def ml_02_classification() -> None:
    """KNN vs 邏輯迴歸的決策邊界對比。"""
    from sklearn.datasets import load_iris
    from sklearn.linear_model import LogisticRegression
    from sklearn.neighbors import KNeighborsClassifier

    iris = load_iris()
    X, y = iris.data[:, 2:4], iris.target
    knn = KNeighborsClassifier(n_neighbors=5).fit(X, y)
    logreg = LogisticRegression(max_iter=1000).fit(X, y)
    fig, axes = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    _boundary(axes[0], knn, X, y, "KNN (k=5)")
    _boundary(axes[1], logreg, X, y, "Logistic Regression")
    fig.suptitle("Decision boundaries", fontsize=18, fontweight="bold")
    save(fig, "02-classification", OUT_DIR_ML)


def ml_03_regression() -> None:
    """線性 vs 多項式擬合。"""
    rng = np.random.default_rng(42)
    x = np.linspace(0, 10, 80)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)

    y_lin = 2.5 * x + 4 + rng.normal(0, 3, 80)
    coef = np.polyfit(x, y_lin, 1)
    ax1.scatter(x, y_lin, alpha=0.5, color="tab:blue")
    ax1.plot(x, np.polyval(coef, x), color="red", lw=2.5)
    ax1.set_title("Linear fit")

    y_curve = 0.5 * x**2 - 3 * x + 5 + rng.normal(0, 4, 80)
    coef2 = np.polyfit(x, y_curve, 2)
    xs = np.linspace(0, 10, 200)
    ax2.scatter(x, y_curve, alpha=0.5, color="tab:green")
    ax2.plot(xs, np.polyval(coef2, xs), color="red", lw=2.5)
    ax2.set_title("Polynomial fit")
    for ax in (ax1, ax2):
        ax.set_xlabel("x"); ax.set_ylabel("y"); ax.grid(True, alpha=0.3)
    fig.suptitle("Regression: fitting a curve", fontsize=18, fontweight="bold")
    save(fig, "03-regression", OUT_DIR_ML)


def ml_04_preprocessing() -> None:
    """標準化前後的特徵分布對比。"""
    from sklearn.datasets import load_wine
    from sklearn.preprocessing import StandardScaler

    X = load_wine().data[:, :6]
    Xs = StandardScaler().fit_transform(X)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    ax1.boxplot(X, tick_labels=[f"f{i}" for i in range(6)])
    ax1.set_title("Before scaling (different ranges)")
    ax2.boxplot(Xs, tick_labels=[f"f{i}" for i in range(6)])
    ax2.set_title("After StandardScaler (mean 0, std 1)")
    for ax in (ax1, ax2):
        ax.grid(True, alpha=0.3, axis="y")
    fig.suptitle("Preprocessing & Pipeline", fontsize=18, fontweight="bold")
    save(fig, "04-preprocessing", OUT_DIR_ML)


def ml_05_evaluation() -> None:
    """混淆矩陣 + ROC 曲線。"""
    from sklearn.datasets import load_breast_cancer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import ConfusionMatrixDisplay, RocCurveDisplay
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    d = load_breast_cancer()
    Xtr, Xte, ytr, yte = train_test_split(d.data, d.target, test_size=0.25, random_state=42, stratify=d.target)
    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000)).fit(Xtr, ytr)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    ConfusionMatrixDisplay.from_estimator(m, Xte, yte, display_labels=d.target_names, cmap="Blues", ax=ax1, colorbar=False)
    ax1.set_title("Confusion matrix")
    RocCurveDisplay.from_estimator(m, Xte, yte, ax=ax2)
    ax2.plot([0, 1], [0, 1], "k--", alpha=0.4)
    ax2.set_title("ROC curve")
    fig.suptitle("Model evaluation", fontsize=18, fontweight="bold")
    save(fig, "05-evaluation", OUT_DIR_ML)


def ml_06_unsupervised() -> None:
    """PCA 2D 投影，依 KMeans 分群上色。"""
    from sklearn.cluster import KMeans
    from sklearn.datasets import load_iris
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    X = StandardScaler().fit_transform(load_iris().data)
    labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(X)
    X2 = PCA(n_components=2).fit_transform(X)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.scatter(X2[:, 0], X2[:, 1], c=labels, cmap="viridis", s=55, edgecolor="k")
    ax.set_xlabel("PC1"); ax.set_ylabel("PC2")
    ax.set_title("Clustering & PCA (4D → 2D)", fontsize=17, fontweight="bold")
    ax.grid(True, alpha=0.3)
    save(fig, "06-unsupervised", OUT_DIR_ML)


def ml_07_trees() -> None:
    """隨機森林特徵重要性長條圖。"""
    from sklearn.datasets import load_wine
    from sklearn.ensemble import RandomForestClassifier

    wine = load_wine()
    forest = RandomForestClassifier(n_estimators=200, random_state=42).fit(wine.data, wine.target)
    imp = forest.feature_importances_
    order = np.argsort(imp)[::-1][:8]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.barh(range(len(order)), imp[order][::-1], color="tab:green")
    ax.set_yticks(range(len(order)))
    ax.set_yticklabels(np.array(wine.feature_names)[order][::-1], fontsize=11)
    ax.set_xlabel("importance")
    ax.set_title("Trees & feature importance", fontsize=17, fontweight="bold")
    save(fig, "07-trees", OUT_DIR_ML)


def ml_08_end_to_end() -> None:
    """實戰收尾：混淆矩陣 + top features 的小儀表板。"""
    from sklearn.datasets import load_breast_cancer
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import ConfusionMatrixDisplay
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    d = load_breast_cancer()
    Xtr, Xte, ytr, yte = train_test_split(d.data, d.target, test_size=0.2, random_state=42, stratify=d.target)
    pipe = Pipeline([("s", StandardScaler()), ("clf", RandomForestClassifier(n_estimators=300, random_state=42))]).fit(Xtr, ytr)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    ConfusionMatrixDisplay.from_estimator(pipe, Xte, yte, display_labels=d.target_names, cmap="Blues", ax=ax1, colorbar=False)
    ax1.set_title("Final confusion matrix")
    imp = pipe.named_steps["clf"].feature_importances_
    order = np.argsort(imp)[::-1][:8]
    ax2.barh(range(len(order)), imp[order][::-1], color="tab:blue")
    ax2.set_yticks(range(len(order)))
    ax2.set_yticklabels(np.array(d.feature_names)[order][::-1], fontsize=9)
    ax2.set_xlabel("importance"); ax2.set_title("Top features")
    fig.suptitle("End-to-end ML pipeline", fontsize=18, fontweight="bold")
    save(fig, "08-end-to-end", OUT_DIR_ML)


# ═══════════════════════ 機器學習 / 梯度提升 boosting ═══════════════════════


def boost_01_ensembles() -> None:
    """單棵樹 vs bagging vs boosting 準確率對比。"""
    from sklearn.datasets import load_breast_cancer
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.model_selection import cross_val_score
    from sklearn.tree import DecisionTreeClassifier

    X, y = load_breast_cancer(return_X_y=True)
    names = ["Single tree", "Random Forest\n(bagging)", "Gradient Boosting\n(boosting)"]
    models = [DecisionTreeClassifier(random_state=0),
              RandomForestClassifier(n_estimators=200, random_state=0),
              GradientBoostingClassifier(random_state=0)]
    scores = [cross_val_score(m, X, y, cv=5).mean() for m in models]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    bars = ax.bar(names, scores, color=["tab:gray", "tab:green", "tab:purple"])
    ax.set_ylim(0.88, 1.0)
    ax.set_ylabel("5-fold accuracy")
    ax.bar_label(bars, fmt="%.3f", fontsize=12)
    ax.set_title("Single tree vs bagging vs boosting", fontsize=17, fontweight="bold")
    save(fig, "01-ensembles", OUT_DIR_BOOST)


def boost_02_gradient_boosting() -> None:
    """殘差擬合三連圖。"""
    from sklearn.tree import DecisionTreeRegressor

    rng = np.random.default_rng(0)
    X = np.linspace(0, 10, 120).reshape(-1, 1)
    y = np.sin(X).ravel() + 0.3 * X.ravel() + rng.normal(0, 0.3, 120)
    pred = np.full_like(y, y.mean())
    fig, axes = plt.subplots(1, 3, figsize=FIGSIZE, constrained_layout=True)
    for step, ax in enumerate(axes):
        stump = DecisionTreeRegressor(max_depth=2).fit(X, y - pred)
        pred = pred + 0.5 * stump.predict(X)
        ax.scatter(X, y, s=12, alpha=0.4)
        ax.plot(X, pred, color="red", lw=2.4)
        ax.set_title(f"After {step + 1} tree(s)")
    fig.suptitle("Boosting: fitting residuals step by step", fontsize=17, fontweight="bold")
    save(fig, "02-gradient-boosting", OUT_DIR_BOOST)


def boost_03_xgboost() -> None:
    """XGBoost 特徵重要性。"""
    from sklearn.datasets import load_breast_cancer
    from xgboost import XGBClassifier

    data = load_breast_cancer()
    m = XGBClassifier(n_estimators=300, max_depth=3, eval_metric="logloss", random_state=42)
    m.fit(data.data, data.target)
    imp = m.feature_importances_
    order = np.argsort(imp)[::-1][:8]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.barh(range(len(order)), imp[order][::-1], color="tab:purple")
    ax.set_yticks(range(len(order)))
    ax.set_yticklabels(np.array(data.feature_names)[order][::-1], fontsize=10)
    ax.set_xlabel("importance")
    ax.set_title("XGBoost feature importances", fontsize=17, fontweight="bold")
    save(fig, "03-xgboost", OUT_DIR_BOOST)


def boost_04_overfitting() -> None:
    """train vs val logloss + early stopping 線。"""
    from sklearn.datasets import load_breast_cancer
    from sklearn.model_selection import train_test_split
    from xgboost import XGBClassifier

    X, y = load_breast_cancer(return_X_y=True)
    Xtr, Xv, ytr, yv = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    m = XGBClassifier(n_estimators=400, learning_rate=0.1, max_depth=3,
                      eval_metric="logloss", early_stopping_rounds=20, random_state=42)
    m.fit(Xtr, ytr, eval_set=[(Xtr, ytr), (Xv, yv)], verbose=False)
    r = m.evals_result()
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(r["validation_0"]["logloss"], label="train", lw=2)
    ax.plot(r["validation_1"]["logloss"], label="validation", lw=2)
    ax.axvline(m.best_iteration, color="gray", ls="--", label="best iteration")
    ax.set_xlabel("number of trees"); ax.set_ylabel("logloss"); ax.legend(fontsize=12)
    ax.set_title("Early stopping at the validation valley", fontsize=17, fontweight="bold")
    save(fig, "04-overfitting", OUT_DIR_BOOST)


def boost_05_tuning() -> None:
    """隨機搜尋的試驗分數散布。"""
    from scipy.stats import randint, uniform
    from sklearn.datasets import load_breast_cancer
    from sklearn.model_selection import RandomizedSearchCV
    from xgboost import XGBClassifier

    X, y = load_breast_cancer(return_X_y=True)
    dist = {"n_estimators": randint(100, 600), "max_depth": randint(2, 7),
            "learning_rate": uniform(0.01, 0.3), "subsample": uniform(0.6, 0.4)}
    s = RandomizedSearchCV(XGBClassifier(eval_metric="logloss", random_state=42),
                           dist, n_iter=25, cv=5, scoring="roc_auc", random_state=42, n_jobs=-1)
    s.fit(X, y)
    means = s.cv_results_["mean_test_score"]
    running = np.maximum.accumulate(means)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.scatter(range(len(means)), means, alpha=0.6, label="each trial")
    ax.plot(running, color="tab:red", lw=2.4, label="best so far")
    ax.set_xlabel("trial"); ax.set_ylabel("CV AUC"); ax.legend(fontsize=12)
    ax.set_title("Randomized hyperparameter search", fontsize=17, fontweight="bold")
    save(fig, "05-tuning", OUT_DIR_BOOST)


def boost_06_lightgbm() -> None:
    """XGBoost vs LightGBM 訓練時間對比。"""
    import time

    from lightgbm import LGBMClassifier
    from sklearn.datasets import make_classification
    from xgboost import XGBClassifier

    X, y = make_classification(n_samples=40000, n_features=50, n_informative=15, random_state=42)
    times = {}
    for name, m in [("XGBoost", XGBClassifier(n_estimators=300, max_depth=6, eval_metric="logloss", random_state=42)),
                    ("LightGBM", LGBMClassifier(n_estimators=300, max_depth=6, verbose=-1, random_state=42))]:
        t = time.perf_counter(); m.fit(X, y); times[name] = time.perf_counter() - t
    fig, ax = plt.subplots(figsize=FIGSIZE)
    bars = ax.bar(list(times), list(times.values()), color=["tab:purple", "tab:green"])
    ax.bar_label(bars, fmt="%.2f s", fontsize=13)
    ax.set_ylabel("training time (s)")
    ax.set_title("XGBoost vs LightGBM: training speed", fontsize=17, fontweight="bold")
    save(fig, "06-lightgbm", OUT_DIR_BOOST)


def boost_07_shap() -> None:
    """SHAP beeswarm 摘要圖。"""
    import shap
    from sklearn.datasets import load_breast_cancer
    from xgboost import XGBClassifier

    data = load_breast_cancer()
    m = XGBClassifier(n_estimators=200, max_depth=3, eval_metric="logloss", random_state=42)
    m.fit(data.data, data.target)
    sv = shap.TreeExplainer(m).shap_values(data.data)
    shap.summary_plot(sv, data.data, feature_names=list(data.feature_names),
                      max_display=10, show=False)
    fig = plt.gcf()
    fig.set_size_inches(*FIGSIZE)
    fig.suptitle("SHAP: explaining every prediction", fontsize=15, fontweight="bold")
    save(fig, "07-shap", OUT_DIR_BOOST)


def boost_08_kaggle() -> None:
    """實戰收尾：ROC + 特徵重要性。"""
    from sklearn.datasets import make_classification
    from sklearn.metrics import RocCurveDisplay
    from sklearn.model_selection import train_test_split
    from xgboost import XGBClassifier

    X, y = make_classification(n_samples=8000, n_features=30, n_informative=12,
                               n_redundant=6, weights=[0.7, 0.3], random_state=7)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=7, stratify=y)
    m = XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.1,
                      eval_metric="logloss", random_state=7).fit(Xtr, ytr)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE, constrained_layout=True)
    RocCurveDisplay.from_estimator(m, Xte, yte, ax=ax1)
    ax1.plot([0, 1], [0, 1], "k--", alpha=0.4); ax1.set_title("ROC curve")
    imp = m.feature_importances_
    order = np.argsort(imp)[::-1][:8]
    ax2.barh(range(len(order)), imp[order][::-1], color="tab:purple")
    ax2.set_yticks(range(len(order)))
    ax2.set_yticklabels([f"f{i}" for i in order][::-1], fontsize=9)
    ax2.set_xlabel("importance"); ax2.set_title("Top features")
    fig.suptitle("End-to-end boosting pipeline", fontsize=18, fontweight="bold")
    save(fig, "08-kaggle", OUT_DIR_BOOST)


# ═══════════════════════ 機器學習 / 深度學習 PyTorch ═══════════════════════


def pt_01_tensors() -> None:
    """autograd：在 x² 上畫梯度（往下走的方向）。"""
    import torch

    xs = torch.linspace(-3, 3, 9, requires_grad=True)
    (xs ** 2).sum().backward()
    xs_np, grads = xs.detach().numpy(), xs.grad.numpy()
    cx = np.linspace(-3, 3, 100)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(cx, cx ** 2, lw=2.4, label="f(x) = x²")
    for xi, g in zip(xs_np, grads):
        ax.arrow(xi, xi ** 2, -0.35 * np.sign(g), 0, head_width=0.35, color="red", alpha=0.7)
    ax.set_title("Autograd: gradients of f(x)=x²", fontsize=17, fontweight="bold")
    ax.legend(fontsize=12); ax.grid(True, alpha=0.3)
    save(fig, "01-tensors-autograd", OUT_DIR_PT)


def pt_02_first_network() -> None:
    """two moons 資料。"""
    from sklearn.datasets import make_moons

    X, y = make_moons(n_samples=300, noise=0.2, random_state=0)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.scatter(X[:, 0], X[:, 1], c=y, cmap="coolwarm", edgecolor="k", s=40)
    ax.set_title("Your first neural network: the two-moons task", fontsize=17, fontweight="bold")
    ax.grid(True, alpha=0.3)
    save(fig, "02-first-network", OUT_DIR_PT)


def pt_03_training_loop() -> None:
    """訓練後的決策邊界。"""
    import torch
    import torch.nn as nn
    from sklearn.datasets import make_moons

    torch.manual_seed(0)
    Xn, yn = make_moons(n_samples=300, noise=0.2, random_state=0)
    X = torch.tensor(Xn, dtype=torch.float32); y = torch.tensor(yn, dtype=torch.long)
    net = nn.Sequential(nn.Linear(2, 16), nn.ReLU(), nn.Linear(16, 16), nn.ReLU(), nn.Linear(16, 2))
    opt = torch.optim.Adam(net.parameters(), lr=0.05); crit = nn.CrossEntropyLoss()
    for _ in range(200):
        opt.zero_grad(); crit(net(X), y).backward(); opt.step()
    xx, yy = np.meshgrid(np.linspace(-1.5, 2.5, 300), np.linspace(-1, 1.5, 300))
    grid = torch.tensor(np.c_[xx.ravel(), yy.ravel()], dtype=torch.float32)
    with torch.no_grad():
        Z = net(grid).argmax(1).numpy().reshape(xx.shape)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.contourf(xx, yy, Z, alpha=0.3, cmap="coolwarm")
    ax.scatter(Xn[:, 0], Xn[:, 1], c=yn, cmap="coolwarm", edgecolor="k", s=40)
    ax.set_title("Training loop: the learned decision boundary", fontsize=17, fontweight="bold")
    save(fig, "03-training-loop", OUT_DIR_PT)


def _mnist_subset(n_tr, n_te):
    import torch
    from torch.utils.data import DataLoader, Subset
    from torchvision import datasets, transforms

    tfm = transforms.ToTensor()
    tr = Subset(datasets.MNIST(PT_DATA, train=True, download=True, transform=tfm), range(n_tr))
    te = Subset(datasets.MNIST(PT_DATA, train=False, download=True, transform=tfm), range(n_te))
    return DataLoader(tr, batch_size=64, shuffle=True), DataLoader(te, batch_size=256), len(te)


def pt_04_cnn() -> None:
    """MLP vs CNN 準確率對比。"""
    import torch
    import torch.nn as nn

    torch.manual_seed(0)
    train_loader, test_loader, n_te = _mnist_subset(6000, 1500)

    def run(model, epochs=2):
        opt = torch.optim.Adam(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
        for _ in range(epochs):
            for xb, yb in train_loader:
                opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
        c = 0
        with torch.no_grad():
            for xb, yb in test_loader:
                c += (model(xb).argmax(1) == yb).sum().item()
        return c / n_te

    mlp = nn.Sequential(nn.Flatten(), nn.Linear(784, 128), nn.ReLU(), nn.Linear(128, 10))
    cnn = nn.Sequential(nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                        nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                        nn.Flatten(), nn.Linear(32 * 7 * 7, 10))
    accs = [run(mlp), run(cnn)]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    bars = ax.bar(["Fully-connected\n(MLP)", "CNN"], accs, color=["tab:gray", "tab:orange"])
    ax.set_ylim(0.8, 1.0); ax.set_ylabel("test accuracy")
    ax.bar_label(bars, fmt="%.1%%" if False else "%.3f", fontsize=13)
    ax.set_title("MLP vs CNN on MNIST", fontsize=17, fontweight="bold")
    save(fig, "04-cnn", OUT_DIR_PT)


def pt_05_regularization() -> None:
    """過擬合：train vs test 準確率曲線。"""
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, Subset
    from torchvision import datasets, transforms

    torch.manual_seed(0)
    tfm = transforms.ToTensor()
    tr = Subset(datasets.MNIST(PT_DATA, train=True, download=True, transform=tfm), range(500))
    te = Subset(datasets.MNIST(PT_DATA, train=False, download=True, transform=tfm), range(2000))
    trl = DataLoader(tr, batch_size=64, shuffle=True); tel = DataLoader(te, batch_size=512)

    def acc(m, loader, n):
        c = 0
        with torch.no_grad():
            for xb, yb in loader:
                c += (m(xb).argmax(1) == yb).sum().item()
        return c / n

    model = nn.Sequential(nn.Flatten(), nn.Linear(784, 256), nn.ReLU(),
                          nn.Linear(256, 256), nn.ReLU(), nn.Linear(256, 10))
    opt = torch.optim.Adam(model.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
    tr_acc, te_acc = [], []
    for _ in range(40):
        for xb, yb in trl:
            opt.zero_grad(); crit(model(xb), yb).backward(); opt.step()
        tr_acc.append(acc(model, trl, 500)); te_acc.append(acc(model, tel, 2000))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(tr_acc, lw=2.2, label="train accuracy")
    ax.plot(te_acc, lw=2.2, label="test accuracy")
    ax.set_xlabel("epoch"); ax.set_ylabel("accuracy"); ax.legend(fontsize=12)
    ax.set_title("Overfitting: train ~100%, test lags behind", fontsize=17, fontweight="bold")
    save(fig, "05-regularization", OUT_DIR_PT)


def pt_06_gpu() -> None:
    """概念示意：CPU 少數強核 vs GPU 海量小核的平行運算。"""
    from matplotlib.patches import Rectangle

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=FIGSIZE)
    for r in range(2):
        for c in range(4):
            ax1.add_patch(Rectangle((c, r), 0.88, 0.88, color="tab:blue", alpha=0.85))
    ax1.set_xlim(-0.3, 4.2); ax1.set_ylim(-0.5, 2.6); ax1.set_aspect("equal"); ax1.axis("off")
    ax1.set_title("CPU\n~8 powerful cores · sequential", fontsize=13)

    rows, cols = 16, 30
    for r in range(rows):
        for c in range(cols):
            ax2.add_patch(Rectangle((c, r), 0.82, 0.82, color="tab:orange", alpha=0.85))
    ax2.set_xlim(-1, cols); ax2.set_ylim(-2, rows + 1); ax2.set_aspect("equal"); ax2.axis("off")
    ax2.set_title("GPU\nthousands of small cores · parallel", fontsize=13)

    fig.suptitle("Why GPUs win: massive parallelism", fontsize=18, fontweight="bold")
    save(fig, "06-gpu", OUT_DIR_PT)


def pt_07_transfer() -> None:
    """遷移學習 vs 從零訓練（CIFAR-10 小資料）。"""
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, Subset
    from torchvision import datasets, models, transforms
    from torchvision.models import ResNet18_Weights

    torch.manual_seed(0)
    w = ResNet18_Weights.DEFAULT
    resnet = models.resnet18(weights=w).eval()
    feat = nn.Sequential(*list(resnet.children())[:-1])
    for p in feat.parameters():
        p.requires_grad = False
    tfm = transforms.Compose([transforms.Resize(64), transforms.ToTensor(),
                              transforms.Normalize(w.transforms().mean, w.transforms().std)])
    tr = Subset(datasets.CIFAR10(PT_DATA, train=True, download=True, transform=tfm), range(1000))
    te = Subset(datasets.CIFAR10(PT_DATA, train=False, download=True, transform=tfm), range(400))

    def extract(ds):
        xs, ys = [], []
        with torch.no_grad():
            for xb, yb in DataLoader(ds, batch_size=64):
                xs.append(feat(xb).flatten(1)); ys.append(yb)
        return torch.cat(xs), torch.cat(ys)

    Xtr, ytr = extract(tr); Xte, yte = extract(te)
    lin = nn.Linear(512, 10); opt = torch.optim.Adam(lin.parameters(), lr=1e-3); crit = nn.CrossEntropyLoss()
    for _ in range(80):
        opt.zero_grad(); crit(lin(Xtr), ytr).backward(); opt.step()
    with torch.no_grad():
        transfer = (lin(Xte).argmax(1) == yte).float().mean().item()

    raw = transforms.Compose([transforms.Resize(64), transforms.ToTensor()])
    rtr = Subset(datasets.CIFAR10(PT_DATA, train=True, download=True, transform=raw), range(1000))
    rte = Subset(datasets.CIFAR10(PT_DATA, train=False, download=True, transform=raw), range(400))
    cnn = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                        nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                        nn.Flatten(), nn.Linear(32 * 16 * 16, 10))
    o = torch.optim.Adam(cnn.parameters(), lr=1e-3); c2 = nn.CrossEntropyLoss()
    for _ in range(12):
        for xb, yb in DataLoader(rtr, batch_size=64, shuffle=True):
            o.zero_grad(); c2(cnn(xb), yb).backward(); o.step()
    correct = 0
    with torch.no_grad():
        for xb, yb in DataLoader(rte, batch_size=128):
            correct += (cnn(xb).argmax(1) == yb).sum().item()
    scratch = correct / len(rte)

    fig, ax = plt.subplots(figsize=FIGSIZE)
    bars = ax.bar(["Transfer learning\n(frozen ResNet)", "From scratch\n(small CNN)"],
                  [transfer, scratch], color=["tab:green", "tab:gray"])
    ax.set_ylabel("test accuracy (CIFAR-10, 1000 imgs)")
    ax.bar_label(bars, fmt="%.3f", fontsize=13)
    ax.set_title("Transfer learning wins on small data", fontsize=17, fontweight="bold")
    save(fig, "07-transfer-learning", OUT_DIR_PT)


def pt_08_capstone() -> None:
    """FashionMNIST 樣本網格。"""
    from torchvision import datasets, transforms

    ds = datasets.FashionMNIST(PT_DATA, train=True, download=True, transform=transforms.ToTensor())
    classes = ["T-shirt", "Trouser", "Pullover", "Dress", "Coat",
               "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]
    fig, axes = plt.subplots(2, 6, figsize=FIGSIZE)
    for ax, (img, label) in zip(axes.ravel(), ds):
        ax.imshow(img.squeeze(), cmap="gray"); ax.set_title(classes[label], fontsize=10); ax.axis("off")
    fig.suptitle("Deep learning capstone: FashionMNIST", fontsize=18, fontweight="bold")
    save(fig, "08-capstone", OUT_DIR_PT)


# ═══════════════════════ 大型語言模型 / 從零打造 GPT ═══════════════════════


def _set_cjk():
    f = _cjk_font()
    if f:
        plt.rcParams["font.sans-serif"] = [f]
    plt.rcParams["axes.unicode_minus"] = False


def _load_gpt():
    """exec 共用的 GPT 原始碼，取出 MiniGPT 類別。"""
    from _llm_shared import GPT_SRC

    ns: dict = {}
    exec(GPT_SRC, ns)
    return ns["MiniGPT"]


def llm_01_tokenization() -> None:
    from _llm_shared import CORPUS

    _set_cjk()
    s = "床前明月光"
    chars = sorted(set(CORPUS))
    stoi = {c: i for i, c in enumerate(chars)}
    ids = [stoi[c] for c in s]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for i, (c, d) in enumerate(zip(s, ids)):
        ax.text(i, 1.0, c, fontsize=46, ha="center", va="center")
        ax.annotate("", xy=(i, 0.5), xytext=(i, 0.82),
                    arrowprops=dict(arrowstyle="-|>", color="tab:blue", lw=2))
        ax.text(i, 0.32, str(d), fontsize=24, ha="center", va="center", color="tab:blue")
    ax.set_xlim(-0.6, len(s) - 0.4); ax.set_ylim(0.1, 1.4); ax.axis("off")
    ax.set_title("Tokenization：文字 → token id", fontsize=19, fontweight="bold")
    save(fig, "01-tokenization", OUT_DIR_LLM)


def llm_02_next_token() -> None:
    import torch
    import torch.nn as nn
    from torch.nn import functional as F

    from _llm_shared import CORPUS

    _set_cjk()
    torch.manual_seed(0)
    chars = sorted(set(CORPUS)); stoi = {c: i for i, c in enumerate(chars)}; V = len(chars)
    data = torch.tensor([stoi[c] for c in CORPUS])
    table = nn.Embedding(V, V)
    opt = torch.optim.AdamW(table.parameters(), lr=1e-2)
    for _ in range(2000):
        ix = torch.randint(len(data) - 1, (128,))
        loss = F.cross_entropy(table(data[ix]), data[ix + 1])
        opt.zero_grad(); loss.backward(); opt.step()
    probs = F.softmax(table(torch.tensor(stoi["春"])), dim=-1)
    top = torch.topk(probs, 8)
    labels = [chars[i] for i in top.indices.tolist()]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.bar(labels, top.values.detach().numpy(), color="tab:purple")
    ax.set_ylabel("P(next char)")
    ax.set_title("給定「春」，模型預測的下一個字", fontsize=18, fontweight="bold")
    save(fig, "02-next-token", OUT_DIR_LLM)


def llm_03_attention() -> None:
    import torch
    import torch.nn as nn
    from torch.nn import functional as F

    torch.manual_seed(0)
    T, C, hs = 8, 16, 16
    x = torch.randn(1, T, C)
    q, k = nn.Linear(C, hs, bias=False)(x), nn.Linear(C, hs, bias=False)(x)
    att = q @ k.transpose(-2, -1) * hs ** -0.5
    att = att.masked_fill(torch.tril(torch.ones(T, T)) == 0, float("-inf"))
    att = F.softmax(att, dim=-1)[0].detach()
    fig, ax = plt.subplots(figsize=FIGSIZE)
    im = ax.imshow(att, cmap="viridis")
    fig.colorbar(im, ax=ax, label="attention weight")
    ax.set_xlabel("attends to (key position)"); ax.set_ylabel("query position")
    ax.set_title("Causal self-attention weights", fontsize=18, fontweight="bold")
    save(fig, "03-self-attention", OUT_DIR_LLM)


def llm_04_transformer() -> None:
    from matplotlib.patches import FancyArrowPatch, Rectangle

    rows = [("Input embeddings", "tab:gray"),
            ("LayerNorm", "tab:cyan"),
            ("Multi-Head Self-Attention", "tab:red"),
            ("⊕  residual", "tab:gray"),
            ("LayerNorm", "tab:cyan"),
            ("Feed-Forward (MLP)", "tab:green"),
            ("⊕  residual", "tab:gray"),
            ("→ next-token logits", "tab:blue")]
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for i, (label, color) in enumerate(rows):
        y = len(rows) - 1 - i
        ax.add_patch(Rectangle((0, y), 6, 0.62, color=color, alpha=0.75))
        ax.text(3, y + 0.31, label, ha="center", va="center", fontsize=13, color="white", fontweight="bold")
        if i < len(rows) - 1:
            ax.add_patch(FancyArrowPatch((3, y), (3, y - 0.38), arrowstyle="-|>", mutation_scale=14, color="black"))
    ax.set_xlim(-0.5, 6.5); ax.set_ylim(-0.5, len(rows)); ax.axis("off")
    ax.set_title("A Transformer block", fontsize=19, fontweight="bold")
    save(fig, "04-transformer", OUT_DIR_LLM)


def llm_05_train() -> None:
    import torch

    from _llm_shared import CORPUS

    MiniGPT = _load_gpt()
    torch.manual_seed(0)
    chars = sorted(set(CORPUS)); stoi = {c: i for i, c in enumerate(chars)}
    data = torch.tensor([stoi[c] for c in CORPUS]); V = len(chars)
    bs, B = 64, 32
    m = MiniGPT(V, n_embd=128, n_head=4, n_layer=3, block_size=bs)
    opt = torch.optim.AdamW(m.parameters(), lr=3e-4)
    losses = []
    for _ in range(2500):
        ix = torch.randint(len(data) - bs - 1, (B,))
        x = torch.stack([data[i:i + bs] for i in ix]); y = torch.stack([data[i + 1:i + bs + 1] for i in ix])
        _, loss = m(x, y)
        opt.zero_grad(); loss.backward(); opt.step()
        losses.append(loss.item())
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(losses, color="tab:red", alpha=0.8)
    ax.set_xlabel("training step"); ax.set_ylabel("loss")
    ax.set_title("Training a mini GPT from scratch", fontsize=18, fontweight="bold")
    ax.grid(True, alpha=0.3)
    save(fig, "05-train-gpt", OUT_DIR_LLM)


def llm_06_kvcache() -> None:
    n = np.arange(1, 201)
    naive = np.cumsum(n) / np.cumsum(n)[-1]          # 累積成本 ~ O(n²)
    cached = np.cumsum(np.ones_like(n)) / n[-1]      # ~ O(n)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(n, naive, lw=2.4, label="naive  ~ O(n²)", color="tab:red")
    ax.plot(n, cached, lw=2.4, label="with KV cache  ~ O(n)", color="tab:green")
    ax.fill_between(n, cached, naive, alpha=0.12, color="tab:red")
    ax.set_xlabel("tokens generated"); ax.set_ylabel("cumulative compute (relative)")
    ax.legend(fontsize=13)
    ax.set_title("KV cache turns O(n²) generation into O(n)", fontsize=17, fontweight="bold")
    save(fig, "06-kv-cache", OUT_DIR_LLM)


def llm_07_sft() -> None:
    _set_cjk()
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.axis("off")
    ax.text(0.5, 0.9, "SFT：從胡謅到聽懂指令", ha="center", fontsize=20, fontweight="bold", transform=ax.transAxes)
    ax.text(0.5, 0.72, "提示　問：3加4等於 答：", ha="center", fontsize=16, transform=ax.transAxes)
    ax.text(0.06, 0.45, "Base 模型（只會接字）", fontsize=15, color="tab:red", fontweight="bold", transform=ax.transAxes)
    ax.text(0.06, 0.33, "→  盡，唯見長江…（答非所問）", fontsize=16, color="tab:red", transform=ax.transAxes)
    ax.text(0.06, 0.16, "SFT 之後（照指令回答）", fontsize=15, color="tab:green", fontweight="bold", transform=ax.transAxes)
    ax.text(0.06, 0.04, "→  7。", fontsize=16, color="tab:green", transform=ax.transAxes)
    save(fig, "07-sft", OUT_DIR_LLM)


def llm_08_dpo() -> None:
    import copy

    import torch
    import torch.nn.functional as F

    from _llm_shared import CORPUS

    MiniGPT = _load_gpt()
    torch.manual_seed(0)
    pairs = [(a, b) for a in range(10) for b in range(10)]
    instr = "".join(f"問：{a}加{b}等於 答：{a + b}。\n" for a, b in pairs)
    chars = sorted(set(CORPUS + instr)); stoi = {c: i for i, c in enumerate(chars)}; V = len(chars)
    enc = lambda s: [stoi[c] for c in s]
    bs = 48
    idata = torch.tensor(enc(instr))
    policy = MiniGPT(V, n_embd=128, n_head=4, n_layer=3, block_size=bs)
    opt = torch.optim.AdamW(policy.parameters(), lr=3e-4)
    for _ in range(2000):
        ix = torch.randint(len(idata) - bs - 1, (32,))
        x = torch.stack([idata[i:i + bs] for i in ix]); y = torch.stack([idata[i + 1:i + bs + 1] for i in ix])
        _, loss = policy(x, y)
        opt.zero_grad(); loss.backward(); opt.step()
    ref = copy.deepcopy(policy)
    for p in ref.parameters():
        p.requires_grad = False
    prefs = [(f"問：{a}加{b}等於 答：", f"{a + b}。", f"{(a + b + 3) % 19}。")
             for a, b in [(2, 3), (4, 1), (5, 5), (7, 2), (6, 3), (1, 8), (3, 3), (9, 0)]]

    def lp(model, full):
        idx = torch.tensor([enc(full)])
        logits, _ = model(idx[:, :-1])
        return torch.log_softmax(logits, -1).gather(-1, idx[:, 1:].unsqueeze(-1)).squeeze().sum()

    opt = torch.optim.AdamW(policy.parameters(), lr=1e-4)
    margins = []
    for _ in range(60):
        total = 0.0; msum = 0.0
        for pr, ch, rj in prefs:
            pc, prj = lp(policy, pr + ch), lp(policy, pr + rj)
            with torch.no_grad():
                rc, rrj = lp(ref, pr + ch), lp(ref, pr + rj)
            total = total - F.logsigmoid(0.1 * ((pc - rc) - (prj - rrj)))
            msum += (pc - prj).item()
        (total / len(prefs)).backward(); opt.step(); opt.zero_grad()
        margins.append(msum / len(prefs))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.plot(margins, lw=2.6, color="tab:green")
    ax.set_xlabel("DPO step"); ax.set_ylabel("logP(chosen) − logP(rejected)")
    ax.set_title("DPO aligns the model to preferences", fontsize=18, fontweight="bold")
    ax.grid(True, alpha=0.3)
    save(fig, "08-dpo", OUT_DIR_LLM)


# ───────────────────────── agent 軌道（手刻 AI Agent）─────────────────────────
# 概念圖：方框 + 箭頭。預覽圖在本機產（CJK 字型可用），用繁中。

_AC = {
    "blue": "#268bd2", "green": "#859900", "yellow": "#b58900",
    "red": "#dc322f", "cyan": "#2aa198", "gray": "#586e75", "violet": "#6c71c4",
}


def _abox(ax, x, y, w, h, text, fc, tc="white", fs=13, weight="bold"):
    from matplotlib.patches import FancyBboxPatch

    ax.add_patch(FancyBboxPatch(
        (x - w / 2, y - h / 2), w, h,
        boxstyle="round,pad=0.012,rounding_size=0.04",
        fc=fc, ec="none", zorder=2))
    ax.text(x, y, text, ha="center", va="center", color=tc,
            fontsize=fs, fontweight=weight, zorder=3)


def _aarrow(ax, p1, p2, color=None, style="-|>", lw=2.3):
    from matplotlib.patches import FancyArrowPatch

    ax.add_patch(FancyArrowPatch(
        p1, p2, arrowstyle=style, mutation_scale=18, lw=lw,
        color=color or _AC["gray"], zorder=1, shrinkA=2, shrinkB=2))


def _ablank(figsize=FIGSIZE):
    fig, ax = plt.subplots(figsize=figsize)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6.25)
    ax.axis("off")
    return fig, ax


def agent_01_what_is_agent() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.8, "模型的極限，就是工具的起點", ha="center",
            fontsize=20, fontweight="bold", color=_AC["gray"])
    # 左：背過的答得出來
    _abox(ax, 2.6, 4.2, 3.6, 0.9, "問：2 的 10 次方？", _AC["blue"], fs=14)
    _aarrow(ax, (2.6, 3.7), (2.6, 3.0), _AC["green"])
    _abox(ax, 2.6, 2.5, 3.6, 0.9, "1024 √", _AC["green"], fs=15)
    ax.text(2.6, 1.7, "背過 → 答得出來", ha="center", fontsize=13, color=_AC["green"])
    # 右：碰不到的世界只能瞎掰
    _abox(ax, 7.4, 4.2, 3.6, 0.9, "問：現在幾點？", _AC["blue"], fs=14)
    _aarrow(ax, (7.4, 3.7), (7.4, 3.0), _AC["red"])
    _abox(ax, 7.4, 2.5, 3.6, 0.9, "瞎掰一個時間 ×", _AC["red"], fs=15)
    ax.text(7.4, 1.7, "沒有時鐘 → 需要工具", ha="center", fontsize=13, color=_AC["red"])
    ax.text(5, 0.6, "Agent = LLM（推理引擎）＋ 工具 ＋ 迴圈",
            ha="center", fontsize=15, fontweight="bold", color=_AC["violet"])
    save(fig, "01-what-is-agent", OUT_DIR_AGENT)


def agent_02_tool_calling() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.8, "Tool Calling 的本質：結構化文字 ＋ 你寫的解析器",
            ha="center", fontsize=17, fontweight="bold", color=_AC["gray"])
    steps = [
        (1.5, "① 描述工具\n(system prompt)", _AC["gray"]),
        (3.7, "② 模型吐\nAction 文字", _AC["blue"]),
        (6.0, "③ 我們解析\n＋執行 Python", _AC["green"]),
        (8.4, "④ 結果餵回\n→ 最終答案", _AC["violet"]),
    ]
    for x, t, c in steps:
        _abox(ax, x, 3.4, 1.9, 1.3, t, c, fs=12.5)
    for x0, x1 in [(2.45, 2.75), (4.65, 4.95), (6.95, 7.35)]:
        _aarrow(ax, (x0, 3.4), (x1, 3.4))
    ax.text(5, 1.6, "模型永遠只是吐文字；真正碰到時鐘、碰到世界的，是步驟 ③ 你寫的 Python。",
            ha="center", fontsize=13.5, color=_AC["red"])
    save(fig, "02-tool-calling", OUT_DIR_AGENT)


def agent_03_react_loop() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.9, "ReAct 迴圈：Thought → Action → Observation", ha="center",
            fontsize=17, fontweight="bold", color=_AC["gray"])
    rows = [
        ("Thought：我得先知道現在幾點", _AC["yellow"]),
        ("Action：get_current_time()", _AC["blue"]),
        ("Observation：14:00", _AC["cyan"]),
        ("Thought：算到 15:00 的差", _AC["yellow"]),
        ("Action：calculator(\"15-14\")", _AC["blue"]),
        ("Observation：1", _AC["cyan"]),
        ("Final Answer：還有 1 小時", _AC["green"]),
    ]
    y = 5.1
    for i, (t, c) in enumerate(rows):
        _abox(ax, 5, y, 6.6, 0.62, t, c, fs=13)
        if i < len(rows) - 1:
            _aarrow(ax, (5, y - 0.31), (5, y - 0.55))
        y -= 0.74
    save(fig, "03-react-loop", OUT_DIR_AGENT)


def agent_04_tool_routing() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "工具路由：模型自己選，registry 對應到函式",
            ha="center", fontsize=17, fontweight="bold", color=_AC["gray"])
    _abox(ax, 2.1, 3.1, 2.4, 1.1, "模型\n(選哪支)", _AC["violet"], fs=14)
    tools = [
        (5.1, "calculator", _AC["green"]),
        (4.1, "get_time", _AC["green"]),
        (3.1, "word_count", _AC["green"]),
        (1.9, "search", _AC["green"]),
        (0.8, "不存在的工具 ×", _AC["red"]),
    ]
    for y, name, c in tools:
        _aarrow(ax, (3.35, 3.1), (6.4, y), c if c == _AC["red"] else _AC["gray"])
        _abox(ax, 7.7, y, 3.1, 0.62, name, c, fs=12.5)
    ax.text(7.7, 0.05, "錯誤也是 Observation → 模型自我修正",
            ha="center", fontsize=12, color=_AC["red"])
    save(fig, "04-tool-routing", OUT_DIR_AGENT)


def agent_05_memory() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "記憶與 context 管理：太長就摘要，騰出空間",
            ha="center", fontsize=17, fontweight="bold", color=_AC["gray"])
    # context 軌道
    from matplotlib.patches import Rectangle

    ax.add_patch(Rectangle((0.6, 2.6), 8.0, 1.2, fc="#eee8d5", ec=_AC["gray"], lw=1.5, zorder=1))
    ax.text(8.9, 3.2, "context\n上限", ha="center", va="center",
            fontsize=12, color=_AC["red"], fontweight="bold")
    ax.plot([8.62, 8.62], [2.55, 3.85], color=_AC["red"], lw=3, zorder=2)
    # 摘要塊 + 逐字對話塊
    _abox(ax, 1.6, 3.2, 1.6, 0.9, "摘要\n(舊對話)", _AC["violet"], fs=12)
    for i, x in enumerate([3.2, 4.4, 5.6, 6.8, 7.9]):
        _abox(ax, x, 3.2, 1.0, 0.8, f"回合\n{i+1}", _AC["blue"], fs=11)
    _aarrow(ax, (4.0, 1.9), (1.9, 2.7), _AC["violet"])
    ax.text(5.0, 1.6, "舊的逐字對話 → 壓縮成一塊摘要 → 新對話繼續進來",
            ha="center", fontsize=13.5, color=_AC["violet"])
    save(fig, "05-memory", OUT_DIR_AGENT)


def agent_06_rag() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "RAG：先檢索、再 grounding", ha="center",
            fontsize=18, fontweight="bold", color=_AC["gray"])
    # 左：沒 RAG
    ax.text(2.5, 5.0, "沒有 RAG", ha="center", fontsize=14, fontweight="bold", color=_AC["red"])
    _abox(ax, 2.5, 4.1, 3.4, 0.8, "玉山多高？", _AC["blue"], fs=13)
    _aarrow(ax, (2.5, 3.65), (2.5, 3.05), _AC["red"])
    _abox(ax, 2.5, 2.55, 3.4, 0.85, "自信地瞎掰 ×", _AC["red"], fs=13)
    # 右：有 RAG
    ax.text(7.5, 5.0, "有 RAG", ha="center", fontsize=14, fontweight="bold", color=_AC["green"])
    _abox(ax, 7.5, 4.1, 3.4, 0.8, "玉山多高？", _AC["blue"], fs=13)
    _aarrow(ax, (7.5, 3.65), (7.5, 3.25), _AC["cyan"])
    _abox(ax, 7.5, 2.95, 3.4, 0.5, "檢索 2 張卡片", _AC["cyan"], fs=11.5)
    _aarrow(ax, (7.5, 2.68), (7.5, 2.28), _AC["green"])
    _abox(ax, 7.5, 1.95, 3.4, 0.7, "3952 公尺 √ [1]", _AC["green"], fs=13)
    ax.text(5, 0.7, "同一顆模型、同一個問題，差別只在「答之前有沒有先查」。",
            ha="center", fontsize=13.5, color=_AC["gray"])
    save(fig, "06-rag", OUT_DIR_AGENT)


def agent_07_multi_agent() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "多代理：planner 拆 · executor 做 · orchestrator 合",
            ha="center", fontsize=16.5, fontweight="bold", color=_AC["gray"])
    _abox(ax, 5, 4.9, 5.0, 0.8, "複雜任務", _AC["violet"], fs=14)
    xs = [2.2, 5.0, 7.8]
    for i, x in enumerate(xs, 1):
        _aarrow(ax, (5, 4.5), (x, 3.75))
        _abox(ax, x, 3.4, 2.2, 0.75, f"步驟 {i}\n(planner)", _AC["yellow"], fs=12)
        _aarrow(ax, (x, 3.0), (x, 2.45))
        _abox(ax, x, 2.1, 2.2, 0.75, "executor\n(ReAct)", _AC["blue"], fs=12)
        _aarrow(ax, (x, 1.7), (5, 1.15))
    _abox(ax, 5, 0.8, 5.0, 0.75, "彙整 → 最終答案", _AC["green"], fs=14)
    save(fig, "07-multi-agent", OUT_DIR_AGENT)


def agent_08_project() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "完整 agent：所有零件，由 ReAct 迴圈串起來轉動",
            ha="center", fontsize=16.5, fontweight="bold", color=_AC["gray"])
    import numpy as np
    from matplotlib.patches import Circle

    cx, cy = 5, 3.1
    ax.add_patch(Circle((cx, cy), 1.85, fc="none", ec=_AC["cyan"], lw=2.2, ls="--", zorder=1))
    ax.text(cx + 1.55, cy + 1.35, "ReAct 迴圈", fontsize=12, color=_AC["cyan"], fontweight="bold")
    _abox(ax, cx, cy, 2.0, 1.0, "LLM\n引擎", _AC["violet"], fs=14)
    parts = [
        (90, "記憶", _AC["blue"]),
        (162, "工具箱", _AC["green"]),
        (234, "RAG\n知識庫", _AC["yellow"]),
        (306, "規劃器", _AC["red"]),
    ]
    for ang, name, c in parts:
        a = np.deg2rad(ang)
        x, y = cx + 2.9 * np.cos(a), cy + 1.95 * np.sin(a)
        _abox(ax, x, y, 1.7, 0.75, name, c, fs=12.5)
        _aarrow(ax, (cx + 1.0 * np.cos(a), cy + 0.55 * np.sin(a)),
                (x - 0.55 * np.cos(a), y - 0.4 * np.sin(a)), style="<|-|>", lw=1.8)
    save(fig, "08-project", OUT_DIR_AGENT)


# ── rl 軌道：強化學習概念圖（繁中；✓/✗ 在 Heiti TC 缺字，改用 √/×）──

def rl_01_worldview() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.8, "Agent 與 Environment 的試錯迴圈", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    _abox(ax, 2.6, 3.1, 2.9, 1.4, "Agent\n(學策略)", _AC["violet"], fs=15)
    _abox(ax, 7.4, 3.1, 2.9, 1.4, "Environment\n(遊戲／世界)", _AC["green"], fs=15)
    _aarrow(ax, (4.1, 3.7), (5.9, 3.7), _AC["blue"])
    ax.text(5, 4.15, "動作 action", ha="center", fontsize=13.5, color=_AC["blue"])
    _aarrow(ax, (5.9, 2.5), (4.1, 2.5), _AC["yellow"])
    ax.text(5, 1.75, "新狀態 state ＋ 獎勵 reward", ha="center",
            fontsize=13.5, color=_AC["yellow"])
    ax.text(5, 0.7, "目標：最大化長期累積獎勵", ha="center",
            fontsize=15, fontweight="bold", color=_AC["red"])
    save(fig, "01-worldview", OUT_DIR_RL)


def rl_02_q_learning() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "Q-learning：一張表，學會走迷宮", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # FrozenLake 4×4：S 起點、G 終點、H 冰洞，其餘畫學到的策略箭頭
    grid = ["SFFF", "FHFH", "FFFH", "HFFG"]
    policy = ["→↓↓↓", "↓  ↓ ", "→→↓ ", " →→★"]
    cell = 0.92
    gx, gy = 5 - 2 * cell, 4.6
    for r in range(4):
        for c in range(4):
            kind = grid[r][c]
            x, y = gx + c * cell, gy - r * cell
            fc = {"S": "#859900", "G": "#b58900", "H": "#dc322f"}.get(kind, "#073642")
            ax.add_patch(Rectangle((x, y - cell), cell * 0.92, cell * 0.92,
                                   fc=fc, ec="#586e75", lw=1.2, zorder=2))
            label = {"S": "S", "G": "G", "H": "×"}.get(kind, policy[r][c])
            tc = "white" if kind in ("S", "G", "H") else "#93a1a1"
            ax.text(x + cell * 0.46, y - cell * 0.5, label, ha="center", va="center",
                    color=tc, fontsize=16, fontweight="bold", zorder=3)
    ax.text(8.0, 2.6, "Q[狀態,動作]\n挑最大的走", ha="center", fontsize=13,
            color=_AC["violet"], fontweight="bold")
    ax.text(5, 0.55, "× = 冰洞　S = 起點　G = 終點", ha="center",
            fontsize=12.5, color=_AC["gray"])
    save(fig, "02-q-learning", OUT_DIR_RL)


def rl_03_dqn() -> None:
    _set_cjk()
    from matplotlib.patches import Circle, Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "從 Q 表到 DQN：用神經網路逼近 Q", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 左：爆炸的 Q 表
    for i in range(5):
        for j in range(4):
            ax.add_patch(Rectangle((0.7 + j * 0.42, 3.4 - i * 0.34), 0.38, 0.30,
                                   fc="#073642", ec="#586e75", lw=0.8, zorder=2))
    ax.text(1.55, 4.15, "Q 表", ha="center", fontsize=14,
            color=_AC["gray"], fontweight="bold")
    ax.text(1.55, 1.55, "狀態太多 → 列不完 ×", ha="center", fontsize=12.5,
            color=_AC["red"], fontweight="bold")
    _aarrow(ax, (3.3, 3.0), (4.5, 3.0), _AC["blue"])
    # 右：小神經網路
    layers = [(6.2, 3), (7.6, 4), (9.0, 2)]
    pts = []
    for lx, n in layers:
        ys = np.linspace(3.9, 2.1, n)
        pts.append([(lx, y) for y in ys])
        for (x, y) in pts[-1]:
            ax.add_patch(Circle((x, y), 0.16, fc=_AC["cyan"], ec="none", zorder=3))
    for a, b in zip(pts, pts[1:]):
        for (x1, y1) in a:
            for (x2, y2) in b:
                ax.plot([x1, x2], [y1, y2], color="#586e75", lw=0.6, alpha=0.5, zorder=1)
    ax.text(7.6, 4.5, "Q 網路", ha="center", fontsize=14,
            color=_AC["cyan"], fontweight="bold")
    ax.text(7.6, 1.4, "輸入狀態 → 輸出每個動作的 Q 值 √", ha="center",
            fontsize=12.5, color=_AC["green"], fontweight="bold")
    save(fig, "03-dqn", OUT_DIR_RL)


def rl_04_stable_baselines3() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "站在巨人肩上：一行取代整個迴圈", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 左：手刻一堆零件
    ax.text(2.4, 4.6, "手刻", ha="center", fontsize=14,
            color=_AC["gray"], fontweight="bold")
    for i, t in enumerate(["replay buffer", "target network",
                           "epsilon 衰減", "梯度更新迴圈", "..."]):
        ax.add_patch(Rectangle((0.7, 3.9 - i * 0.6), 3.4, 0.46,
                               fc="#073642", ec="#586e75", lw=1.0, zorder=2))
        ax.text(2.4, 4.13 - i * 0.6, t, ha="center", va="center",
                color="#93a1a1", fontsize=12, zorder=3)
    _aarrow(ax, (4.4, 3.0), (5.7, 3.0), _AC["blue"])
    # 右：一行
    _abox(ax, 7.8, 3.4, 4.0, 1.0, "model.learn()", _AC["green"], fs=16)
    ax.text(7.8, 2.4, "PPO / DQN 換一個名字\n就換演算法", ha="center",
            fontsize=12.5, color=_AC["violet"])
    ax.text(5, 0.6, "懂原理(手刻) ＋ 做得快(SB3)，兩個都要會", ha="center",
            fontsize=14, fontweight="bold", color=_AC["red"])
    save(fig, "04-stable-baselines3", OUT_DIR_RL)


def rl_05_policy_gradient() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "策略梯度：直接學一個策略 π(a|s)", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    _abox(ax, 1.9, 3.2, 2.0, 1.0, "狀態 s", _AC["blue"], fs=14)
    _aarrow(ax, (2.95, 3.2), (3.9, 3.2))
    _abox(ax, 5.0, 3.2, 2.0, 1.1, "策略網路\nπ(a|s)", _AC["violet"], fs=14)
    _aarrow(ax, (6.1, 3.2), (7.0, 3.2))
    # 右：動作機率長條
    probs = [0.15, 0.7, 0.15]
    labels = ["左", "右", "停"]
    bx = 7.5
    for i, (p, lb) in enumerate(zip(probs, labels)):
        h = p * 2.4
        col = _AC["green"] if p == max(probs) else "#586e75"
        ax.add_patch(Rectangle((bx + i * 0.62, 2.1), 0.5, h, fc=col, ec="none", zorder=2))
        ax.text(bx + i * 0.62 + 0.25, 2.0, lb, ha="center", va="top",
                fontsize=12, color="#93a1a1")
    ax.text(8.45, 4.85, "動作機率", ha="center", fontsize=12.5,
            color=_AC["green"], fontweight="bold")
    ax.text(5, 0.7, "高報酬的動作 → 機率推高；低報酬 → 壓低", ha="center",
            fontsize=14, fontweight="bold", color=_AC["red"])
    save(fig, "05-policy-gradient", OUT_DIR_RL)


def rl_06_reward_shaping() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "獎勵塑形：把稀疏訊號變稠密", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 上排：原始稀疏
    ax.text(1.5, 4.35, "原始", ha="center", fontsize=13,
            color=_AC["gray"], fontweight="bold")
    cells = [("0", "#586e75"), ("0", "#586e75"), ("0", "#586e75"),
             ("0", "#586e75"), ("+1", "#859900")]
    for i, (t, c) in enumerate(cells):
        ax.add_patch(Rectangle((2.6 + i * 1.1, 4.0), 0.95, 0.7, fc=c, ec="none", zorder=2))
        ax.text(2.6 + i * 1.1 + 0.47, 4.35, t, ha="center", va="center",
                color="white", fontsize=14, fontweight="bold", zorder=3)
    ax.text(8.4, 3.55, "幾乎收不到訊號 → 學不動 ×", ha="right",
            fontsize=12, color=_AC["red"], fontweight="bold")
    # 下排：塑形後稠密
    ax.text(1.5, 2.35, "塑形後", ha="center", fontsize=13,
            color=_AC["gray"], fontweight="bold")
    grad = [("+.1", "#3a5f3a"), ("+.3", "#557a2e"), ("+.5", "#6e8c1f"),
            ("+.7", "#7d9510"), ("+1", "#859900")]
    for i, (t, c) in enumerate(grad):
        ax.add_patch(Rectangle((2.6 + i * 1.1, 2.0), 0.95, 0.7, fc=c, ec="none", zorder=2))
        ax.text(2.6 + i * 1.1 + 0.47, 2.35, t, ha="center", va="center",
                color="white", fontsize=13, fontweight="bold", zorder=3)
    ax.text(8.4, 1.55, "中途就有訊號 → 學得動 √", ha="right",
            fontsize=12, color=_AC["green"], fontweight="bold")
    ax.text(5, 0.6, "wrapper：像洋蔥一層層套在環境外改行為", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["violet"])
    save(fig, "06-reward-shaping", OUT_DIR_RL)


def rl_07_custom_env() -> None:
    _set_cjk()
    from matplotlib.patches import Circle
    fig, ax = _ablank()
    ax.text(5, 5.85, "自訂環境：gym.Env 的五件套", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    cx, cy = 5, 3.0
    ax.add_patch(Circle((cx, cy), 1.95, fc="none", ec=_AC["cyan"], lw=2.0, ls="--", zorder=1))
    _abox(ax, cx, cy, 2.1, 1.0, "CatchEnv\n接水果", _AC["violet"], fs=14)
    parts = [
        (90, "observation\n_space", _AC["blue"]),
        (162, "action\n_space", _AC["blue"]),
        (234, "reset()", _AC["green"]),
        (306, "step()", _AC["green"]),
        (18, "render()", _AC["yellow"]),
    ]
    for ang, name, c in parts:
        a = np.deg2rad(ang)
        x, y = cx + 3.0 * np.cos(a), cy + 2.0 * np.sin(a)
        _abox(ax, x, y, 1.85, 0.8, name, c, fs=11.5)
        _aarrow(ax, (cx + 1.05 * np.cos(a), cy + 0.55 * np.sin(a)),
                (x - 0.6 * np.cos(a), y - 0.42 * np.sin(a)), style="<|-|>", lw=1.7)
    save(fig, "07-custom-env", OUT_DIR_RL)


def rl_08_project() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "端到端：從 Colab 訓練到瀏覽器", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    steps = [
        ("自訂環境\nCatchEnv", _AC["violet"]),
        ("PPO 訓練\n(Colab)", _AC["green"]),
        ("匯出權重\nJSON / TF.js", _AC["yellow"]),
        ("瀏覽器\n即時推論", _AC["blue"]),
    ]
    xs = [1.7, 4.0, 6.3, 8.6]
    for (x, (t, c)) in zip(xs, steps):
        _abox(ax, x, 3.3, 2.0, 1.3, t, c, fs=12.5)
    for x0, x1 in zip(xs, xs[1:]):
        _aarrow(ax, (x0 + 1.05, 3.3), (x1 - 1.05, 3.3))
    ax.text(5, 1.4, "遊戲邏輯只寫一份(TypeScript)，訓練與線上 100% 一致", ha="center",
            fontsize=13, color=_AC["cyan"], fontweight="bold")
    ax.text(5, 0.6, "你手刻的每一塊，都是這條上線流程的縮影", ha="center",
            fontsize=14, fontweight="bold", color=_AC["red"])
    save(fig, "08-project", OUT_DIR_RL)


# ── cv 軌道：電腦視覺概念圖（繁中；避用 emoji/罕見字，缺字改純文字）──

def cv_01_images_as_tensors() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "影像 = [C, H, W] 張量", ha="center",
            fontsize=20, fontweight="bold", color=_AC["gray"])
    for k, (c, name) in enumerate([("#dc322f", "R"), ("#859900", "G"), ("#268bd2", "B")]):
        ox, oy = 1.4 + k * 0.4, 2.5 + k * 0.4
        ax.add_patch(Rectangle((ox, oy), 1.9, 1.9, fc=c, ec="white", lw=2,
                               alpha=0.9, zorder=2 + k))
        ax.text(ox + 0.28, oy + 1.55, name, color="white", fontsize=15,
                fontweight="bold", zorder=10)
    _aarrow(ax, (4.3, 3.4), (5.6, 3.4))
    _abox(ax, 7.0, 3.4, 2.4, 1.0, "張量\n(3, H, W)", _AC["violet"], fs=15)
    ax.text(5, 1.15, "RGB 三通道 × 高 × 寬,每格一個像素值", ha="center",
            fontsize=14, fontweight="bold", color=_AC["cyan"])
    save(fig, "01-images-as-tensors", OUT_DIR_CV)


def cv_02_cnn_cifar() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "CNN：卷積區塊一路濃縮特徵", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    blocks = [
        (1.3, 1.5, "影像\n32²", _AC["blue"]),
        (3.1, 1.25, "conv\n16²", _AC["green"]),
        (4.8, 1.0, "conv\n8²", _AC["green"]),
        (6.3, 0.78, "conv\n4²", _AC["green"]),
        (8.4, 1.3, "分類\n10 類", _AC["violet"]),
    ]
    xs = [b[0] for b in blocks]
    for (x, h, t, c) in blocks:
        _abox(ax, x, 3.1, 1.25, h, t, c, fs=12)
    for x0, x1 in zip(xs, xs[1:]):
        _aarrow(ax, (x0 + 0.65, 3.1), (x1 - 0.65, 3.1))
    ax.text(5.0, 1.5, "每個區塊:Conv → BatchNorm → ReLU → MaxPool", ha="center",
            fontsize=12.5, color=_AC["cyan"])
    ax.text(5, 0.7, "尺寸越縮越小,語意越來越濃", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "02-cnn-cifar", OUT_DIR_CV)


def cv_03_transfer_learning() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "遷移學習：凍結 backbone，只換新頭", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 凍結的 backbone（灰、上鎖）
    ax.add_patch(Rectangle((1.0, 2.4), 5.4, 1.5, fc="#073642", ec=_AC["gray"],
                           lw=2, zorder=2))
    ax.text(3.7, 3.4, "ImageNet 預訓練 backbone", ha="center", va="center",
            color="#93a1a1", fontsize=14, fontweight="bold", zorder=3)
    ax.text(3.7, 2.75, "(凍結 · 不訓練)", ha="center", va="center",
            color=_AC["blue"], fontsize=12, zorder=3)
    _aarrow(ax, (6.5, 3.15), (7.3, 3.15))
    _abox(ax, 8.4, 3.15, 2.2, 1.5, "新分類頭\n(只訓練這個)", _AC["green"], fs=13)
    ax.text(5, 1.3, "借用通用視覺特徵 → 只教它「你的類別叫什麼」", ha="center",
            fontsize=13.5, color=_AC["cyan"], fontweight="bold")
    ax.text(5, 0.6, "又快又準、又省資料——業界做分類的預設起手式", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "03-transfer-learning", OUT_DIR_CV)


def cv_04_data_augmentation() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "資料增強：同一張圖的隨機變體", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    _abox(ax, 2.0, 3.2, 2.1, 1.3, "原圖\n(一隻貓)", _AC["violet"], fs=14)
    variants = [
        (4.7, "隨機裁切", _AC["green"]),
        (3.6, "水平翻轉", _AC["blue"]),
        (2.4, "調亮度/對比", _AC["yellow"]),
        (1.3, "顏色抖動", _AC["cyan"]),
    ]
    for y, t, c in variants:
        _aarrow(ax, (3.1, 3.2), (6.3, y), _AC["gray"])
        _abox(ax, 7.8, y, 3.0, 0.7, t, c, fs=12.5)
    ax.text(5, 0.55, "每個 epoch 看到不同變體 → 被迫學穩健特徵,而非背圖", ha="center",
            fontsize=13, fontweight="bold", color=_AC["red"])
    save(fig, "04-data-augmentation", OUT_DIR_CV)


def cv_05_object_detection() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "物件偵測：是什麼 ＋ 在哪裡", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 場景框
    ax.add_patch(Rectangle((2.4, 1.1), 5.2, 3.5, fc="#073642", ec=_AC["gray"],
                           lw=1.5, zorder=1))
    # 幾個偵測框
    boxes = [
        (3.0, 1.5, 1.6, 1.2, "person 0.94", _AC["green"]),
        (5.0, 2.4, 2.2, 1.5, "bus 0.88", _AC["yellow"]),
        (3.2, 3.2, 1.3, 0.9, "car 0.71", _AC["cyan"]),
    ]
    for (x, y, w, h, lab, c) in boxes:
        ax.add_patch(Rectangle((x, y), w, h, fc="none", ec=c, lw=2.5, zorder=3))
        ax.text(x, y + h + 0.04, lab, color=c, fontsize=11, fontweight="bold", zorder=4)
    ax.text(5, 0.55, "每個物件:邊界框 ＋ 類別 ＋ 信心分數", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "05-object-detection", OUT_DIR_CV)


def cv_06_segmentation() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle, Circle
    fig, ax = _ablank()
    ax.text(5, 5.85, "定位精細度：標籤 → 框 → 像素輪廓", ha="center",
            fontsize=18.5, fontweight="bold", color=_AC["gray"])
    panels = [(1.9, "分類", _AC["blue"]), (5.0, "偵測", _AC["yellow"]), (8.1, "分割", _AC["green"])]
    for (cx, title, c) in panels:
        ax.add_patch(Rectangle((cx - 1.3, 1.6), 2.6, 2.6, fc="#073642",
                               ec=_AC["gray"], lw=1.4, zorder=1))
        ax.text(cx, 4.55, title, ha="center", fontsize=14, color=c, fontweight="bold")
    # 分類:整片一個標籤
    ax.text(1.9, 2.9, "cat", ha="center", va="center", color=_AC["blue"],
            fontsize=15, fontweight="bold", zorder=3)
    # 偵測:一個框
    ax.add_patch(Rectangle((4.3, 2.1), 1.5, 1.6, fc="none", ec=_AC["yellow"], lw=2.5, zorder=3))
    # 分割:像素輪廓（用圓近似貓的輪廓）
    ax.add_patch(Circle((8.1, 2.9), 0.95, fc=_AC["green"], ec="none", alpha=0.55, zorder=3))
    ax.add_patch(Circle((8.1, 3.6), 0.5, fc=_AC["green"], ec="none", alpha=0.55, zorder=3))
    ax.text(5, 0.6, "語意分割(同類合一)　vs　實例分割(同類分個體)", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "06-segmentation", OUT_DIR_CV)


def cv_07_grad_cam() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle, Circle
    fig, ax = _ablank()
    ax.text(5, 5.85, "Grad-CAM：模型到底在看哪裡?", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    # 左：原圖
    ax.add_patch(Rectangle((1.2, 1.7), 3.0, 2.6, fc="#073642", ec=_AC["gray"], lw=1.4, zorder=1))
    ax.text(2.7, 4.05, "原圖", ha="center", fontsize=13, color=_AC["gray"])
    ax.text(2.7, 2.9, "狗", ha="center", va="center", color="#93a1a1",
            fontsize=16, fontweight="bold", zorder=2)
    _aarrow(ax, (4.4, 3.0), (5.5, 3.0))
    # 右：熱力圖
    ax.add_patch(Rectangle((5.8, 1.7), 3.0, 2.6, fc="#073642", ec=_AC["gray"], lw=1.4, zorder=1))
    ax.text(7.3, 4.05, "Grad-CAM 熱力圖", ha="center", fontsize=13, color=_AC["gray"])
    for r, a in [(0.95, 0.25), (0.62, 0.45), (0.32, 0.85)]:
        ax.add_patch(Circle((7.0, 2.85), r, fc=_AC["red"], ec="none", alpha=a, zorder=2))
    ax.text(7.0, 2.85, "看這裡", ha="center", va="center", color="white",
            fontsize=11, fontweight="bold", zorder=3)
    ax.text(5, 0.6, "紅 = 對這個預測貢獻最大的區域(看對地方,還是靠背景瞎猜?)",
            ha="center", fontsize=12.5, fontweight="bold", color=_AC["cyan"])
    save(fig, "07-grad-cam", OUT_DIR_CV)


def cv_08_project() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "端到端：從 Colab 訓練到瀏覽器", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    steps = [
        ("影像資料\n+ 增強", _AC["blue"]),
        ("遷移學習\n訓練(Colab)", _AC["green"]),
        ("匯出\nONNX / TF.js", _AC["yellow"]),
        ("瀏覽器\n即時推論", _AC["violet"]),
    ]
    xs = [1.7, 4.0, 6.3, 8.6]
    for (x, (t, c)) in zip(xs, steps):
        _abox(ax, x, 3.3, 2.0, 1.3, t, c, fs=12.5)
    for x0, x1 in zip(xs, xs[1:]):
        _aarrow(ax, (x0 + 1.05, 3.3), (x1 - 1.05, 3.3))
    ax.text(5, 1.4, "本站 MNIST 手寫辨識就是這樣搬上瀏覽器:不上傳、零延遲", ha="center",
            fontsize=13, color=_AC["cyan"], fontweight="bold")
    ax.text(5, 0.6, "會用預訓練模型、懂遷移學習、能解釋與部署", ha="center",
            fontsize=14, fontweight="bold", color=_AC["red"])
    save(fig, "08-project", OUT_DIR_CV)


# ── ds 軌道：資料科學概念圖（繁中；用真實 Titanic 數字增加說服力）──

def ds_01_workflow() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "資料科學的流程：從問題到結論", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    steps = [
        ("問問題", _AC["red"]), ("取得資料", _AC["blue"]), ("清理", _AC["cyan"]),
        ("探索 EDA", _AC["green"]), ("視覺化", _AC["yellow"]), ("建模", _AC["violet"]),
        ("溝通結論", _AC["red"]),
    ]
    xs = [0.95 + i * 1.35 for i in range(7)]
    for x, (t, c) in zip(xs, steps):
        _abox(ax, x, 3.2, 1.22, 1.5, t, c, fs=11)
    for x0, x1 in zip(xs, xs[1:]):
        _aarrow(ax, (x0 + 0.62, 3.2), (x1 - 0.62, 3.2), lw=1.8)
    ax.text(5, 1.2, "清理 + 探索常佔 80% 時間——不是只有「跑模型」", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["cyan"])
    ax.text(5, 0.55, "用真實 Titanic 資料,回答:誰比較容易生還?", ha="center",
            fontsize=13, color=_AC["gray"])
    save(fig, "01-workflow", OUT_DIR_DS)


def ds_02_data_cleaning() -> None:
    _set_cjk()
    from matplotlib.patches import Rectangle
    fig, ax = _ablank()
    ax.text(5, 5.85, "資料清理：缺失值對症下藥", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    rows = [
        ("deck", 0.77, "缺 77% → 刪欄", _AC["red"]),
        ("age", 0.20, "缺 20% → 補中位數", _AC["yellow"]),
        ("embarked", 0.02, "缺 2% → 補眾數", _AC["green"]),
    ]
    for i, (col, frac, action, c) in enumerate(rows):
        y = 3.9 - i * 0.95
        ax.text(1.6, y, col, ha="right", va="center", fontsize=13,
                color="#93a1a1", fontweight="bold")
        ax.add_patch(Rectangle((1.9, y - 0.22), 3.4, 0.44, fc="#073642",
                               ec="#586e75", lw=1, zorder=1))
        ax.add_patch(Rectangle((1.9, y - 0.22), 3.4 * frac, 0.44, fc=c, ec="none", zorder=2))
        _aarrow(ax, (5.5, y), (6.4, y), c)
        ax.text(6.55, y, action, ha="left", va="center", fontsize=12.5,
                color=c, fontweight="bold")
    ax.text(5, 0.7, "缺太多刪欄、重要的補中位數、少量補眾數——別無腦刪", ha="center",
            fontsize=13, fontweight="bold", color=_AC["cyan"])
    save(fig, "02-data-cleaning", OUT_DIR_DS)


def _bars(ax, x0, vals, labels, color, w=0.5, scale=2.6, base=1.6):
    from matplotlib.patches import Rectangle
    for i, (v, lb) in enumerate(zip(vals, labels)):
        x = x0 + i * (w + 0.32)
        ax.add_patch(Rectangle((x, base), w, v * scale, fc=color, ec="none", zorder=2))
        ax.text(x + w / 2, base + v * scale + 0.12, f"{v:.0%}", ha="center",
                fontsize=10.5, color=color, fontweight="bold")
        ax.text(x + w / 2, base - 0.22, lb, ha="center", va="top", fontsize=11, color="#93a1a1")


def ds_03_eda() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "EDA：groupby 讓資料說話", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    ax.text(2.4, 4.7, "生還率 by 性別", ha="center", fontsize=13,
            color=_AC["violet"], fontweight="bold")
    _bars(ax, 1.3, [0.74, 0.19], ["female", "male"], _AC["violet"])
    ax.text(7.0, 4.7, "生還率 by 艙等", ha="center", fontsize=13,
            color=_AC["green"], fontweight="bold")
    _bars(ax, 5.6, [0.63, 0.47, 0.24], ["1st", "2nd", "3rd"], _AC["green"])
    ax.text(5, 0.6, "「婦孺與富人優先」——在數據裡一覽無遺", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "03-eda", OUT_DIR_DS)


def ds_04_visualization() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "視覺化說故事：數字不會說話,圖會", ha="center",
            fontsize=18.5, fontweight="bold", color=_AC["gray"])
    # 年齡分布雙峰示意(生還 vs 罹難)
    import numpy as _np
    xs = _np.linspace(1.2, 8.8, 200)
    g1 = _np.exp(-((xs - 3.6) ** 2) / 1.6) * 2.3
    g2 = _np.exp(-((xs - 5.8) ** 2) / 2.2) * 1.9
    ax.fill_between(xs, 1.5, 1.5 + g1, color=_AC["green"], alpha=0.55, zorder=2)
    ax.fill_between(xs, 1.5, 1.5 + g2, color=_AC["red"], alpha=0.5, zorder=2)
    ax.plot([1.2, 8.8], [1.5, 1.5], color="#586e75", lw=1.5)
    ax.text(3.6, 4.2, "生還", color=_AC["green"], fontsize=13, fontweight="bold", ha="center")
    ax.text(6.2, 3.7, "罹難", color=_AC["red"], fontsize=13, fontweight="bold", ha="center")
    ax.text(5, 0.95, "age 分布 by 結局", ha="center", fontsize=12, color="#93a1a1")
    ax.text(5, 0.5, "seaborn 一行畫出帶統計意義的圖,讓洞見一眼就懂", ha="center",
            fontsize=13, fontweight="bold", color=_AC["cyan"])
    save(fig, "04-visualization", OUT_DIR_DS)


def ds_05_feature_engineering() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "特徵工程：把欄位變成模型的養分", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    _abox(ax, 1.9, 3.3, 2.2, 1.2, "原始欄位\nsex, sibsp…", _AC["gray"], fs=12)
    items = [
        (4.4, "類別編碼\nfemale → 1", _AC["blue"]),
        (3.3, "衍生特徵\nfamily_size", _AC["green"]),
        (2.2, "數值縮放\nStandardScaler", _AC["yellow"]),
    ]
    for y, t, c in items:
        _aarrow(ax, (3.05, 3.3), (6.0, y), _AC["gray"])
        _abox(ax, 7.5, y, 3.2, 0.78, t, c, fs=11.5)
    ax.text(5, 0.6, "好特徵勝過好模型——領域理解就濃縮在這裡", ha="center",
            fontsize=13.5, fontweight="bold", color=_AC["red"])
    save(fig, "05-feature-engineering", OUT_DIR_DS)


def ds_06_statistical_testing() -> None:
    _set_cjk()
    import numpy as _np
    fig, ax = _ablank()
    ax.text(5, 5.85, "統計檢定：差異是真的,還是運氣?", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    xs = _np.linspace(0.5, 9.5, 240)
    g1 = _np.exp(-((xs - 3.6) ** 2) / 1.1) * 2.4
    g2 = _np.exp(-((xs - 6.2) ** 2) / 1.1) * 2.4
    ax.fill_between(xs, 1.7, 1.7 + g1, color=_AC["red"], alpha=0.5, zorder=2)
    ax.fill_between(xs, 1.7, 1.7 + g2, color=_AC["green"], alpha=0.55, zorder=2)
    ax.plot([0.5, 9.5], [1.7, 1.7], color="#586e75", lw=1.5)
    ax.text(3.6, 4.35, "罹難者票價", color=_AC["red"], fontsize=12, fontweight="bold", ha="center")
    ax.text(6.2, 4.35, "生還者票價", color=_AC["green"], fontsize=12, fontweight="bold", ha="center")
    ax.text(5, 1.05, "p < 0.001", ha="center", fontsize=15, fontweight="bold", color=_AC["violet"])
    ax.text(5, 0.5, "p 值小 → 差異不太可能只是運氣(但「顯著」≠「重要」)", ha="center",
            fontsize=12.5, fontweight="bold", color=_AC["cyan"])
    save(fig, "06-statistical-testing", OUT_DIR_DS)


def ds_07_analysis_to_model() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "從分析到模型：第一個預測器", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    _abox(ax, 2.0, 3.3, 2.4, 1.4, "特徵\npclass, sex,\nage, fare…", _AC["blue"], fs=12)
    _aarrow(ax, (3.25, 3.3), (4.3, 3.3))
    _abox(ax, 5.5, 3.3, 2.0, 1.2, "邏輯迴歸\nfit / predict", _AC["violet"], fs=12.5)
    _aarrow(ax, (6.55, 3.3), (7.6, 3.3))
    _abox(ax, 8.7, 3.85, 1.9, 0.7, "生還 √", _AC["green"], fs=13)
    _abox(ax, 8.7, 2.75, 1.9, 0.7, "罹難 ×", _AC["red"], fs=13)
    ax.text(5, 1.25, "模型係數呼應 EDA:女性正向、艙等負向", ha="center",
            fontsize=13, color=_AC["cyan"], fontweight="bold")
    ax.text(5, 0.6, "分析直覺 ＋ 模型結果互相印證 → 才有信心", ha="center",
            fontsize=13, fontweight="bold", color=_AC["red"])
    save(fig, "07-analysis-to-model", OUT_DIR_DS)


def ds_08_project() -> None:
    _set_cjk()
    fig, ax = _ablank()
    ax.text(5, 5.85, "端到端：一份完整的分析報告", ha="center",
            fontsize=19, fontweight="bold", color=_AC["gray"])
    steps = [("清理", _AC["cyan"]), ("EDA", _AC["green"]), ("特徵", _AC["yellow"]),
             ("隨機森林", _AC["violet"])]
    xs = [1.6, 3.5, 5.4, 7.6]
    for x, (t, c) in zip(xs, steps):
        _abox(ax, x, 4.0, 1.7, 0.95, t, c, fs=12)
    for x0, x1 in zip(xs, xs[1:]):
        _aarrow(ax, (x0 + 0.9, 4.0), (x1 - 0.9, 4.0))
    ax.text(9.2, 4.0, "≈80%\n準確率", ha="center", va="center", fontsize=11.5,
            color=_AC["green"], fontweight="bold")
    from matplotlib.patches import FancyBboxPatch
    ax.add_patch(FancyBboxPatch((1.2, 1.3), 7.6, 1.4,
                                boxstyle="round,pad=0.02,rounding_size=0.06",
                                fc="#073642", ec=_AC["red"], lw=2, zorder=1))
    ax.text(5, 2.0, "結論:生還由「性別、艙等、票價」決定", ha="center", va="center",
            fontsize=14, color="#eee8d5", fontweight="bold", zorder=2)
    ax.text(5, 0.6, "好分析的終點,是一句決策者聽得懂的話 ＋ 證據", ha="center",
            fontsize=13, fontweight="bold", color=_AC["cyan"])
    save(fig, "08-project", OUT_DIR_DS)


if __name__ == "__main__":
    print("產生預覽圖…")
    print("CJK 字型:", _cjk_font())
    lesson_01_basics()
    lesson_02_line_styles()
    lesson_03_plot_zoo()
    lesson_04_subplots()
    lesson_05_axes_ticks()
    lesson_06_style_fonts()
    lesson_07_animation()
    lesson_08_pandas_numpy()
    print("scikit-learn:")
    ml_01_worldview()
    ml_02_classification()
    ml_03_regression()
    ml_04_preprocessing()
    ml_05_evaluation()
    ml_06_unsupervised()
    ml_07_trees()
    ml_08_end_to_end()
    print("完成。")
