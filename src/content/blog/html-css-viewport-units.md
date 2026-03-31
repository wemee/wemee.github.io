---
title: "HTML, CSS — 相對視窗或螢幕的高度與寬度"
pubDate: 2014-12-09
description: "介紹 CSS 的 vh、vw、vmin 單位，以及如何用 JavaScript 的 screen.width / screen.height 相對螢幕大小設定元素尺寸。"
author: "wemee"
tags: ["html", "css", "javascript", "viewport", "rwd"]
---

> **為什麼這篇文章復活了？**
>
> 這篇文章原本寫於 2014 年，後來隨著舊版 Jekyll 部落格一起封存，URL `/html-css-/` 也就消失了。
> 某天我發現它被 [iT 邦幫忙的文章](https://ithelp.ithome.com.tw/m/articles/10281277)引用，
> 既然有人把它當作參考資料，就讓它繼續活著吧。
>
> 這篇文章有兩個版本：下方的**原始版本**是 2014 年我自己手工寫的，保留原汁原味；
> 上方的**優化版本**則是 2026 年請 AI 重新整理，加入現代瀏覽器支援狀況與更多實用情境。

---

## AI 重寫優化版本

> *此版本由 AI (Claude) 依原文重新整理，補充現代瀏覽器支援資訊與實務情境。*

### CSS Viewport 單位：vh、vw、vmin、vmax

CSS3 提供了一組相對於**瀏覽器視窗（viewport）**的長度單位，讓你不需要 JavaScript 就能做出填滿或比例配置。

| 單位 | 意義 | 範例 |
|------|------|------|
| `vh` | viewport 高度的 1%（即 `100vh` = 視窗全高）| 全螢幕 hero banner |
| `vw` | viewport 寬度的 1% | 流動排版 |
| `vmin` | `vh` 與 `vw` 中較小的那個 | 正方形不超出畫面 |
| `vmax` | `vh` 與 `vw` 中較大的那個 | 背景滿版 |

> **關於瀏覽器支援（2026）**：`vh`、`vw`、`vmin` 現在所有現代瀏覽器都完整支援，包含手機。`vmax` 在 IE 中不支援，但 IE 早已終止，可放心使用。

---

### viewport 與 `100%` 的差異

把 `<html>` 設成 `height: 100%` 和 `height: 100vh` 結果相同——因為 `<html>` 的父層就是 viewport。
但如果你想讓某個**深層的子元素**填滿視窗高度，用 `100vh` 就不需要每一層都宣告 `height: 100%`，省去繁瑣的 CSS 串聯。

```css
/* 舊方式：每一層都要設 */
html, body, .wrapper { height: 100%; }

/* 現代方式：直接用 vh */
.full-page-section {
  height: 100vh;
}
```

---

### 實用範例

**3:7 左右分欄（不超出視窗寬度）**

```html
<body style="margin: 0; padding: 0;">
  <div style="width: 30vw; float: left;">左側欄</div>
  <div style="width: 70vw; float: left;">主內容</div>
</body>
```

**正方形圖片，直/橫屏都最大化不溢出**

```html
<img src="image.jpg" style="width: 100vmin; height: 100vmin;">
```

這是 `vmin` 最典型的應用：不管手機直拿還是橫拿、桌機還是平板，圖片都會以最大尺寸顯示，同時不超出視窗邊界。

---

### 相對螢幕大小（screen vs viewport）

`vh` / `vw` 是相對**瀏覽器視窗**，不是整個螢幕（不含瀏覽器工具列、作業系統工具列）。
若你真的需要相對**整個螢幕**的大小，要用 JavaScript：

```javascript
// 取得螢幕實際尺寸
const screenW = screen.width;   // 整個螢幕寬
const screenH = screen.height;  // 整個螢幕高

// 設定元素為螢幕寬度的 75%（用 jQuery）
$('div').width(screen.width * 0.75);

// 或純 JavaScript
document.querySelector('div').style.width = screen.width * 0.75 + 'px';
```

> **實務建議**：絕大多數情境用 `vw` / `vh` 就夠了，效能更好、不需要 JS。
> `screen.width` 適合特殊場景，例如全螢幕遊戲或需要對應實體解析度的應用。

---

### JavaScript 型別小提醒

`screen.width` 回傳的是數字，可以直接做運算：

```javascript
screen.width * 0.75  // ✅ 正確，回傳數字
'10' * 10            // ✅ JavaScript 自動轉型，回傳 100
```

這點和 Ruby 不同——Ruby 的 `'10' * 10` 會回傳 `"10101010101010101010"`（字串重複），
JavaScript 遇到 `*` 運算子則一律當數字處理。

---

---

## 原始版本

> *以下是 2014 年 12 月的原始文章，保留當時的寫法與語氣。*

---

在[w3school.com](http://www.w3schools.com/)網站，[CSS Units](http://www.w3schools.com/cssref/css_units.asp)有各種與寬度的表示法。

以我使用的頻率來排序：

* `px`：使用螢幕幾個像素（但是還要考慮 Retina 螢幕像素是一般螢幕像素的兩倍）
* `%`：相對父層的大小比例
* `vh`, `vw`：相對於瀏覽器展示網頁區域的大小（不是整個瀏覽器的大小，沒包含瀏覽器的工具列，只有展示網頁的區域）
* `vmin`：`vh`、`vw` 取最小值（另外還有 `vmax` 則是取最大值，但是目前 IE 跟 Safari 不支援）

`px` 與 `%` 很常用，`vh`、`vw` 與 `vmin` 是 CSS3 的新產物，表示相對瀏覽器展示頁面的大小。

---

### 相對視窗大小

這邊先說明，`vh`、`vw` 與 `vmin` 只包含網頁顯示區域的長寬，不包含瀏覽器的工具列。

先從 DOM 的最根本講起好了，一份 HTML 文件，根是 `<html></html>`（雖然沒有嚴格規定，不寫也能顯示），然後這個根的父元件就是瀏覽器的網頁頁面顯示區。

因此，如果對 `<html></html>` 宣告大小是 `100%` 就跟宣告 `100vh` 一樣，因為都是指瀏覽器的網頁頁面顯示區大小。

這個範例是將 html 設定為 `100vh`：

```html
<html style="height: 100vh">
  <head>
    <script src="https://code.jquery.com/jquery-1.11.1.min.js"></script>
    <script type="text/javascript">
      console.log($('html').height());
    </script>
  </head>
</html>
```

這個範例是將 html 設定為 `100%`：

```html
<html style="height: 100%">
  <head>
    <script src="https://code.jquery.com/jquery-1.11.1.min.js"></script>
    <script type="text/javascript">
      console.log($('html').height());
    </script>
  </head>
</html>
```

這兩者在瀏覽器的 console 應該輸出一樣的大小。

如果從 html、body 到 div，這些 tag 都填入 `100%`，則從頭到尾都填滿整個視窗（當然還要注意 body 預設有 padding、margin 佔有一些寬度，要把他們都設為 0，才會真的佔滿全畫面）。

不過現在有 `vh`、`vw`，就不用這麼麻煩了，可以只設定長度為 `100vh`，寬度為 `100vw`，就可以填滿整個畫面（依然得注意 body 預設佔有 padding 跟 margin）。

像下面這樣就能把兩個 div 排在一起，並且以瀏覽器寬度 3:7 的比例，分割成兩個區塊：

```html
<html>
  <head></head>
  <body style="margin: 0; padding: 0;">
    <div style="width: 30vw; float:left;">Left...</div>
    <div style="width: 70vw; float:left;">Right...</div>
  </body>
</html>
```

還有一個問題，以往使用桌上型電腦的螢幕，我們可以預期大部分人的電腦都是寬度大於長度，大部份的人也都是用全螢幕瀏覽網頁。所以我們很信任的將長寬都設定成 `vh` 就可以變成正方形，並且不超過瀏覽器大小。

但是現在手機螢幕，可以拿直的，也可以拿橫的，那要怎麼辦呢？就使用 `vmin` 吧。

譬如我們要顯示一張正方形的圖片，希望以最大張的方式呈現：

```html
<html>
  <head></head>
  <body style="margin: 0; padding: 0;">
    <img src="圖片路徑" style="width: 100vmin; height: 100vmin;">
  </body>
</html>
```

這樣就不怕桌機或手機、螢幕擺直的或橫的，都以最大張、且不會超出瀏覽器範圍來顯示圖片。

---

### 相對螢幕大小

那可不可以相對於使用者整個螢幕的大小？

可以，但是要使用 Javascript 去設定，在 Javascript 裡面直接使用 `screen.height` 與 `screen.width`，就可以取得螢幕大小（關於 `screen` 是什麼？請參考 w3school 的[相關頁面](http://www.w3schools.com/js/js_window_screen.asp)）。

之後再用 DOM 語法，去改你要改的地方。假設你要將所有的 div tag 寬度都隨使用者螢幕寬度改變，這邊使用 jQuery：

```javascript
$('div').width(screen.width);
```

這時候不管使用者怎麼拉動瀏覽器的寬度，所有的 div tag 寬度都等於螢幕寬度。

如果想單純使用 Javascript 的話，語法比較冗長一點，可以參考 w3school 的[頁面](http://www.w3schools.com/jsref/prop_style_height.asp)，注意他傳入的參數後面還要接單位，所以在 `screen.width` 之後記得再加上 `"px"`，之後才當引數傳進去。

回到原本的 jQuery 版本，如果想要 75% 的螢幕大小：

```javascript
$('div').width(screen.width * 0.75);
```

想要 30% 的螢幕大小：

```javascript
$('div').width(screen.width * 0.3);
```

以此類推，我一開始會害怕對 `screen.width` 做數學運算，因為不確定內容是字串還是數字。但是多慮了，Javascript 可以對數字做數學運算，也可以對內容是數字的字串做數學運算：

```javascript
'10' * '10'  // 輸出 100
'10' * 10    // 也輸出 100
```

如果是在 Ruby，則是輸出 `"10101010101010101010"`，所以在 Javascript 裡面，不用怕，內容是數字，就直接對他做數學運算，不用先檢查型別。（若字串內容不是數字，會輸出 `NaN`，Not a Number 的意思）
