---
title: "圖片處理工廠開發筆記：HEIC、TIFF、iPhone 風格 cropper 跟 Tailwind 的 JIT"
pubDate: 2026-05-27
description: "在瀏覽器內解 HEIC 跟 TIFF、用 dynamic import 把解碼器擋在主 bundle 外、iOS Safari 的 file.type 空字串、cropperjs 預設樣式為什麼不能用，跟 Tailwind JIT 對動態 class 的硬性要求。"
author: "wemee (with AI assistant)"
tags: ["image-lab", "heic", "tiff", "tailwind", "cropper", "react"]
related: ["/tools/image-lab/"]
---

## 前言

「我這張照片太大了，IG / 表單 / 學校系統說不能上傳」——這是壓圖工具長期存在的理由。市場上一堆這種工具，但他們普遍有兩個問題：上傳到對方伺服器（隱私），跑不動 iPhone 拍的 HEIC（格式）。

這個工具反過來：純瀏覽器、支援 HEIC 跟 TIFF、輸入輸出格式不設限。實作上最有故事的是「怎麼讓瀏覽器解 iPhone 預設格式」、「cropper 的 iPhone 風格客製化」，跟一個 Tailwind 的微妙陷阱。

## HEIC 跟 TIFF 為什麼瀏覽器不支援

- **HEIC**：iPhone 從 iOS 11 開始的預設格式。**只有 Safari 原生支援**，其他瀏覽器（Chrome、Firefox、Edge）一概看不見。
- **TIFF**：印刷、掃描器、舊系統還在用的格式。**任何瀏覽器都不原生支援**。

但 iPhone 使用者貼上 HEIC、設計師上傳 TIFF 是真實情境。不能直接擋掉。

解法：動態載入 JS 解碼器，在瀏覽器內把這兩個格式轉成原生可讀的格式：

```typescript
// src/lib/image.ts
export async function decodeFile(file: File): Promise<File> {
    const kind = detectNonNativeFormat(file);
    if (!kind) return file;

    if (kind === 'heic') {
        const { heicTo } = await import('heic-to');
        const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
        const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        return new File([blob], newName || 'image.jpg', { type: 'image/jpeg' });
    }

    // TIFF：UTIF 是 CommonJS，要從 default 拿
    const UTIF = (await import('utif')).default;
    const buf = await file.arrayBuffer();
    const ifds = UTIF.decode(buf);
    if (!ifds.length) throw new Error('TIFF 檔案沒有可解析的頁面');
    const page = ifds[0];
    UTIF.decodeImage(buf, page);
    const rgba = UTIF.toRGBA8(page);

    const canvas = document.createElement('canvas');
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext('2d')!;
    const imageData = new ImageData(
        new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
        page.width, page.height,
    );
    ctx.putImageData(imageData, 0, 0);
    // ...toBlob 成 PNG、包成 File 回傳
}
```

兩個關鍵：

- **`await import(...)`**：dynamic import。沒有 HEIC / TIFF 進來時，這兩個解碼器（heic-to 大約 800 KB、utif 大約 100 KB）不會被打進主 bundle。其他工具頁面的首屏完全感受不到它們的存在。
- **轉成 File 物件回傳**：下游的 `URL.createObjectURL`、Image element、cropper 全部都認 File / Blob，所以解碼之後接的人不知道也不關心這檔案原本是 HEIC。

格式選擇也有取捨：

- **HEIC → JPEG，品質 0.92**：HEIC 通常是手機拍的人像，JPEG 是好的中介格式。0.92 是「肉眼幾乎看不出差異」的甜點。
- **TIFF → PNG**：TIFF 常見的用途是有 alpha channel 的素材，PNG 是無損保留的安全選項。

## iOS Safari 的「file.type 是空字串」

第一版的偵測寫法只看 MIME：

```typescript
// 反例
if (file.type === 'image/heic') return 'heic';
```

實測：iOS Safari **偶爾**把 HEIC 的 `file.type` 回傳空字串。不是每次、不是所有版本，但會發生。發生時就是「使用者上傳了 HEIC、被當成未知格式擋掉」。

修法：副檔名 fallback。

