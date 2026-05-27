---
title: "免登入待辦清單開發筆記：localStorage 最樸素的一種寫法"
pubDate: 2026-05-27
description: "整站最簡單的一個工具：一個 localStorage key 加一份 React state 就完事。但藏在裡面的有 IME 組字、Modal 關閉策略、跟為什麼這次不用 debounce。"
author: "wemee (with AI assistant)"
tags: ["todo", "localstorage", "react", "ime"]
related: ["/tools/todo/"]
---

## 前言

「免登入待辦清單」是這站上最簡單的工具。沒有 race condition、沒有 IndexedDB、沒有外部 lib——一個 `localStorage` key 加一份 React state，事情就辦完了。

這是工具系列裡素材最少的一篇。但「素材少」不等於「沒東西可說」——這個工具值得記的，其實是幾個被普遍忽略的小細節，加上一個刻意做出的 UX 取捨。

## 資料模型

```typescript
interface SubItem {
    text: string;
    completed: boolean;
}

interface Todo {
    id: string;
    title: string;
    completed: boolean;
    notes: string;
    subItems: SubItem[];
}
```

平的不能再平。`title` + `completed` 是 90% 的待辦 App 共同骨架；`notes` 跟 `subItems` 是為了「我這件事不只一句話講得完」的情境而存在。

設計取捨：

- **沒有截止日 / 優先級 / 標籤**：這些東西做下去，工具會越來越像 Notion。我自己是當「散裝靈感清單」用，不需要這些。
- **`subItems` 不能再下一層**：兩層深就停。下個層級的需求出現之前，我不想處理「樹狀結構」的渲染、拖曳、收合。

## IME 組字中按 Enter 不該觸發

中文輸入是這個工具最容易被忽略的細節。常見寫法：

```tsx
// 反例
<input
    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
/>
```

問題：使用者打中文時，按 Enter 是「確認選字」，不是「送出」。但 keydown 事件還是會帶著 `key === 'Enter'` 觸發。結果就是——選字選到一半，事項已經被加進去了。

正解：

```tsx
<input
    onKeyDown={(e) =>
        e.key === 'Enter' &&
        !e.nativeEvent.isComposing &&
        addTodo()
    }
/>
```

`e.nativeEvent.isComposing` 在 IME 組字過程中是 `true`，組字結束（按 Enter 確認選字後）那一瞬間還是 `true`，再下一次 keydown 才會是 `false`。所以這個檢查能精準濾掉「組字中的 Enter」。

這個檢查在這個工具用了兩個地方：主輸入框（新增事項）、子項目輸入框（編輯 modal 裡的「+」）。**任何接受中文輸入的送出鍵，都該這樣寫**。

## Modal-as-form：點外面 = 儲存

打開編輯 modal、改完內容、點外面關掉——這時候應該怎麼辦？

兩種主流答案：

1. **棄置**：點外面是「取消」。要儲存必須明確按「儲存」按鈕。
2. **儲存**：點外面是「完成」。把改動沿用，按鈕只是視覺上的「離開」。

兩種都有人用。Notion 走儲存模式、Trello 走棄置模式。我選了儲存：

```tsx
<Modal
    isOpen={isModalOpen}
    onClose={saveEdit}  // ← 不是 setIsModalOpen(false)
    title="編輯事項"
    ...
>
```

選儲存的理由：

- 這個工具的編輯體驗是「修改現有事項」，不是「填一張表單」。棄置模式比較適合複雜表單，有「我還在草稿狀態」的概念。
- 使用者預期是「我改了就改了，關掉就好」，要他多點一個確認按鈕是阻力。
- 沒有「危險動作」要保護。刪除有獨立按鈕，那個動作才走確認流程。

副作用：使用者**不能**改到一半再決定取消。如果這成為痛點，要再補「取消」按鈕、然後做髒位（dirty bit）追蹤——目前沒人抱怨。

## localStorage 為什麼不用 debounce

對比一下：

- 記事本是 IndexedDB + 1 秒 debounce
- 待辦清單是 localStorage + 每次操作直接寫

為什麼差這麼多？

```typescript
const saveTodos = useCallback((newTodos: Todo[]) => {
    setTodos(newTodos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTodos));
}, []);
```

理由是寫入的「頻率」跟「同步性」差太多：

- **記事本**：每次 keystroke 都是一個 input 事件。一秒可能 5–10 次。直接寫會 thrash 儲存層、sidebar 也會瘋狂閃。
- **待辦清單**：每次操作（新增、勾選、刪除、編輯儲存）都是離散事件。最高頻率大概一秒一次。每次操作後立刻持久化是合理的——也讓「關掉分頁就消失」的風險變最低。

順帶一提，`localStorage.setItem` 是同步 API，會卡住主執行緒；資料規模大的話這就會變問題。但「~100 筆待辦、每筆幾百 bytes」這個量級下，I/O 在 1ms 等級，無感。

## 沒做、刻意不做

- **同步**：違反「免登入」這個前提。要做就是另一個工具。
- **排序 / 拖曳重排**：新增是 LIFO（最新的在最上）。會需要排序的人，通常該先解決「為什麼會混到搞不清楚順序」這個更上游的問題。
- **跨裝置**：因為沒同步，這個工具的待辦只能在「同一個瀏覽器、同一個 profile」看到。
- **匯出**：理論上一個 `JSON.stringify(todos)` 加個下載按鈕就好，但沒人要過。

## 收尾

這個工具的價值不在程式碼複雜度，在於它「沒長出來該長出的東西」。沒有帳號、沒有同步、沒有截止日提醒。**它就是一張瀏覽器內的便條紙**，被打開的次數比被討論的次數多得多。

工具本身在 [/tools/todo/](/tools/todo/)。

---

*本文由 AI 協助撰寫，記錄真實開發過程。*
