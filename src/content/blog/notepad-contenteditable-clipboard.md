---
title: "快速記事本開發筆記（上）：contentEditable 與剪貼簿的三條軌道"
pubDate: 2026-05-27
description: "做一個免登入的線上記事本，前端三個非顯而易見的決定：為什麼用 contentEditable、為什麼剪貼簿要分三條軌道、為什麼背景色無論如何都要剝掉。"
author: "wemee (with AI assistant)"
tags: ["notepad", "contenteditable", "clipboard", "react", "web-api"]
related: ["/tools/notepad/"]
---

## 前言

這個工具的設計目標只有三句話：免登入、離線可用、資料只留本機。

聽起來很單純，但實作上每一個非顯而易見的決定，幾乎都來自這三句話的副作用：

- 「不能上傳」逼著我把存圖也塞進瀏覽器，連帶決定了用 IndexedDB 而不是 localStorage。
- 「打開就能寫」逼著我接受 `contentEditable` 的全部毛病，因為任何重一點的編輯器框架都會讓首屏變慢。
- 「想直接貼截圖」連帶讓剪貼簿的處理變成這篇文章的主菜。

這篇是上篇，重點放在編輯器與剪貼簿。下篇會講儲存層裡的兩個 race condition。

## 技術選型（很短）

- **React 19 + Astro island**：頁面其他地方是純 Astro，記事本這塊用 island 包起來。整個工具就一個元件、一份 state，不需要 store。
- **IndexedDB（不是 localStorage）**：因為要存貼上來的圖片 base64，localStorage 5 MB 上限不夠用，而且 IndexedDB 的非同步 API 加索引在這裡更自然——sidebar 依 `updatedAt` 倒序就直接靠 index。
- **`contentEditable`（不是 Tiptap / Quill / Lexical）**：這個決定的代價最大，但 bundle 體積、首屏速度、貼圖支援、跟 React 的協作四件事權衡完，原生 `contentEditable` 贏了。代價是你接下來會看到的一堆坑。
- **不裝 DOMPurify**：要 strip 的東西非常侷限——就是把外部來源的 inline `color`、`background`、`font` 全拔掉。手寫 9 行函式比拉一個 sanitize 函式庫合理。

## 剪貼簿的三條軌道

先講最有故事的部分。

### 一個 bug 開場

第一版做完當天我用 Google Sheets 複製一段儲存格貼進來，整段文字當場「消失」。

原因很白：Sheets 的 HTML 帶 inline `color: rgb(0,0,0)`，記事本用的是深色主題，黑字打在深底色上等於不可見。

修法看起來只有一條：**所有外部來源貼進來，一律把 inline style 剝掉**。

```typescript
// src/lib/notepad/clipboard.ts
export function sanitizePastedHtml(html: string): string {
    const container = document.createElement('div');
    container.innerHTML = html;

    container
        .querySelectorAll('style, link, script, meta')
        .forEach((el) => el.remove());

    container
        .querySelectorAll<HTMLElement>('*')
        .forEach((el) => stripAllStyling(el));

    return container.innerHTML;
}
```

保留 `<p>`、`<br>`、`<strong>`、`<ul>`、`<table>`、`<img>` 這些語意標籤跟 `<img src>` 這類結構屬性；inline `style` 屬性跟 `class` 全砍。對「快速記事」這個情境綽綽有餘。

### 但複製出去的情境又不一樣

剝樣式對「貼進來」是對的，但對「複製出去」就太霸道了：使用者複製一段筆記去貼到 Slack，會希望粗體還在。所以複製方向反而要保留樣式，但有兩個例外：

1. **背景色無論如何都要剝**。深色主題的背景貼到別人那邊幾乎一定刺眼。
2. **使用者要有「我這次就要純文字」的能力**。

於是出現一個切換鈕（帶樣式 / 純文字），預設帶樣式。實作上很單純：

```typescript
export function sanitizeFragmentToHtml(
    fragment: DocumentFragment,
    keepStyles: boolean
): string {
    const container = document.createElement('div');
    container.appendChild(fragment.cloneNode(true));

    const elements = container.querySelectorAll<HTMLElement>('*');
    elements.forEach((el) => {
        if (keepStyles) {
            stripBackground(el);
        } else {
            stripAllStyling(el);
        }
    });

    return container.innerHTML;
}
```

