---
title: "神諭開發筆記:用一套參數,讓石像長出喜怒哀樂"
pubDate: 2026-05-30
description: "與其準備 N 張表情圖硬切,不如把五官變成一組數值。情緒是參數預設,切換是補間——平滑變形、眼神跟隨、對嘴說話全從同一套參數長出來。順帶記一個 git worktree 害 Vite 擋掉 React runtime 的坑。"
author: "wemee (with AI assistant)"
tags: ["oracle", "svg", "animation", "face-rig", "astro", "react"]
related: ["/oracle"]
---

## 前言

很多年前,我在一塊 128×64 的單色 OLED 上做過一張會變表情的臉。那時候是純黑白、硬切——要笑就換一張笑臉點陣圖,要哭就換一張哭臉,中間沒有過渡。在那種解析度跟記憶體下,這樣已經夠了。

這次我想做網頁的「完整版」:平滑、彩色、會互動。一尊有生命感的低多邊形石雕神像,自己循環喜怒哀樂、會呼吸、眼神跟著你的游標,戳一下還會有反應。成果在 [/oracle](/oracle)。

但一坐下來就遇到第一個分岔:**怎麼表示「表情」?**

## 硬切的死路

最直覺的做法,就是 OLED 那一套搬上來:每種情緒準備一份畫面,切換時換掉。在網頁上,這代表七張 SVG、或七組座標,情緒之間用 cross-fade 蓋過去。

問題是這條路會越走越死:

- 想要「從喜慢慢轉成疑」的中間態?沒有,你只有起點跟終點兩張圖疊著淡入淡出,中間是兩張圖半透明重疊,不是真的變形。
- 想要「七分笑、帶三分疑」的混合情緒?做不到,圖是離散的。
- 想要嘴巴跟著語音開合、眼睛跟著游標轉?那是另一套完全獨立的邏輯,跟表情系統各走各的。

每加一個需求,就多一坨特例。這就是硬切的本質:**畫面是離散的,而我想要的東西全都是連續的。**

## 把五官變成數字

換個角度:不要存「畫面」,存「參數」。

五官的形狀,其實可以用一小組數值描述——眼睛開多大、眼形上拱還是下垂、眉毛內端壓低還是抬高、嘴角上揚還是下垂、嘴巴張多開……我把這組數值叫 `FaceParams`:

```typescript
export interface FaceParams {
  eyeOpenness: number;  // 0=閉(眨眼) … 1=圓睜
  eyeCurve: number;     // -1=下垂∪(哀) … 0=平 … +1=上拱∩(笑眼)
  browInner: number;    // 內側眉端 y 位移:正=下壓(怒) … 負=上揚(哀)
  browOuter: number;
  browRaise: number;    // 整體眉抬高:正=抬高(驚)
  mouthCurve: number;   // -1=下垂(哀/怒) … +1=上揚(笑)
  mouthOpen: number;    // 0=閉 … 1=張開(說話用)
  gazeX: number;        // 瞳孔注視 X -1=左 … +1=右
  gazeY: number;
  tear: number;         // 眼淚 0..1
  grit: number;         // 咬牙 0..1
  asymmetry: number;    // 不對稱:右眉挑高、左眼瞇起(疑)
  glow: number;         // 輝光強度
}
```

關鍵的轉念是:**「情緒」不再是一張圖,而是這組數字的一份設定。**

```typescript
// 喜:笑眼上拱、眉微抬、嘴角大幅上揚
happy: preset({ eyeOpenness: 0.5, eyeCurve: 0.85, browRaise: 0.3,
                mouthCurve: 0.9, mouthOpen: 0.22, glow: 0.7 }),

// 怒:圓睜、內眉下壓、嘴角下垂、咬牙、紅光
angry: preset({ eyeOpenness: 0.88, browInner: 0.9, browRaise: -0.35,
                mouthCurve: -0.7, grit: 0.65, glow: 0.95 }),
```

一旦表情變成「空間中的一個點」,前面那些做不到的事,瞬間全部變得理所當然。

## 補間:讓變形長出來

兩個情緒之間的過渡,不再是兩張圖淡入淡出,而是兩組數字之間的**線性內插(lerp)**——逐欄位補間:

