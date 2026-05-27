---
title: "QR Code 工具開發筆記：兩個 lib 跟一個全域 paste listener 的陷阱"
pubDate: 2026-05-27
description: "在瀏覽器解碼跟產生 QR Code，加上一個被 Headless UI 的 Tabs 設計引發的全域 paste race condition。用 offsetParent 判斷自己是否真的可見。"
author: "wemee (with AI assistant)"
tags: ["qrcode", "paste", "headlessui", "tabs", "react"]
related: ["/tools/qrcode/"]
---

## 前言

線上 QR Code 解碼跟產生的工具一抓一大把，幾乎每個都會塞滿廣告、要你登入、或偷偷把你的圖片送到後端。這個工具反過來：純瀏覽器、沒帳號、沒追蹤。

實作上靠兩個現成的 lib（一個解碼、一個產生）加 React 的 Tabs 介面。一切看起來都很直覺——除了一個 paste 事件踩到的坑。

## 兩個 lib，兩條路徑

### 解碼：jsQR + canvas

QR Code 解碼的核心是「給我一個圖片，告訴我裡面寫了什麼」。jsQR 的 API 設計極簡——它要的是 RGBA 像素資料加寬高：

```typescript
const code = window.jsQR(imgData.data, imgData.width, imgData.height);
if (code) {
    setResult({
        data: code.data,
        isUrl: /^https?:\/\//i.test(code.data),
    });
}
```

問題是 `imgData.data` 從哪來。瀏覽器沒有「直接從 File 抽 RGBA」的 API，必須繞 canvas：

```typescript
const img = new Image();
img.onload = () => {
    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    // ...送進 jsQR
};
img.src = URL.createObjectURL(file);
```

繞 canvas 是「圖片 → 像素資料」的標準路徑。這個 canvas 不需要被使用者看見，DOM 裡用 `className="hidden"` 藏起來就好。

### 產生：qrcode-generator + 自己畫

qrcode-generator 跟 jsQR 的設計哲學相反——它只給你「QR Code 的格子陣列」，畫圖部分交給你：

```typescript
const qr = window.qrcode(0, errorLevel);  // 0 = 自動選版本
qr.addData(text);
qr.make();

const moduleCount = qr.getModuleCount();
const cellSize = parseInt(size);

const canvas = document.createElement('canvas');
canvas.width = canvas.height = moduleCount * cellSize;
const ctx = canvas.getContext('2d')!;

// 先白底
ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 再畫黑格
ctx.fillStyle = '#000000';
for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
    }
}
```

這種 API 設計乍看煩——明明可以一個 method 解決，為什麼要我自己跑 nested loop？但實際做起來反而有好處：cell size、間距、顏色、邊框我都可以自由控制，lib 不用提供 10 個 option 來蓋所有人的需求。

### 為什麼 lib 用 plain `<script>` 而不是 npm import

兩個 lib 都不是 `npm install` 進來的。看 `index.astro` 結尾：

```astro
<script is:inline src="/tools/qrcode/jsQR.min.js"></script>
<script is:inline src="/tools/qrcode/qrcode-generator.min.js"></script>
```

理由：

- 這兩個 lib **只有 QR Code 頁會用到**。如果走 npm，Astro 不一定能正確拆出來、不被打進共用 bundle。
- 用 `<script>` 標籤確保只在 `/tools/qrcode/` 載入；其他頁面（記事本、id-photo）的首屏不會被拖。
- TypeScript 那邊用 `declare global { interface Window { jsQR: ...; qrcode: ...; } }` 補型別，IDE 還是有自動完成。

代價是這兩個 JS 檔變成「我自己 vendor 進 `public/`」的靜態資源，沒有 npm 的版本管控。對快速產出工具來說這個取捨值得。

## Tabs 跟全域 paste listener 的衝突

這是這篇文章想記的主菜。

工具有兩個 tab：「解碼 QR Code」跟「產生 QR Code」。我希望使用者**在任何地方** Ctrl+V 都能把剪貼簿圖片送進解碼器——焦點不一定要在上傳區。

第一版很直接：

```typescript
// 反例
useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
}, [handlePaste]);
```

實際跑起來怪事：切到「產生 QR Code」tab、輸入網址、按 Ctrl+V 想貼上文字到 textarea——textarea 的內容沒變化，但**右邊的解碼 panel 不知怎麼地出現了一張圖**。

原因要看 Headless UI 的 Tabs 怎麼運作。它**保持兩個 panel 都掛載**，只是把 inactive 的那個設成 `display: none`。這個設計是為了保留 panel 的內部 state（不會在切換 tab 時把表單清空），副作用是：

