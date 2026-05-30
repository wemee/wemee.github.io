"""產生 ds 軌道 lessons 05–08 的 notebook（資料分析實戰）。

用法：
    notebooks/.venv/bin/python notebooks/gen_ds_5to8.py

比照其他軌道：**無輸出提交**，留 Colab 跑。
"""

from _ds_shared import INSTALL
from _nbgen import build_notebook, code, md

DIR = "ds/data-analysis"

# 多課共用：載入並做基本清理（L05–L08 都從乾淨資料出發）。
CLEAN_SRC = '''
import pandas as pd
import seaborn as sns

df = sns.load_dataset("titanic")
df["age"] = df["age"].fillna(df["age"].median())
df["embarked"] = df["embarked"].fillna(df["embarked"].mode()[0])
df = df.drop(columns=["deck"])
print("乾淨資料:", df.shape)
'''


def lesson_05() -> None:
    cells = [
        md(
            """
# 05 · 特徵工程：把原始欄位變成模型的養分

模型不會自己「看懂」原始資料。**特徵工程**就是把原始欄位加工成模型更好吃的形式——這往往比換更厲害的模型還有效。

三件最常見的事:
1. **類別編碼**:`sex="female"` 這種文字,模型看不懂,要轉成數字。
2. **衍生特徵**:從現有欄位算出新的、更有意義的欄位(例如家庭人數)。
3. **數值縮放**:把不同尺度的數值拉到同一範圍。
"""
        ),
        md("## 1. 載入乾淨資料"),
        code(INSTALL),
        code(CLEAN_SRC),
        md(
            "## 2. 類別編碼\n\n"
            "二元類別(sex)直接映射 0/1;多類別(embarked)用 one-hot 展開成多欄。"
        ),
        code(
            '''
feat = df.copy()
feat["sex"] = feat["sex"].map({"male": 0, "female": 1})        # 二元 → 0/1
feat = pd.get_dummies(feat, columns=["embarked"], prefix="emb")  # one-hot
print("編碼後新增的欄位:", [c for c in feat.columns if c.startswith("emb_")])
'''
        ),
        md(
            "## 3. 衍生特徵:創造更有意義的欄位\n\n"
            "`sibsp`(兄弟姊妹/配偶)+ `parch`(父母/子女)+ 自己 = **家庭人數**;"
            "再衍生一個「是否獨自一人」。這種特徵常比原始欄位更能預測生還。"
        ),
        code(
            '''
feat["family_size"] = feat["sibsp"] + feat["parch"] + 1
feat["is_alone"] = (feat["family_size"] == 1).astype(int)
print(feat.groupby("is_alone")["survived"].mean())
# 獨自一人的生還率明顯較低——新特徵抓到了原始欄位沒直接表達的訊號。
'''
        ),
        md("## 4. 數值縮放\n\n`age` 跨 0–80、`fare` 跨 0–500,尺度差很多。`StandardScaler` 把它們標準化到同一基準。"),
        code(
            '''
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
feat[["age", "fare"]] = scaler.fit_transform(feat[["age", "fare"]])
print(feat[["age", "fare"]].describe().round(2).loc[["mean", "std"]])
# 標準化後:平均 ~0、標準差 ~1。許多模型(尤其線性模型)吃這個更穩。
'''
        ),
        md(
            """
## 小結

- **特徵工程三招**:類別編碼(map / one-hot)、衍生特徵、數值縮放。
- **好特徵勝過好模型**:`family_size` / `is_alone` 抓到了原始欄位沒直接講的訊號。
- 縮放讓不同尺度的數值公平比較,線性模型特別需要。

下一課:用**統計檢定**確認「這些差異是真的,還是運氣」。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/05-feature-engineering.ipynb")


def lesson_06() -> None:
    cells = [
        md(
            """
# 06 · 統計檢定：這個差異是真的，還是運氣？

EDA 看到「女性生還率比男性高」,但這會不會只是**抽樣的運氣**?統計檢定就是用來回答這個問題的:

> **假設檢定**先假設「其實沒差」(虛無假設),再算出「如果真的沒差,卻看到這麼大的差異」的機率——這就是 **p 值**。p 值很小(慣例 < 0.05),就有信心說「差異是真的」。

這也是 **A/B test** 的數學基礎:網站改版有沒有真的提升轉換率,用的就是同一套。
"""
        ),
        md("## 1. 載入乾淨資料"),
        code(INSTALL),
        code(CLEAN_SRC),
        md(
            "## 2. t 檢定:生還者與罹難者的票價有差嗎?\n\n"
            "比較兩組**數值**的平均,用獨立樣本 t 檢定。"
        ),
        code(
            '''
from scipy import stats

fare_survived = df[df["survived"] == 1]["fare"]
fare_died = df[df["survived"] == 0]["fare"]
t, p = stats.ttest_ind(fare_survived, fare_died, equal_var=False)
print(f"生還者平均票價 {fare_survived.mean():.1f} vs 罹難者 {fare_died.mean():.1f}")
print(f"t = {t:.2f},  p = {p:.2e}")
print("→ p 遠小於 0.05:票價差異是真的,不是運氣。")
'''
        ),
        md(
            "## 3. 卡方檢定:性別與生還有關聯嗎?\n\n"
            "兩個**類別**變數有沒有關聯,用卡方檢定(看交叉表的實際 vs 期望)。"
        ),
        code(
            '''
table = pd.crosstab(df["sex"], df["survived"])
print("交叉表:"); print(table)
chi2, p, dof, _ = stats.chi2_contingency(table)
print(f"\\nchi2 = {chi2:.1f},  p = {p:.2e}")
print("→ p 極小:性別與生還高度相關,絕非巧合。")
'''
        ),
        md(
            "## 4. p 值的正確心態\n\n"
            "p 值小 = 「差異不太可能只是運氣」,**不等於**「差異很大」或「很重要」。"
            "樣本夠大時,再小的差異 p 值也會很小。**統計顯著 ≠ 實務重要**,兩者要分開看。"
        ),
        code(
            '''
print("檢定告訴你『有沒有差』(顯著性);效果大小告訴你『差多少』(重要性)。")
print("好的分析兩個都報:p 值 + 實際差距。")
'''
        ),
        md(
            """
## 小結

- **假設檢定 + p 值**:判斷觀察到的差異是真的,還是抽樣運氣。
- **t 檢定**比兩組數值平均(票價);**卡方檢定**看兩個類別的關聯(性別 vs 生還)。
- **統計顯著 ≠ 實務重要**:p 值要搭配效果大小一起解讀。這正是 A/B test 的核心邏輯。

下一課:把分析收斂成一個**預測模型**,接上 `ml/scikit-learn`。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/06-statistical-testing.ipynb")


def lesson_07() -> None:
    cells = [
        md(
            """
# 07 · 從分析到模型：第一個預測器

前面六課我們**理解**了資料:誰容易生還、為什麼。最後一步,把理解變成**預測**——訓練一個模型,輸入乘客資料、輸出「會不會生還」。

這課是資料科學與機器學習的**交接點**:用前面清理 + 特徵工程的成果,接上 `ml/scikit-learn` 教過的 `fit` / `predict`,建一個 baseline。
"""
        ),
        md("## 1. 載入、清理、特徵工程(濃縮前幾課)"),
        code(INSTALL),
        code(
            '''
import pandas as pd
import seaborn as sns

df = sns.load_dataset("titanic")
df["age"] = df["age"].fillna(df["age"].median())
df["embarked"] = df["embarked"].fillna(df["embarked"].mode()[0])

df["sex"] = df["sex"].map({"male": 0, "female": 1})
df["family_size"] = df["sibsp"] + df["parch"] + 1
features = ["pclass", "sex", "age", "fare", "family_size"]
X = df[features]
y = df["survived"]
print("特徵:", features)
'''
        ),
        md("## 2. 切訓練/測試集\n\n用測試集評估,才知道模型對**沒看過的人**準不準(避免自我感覺良好)。"),
        code(
            '''
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"訓練 {len(X_train)} 筆、測試 {len(X_test)} 筆")
'''
        ),
        md("## 3. 訓練一個 baseline:邏輯迴歸\n\n分類任務最常見的起手式,簡單、可解釋。"),
        code(
            '''
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)
acc = accuracy_score(y_test, model.predict(X_test))
print(f"測試準確率:{acc:.1%}  (基準線是『全猜死』的 {1 - y.mean():.1%})")
'''
        ),
        md("## 4. 模型在看什麼?看係數\n\n邏輯迴歸的係數方向,呼應我們 EDA 的發現:女性(sex=1)、高艙等強烈正向。"),
        code(
            '''
import pandas as pd

coef = pd.Series(model.coef_[0], index=features).sort_values()
print("特徵係數(正=提高生還機率):")
print(coef.round(3))
# sex 大正值、pclass 負值——模型自己「學到」了我們前面用 EDA 看到的故事。
'''
        ),
        md(
            """
## 小結

- 把清理 + 特徵工程的成果,接上 sklearn 的 `fit` / `predict`,建了第一個生還預測器。
- **訓練/測試切分**才能誠實評估;**準確率**要跟基準線比才有意義。
- 模型係數**呼應 EDA**:性別與艙等是關鍵——分析與建模互相印證。
- 想更準?回 `ml/scikit-learn` 軌道換樹模型、調參、交叉驗證。

下一課(壓軸):把整條流程串成一份**完整分析報告**。
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/07-analysis-to-model.ipynb")


def lesson_08() -> None:
    cells = [
        md(
            """
# 08 · 端到端實戰：一份完整的分析報告

整條軌道的收尾。把**問題 → 資料 → 清理 → EDA → 特徵 → 模型 → 結論**走完整一輪,產出一份能交付的分析。這正是資料科學家的日常產出長相。

**問題:什麼樣的鐵達尼號乘客比較容易生還?能不能預測?**
"""
        ),
        md("## 1. 取得與清理"),
        code(INSTALL),
        code(
            '''
import pandas as pd
import seaborn as sns

df = sns.load_dataset("titanic")
df["age"] = df["age"].fillna(df["age"].median())
df["embarked"] = df["embarked"].fillna(df["embarked"].mode()[0])
df = df.drop(columns=["deck"])
print(f"清理完成:{df.shape[0]} 位乘客,整體生還率 {df['survived'].mean():.1%}")
'''
        ),
        md("## 2. 關鍵發現(EDA 濃縮)"),
        code(
            '''
print("生還率 by 性別:");  print(df.groupby("sex")["survived"].mean().round(2))
print("\\n生還率 by 艙等:"); print(df.groupby("pclass")["survived"].mean().round(2))
'''
        ),
        md("## 3. 特徵工程 + 建模"),
        code(
            '''
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

d = df.copy()
d["sex"] = d["sex"].map({"male": 0, "female": 1})
d["family_size"] = d["sibsp"] + d["parch"] + 1
feats = ["pclass", "sex", "age", "fare", "family_size"]
X_train, X_test, y_train, y_test = train_test_split(
    d[feats], d["survived"], test_size=0.2, random_state=42, stratify=d["survived"]
)
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)
pred = model.predict(X_test)
print(f"準確率:{accuracy_score(y_test, pred):.1%}\\n")
print(classification_report(y_test, pred, target_names=["died", "survived"]))
'''
        ),
        md("## 4. 哪些因素最重要?\n\n隨機森林的特徵重要度,把整份分析收斂成一句話。"),
        code(
            '''
import pandas as pd

importance = pd.Series(model.feature_importances_, index=feats).sort_values(ascending=False)
print("特徵重要度:"); print(importance.round(3))
'''
        ),
        md(
            """
## 5. 結論(這就是要交付的東西)

> **鐵達尼號的生還,主要由「性別、艙等、票價」決定**:女性與高艙等乘客生還率遠高於平均,印證了「婦孺與富人優先」。用這幾個特徵,隨機森林能以約八成準確率預測一位乘客是否生還。

一份好的資料分析,最後一定回到**一句人話的結論** + 支撐它的證據(圖表、檢定、模型)。

## 軌道小結

你走完了資料科學的完整流程:

- **流程與載入**(01)→ **清理**(02)→ **EDA**(03)→ **視覺化**(04)
- **特徵工程**(05)→ **統計檢定**(06)→ **建模**(07)→ **完整報告**(08)

**會清資料、會探索、會說故事、能接上模型**——這就是資料科學家把原始資料變成決策的核心能力。接下來想深入建模,`ml/scikit-learn` 在等你。📈
"""
        ),
    ]
    build_notebook(cells, f"{DIR}/08-project.ipynb")


if __name__ == "__main__":
    print("產生 ds lessons 05–08…")
    lesson_05()
    lesson_06()
    lesson_07()
    lesson_08()
    print("完成。")