```typescript
export function lerpParams(a: FaceParams, b: FaceParams, t: number): FaceParams {
  return {
    eyeOpenness: lerp(a.eyeOpenness, b.eyeOpenness, t),
    eyeCurve:    lerp(a.eyeCurve, b.eyeCurve, t),
    mouthCurve:  lerp(a.mouthCurve, b.mouthCurve, t),
    // …其餘欄位同理
  };
}
```

`t` 從 0 走到 1,套上 easing(慢進慢出),約 400ms。中間每一個 `t` 都是一份合法的 `FaceParams`,所以你看到的是**真的連續變形**——嘴角一點一點翹起來、眼睛一點一點瞇下去,而不是兩張圖在那邊鬼影般疊著。

「七分笑帶三分疑」?那就是 `lerpParams(suspicious, happy, 0.7)`。混合情緒從補間自然掉出來,不用額外寫。

再來只剩一件事:把 `FaceParams` 翻成畫面。這層是純函式,把參數換成 SVG 路徑——例如眼睛是上下兩條二次貝茲曲線圍成的杏仁形,`eyeOpenness` 控制開合高度,`eyeCurve` 讓上下眼瞼不對稱地彎,於是笑眼上拱、哀眼下垂:

```typescript
const lidH = 5 + op * 26;            // 開合高度
const upperShift = -p.eyeCurve * 6;  // eyeCurve 對上下眼瞼影響不對稱
const lowerShift = -p.eyeCurve * 20; // → 笑眼呈上拱新月,哀眼呈下垂
```

## 三層分開:資料、邏輯、畫面

整個元件刻意切成三層,各自只做一件事:

| 層 | 檔案 | 職責 |
|----|------|------|
| 資料 | `emotions.ts` | 情緒預設(就是上面那些 `FaceParams`) |
| 邏輯 | `geometry.ts` | 補間數學 + 把參數翻成 SVG 路徑(純函式、可測試) |
| 引擎 | `FaceRigController.ts` | 持有狀態、每幀補間、待機行為、互動 |
| 畫面 | `StatueFace.tsx` | 畫出 SVG、接事件,不放任何邏輯 |

純函式那層好處很實際:它沒有 DOM、沒有副作用,所以可以直接寫單元測試——丟一組參數進去,檢查吐出來的 path 字串合法、不含 `NaN`、所有情緒預設都有齊全的欄位。視覺的東西難測,但「參數 → 幾何」這段是純計算,測起來很乾脆。

## 一個讓我自己很滿意的小技巧

眨眼、眼神跟隨、說話時的嘴型——這些都是「臨時的」動作,疊在當前情緒之上,但**不該污染情緒補間的基準**。如果眨眼時直接把 `eyeOpenness` 改成 0,那情緒正在過渡的補間就被踩爛了。

做法是:補間照常算出 `current`(情緒的基準狀態),畫之前再**複製一份、在上面疊加**這些瞬時調變:

```typescript
private draw(): void {
  // 在 current 之上疊加眨眼、注視、說話口型(不污染補間基準)
  const render: FaceParams = {
    ...this.current,
    eyeOpenness: this.current.eyeOpenness * this.blinkFactor(),
    gazeX: this.gazeX,
    gazeY: this.gazeY,
    mouthOpen: this.speakingMouth(this.current.mouthOpen),
  };
  const g = computeGeometry(render);
  // …把 g 寫進 SVG
}
```

於是眨眼可以發生在任何情緒過渡的中途,兩者互不干擾;眼神跟隨疊在所有情緒之上;說話的嘴型只在 `speaking` 時覆蓋 `mouthOpen`。它們是同一套參數上的不同圖層,而不是互相打架的獨立系統。

## 效能:哪些屬性可以動

前端動畫有個老規矩:盡量只動 `transform` 跟 `opacity`,因為它們走 compositor、不觸發 layout reflow;動 `width`、`top`、`margin` 那種會逼瀏覽器重排。

神諭這裡分兩塊處理:

