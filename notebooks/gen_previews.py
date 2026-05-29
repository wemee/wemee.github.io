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
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR_ML.mkdir(parents=True, exist_ok=True)
OUT_DIR_BOOST.mkdir(parents=True, exist_ok=True)

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