```typescript
function detectNonNativeFormat(file: File): 'heic' | 'tiff' | null {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();

    if (type === 'image/heic' || type === 'image/heif'
        || name.endsWith('.heic') || name.endsWith('.heif')) {
        return 'heic';
    }
    if (type === 'image/tiff' || type === 'image/x-tiff'
        || name.endsWith('.tif') || name.endsWith('.tiff')) {
        return 'tiff';
    }
    return null;
}
```

MIME 或副檔名**任一**命中就算。

這個經驗推廣到所有「依賴 MIME」的程式碼：**MIME 是 hint，不是真相**。副檔名同樣不可信，但兩個都查至少能擋掉一邊單獨失效的情況。

## TIFF 只解第一頁

TIFF 是個可以包多頁的容器格式——掃描器產出的多頁文件、CMYK 印刷檔都可能是 multi-page TIFF。但這個工具不是 PDF reader：

```typescript
const ifds = UTIF.decode(buf);
if (!ifds.length) {
    throw new Error('TIFF 檔案沒有可解析的頁面');
}
const page = ifds[0];  // 只解第一頁
UTIF.decodeImage(buf, page);
```

刻意只解 `ifds[0]`。multi-page TIFF 的後續頁面靜默忽略。

理由：

- 90% 的 TIFF 是單頁
- 處理多頁要 UI 出現「選擇頁面」的步驟，但這個工具的設計是「上傳 → 裁切 → 下載」三步走
- 沒人為了 multi-page 抱怨過

寫程式碼有時候是寫「我刻意不做的事」。

## iPhone 風格 cropper：為什麼不用 cropperjs 預設樣式

cropper 用的是 `react-cropper`（包了 cropperjs 的 React wrapper）。但 cropperjs 的預設樣式很 90 年代風：粗虛線、引導線、四個角的拉桿手把、強制顯示縮放級別。在現代 UI 裡看起來像補丁。

iPhone 內建照片 App 的裁切體驗——黑底、四個角的細白線、拖曳區清晰——是大家最熟悉的標準。所以 `iphone-cropper.css` 重寫整個樣式：

```css
/* iphone-cropper.css 節錄 */
.cropper-view-box {
    outline: none;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);  /* 蓋住 view-box 以外的區域 */
}

.cropper-line {
    background-color: transparent;  /* 拿掉預設的中間引導線 */
}

.cropper-point {
    background-color: transparent;
    border-color: #FFFFFF;
    width: 16px;
    height: 16px;
}
```

整份 CSS 有 488 行——但這篇文章不會把它全展開。理由是這種「蓋預設樣式」的 CSS 沒什麼複用價值：每個 lib 的 class 名稱不一樣、每個視覺風格的微調都不一樣。

值得記的原則只有一條：**第三方 UI 元件的 CSS，蓋預設值比寫新樣式重要**。先把預設的醜東西全壓平，再決定要加什麼上去——而不是一邊加新樣式一邊跟預設樣式打架。

## Tailwind JIT 的 dynamic class 陷阱

這個是讓我卡最久的點。

`SmartEditor` 被多個工具復用，需要主題色可設定：blue（圖片處理）、green（證件照）、cyan（其他）。第一版我寫得很直覺：

```tsx
// 反例
function SmartEditor({ accentColor = 'blue' }) {
    return (
        <button className={`bg-accent-${accentColor} hover:bg-accent-${accentColor}/80`}>
            ...
        </button>
    );
}
```

跑起來：按鈕沒有顏色、`hover` 也沒效果。打開 DevTools 看 class 名稱：`bg-accent-green` 是有的——但 generated CSS 裡**根本沒有這條規則**。

原因：**Tailwind JIT 是靜態掃描 source code 來決定要產生哪些 CSS**。`bg-accent-${color}` 這種動態拼接的字串，JIT 看到的是 `bg-accent-` 跟 `${color}`，不會知道實際組合出的字串長什麼樣。所以對應的 CSS 規則一條都不會被產生。

這是 JIT 的固有限制，不是 bug。修法是把所有可能的組合**完整字面字串**寫死：

