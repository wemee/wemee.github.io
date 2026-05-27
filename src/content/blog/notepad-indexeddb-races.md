---
title: "快速記事本開發筆記（下）：IndexedDB 自動儲存的兩個競態"
pubDate: 2026-05-27
description: "切換筆記讓 sidebar 順序自己跳、按下垃圾桶一秒後筆記又復活——同一個工具裡的兩個 race condition 怎麼修，以及為什麼把純邏輯抽到獨立檔案。"
author: "wemee (with AI assistant)"
tags: ["notepad", "indexeddb", "race-condition", "react", "testing"]
related: ["/tools/notepad/"]
---

## 前言

[上篇](/blog/notepad-contenteditable-clipboard/)講編輯器跟剪貼簿，那是介面層的故事。這篇接著講儲存層，主角是兩個被自動儲存的 debounce 引出來的 race condition。

兩個 bug 的形狀很不一樣：

- 第一個是無聲的——sidebar 順序自己跳，使用者只會覺得「奇怪剛剛那筆怎麼變最上面」。
- 第二個是有聲的——你刪掉一筆筆記，一秒之後它自己復活。

兩個都跟同一個機制有關：1 秒的 debounce 自動儲存。

## 自動儲存的基本盤

開始講 bug 之前，先看現狀：

```typescript
const AUTO_SAVE_DELAY = 1000;
const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleEditorInput = useCallback(() => {
    setIsEmpty(isEditorEmpty(editorRef.current?.innerHTML));
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('hidden');
    saveTimeoutRef.current = setTimeout(performSave, AUTO_SAVE_DELAY);
}, [performSave]);
```

很標準的 debounce：每次輸入重新計時，停手 1 秒後寫入 IndexedDB。

`performSave` 把當前內容打包成 `Note`、呼叫 `saveNote(db, note)`、重抓全部筆記丟給 React 重畫 sidebar：

```typescript
// 還沒修的版本
const performSave = useCallback(async () => {
    if (!db || !currentNoteId || !editorRef.current) return;

    const content = editorRef.current.innerHTML;
    setSaveStatus('saving');
    const note: Note = {
        id: currentNoteId,
        content,
        updatedAt: Date.now(),
    };

    await saveNote(db, note);
    const allNotes = await getAllNotes(db);
    setNotes(allNotes);
    setSaveStatus('saved');
}, [db, currentNoteId]);
```

看起來沒問題。實際上下面要講的兩個 bug 都藏在這幾行裡。

## 競態一：sidebar 順序亂跳

### 現象

我自己用的時候注意到：在筆記 A 裡打了兩個字，馬上點 sidebar 跳到筆記 B 看一下，再回頭——筆記 A 跑到列表第一位了。

第一反應是「對啊，因為我剛剛打過字」。再仔細想：我並沒有手動儲存啊，那兩個字也才打了 0.5 秒，根本還在 debounce 裡。為什麼會 bump？

### 追根

來看 `loadNote`（切換筆記時呼叫的函式）：

```typescript
// 還沒修的版本
const loadNote = useCallback(async (note: Note) => {
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        await performSave(); // ← 嫌疑犯
    }

    setCurrentNoteId(note.id);
    if (editorRef.current) {
        editorRef.current.innerHTML = note.content;
    }
}, [performSave]);
```

邏輯本身沒錯：切走之前要先把當前未存的內容 flush 進去，否則使用者切回來會發現「咦剛剛那兩個字呢」。

但這個 flush 連帶 bump 了 `updatedAt`。Sidebar 是依 `updatedAt` 倒序排的（用 IndexedDB 的索引），所以順序自動跳。

退一步看，這是個「副作用設計錯誤」：**「儲存」這個動作隱含了「視為最近一次編輯」，但 flush pending debounce 並不一定真的有編輯**。

更精確地描述：當使用者只是切換筆記、沒有實際改動內容時，flush 不應該 bump `updatedAt`。

### 修法

最直覺的修法是「切換時不要 flush」，但這會破壞「切走前先存」的保證——萬一使用者剛打完字立刻切走，那幾個字就沒了。

第二個想法是「切換時 flush，但用舊的 `updatedAt`」，但這需要在好幾個呼叫點傳遞「這次儲存要不要 bump」的旗標，API 形狀很噁。

最後的解法是讓 `performSave` 自己判斷有沒有真的變動：

