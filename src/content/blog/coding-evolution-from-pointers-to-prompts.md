---
title: "從指標到提示詞：一個老工程師的程式開發滄桑史"
pubDate: 2026-01-12
description: "從 C 語言的指標地獄，到腳本語言的解放，再到 AI 輔助開發的新時代。一個寫了 20 年程式的工程師，回顧那些年我們追過的編譯器錯誤。"
author: "wemee"
image: "/images/blog/coding-evolution.webp"
tags: ["程式開發", "C語言", "Python", "AI", "Claude Code", "回憶錄"]
---

我還記得第一次看到 `Segmentation fault (core dumped)` 時的絕望。

那是二十年前的事了。當時的我，坐在實驗室那台CRT螢幕前，盯著一個找不到的野指標 (Dangling Pointer)，懷疑人生。

如今，我坐在同一個姿勢，只是螢幕換成了 4K，而我正在用自然語言「指揮」AI 幫我寫程式。從 `malloc` 到 `prompt`，這二十年，恍如隔世。

## 石器時代：C 與指標的煉獄

<img src="/images/blog/coding/c-pointer-hell.webp" alt="C 語言指標地獄" class="img-fluid rounded mb-4 shadow" />

```c
char *ptr = (char *)malloc(100 * sizeof(char));
// ... 一百行程式碼後 ...
free(ptr);
// ... 又一百行程式碼後 ...
strcpy(ptr, "Hello");  // 💀 你已經 free 了，兄弟
```

那個年代，寫 C 語言就像是在刀尖上跳舞。

**指標 (Pointer)** 是 C 的靈魂，也是無數工程師的噩夢。你必須親自管理記憶體：自己 `malloc`，自己 `free`，忘了就是 Memory Leak，多 free 一次就是 Double Free，用錯地址就是 Segfault。

更別提那些令人髮指的**靜態型別**宣告：

```c
int (*(*callbacks[10])(int, char *))[5];
// 這是什麼鬼？一個函數指標陣列，每個函數回傳一個指向 int[5] 的指標
// 我寫完自己都看不懂
```

編譯一次要等好幾分鐘。跑起來 crash 了，沒有 stack trace，只有一句冷冰冰的 `core dumped`。

那時候我們說：「會寫 C 的才是真正的工程師。」
現在回頭看，那不過是一種**斯德哥爾摩症候群**。

## 青銅時代：腳本語言的解放

<img src="/images/blog/coding/scripting-freedom.webp" alt="腳本語言的解放" class="img-fluid rounded mb-4 shadow" />

後來，**Python** 和 **Ruby** 開始流行。

第一次用 Python 寫程式時，我整個人是懵的：

```python
# 這樣就行了？不用宣告型別？不用編譯？
numbers = [1, 2, 3, 4, 5]
doubled = [x * 2 for x in numbers]
print(doubled)
```

沒有指標。沒有 `malloc`。沒有標頭檔。沒有 Makefile。

**直譯式語言 (Interpreted Language)** 讓我們從編譯地獄中解脫。**動態型別 (Dynamic Typing)** 讓我們不用再跟編譯器吵架。**垃圾回收 (Garbage Collection)** 讓記憶體管理成為歷史。

生產力爆炸了。以前要寫三天的東西，現在三小時搞定。

我們開始嘲笑那些還在堅持用 C 的老古板：「都什麼年代了，還在手動管理記憶體？」

殊不知，二十年後的年輕人，會用同樣的眼神看著我們手動敲程式碼。

## 白銀時代：語言模型的曙光

<img src="/images/blog/coding/llm-assistant.webp" alt="語言模型輔助開發" class="img-fluid rounded mb-4 shadow" />

大約兩三年前，**ChatGPT** 橫空出世。

我第一次嘗試用它寫程式時，心情很複雜。

```
我：幫我寫一個 Python 函數，計算費波那契數列

ChatGPT：好的，這是一個計算費波那契數列的函數...
```

它真的寫出來了。語法正確，邏輯清晰。

但很快我就發現問題：

- 問它稍微複雜一點的問題，它就開始**一本正經地胡說八道**。
- 給它看專案程式碼，它經常**答非所問**，自顧自地發揮。
- 它寫的程式跑起來會動，但仔細一看，裡面藏著各種**邏輯炸彈**。
- 最可怕的是它的**自信**。錯得離譜，但語氣篤定，像個資深工程師。

那時候的 AI，就像是一個剛畢業的實習生：熱情洋溢，基本功還行，但你不能真的把專案交給他。

你只能把它當成一個**高級 Stack Overflow**。問個片段、查個語法、產生個樣板。省了一些時間，但距離「取代工程師」還差得遠。

## 黃金時代：Agentic AI 與 Claude Code

<img src="/images/blog/coding/agentic-collaboration.webp" alt="AI 協作開發" class="img-fluid rounded mb-4 shadow" />

然後，**Claude Code** 出現了。

第一次把整個專案資料夾交給它時，我是帶著懷疑的。
「你能看懂這坨義大利麵嗎？」

結果它不只看懂了，還幫我重構、抓 bug、補測試。

現在我的開發流程變成這樣：

1. **我描述需求**：「我要做一個向量內積的視覺化工具」
2. **Claude Code 完成 90% 架構**：它讀取專案結構，理解既有的 coding style，然後生出整個功能的骨幹。
3. **我指出問題，它修到 99%**：「這邊的角度計算有 bug」「這個 HTML 結構不對」，它就去改。
4. **最後 1% 由我完成**：一些只有人類才懂的 edge case、一些審美上的微調。

這不是在「用 AI 寫程式」，這是在**協作**。

我從「寫程式的人」，變成了「審程式的人」。

## 感慨：二十年的風華

有時候我會想，如果二十年前就有 Claude Code，我的人生會不會不一樣？

那些在實驗室裡 debug 到凌晨的夜晚。
那些為了一個 Segfault 翻遍整個 codebase 的週末。
那些跟編譯器錯誤訊息大眼瞪小眼的午後。

這些經歷塑造了我，讓我理解電腦底層的運作，讓我學會了耐心和細膩。

但說實話，如果可以選擇，我寧願把那些時間拿去陪家人、看書、或者發呆。

**工具進步的意義，就是讓人類把時間花在更值得的事情上。**

---

現在的年輕工程師，可能永遠不需要理解什麼是指標，不需要知道 `malloc` 和 `free` 的配對，不需要經歷 `Segmentation fault` 的絕望。

這是好事。

就像我們不需要會生火才能煮飯，不需要會騎馬才能出門。

科技的意義，就是把過去的苦難，變成歷史課本裡的一頁。

而我這個老工程師，就負責在旁邊碎碎念：「想當年啊...」

---

*從指標到提示詞，從 `malloc` 到 `prompt`，從編譯錯誤到對話框。*
*二十年了，滄海桑田，不過如此。*
