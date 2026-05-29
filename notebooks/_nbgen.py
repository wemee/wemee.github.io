"""程式實驗室 notebook 產生器的共用工具。

每課用一份 (kind, source) 的 cell 清單描述，build_notebook() 組裝成 .ipynb。
產出後再用 nbconvert 執行嵌出輸出（見各 gen_*.py 結尾說明）。

慣例：
- 圖內文字一律英文（Plan A）——讓 Colab 一鍵跑、免裝中文字型；教學中文放網頁 md。
- kernelspec 用 python3，與既有 matplotlib notebook 一致。
"""

from __future__ import annotations

from pathlib import Path

import nbformat
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

ROOT = Path(__file__).resolve().parent.parent


def md(source: str) -> tuple[str, str]:
    """一個 markdown cell。"""
    return ("md", source.strip("\n"))


def code(source: str) -> tuple[str, str]:
    """一個 code cell。"""
    return ("code", source.strip("\n"))


def build_notebook(cells: list[tuple[str, str]], rel_path: str) -> Path:
    """把 cell 清單寫成 notebooks/<rel_path>，回傳絕對路徑。"""
    nb = new_notebook()
    nb.cells = [
        new_markdown_cell(src) if kind == "md" else new_code_cell(src)
        for kind, src in cells
    ]
    nb.metadata = {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {
            "codemirror_mode": {"name": "ipython", "version": 3},
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
            "version": "3.13.12",
        },
    }
    out = ROOT / "notebooks" / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    nbformat.write(nb, out)
    print(f"  ✓ {out.relative_to(ROOT)}")
    return out
