"""ds 軌道共用素材。

資料科學軌道很輕(pandas / seaborn / scikit-learn,Colab 全內建),程式多半 inline。
這裡只集中「每課都要的安裝 + 載入 Titanic 資料」字串,注入各 notebook。

用真實公開資料集 **Titanic**(seaborn 內建):有缺失值(age/deck/embarked)、
類別欄(sex/class/embarked)、二元目標(survived),是資料科學教學的經典資料集。
比照其他軌道 **無輸出提交**,留 Colab 跑(seaborn 載資料需連網)。
"""

# Colab 多半已內建,保險起見補裝。
INSTALL = '%pip install -q -U seaborn scikit-learn'

# 載入 Titanic,多課共用的起手式。
LOAD_TITANIC = '''
import pandas as pd
import seaborn as sns

df = sns.load_dataset("titanic")    # 真實公開資料集:鐵達尼號乘客
print("資料形狀:", df.shape)        # (891, 15) = 891 位乘客 × 15 個欄位
df.head()
'''