```typescript
const accentClasses = {
    green: {
        bg: 'bg-accent-green',
        bgSubtle: 'bg-accent-green/10',
        hover: 'hover:bg-accent-green/80',
        border: 'border-accent-green',
        hoverBorder: 'hover:border-accent-green',
        focusBorder: 'focus:border-accent-green',
        text: 'text-accent-green',
    },
    blue: { /* 同上但是 blue */ },
    cyan: { /* 同上但是 cyan */ },
};
const accent = accentClasses[accentColor];

// 用：
<button className={`${accent.bg} ${accent.hover}`}>
```

每個變體都是完整字面字串、JIT 掃得到、CSS 才會被產生。

教訓：**Tailwind 的動態 class 必須在 source code 裡看得到完整字串**。`hover:${color}` / `text-${size}` / `bg-[#${hex}]` 全部都會失效。寫起來很囉嗦，但這是 JIT 的代價，換到的是 bundle size 縮小一個量級。

## JPEG 沒有 alpha → 導出前先填白底

PNG 跟 WebP 支援透明，JPEG 不支援。把透明 PNG 用 JPEG 編碼，alpha 通道會變黑——不是白、是**黑**。這是 canvas 的預設行為。

修法是導出 JPEG 前先把 alpha 攤平到白底：

```typescript
if (finalFormat === 'jpeg') {
    targetCanvas = document.createElement('canvas');
    targetCanvas.width = canvas.width;
    targetCanvas.height = canvas.height;
    const ctx = targetCanvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);  // 先填白底
    ctx.drawImage(canvas, 0, 0);                       // 再畫上原圖
}
```

不能在原本的 canvas 上加白底——cropper 可能會重用這個 canvas。建一個新的 canvas、白底打底、把原圖蓋上去，再 `toBlob` 成 JPEG。

WebP 跟 PNG 不走這條路，因為它們支援 alpha。

## 輸出大小估算的 300ms debounce

工具會即時顯示「預估輸出檔案大小」，讓使用者拖品質滑桿時可以看到變化。實作很直覺：每次設定變動就 `canvas.toBlob` 一次、量大小。

問題：滑桿是連續事件。一次從 100 拖到 50，可能觸發 50 次 `toBlob`——這個操作會跑 JPEG 編碼，1500×1000 的圖大概要 30–80ms。50 次連在一起 CPU 整個熔。

修法是 debounce：

```typescript
useEffect(() => {
    if (!cropperRef.current?.cropper || !outputDimensions) return;

    const timer = setTimeout(async () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas({
            width: outputDimensions.width,
            height: outputDimensions.height,
        });

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, `image/${finalFormat}`, outputQuality / 100);
        });
        if (blob) setEstimatedSize(formatFileSize(blob.size));
    }, 300);

    return () => clearTimeout(timer);
}, [outputDimensions, outputFormat, outputQuality, image]);
```

300ms 是「人類停手」的 sweet spot。比 100ms 短就還是會被連續觸發、比 500ms 長使用者感覺工具反應慢。

順帶一提：這個 `useEffect` 的 cleanup 會 `clearTimeout`。等於每次 deps 變動就重置計時器——這就是 debounce 模式在 hooks 裡的標準寫法，不需要外加 lib。

## 沒做、刻意不做

- **旋轉**：cropperjs 提供 `rotate(90)`，但旋轉之後 crop box 的 aspect ratio 處理會變麻煩，UX 設計沒做好。目前 source 裡有 `TODO: Rotate Button` 的註解。
- **濾鏡 / 調色**：超出「壓圖工具」的範圍。
- **批次處理**：一次處理多張圖。沒人要過。
- **RAW 解碼**：解 .CR2 / .NEF / .ARW 要的 lib 動輒幾 MB，又只服務一小撮人。

## 收尾

這個工具最有故事的部分：

- **HEIC / TIFF 動態解碼**：dynamic import 加 MIME 跟副檔名雙重判斷，把不原生支援的格式打進主流路徑
- **Tailwind JIT 的字面要求**：dynamic class 必須是 source code 裡的完整字串
- **JPEG 攤平 alpha**：一行 `fillRect` 阻擋一個典型的「黑底 JPEG」bug

剩下的（cropper iPhone 化、debounce 估算、HEIC 0.92 品質）是按需求接上去的決定。**這個工具沒有「漂亮的演算法」，全是「碰到的問題的對應補丁」——一個務實工具該有的樣子**。

工具本身在 [/tools/image-lab/](/tools/image-lab/)。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