但 `stripBackground` 不是一行 `removeProperty('background')` 能搞定的。我最後寫成這樣：

```typescript
const BACKGROUND_PROPS = [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'background-attachment',
] as const;

export function stripBackground(el: HTMLElement): void {
    for (const prop of BACKGROUND_PROPS) {
        el.style.removeProperty(prop);
    }
}
```

為什麼要列全部 longhand？兩個原因：

1. 某些 CSS 引擎（包括寫測試會用到的 jsdom）在 `removeProperty('background')` 後會留下 longhand 殘渣，下次序列化還是會把背景色寫回 HTML。
2. 真實瀏覽器這樣寫是 no-op cost，但能讓單元測試在 jsdom 環境穩定通過——這個工具的剪貼簿邏輯有單元測試覆蓋，jsdom 行為直接影響可不可測。

### 第三軌：image/png

到這裡其實已經能用了，但我自己在用的時候踩到另一個情境：在記事本選中一張剛貼進來的截圖，按 Ctrl+C，跑去 Figma 按 Ctrl+V——什麼都沒進來。

原因是 Figma 不讀 `text/html`，它只認 `image/png`。瀏覽器原生的 copy 行為不會幫你產生 `image/png`，必須自己寫。

於是我在 `onCopy` 裡偵測「這次選取是不是只有單張圖」，是的話就額外往剪貼簿寫一份 PNG：

```typescript
const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const plainText = selection.toString();
    const html = sanitizeFragmentToHtml(fragment, keepStylesRef.current);
    const soleImage = findSoleImage(fragment);

    e.preventDefault();
    e.clipboardData.setData('text/plain', plainText);
    e.clipboardData.setData('text/html', html);

    if (soleImage) {
        void writeImageToClipboard(soleImage);
    }
}, []);
```

`findSoleImage` 的判斷很保守——片段裡只有一個 `<img>` 且沒有其他可見文字才算。混合內容時 `image/png` 會干擾貼到 Slack 或 Notion 之類的目的地，寧可少給也不能多給。

實際寫 PNG 的部分有個小細節：`ClipboardItem` 跨瀏覽器穩定支援的只有 `image/png`，原始 blob 如果是 webp 或 jpeg 必須先轉碼，否則 Safari 跟 Firefox 會默默吃掉：

```typescript
export async function reencodeAsPng(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('canvas.toBlob returned null'));
        }, 'image/png');
    });
}
```

繞 canvas 一圈是必要的「醜」做法。

### 三條軌道的總結

| 方向 | text/plain | text/html | image/png |
|------|-----------|-----------|-----------|
| 貼進來 | 直接接 | sanitize（強制剝樣式） | 走瀏覽器原生路徑 |
| 複製出去 | `selection.toString()` | 依切換鈕決定剝多少；背景色一律剝 | 單張圖選取時額外寫一份 |

寫成表格之後看起來簡單，但這個模型是被三四個現實場景逼出來的，不是一開始想好的。

## contentEditable 的幾個經典坑

選了 `contentEditable` 就要付學費。下面是這個工具實際付過的幾筆。

### 「空」是模糊概念

我一開始的 placeholder 邏輯是 `if (editor.innerHTML === '') showPlaceholder()`。

不行。使用者把所有字刪光之後，`contentEditable` 留下的東西可能是 `<br>`、`<div><br></div>`、空的 `<p>`，每個瀏覽器口味還不太一樣。

最後寫成這樣：

```typescript
function isEditorEmpty(html: string | undefined): boolean {
    if (!html) return true;
    const stripped = html
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<div>\s*<\/div>/gi, '')
        .trim();
    return stripped === '';
}
```

這不是優雅的解法，但它是務實的解法。`contentEditable` 沒有「我是空的」事件，只能事後從 HTML 字串裡推測。

### Placeholder overlay 不能從 ref 推導

第二個坑更隱晦：我把 placeholder 做成一層絕對定位的 overlay，靠 `isEmpty` 決定要不要顯示。

我以為可以這樣寫：

```typescript
// 反例
function Editor() {
    const editorRef = useRef<HTMLDivElement>(null);
    const isEmpty = isEditorEmpty(editorRef.current?.innerHTML); // ← 錯
    return (
        <>
            <div ref={editorRef} contentEditable />
            {isEmpty && <div className="placeholder">...</div>}
        </>
    );
}
```