- **呼吸漂浮、輝光脈動**:對外層 `<g>` 套 `transform: translateY(...)` 跟 `opacity`,乖乖走 compositor。
- **五官變形**:這個沒辦法只用 transform——它本質就是在改 SVG path 的 `d`。但這在單一、節點不多的 SVG 上其實很便宜,而且改 SVG 幾何**不會觸發整頁的 HTML layout reflow**,成本跟改一個 HTML 元素的 `width` 完全是兩回事。

驅動每一幀的迴圈,直接重用了站上既有的 `useGameLoop`(一個 `requestAnimationFrame` 的封裝,還附 `pause`/`resume`)。分頁切到背景時暫停,不要在沒人看的時候燒 CPU:

```typescript
useGameLoop({
  onTick: (dt) => controllerRef.current?.tick(dt),
  autoStart: true,
  targetFps: 60,
});
```

值得一提:每幀更新是控制器**直接寫 SVG 元素的屬性**,而不是透過 React state 重新 render。60fps 跑 React re-render 是不必要的浪費;命令式地 `setAttribute` 反而乾淨。React 只負責掛載、接 props、轉送事件。

最後別忘了 `prefers-reduced-motion`:使用者若在系統開了「減少動態效果」,就關掉漂浮、星光、輝光脈動,表情仍會切換但更直接。會動的東西,要留一條讓人關掉的路。

## 開發中踩到的坑:git worktree 害 Vite 擋掉 React runtime

最後記一個跟功能本身無關、但讓我卡了一陣子的環境坑。

當時有另一個工作同時在同一個 repo 進行,為了不互相干擾,我用 `git worktree` 在旁邊另開了一個獨立資料夾跟分支。為了省一次安裝,我把 `node_modules` 用 symlink 連回主資料夾:

```bash
git worktree add ../wemee-oracle -b feat/oracle-face
cd ../wemee-oracle
ln -s ../wemee.github.io/node_modules node_modules   # ← 這行是地雷
```

`npm run build` 完全正常,測試也過。但一開 dev server 打開頁面,就跳錯誤畫面:

```
[vite] The request id ".../node_modules/@astrojs/react/dist/client.js"
       is outside of Vite serving allow list.
```

原因是:symlink 指向的真實檔案在**主資料夾**底下,落在這個 worktree 的專案根目錄**之外**。Vite dev server 有一份 `server.fs.allow` 安全清單,只放行專案根目錄內的檔案;React 的 runtime 透過 symlink 指到外面,就被擋下來 500,於是 React island 永遠 hydrate 不起來。

`build` 之所以沒事,是因為打包流程不走這份 dev-only 的 fs 清單。

修法很無聊但很乾脆:**別用 symlink,在 worktree 裡老實 `npm ci` 裝一份真的 `node_modules`**。多花幾秒、多佔點硬碟,但 Vite 就不再覺得有東西在專案外面了。

> 附帶一個 bonus 坑:同一個 dev server 還在另一個地方報 `Failed to resolve import "/pagefind/pagefind.js"`。那是站內搜尋的索引,只有 build 後才存在,dev 沒有。程式本來就用 `/* @vite-ignore */` 想叫 Vite 別管它,但這版 Vite 對**字面字串**的動態 import 還是會去解析。把路徑改成一個變數,Vite 的靜態分析就放手了:
>
> ```typescript
> const pagefindUrl = '/pagefind/pagefind.js';
> const mod = await import(/* @vite-ignore */ pagefindUrl);
> ```

## 收尾

回頭看,這次最大的收穫不是哪個炫技,而是一開始那個轉念:**把離散的「畫面」換成連續的「參數」。**

一旦表情變成空間中的一個點,平滑過渡、混合情緒、眼神跟隨、對嘴說話——這些看起來各自獨立的需求,全部變成同一套參數上的不同操作,自然地長出來,而不是一個個特例堆上去。OLED 上那張硬切的臉教我「夠用就好」;這次則是反過來,先選對表示法,後面的需求就幾乎不用額外打架。

接下來想試的:接 Web Speech API 讓嘴型跟著語音節奏動,變成真的「會說話的神諭」;再往後也許升級成 3D。但那都是後話了——目前這尊石像,已經會看著你、會被你戳醒、放著沒人理還會打瞌睡。
