---
title: "省錢證件照開發筆記：cm、DPI 跟一個元件的兩種角色"
pubDate: 2026-05-27
description: "公制尺寸到像素的換算、Math.floor 排版置中、刻意保留的重複程式碼，跟一個 cropper 元件怎麼透過 outputMode 同時服務「下載」跟「丟回父元件」兩種完全不同的工具。"
author: "wemee (with AI assistant)"
tags: ["id-photo", "canvas", "dpi", "react", "component-reuse"]
related: ["/tools/id-photo/"]
---

## 前言

實體照相館洗一組大頭照大概要 100–300 塊。但超商列印一張 4x6 只要 6–10 塊——而一張 4x6 可以塞 8 張 2 吋大頭照。

差距就是這個工具的存在理由：在瀏覽器內幫你裁好、排好，丟到超商照片機印一張 4x6，搞定。沒有照相館、沒有 App、沒有伺服器。

技術上沒有特別新穎，但有兩個值得記的點：**從 cm 到像素的換算**，跟**一個 cropper 元件怎麼被兩種工具共用**。

## 動機與商業常識

工具最上面有這段文案：

> 一張 4x6 可以印 8 張 2 吋大頭照，花費不到 10 塊錢。

這不是技術問題，是「為什麼這個工具該存在」的核心。如果使用者不知道「自己排版去超商印」這條路，工具寫得再漂亮也沒人用。

工具的第一張卡片不是上傳區，是這段告訴使用者：你可以省錢。

技術文章我通常不寫 UX——但這次例外：**工具的存在意義要先被理解，技術才有舞台**。

## cm 到像素：印刷品最不直覺的單位轉換

證件照尺寸都用公制：

```typescript
const PHOTO_SIZES = {
    '2inch':      { width: 3.5, height: 4.5, name: '2吋 (身分證/護照)' },
    '1inch':      { width: 2.5, height: 3.0, name: '1吋 (駕照/執照)' },
    '2inch-half': { width: 3.5, height: 5.0, name: '2吋半身 (履歷)' },
} as const;
```

順帶一提：**台灣的「2 吋照片」實際尺寸是 3.5cm × 4.5cm**，不是 5.08cm × 5.08cm（真正的 2 inch）。這是日治時期沿用下來的便宜稱呼，跟英制單位的 2 inch 沒關係。用「2 吋」這個習慣詞做標籤，內部用公制計算才對。

紙張也一樣：

```typescript
const PAPER_SIZES = {
    '4x6': { width: 15.2, height: 10.2, name: '4×6 (超商沖印)' },
    'a4':  { width: 29.7, height: 21.0, name: 'A4 (家用印表機)' },
} as const;
```

但畫到 canvas 要的是像素。中間透過 DPI 換算：

```typescript
const DPI = 300;
const CM_TO_INCH = 0.393701;

function cmToPixels(cm: number): number {
    return Math.round(cm * CM_TO_INCH * DPI);
}
```

300 DPI 是印刷標準。低於 300 印出來會看到顆粒，超過 300 對輸出沒有實質好處（人眼極限大約落在這附近）。一張 4x6 換算下來是 1800 × 1200 pixels——這就是下載的全解析度檔的大小。

## 排版演算法：簡單到不像演算法

```typescript
const calculateLayout = useCallback((): LayoutInfo => {
    const photo = PHOTO_SIZES[photoSize];
    const paper = PAPER_SIZES[paperSize];
    const gap = 0.2;  // cm

    const cols = Math.floor(paper.width / (photo.width + gap));
    const rows = Math.floor(paper.height / (photo.height + gap));

    return {
        cols, rows, total: cols * rows,
        photoWidth: cmToPixels(photo.width),
        photoHeight: cmToPixels(photo.height),
        paperWidth: cmToPixels(paper.width),
        paperHeight: cmToPixels(paper.height),
        gapPixels: cmToPixels(gap),
    };
}, [photoSize, paperSize]);
```

`gap = 0.2cm` 是裁切時剪刀的容錯，不是視覺間距。實際剪下來每張照片邊緣會有 1mm 的白邊，這個 gap 是給你「下刀的空間」。

`Math.floor` 是關鍵：寧可少印一張，也不要超出紙張邊緣。例如 4×6 紙塞 2 吋照片，計算是 `floor(15.2 / 3.7) = 4` 欄、`floor(10.2 / 4.7) = 2` 列——剛好 8 張。改紙張或改照片尺寸這個演算法都一樣，不用特例。

置中靠的也是這個：

```typescript
const totalPhotosWidth =
    layout.cols * layout.photoWidth + (layout.cols - 1) * layout.gapPixels;
const totalPhotosHeight =
    layout.rows * layout.photoHeight + (layout.rows - 1) * layout.gapPixels;
const startX = (layout.paperWidth - totalPhotosWidth) / 2;
const startY = (layout.paperHeight - totalPhotosHeight) / 2;
```

把所有照片寬度加總（包含中間的 gap、但不算最外圈），紙張寬度減掉，除以 2 就是左邊距。沒有特殊規則，國小數學。

## 預覽用 0.3x、下載用全解析度——同樣的繪圖邏輯為什麼寫兩次

`LayoutEngine.tsx` 裡面有兩個幾乎一模一樣的函式：`drawPreview()` 跟 `handleDownload()`。一個畫小張預覽、一個畫全尺寸下載檔。