實際跑起來：使用者打了第一個字之後，placeholder 還是壓在文字上面，大概一秒之後（自動儲存的 debounce 觸發 `setState` 那一刻）才消失。

原因很標準但我當下沒意識到：**ref 不會觸發 re-render**。在 render 函式裡讀 `ref.current` 拿到的是「上次 render 那一刻的 DOM」，下一次必須要有別的東西觸發 re-render，這個值才會被重算。

修法是把 `isEmpty` 拉成獨立的 state，輸入事件裡同步更新：

```typescript
const [isEmpty, setIsEmpty] = useState<boolean>(true);

const handleEditorInput = useCallback(() => {
    setIsEmpty(isEditorEmpty(editorRef.current?.innerHTML));
    // ...debounce auto-save
}, [performSave]);
```

教訓：**任何要驅動 UI 的「派生狀態」，都要走 state，不能走 ref**。Ref 適合放「我會自己讀但不影響畫面」的東西——下篇會講到的 `lastSavedContentRef` 就是這種角色。

### 還在用 execCommand

`document.execCommand` 在 MDN 上是一個大大的紅色「Deprecated」標籤。我每次貼上的時候還在用它：

```typescript
document.execCommand(html ? 'insertHTML' : 'insertText', false, payload);
```

知道它 deprecated 還用，理由只有一個：**它是目前唯一能讓 `contentEditable` 的原生還原堆疊（undo stack）繼續運作的 API**。如果改用 `range.insertNode()` 或 `selection.deleteFromDocument()`，瀏覽器內建的 Ctrl+Z 就會跳過這次貼上，使用者按一次還原是把貼上之前的字也吃掉。

替代方案不是沒有——自己接管整個 undo 堆疊。但代價是要重寫 history、處理選取、處理 IME 組字事件，一個快速記事本不值得這麼搞。所以這裡選擇了務實派：

> deprecated 不等於不能用，等到瀏覽器真的拿掉之前，這就是最便宜的路徑。

### 貼上時的分流

最後一個小細節：貼上事件裡，圖片走原生、文字走 sanitize：

```typescript
const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const dt = e.clipboardData;

    // 截圖：交給瀏覽器原生處理，<img> 會被自動插進來
    for (let i = 0; i < dt.items.length; i++) {
        if (dt.items[i].kind === 'file' && dt.items[i].type.startsWith('image/')) {
            return;
        }
    }

    const html = dt.getData('text/html');
    const text = dt.getData('text/plain');
    if (!html && !text) return;

    e.preventDefault();
    const payload = html ? sanitizePastedHtml(html) : text;
    document.execCommand(html ? 'insertHTML' : 'insertText', false, payload);
    handleEditorInput();
}, [handleEditorInput]);
```

為什麼圖片要走原生：自己處理 base64 → blob → `insertNode` 又會踩到上面說的 undo 堆疊問題，而且瀏覽器原生的截圖貼上已經做得很好（自動轉 data URL、自動加 `<img>`），沒理由重做一次。

## 為什麼還沒換掉 contentEditable

每寫到一段「明明知道不對但只能這樣」的程式碼，都會冒出一個念頭：要不要乾脆換 Tiptap 算了。

最後沒換，理由：

- 這個工具的 UI 核心程式碼總共 ~500 行，純邏輯 ~150 行。換成 Tiptap 之後光是核心 bundle 就要加 ~60 KB，整體體積翻倍以上。
- 真正會痛的功能（粗體、列表、表格）目前都還沒做進來。換編輯器是為了那些功能，不是為了現在這版。
- 真的需要做的時候再換，反正 sanitize 跟 clipboard 那一層已經抽出來（下篇會講），跟編輯器解耦。

換句話說：**`contentEditable` 不是好選擇，它只是現在最便宜的選擇**。這個判斷哪天會翻轉，但今天還不會。

---

下篇會接著講儲存層的兩件事：

- 自動儲存的 debounce 為什麼會讓 sidebar 順序亂跳
- 一個 1 秒的競態怎麼把「剛刪掉的筆記」寫回去

也會講為什麼把純剪貼簿邏輯抽到獨立檔案，以及可測試性的決定。

工具本身在 [/tools/notepad/](/tools/notepad/) 可以直接用。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