```typescript
// 紀錄上次寫入 IndexedDB 的內容快照
const lastSavedContentRef = useRef<string>('');

const performSave = useCallback(async () => {
    if (!db || !currentNoteId || !editorRef.current) return;

    const content = editorRef.current.innerHTML;
    if (content === lastSavedContentRef.current) return; // ← 關鍵

    setSaveStatus('saving');
    const note: Note = {
        id: currentNoteId,
        content,
        updatedAt: Date.now(),
    };

    await saveNote(db, note);
    lastSavedContentRef.current = content;
    const allNotes = await getAllNotes(db);
    setNotes(allNotes);
    // ...
}, [db, currentNoteId]);
```

外加在 `loadNote` 跟初始載入時都更新 `lastSavedContentRef.current`，讓「上次寫入的內容」這個快照永遠跟 IndexedDB 同步。

只在內容真的變了的時候才寫——簡單、無侵入、不用改 API。

`lastSavedContentRef` 用 `useRef` 而不是 `useState`，正好對應上篇的反向結論：**它是「我會自己讀但不影響畫面」的東西，所以放 ref**。放 state 反而會觸發多餘的 re-render。

## 競態二：刪除後筆記復活

### 現象

更詭異的：在筆記 A 裡打了 `hello`，沒等到自動儲存就立刻按垃圾桶刪掉它。Sidebar 變成沒有 A。然後過了大概一秒——A 又出現在列表最上面。

第一反應是「IndexedDB 沒寫進去？瀏覽器壞了？」實際打開 DevTools 的 Application → IndexedDB 一看：A 不只在，內容還是 `hello`。

### 追根

把時序展開：

```
T = 0.0s   使用者打 'hello'，handleEditorInput 觸發
           saveTimeoutRef = setTimeout(performSave, 1000)
T = 0.5s   使用者按垃圾桶
           handleDeleteNote(A) 開始
           confirm('確定要刪除...') → 使用者按 yes
           await deleteNote(db, A)      ← A 從 IndexedDB 移除
           setNotes(allNotes)            ← sidebar 重畫，沒有 A 了
           loadNote(allNotes[0])         ← 自動切到第一筆
T = 1.0s   原本的 setTimeout 觸發 performSave
           performSave 讀 editorRef.current.innerHTML
           此時 editor 已經顯示新筆記的內容，但…
           performSave 用的 currentNoteId 還是 A 嗎？
```

慢一點看：`performSave` 是 `useCallback` 包的，它抓的閉包是「上一次 render 時的 `currentNoteId`」。雖然 React 的 state 在 `setCurrentNoteId(allNotes[0].id)` 之後已經換了，但**那顆早就排好的 timeout，handler 是舊的 `performSave`，閉包裡的 `currentNoteId` 還是 A**。

所以 `performSave` 把「現在 editor 顯示的內容」（可能還沒換成新筆記的）綁上「筆記 A 的 id」寫進 IndexedDB——A 就這樣復活了。

### 修法

修法分兩段。第一段在 `handleDeleteNote` 入口處先撤掉 pending debounce：

```typescript
const handleDeleteNote = useCallback(async (id: string) => {
    if (!db) return;
    if (!confirm('確定要刪除這則筆記嗎？')) return;

    // 關鍵：刪除前先撤掉自動儲存
    if (currentNoteId === id && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
    }

    await deleteNote(db, id);
    const allNotes = await getAllNotes(db);
    setNotes(allNotes);

    if (currentNoteId === id) {
        if (allNotes.length > 0) {
            loadNote(allNotes[0], false); // ← 第二段在這裡
        } else {
            createNewNote(db, false);
        }
    }
}, [db, currentNoteId, loadNote, createNewNote]);
```

第二段是給 `loadNote` 加一個參數 `flushPending`：

```typescript
const loadNote = useCallback(async (note: Note, flushPending = true) => {
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        if (flushPending) await performSave();
    }
    // ...
}, [performSave]);
```

為什麼需要這個參數：

- **使用者主動切換筆記**：`flushPending = true`。要把舊筆記未存的內容 flush 進去，否則切回來會少幾個字。
- **刪除之後的自動切換**：`flushPending = false`。如果 flush，等於把我們剛清掉的那顆 timeout 又叫回來執行，「剛刪掉的筆記」立刻被寫回去——竹籃打水。

兩段修法分別處理兩個 timing window：第一段擋掉「`setTimeout` 已經排好還沒觸發」，第二段擋掉「`loadNote` 自己手動 flush」。少做任何一段，A 都會復活。

### 旁觀者的反省