- 全域 `paste` 事件不知道哪個 panel 是「使用者眼前的那個」
- 兩個 handler 都被觸發
- inactive 的解碼 panel 在背景把圖片吃了

修法是判斷自己是否真的可見：

```typescript
const rootRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
        // offsetParent 在祖先有 display:none 時會是 null
        if (!rootRef.current || rootRef.current.offsetParent === null) return;
        handlePaste(e);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
}, [handlePaste]);
```

`offsetParent` 是 DOM 的老朋友——它的值是「最近的有定位的祖先」，但有個特殊規則：**如果任何祖先有 `display: none`，回傳 `null`**。所以這個檢查能精準分辨「我有沒有被 Headless UI 藏起來」，不需要知道是哪個 tab active。

這個技巧不限 Headless UI——任何用 `display: none` 切換可見性的 UI 框架都會踩到這種 race。Tabs、Modal stack、Accordion 都可能。

## 多種輸入路徑

QR Code 解碼 panel 接受三種輸入，都走同一個 `handleFile`：

```typescript
const handleFile = useCallback((file: File) => { /* ... */ }, []);

// 1. 拖拉
const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
}, [handleFile]);

// 2. 貼上
const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    const items = e.clipboardData?.items;
    const item = Array.from(items).find(i => i.type.startsWith('image/'));
    if (item) {
        const file = item.getAsFile();
        if (file) handleFile(file);
    }
}, [handleFile]);

// 3. 檔案選擇器
<input type="file" accept="image/*"
    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
/>
```

關鍵設計：**三種輸入都「轉成 File」之後再走同一條解碼路徑**。drag / paste / picker 之間的差異全部留在 handler 入口層，下游邏輯只認 `File`。

這是個常忽略的小整潔——一個 tool 只認一種輸入是不夠用的，但維護多條解碼路徑會讓 bug 翻倍。

## 容錯等級跟容量上限

QR Code 有 40 個版本，每個版本對應一個尺寸加四個容錯等級（L / M / Q / H，能容忍 7% / 15% / 25% / 30% 受損）。**容錯等級越高，能塞的資料越少**。

工具讓使用者選等級：

```tsx
<select value={errorLevel} onChange={...}>
    <option value="L">L (7%)</option>
    <option value="M">M (15%)</option>
    <option value="Q">Q (25%)</option>
    <option value="H">H (30%)</option>
</select>
```

容量超標時 qrcode-generator 會 throw。我把錯誤包成人話：

```typescript
try {
    const qr = window.qrcode(0, errorLevel);
    qr.addData(text);
    qr.make();
    // ...
} catch (e) {
    const detail = e instanceof Error ? `（${e.message}）` : '';
    setError(`產生失敗：內容超過容量上限${detail}。試試降低容錯等級或縮短內容`);
}
```

`（${e.message}）` 把原始錯誤帶出來給好奇的人看，主訊息直接告訴使用者「怎麼辦」——降容錯、縮內容。

實用情境：把一個很長的 URL 塞進 QR Code，預設 M 等級會爆，降到 L 通常救得回來。

## URL 自動加「開啟連結」按鈕

小細節但 UX 影響大。解碼結果是字串，但如果看起來像 URL，加一顆按鈕直接打開：

```typescript
setResult({
    data: code.data,
    isUrl: /^https?:\/\//i.test(code.data),
});
```

```tsx
{result.isUrl && (
    <a href={result.data} target="_blank" rel="noopener noreferrer"
        className={buttonStyles.success}>
        🔗 開啟連結
    </a>
)}
```

正則只認 `http(s)://` 開頭。`mailto:`、`tel:`、`magnet:` 都不算——保險起見，這些走「複製文字」就好，不要主動跳協議處理器。

## 沒做、刻意不做

- **批次解碼**：一次餵多張圖。沒人要過。
- **彩色 / Logo QR Code**：要做就要進入 SVG 跟 path 的世界，超出「夠用就好」的範圍。
- **歷史紀錄**：解過的 QR Code 沒存。隱私考量。

## 收尾

這個工具在程式碼層面最有教育意義的是 `offsetParent === null` 那個 Tabs / paste 的 race。其他都是「兩個 lib 的合理使用加一個 canvas 的中介層」，沒有秘密。

但坑就藏在那裡——只要工具長出多個 tab、又用了任何 `display: none` 切換掛載狀態的 UI 元件、又有任何全域事件 listener，就會踩到。記下來給未來的自己。

工具本身在 [/tools/qrcode/](/tools/qrcode/)。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
