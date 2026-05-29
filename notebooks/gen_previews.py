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
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 卡片是 16:10；輸出夠清晰即可
FIGSIZE = (10.24, 6.40)
DPI = 110


def save(fig, slug: str) -> None:
    path = OUT_DIR / f"{slug}.webp"
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


if __name__ == "__main__":
    print("產生預覽圖…")
    print("CJK 字型:", _cjk_font())
    lesson_01_basics()
    lesson_02_line_styles()
    lesson_03_plot_zoo()
    lesson_04_subplots()
    lesson_05_axes_ticks()
    lesson_06_style_fonts()
    print("完成。")