寫完之後我才意識到：這種閉包抓舊變數的 race，**在任何有「非同步排程 + state 依賴」的程式碼裡都會發生**，跟 IndexedDB 或 React 沒什麼關係。

通常我們不會注意到，是因為大部分情境下「舊變數的值」剛好還是對的，或者副作用剛好是冪等的。記事本剛好踩在所有條件都不冪等的點上：刪除是不可逆的、`updatedAt` 是會被覆蓋的、`currentNoteId` 是會切換的。

教訓：**任何有 debounce 的功能，每一個能改變「身分」的動作都要把 pending 先清掉，不能假設它會自己消化**。

## 為什麼把剪貼簿邏輯抽到獨立檔案

寫到中段 `_NotepadApp.tsx` 已經塞了快 700 行，看起來不舒服。把純邏輯抽到 `src/lib/notepad/clipboard.ts` 這件事我做了一次，理由是：

### 想測試

剪貼簿的 sanitize 邏輯有夠多分支：保留樣式 / 不保留樣式、單張圖 / 混合內容、背景色的 longhand 殘留、外部來源的 `<style>` 跟 `<script>` 標籤。手動 QA 完全無法覆蓋這個空間。

抽到 `clipboard.ts` 之後可以直接用 jsdom 跑單元測試：

```typescript
// src/lib/notepad/clipboard.test.ts（節錄）
import { describe, it, expect } from 'vitest';

describe('stripBackground', () => {
    it('removes background-color, background, and background-image', () => {
        const el = document.createElement('span');
        el.style.cssText = 'background-color: red; color: red;';
        stripBackground(el);
        expect(el.getAttribute('style') ?? '').not.toMatch(/background/i);
        expect(el.style.color).toBe('red');
    });
});

describe('sanitizeFragmentToHtml — keepStyles = true', () => {
    it('strips background but preserves text color', () => {
        // ...建一個帶背景色的 fragment...
        const html = sanitizeFragmentToHtml(fragment, true);
        expect(html).not.toMatch(/background/i);
        expect(html).toMatch(/color:\s*red/);
    });
});
```

整個 clipboard 邏輯的測試檔目前 271 行，覆蓋了上篇講到的所有分支。

### 哪些東西不能抽

不是所有東西都搬得走。下面這些必須留在原檔，因為它們吃的是 browser-only API：

```typescript
export async function reencodeAsPng(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);  // browser-only
    // ...
}

export async function writeImageToClipboard(img: HTMLImageElement): Promise<void> {
    // ...
    await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),  // browser-only
    ]);
}
```

`createImageBitmap`、`ClipboardItem`、`navigator.clipboard.write` 在 jsdom 裡都沒有實作，硬要 mock 等於把實作再寫一遍，沒意義。這些 API 走手動 QA：每次動到剪貼簿就在 Chrome 跟 Safari 各貼一次。

把這個分界明確化的好處：純邏輯有單元測試擋住，瀏覽器邊界的東西有清楚的「這裡必須手動驗」標籤。看 code 的人一眼就知道哪些是測過的、哪些是用過的。

## 沒做、刻意不做

寫到這邊應該很明顯，這個工具是一台「夠用就好」的工具，下面這些刻意沒做：

- **雲端同步 / 帳號**：違反設計目標。要的話另開一個產品，不是把這個改成那個。
- **Markdown 渲染 / 富文字工具列**：`contentEditable` 已經能做到基本格式（粗體靠 Ctrl+B），增加工具列就要進編輯器框架的世界。等真的有人需要再做。
- **匯出 / 標籤 / 多人協作**：同上，等情境出現再說。
- **大小限制 / 配額警示**：IndexedDB 配額是瀏覽器給的（通常是磁碟空間的一半左右），目前沒人撞到。

提醒一下：因為資料只在瀏覽器，**清快取會清掉筆記**。Help modal 裡有警示，但實際上備份這件事還是要靠使用者自己。

## 收尾

回頭看，這個工具的核心難度不在「做一個編輯器」，而在三組外部介面：

- 剪貼簿（上篇）
- `contentEditable` 的 DOM 模型（上篇）
- IndexedDB 加自動儲存的 timing（這篇）

三組都不是 React 的世界、都不會自己等你，每一組都有自己的 race condition 等著被踩。寫完發現這比 React 那邊的事情難多了。

`contentEditable` 跟 IndexedDB 大概還會跟我一陣子。哪天真的換掉編輯器，到時候再寫第三篇。

工具本身在 [/tools/notepad/](/tools/notepad/) 可以直接用。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
