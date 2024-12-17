---
layout: splash
title:  "深度學習有辦法學到，依照輸入條件，加總不同的輸入欄位嗎？"
date:   2024-12-17 17:11:11 +0800
categories: "Regression"
tags: []
---
# 深度學習有辦法學到，依照輸入條件，加總不同的輸入欄位嗎？

## 楔子

我本來在做飛機閃子彈的遊戲。想說把最靠近畫面上的n顆子彈與飛機的(相對x,y位置),(子彈x,y速度)，
依序傳給飛機的神經網路當輸入，讓飛機決定要往哪個方向閃躲子彈。

但例外是，當畫面上的子彈數量少於n顆時，神經網路的輸入就會有不足的部分，我就給他補0。結果怎麼訓練都無法收斂。
這時我想到了。應該不能補0，因為0代表相對位置是0，就表示子彈超靠近飛機，跟飛機黏在一起了。
神經網路就是要訓練避開這種狀況，結果我還傳一堆0給他，造成訓練發散。

於是我先想，那應該補多大的數字，代表子彈在超遠的地方，表示沒這顆子彈。那就用整個環境的最大長寬，當作相對位置來輸入好了。
後來覺得神經網路應該要夠聰明，自己知道目前子彈沒有這麼多。所以應該將輸入加一個欄位。代表目前可供輸入的子彈數量。

但我的電腦沒有NVIDIA的顯卡，沒有大模型，可以學到這麼深層的資訊嗎？我很懷疑

## 測試

於是有了以下測試，有4個數字，當作輸入。另外最前面再加個數字，代表輸出將幾個數字相加就好

譬如：2, 0.1, 0.2, 0.4, 0.8 -> 就代表將隨後的兩個數字相加 -> 0.1+0.2 = 0.3

譬如：0, 0.1, 0.2, 0.4, 0.8 -> 就代表所有數字都不相加 -> 0

譬如：4, 0.1, 0.2, 0.4, 0.8 -> 就代表4個數字都要相加 -> 0.1+0.2+0.4+0.8 = 1.5

看看類神經網路有沒有辦法學到，自己辨別要處理幾個數字就好。若測試成功，未來我的飛機AI，也能依樣畫葫蘆，先決定處理幾個子彈輸入即可

## 建立Model

```python
from keras import models, layers
from keras.utils import to_categorical
import tensorflow as tf
import numpy as np

model = models.Sequential([
    layers.Input(shape=(9, )),
    layers.Dense(128, activation='relu'),
    layers.Dense(64, activation='relu'),
    layers.Dense(32, activation='relu'),

    # 最後輸出是一堆-1~1之間的數字相加，所以這邊用tanh，看他能不能學出要還原幾個數字
    layers.Dense(16, activation='tanh'),
    layers.Dense(1),
])
model.compile(loss='mse', optimizer='RMSprop')
model.summary()
```

---
## 測試數據

使用keras的to_categorical將第一個數字轉成類別。比較好辨認出要處理幾個數字就好

```python
N = 2048
x = np.random.randint(0, 5, (N,1))
x = np.hstack((x, np.random.random((N,4))*2-1))
y = []
for arr in x:
    cate = int(arr[0])
    if(cate==0):
        y.append(0)
    else:
        y.append(np.sum(arr[1:(cate+1)]))
y = np.array(y)
x = np.hstack((to_categorical(x[:,0]), x[:, 1:]))
```

---
## 實際訓練

```python
model.fit(x, y, batch_size=32, epochs=16)
```
---
![](/assets/images/dnn_cate_add.png)

## 測試

```python
model.predict(np.array([[
    0, 0, 0, 0, 1, # 全部相加
    -0.5, 0.5, 0.5, 0.5
]]))
# -> array([[1.0212288]], dtype=float32)

model.predict(np.array([[
    0, 0, 0, 0, 1, # 相加前兩個
    -0.5, 0.5, 0.5, 0.5
]]))
# -> array([[-0.06366009]], dtype=float32)

model.predict(np.array([[
    1, 0, 0, 0, 0, # 都不相加
    -0.5, 0.5, 0.5, 0.5
]]))
# -> array([[0.00122787]], dtype=float32)
```

還真的成功了，16個epochs就已經足夠學會，看來沒問題

## 後續

原本想說這不可能訓練成功，所以網路弄的很大。試著把網路縮小，頂多在多幾個epochs訓練看看。
結果其實只要這樣小小的網路，一樣16個epochs就能訓練完成。

```python
model = models.Sequential([
    layers.Input(shape=(9, )),
    # 一層relu讓他做分類
    layers.Dense(32, activation='relu'),

    # 還原回 -1 ~ 1
    layers.Dense(16, activation='tanh'),
    layers.Dense(1),
])
```

類神經網路這裡面的黑盒子，我不可在小覷了

[完整程式碼][code]

[code]: https://github.com/wemee/wemee.github.io/blob/main/codes/dnn_cate_add.ipynb