```typescript
// drawPreview()
const scale = 0.3;
canvas.width = layout.paperWidth * scale;
canvas.height = layout.paperHeight * scale;
ctx.drawImage(
    img,
    x * scale, y * scale,
    layout.photoWidth * scale, layout.photoHeight * scale,
);
```

```typescript
// handleDownload()
canvas.width = layout.paperWidth;
canvas.height = layout.paperHeight;
ctx.drawImage(img, x, y, layout.photoWidth, layout.photoHeight);
```

第一眼看到會手癢：明明就一個 `scale` 參數的差別，為什麼不抽函式？

理由是這兩個用途完全不同：

- **預覽**：每次設定變動都重畫。小張、快、低品質可接受。
- **下載**：使用者按下載才執行一次。大張、可以慢一點、JPEG 0.95 品質、要走 `canvas.toBlob` → 觸發瀏覽器下載。

如果抽成 `drawLayout(canvas, scale, options)`，要傳一堆「是否要 cut lines、是否要白底、是否要 toBlob、品質參數」進去——抽象成本比保留兩段重複還高。

這是個經典的 DRY 取捨。**重複 60 行程式碼有時候比一個 50 行的萬用函式更好讀**。等到第三個地方要用同一段邏輯、且行為一致，再抽。

## SmartEditor 跨工具復用

這個工具沒有自己的 cropper——它用的是「圖片處理工廠」的 `SmartEditor` 元件。但兩個工具的需求差異很大：

| 需求 | 圖片處理工廠 | 證件照工具 |
|------|------------|----------|
| 裁切比例 | 自由 / 16:9 / 4:3 / 1:1 | 2 吋 / 1 吋 / 2 吋半身（公制） |
| 輸出大小設定 | 顯示 | 隱藏 |
| 格式 / 品質設定 | 顯示 | 隱藏 |
| 完成後行為 | 觸發下載 | 把 Blob 丟回父元件做排版 |
| 主題色 | blue | green |

我選擇讓 `SmartEditor` 透過 props 暴露這些差異：

```tsx
<SmartEditor
    aspectPresets={ID_PHOTO_PRESETS}       // 2 吋 / 1 吋 / 2 吋半身
    defaultAspect={getAspectForPhotoSize(photoSize)}
    showOutputSettings={false}              // 不顯示大小/格式/品質面板
    outputMode="callback"                   // 不下載，丟回父元件
    onCropReady={handleCropReady}           // 父元件接收 Blob
    accentColor="green"                     // 主題色
    exportButtonText="✂️ 確認裁切並生成排版"
/>
```

兩個 props 設計上的取捨：

**`outputMode='callback'` vs `'download'`**：這是元件最大的分歧點。圖片處理工廠的完成行為是「下載」，證件照工具是「把裁好的圖丟給 `LayoutEngine` 接著畫排版」。兩種行為的分歧很深——下載要 `toBlob`、要建 `<a download>`、要清 URL；callback 只要 `onCropReady(blob, dims)`。

我沒選「永遠 callback、讓父元件自己決定要不要下載」。理由：圖片處理工廠是 80% 的使用情境，把「下載」當特例會讓常見路徑變麻煩。`outputMode` 就是這個分歧點的閥。

**`showOutputSettings`**：證件照工具的輸出大小是「2 吋 ⇒ 3.5cm × 4.5cm × 300dpi = 413 × 531」，由排版演算法決定，沒有使用者選擇空間。所以這個面板要藏掉。

整體原則：**讓元件「能被當子元件」**，不是把所有複雜度都灌進 props。如果哪天 `SmartEditor` 的 props 超過 10 個，就是該拆兩個元件的訊號。

## 為什麼選 4x6 跟 A4 兩種紙就夠

```typescript
const PAPER_SIZES = {
    '4x6': { width: 15.2, height: 10.2, name: '4×6 (超商沖印)' },
    'a4':  { width: 29.7, height: 21.0, name: 'A4 (家用印表機)' },
};
```

- **4x6**：台灣超商照片機的標配尺寸，每張 6–10 元。
- **A4**：自己家有印表機的人用。

沒做的常見尺寸：

- **5x7、3x5**：超商有但比 4x6 貴、能塞的張數又少，性價比輸 4x6。
- **明信片**：證件照不會印在明信片上，需求不存在。

夠用就好。紙張清單長度跟使用率成反比——多一個選項就多一份決策疲勞。

## 沒做、刻意不做

- **背景去除 / 換背景**：證件照的背景規範（白、藍、紅）超出 canvas 工具的能力範圍，要走 AI 模型。等真的需要再做。
- **臉部對齊輔助**：放大鏡加引導線是 nice-to-have。目前依賴使用者自己對齊。
- **批次處理**：多張照片排不同人——這個情境太少見。

## 收尾

這個工具沒有炫技的地方，只是一份**對印刷常識的程式化**：

- 公制是輸入，DPI 是輸出，中間用一個常數連起來
- 排版是 nested loop 加置中，沒有特殊情況
- 元件透過 props 復用，不需要繼承或 HOC

最有「為什麼這樣寫」價值的反而是那段刻意保留的重複程式碼。下次再多一個「我需要把這個 layout 印到 5x7」的工具，我可能就會抽出來；但今天不會。

工具本身在 [/tools/id-photo/](/tools/id-photo/)。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
