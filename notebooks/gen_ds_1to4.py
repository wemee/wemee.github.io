"""產生 ds 軌道 lessons 01–04 的 notebook（資料分析實戰）。

用法：
    notebooks/.venv/bin/python notebooks/gen_ds_1to4.py

比照其他軌道：**無輸出提交**，留 Colab 跑（seaborn 載資料需連網）。
"""

from _ds_shared import INSTALL, LOAD_TITANIC
from _nbgen import build_notebook, code, md

DIR = "ds/data-analysis"


def lesson_01() -> None:
    cells = [
        md(
            """
# 01 · 資料科學的流程：從問題到結論

歡迎來到 **資料科學 → 資料分析實戰**。

這條軌道是整個程式實驗室的**入門坡道**:不需要懂深度學習,只要會一點 Python,就能跟著用**真實資料**做出有洞見的分析。它銜接 `python/matplotlib`(畫圖)與 `ml/scikit-learn`(建模)——把「看懂資料」這段補起來。

## 資料科學的標準流程

> **問問題 → 取得資料 → 清理 → 探索(EDA)→ 視覺化 → 建模 → 溝通結論。**

很多人以為資料科學就是「跑模型」,其實**前面的清理與探索才佔了大部分時間**。這條軌道就照這個流程一課一課走。

我們的資料集是經典的 **Titanic(鐵達尼號乘客名單)**,要回答一個問題:**什麼樣的乘客比較容易生還?**
"""
        ),
        md("## 1. 安裝與載入資料\n\nTitanic 是 seaborn 內建的真實資料集,一行就能載。"),
        code(INSTALL),
        code(LOAD_TITANIC),
        md(
            "## 2. 認識這份資料:形狀、欄位、型別\n\n"
            "`info()` 一次看完:幾筆、幾欄、每欄什麼型別、有沒有缺值。"
        ),
        code(
            '''
df.info()
# 重點先看:哪些欄位 Non-Null 數量 < 891?那就是有缺失值(下一課處理)。
'''
        ),
        md("## 3. 數值欄位的快速摘要\n\n`describe()` 給每個數值欄的平均、標準差、四分位數——一眼抓到分布與離群。"),
        code('df.describe()'),
        md(
            "## 4. 先問一個最關鍵的問題\n\n"
            "整體生還率是多少?這是後面所有分析的**基準線**。"
        ),
        code(
            '''
print(f"整體生還率:{df['survived'].mean():.1%}")
print(f"總人數:{len(df)},生還:{df['survived'].sum()} 人")
'''
        ),
        md(
            """
## 小結

- 資料科學是一條流程:**問題 → 資料 → 清理 → 探索 → 視覺化 → 建模 → 溝通**。
- `df.info()` 看結構與缺值,`df.describe()` 看數值分布。
- 先算出**基準線**(整體生還率 ~38%),後面才知道「某群人特別高/低」是真的有差。

下一課:把資料**清乾淨**——處理缺失值、型別、離群值。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/01-workflow.ipynb")


def lesson_02() -> None:
    cells = [
        md(
            """
# 02 · 資料清理:髒資料變乾淨

> 「資料科學家 80% 的時間在清資料,剩下 20% 在抱怨要清資料。」

這句玩笑話很真實。真實資料總是**有缺失、型別不對、有重複、有離群值**。模型再強,餵髒資料進去也是垃圾進垃圾出。這課把 Titanic 清乾淨。
"""
        ),
        md("## 1. 載入資料"),
        code(INSTALL),
        code(LOAD_TITANIC),
        md("## 2. 找出缺失值\n\n第一步永遠是:每一欄缺幾個?"),
        code(
            '''
missing = df.isna().sum().sort_values(ascending=False)
print(missing[missing > 0])
# deck 缺超多、age 缺一些、embarked/embark_town 缺幾個——各有對策。
'''
        ),
        md(
            "## 3. 對症下藥:刪 vs 補\n\n"
            "- **缺太多**(deck 缺近 7 成):整欄資訊太少,直接刪欄。\n"
            "- **缺一些、且重要**(age):用中位數補(比平均更抗離群)。\n"
            "- **缺很少**(embarked):用最常見值(眾數)補。"
        ),
        code(
            '''
clean = df.copy()
clean = clean.drop(columns=["deck"])                       # 缺太多,刪欄
clean["age"] = clean["age"].fillna(clean["age"].median())  # 中位數補
clean["embarked"] = clean["embarked"].fillna(clean["embarked"].mode()[0])
clean["embark_town"] = clean["embark_town"].fillna(clean["embark_town"].mode()[0])
print("還有缺值嗎?", clean.isna().sum().sum(), "個")
'''
        ),
        md("## 4. 重複值與離群值\n\n重複列直接刪;離群值先用分位數看,別急著刪(它可能是真實的極端)。"),
        code(
            '''
print("重複列:", clean.duplicated().sum(), "筆")
clean = clean.drop_duplicates()

# 票價 fare 的離群:看 99 百分位 vs 最大值
q99 = clean["fare"].quantile(0.99)
print(f"fare 99% 分位 = {q99:.0f},最大值 = {clean['fare'].max():.0f}")
print("→ 有幾個超貴的頭等艙票價。先保留,記住它存在即可。")
'''
        ),
        md(
            """
## 小結

- 清理四件事:**缺失值、型別、重複、離群**。
- 缺失值要**對症下藥**:缺太多刪欄、重要的補中位數、少量的補眾數。
- 離群值別反射性刪掉——先理解它是錯誤還是真實極端。

下一課:資料乾淨了,開始**探索**——找出哪些因素跟生還有關。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/02-data-cleaning.ipynb")


def lesson_03() -> None:
    cells = [
        md(
            """
# 03 · 探索式分析（EDA）：讓資料說話

資料乾淨後,進入最有趣的一步:**EDA(Exploratory Data Analysis)**。目標是**在建模前,先用 groupby、樞紐表、相關係數,把資料裡的規律挖出來**。

回到我們的問題:**什麼樣的乘客比較容易生還?** 這課用 pandas 找答案。
"""
        ),
        md("## 1. 載入並快速清理"),
        code(INSTALL),
        code(
            '''
import pandas as pd
import seaborn as sns

df = sns.load_dataset("titanic")
df["age"] = df["age"].fillna(df["age"].median())
print("整體生還率基準:", round(df["survived"].mean(), 3))
'''
        ),
        md(
            "## 2. groupby:分組看生還率\n\n"
            "「女性生還率比男性高嗎?」——一個 `groupby` 就回答。"
        ),
        code(
            '''
print("依性別:")
print(df.groupby("sex")["survived"].mean(), "\\n")
print("依艙等:")
print(df.groupby("class", observed=True)["survived"].mean())
# 「婦孺優先」是真的:女性生還率遠高於男性;艙等越高生還率越高。
'''
        ),
        md("## 3. 樞紐表:兩個因素一起看\n\n`pivot_table` 把「性別 × 艙等」交叉起來,看交互作用。"),
        code(
            '''
pivot = df.pivot_table(values="survived", index="sex", columns="class",
                       observed=True, aggfunc="mean")
print(pivot.round(2))
# 頭等艙女性生還率接近 1.0;三等艙男性最低——艙等與性別疊加效果很強。
'''
        ),
        md("## 4. 相關係數:數值欄之間的關聯\n\n看哪些數值因素跟生還最相關(正負都看)。"),
        code(
            '''
num = df[["survived", "age", "fare", "pclass", "sibsp", "parch"]]
print(num.corr()["survived"].sort_values(ascending=False).round(3))
# fare 正相關(票貴=艙等高=易生還)、pclass 負相關(數字越大艙等越低)。
'''
        ),
        md(
            """
## 小結

- **EDA 用 groupby / pivot_table / corr** 在建模前先把規律挖出來。
- Titanic 的故事浮現了:**性別(女性高)、艙等(越高越高)、票價**是生還的關鍵因素。
- 相關係數看「數值」關聯;groupby/樞紐表看「類別」差異——兩者互補。

下一課:把這些發現**畫成圖**,讓洞見一眼就懂。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/03-eda.ipynb")


def lesson_04() -> None:
    cells = [
        md(
            """
# 04 · 視覺化說故事

上一課用數字找出了規律,但**數字不會說故事,圖會**。這課把 EDA 的發現畫成圖——一張好圖,能讓不懂資料的人也一眼看懂「誰比較容易生還」。

這課呼應 `python/matplotlib` 軌道,但改用 **seaborn**:它是建在 matplotlib 上的高階繪圖庫,**一行畫出帶統計意義的圖**,特別適合 EDA。
"""
        ),
        md("## 1. 載入與清理"),
        code(INSTALL),
        code(
            '''
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

df = sns.load_dataset("titanic")
df["age"] = df["age"].fillna(df["age"].median())
sns.set_theme(style="whitegrid")
'''
        ),
        md("## 2. 長條圖:生還率怎麼隨性別/艙等變\n\n`barplot` 自動算每組平均並畫誤差棒。"),
        code(
            '''
fig, axes = plt.subplots(1, 2, figsize=(11, 4))
sns.barplot(data=df, x="sex", y="survived", ax=axes[0])
axes[0].set_title("Survival rate by sex")
sns.barplot(data=df, x="class", y="survived", ax=axes[1])
axes[1].set_title("Survival rate by class")
plt.tight_layout(); plt.show()
'''
        ),
        md("## 3. 分布圖:不同結局的年齡分布\n\n用 histogram 疊圖,看生還與罹難者的年齡差異(小孩是否較易生還?)。"),
        code(
            '''
plt.figure(figsize=(8, 4))
sns.histplot(data=df, x="age", hue="survived", bins=30, kde=True, alpha=0.5)
plt.title("Age distribution by survival")
plt.show()
'''
        ),
        md("## 4. 熱力圖:一眼看完所有數值相關\n\n相關矩陣畫成熱力圖,紅藍深淺一目了然。"),
        code(
            '''
num = df[["survived", "age", "fare", "pclass", "sibsp", "parch"]]
plt.figure(figsize=(6.5, 5))
sns.heatmap(num.corr(), annot=True, fmt=".2f", cmap="coolwarm", center=0)
plt.title("Correlation heatmap")
plt.tight_layout(); plt.show()
'''
        ),
        md(
            """
## 小結

- **seaborn 一行畫出帶統計意義的圖**:`barplot`(分組平均)、`histplot`(分布)、`heatmap`(相關)。
- 好的視覺化把 EDA 的數字變成**一眼就懂的故事**——這是溝通結論的關鍵能力。
- 圖內標籤用英文(Colab 免裝中文字型);中文字型設定見 `python/matplotlib` 第 06 課。

下一課:把原始欄位加工成模型更好用的**特徵**(特徵工程)。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/04-visualization.ipynb")


if __name__ == "__main__":
    print("產生 ds lessons 01–04…")
    lesson_01()
    lesson_02()
    lesson_03()
    lesson_04()
    print("完成。")
