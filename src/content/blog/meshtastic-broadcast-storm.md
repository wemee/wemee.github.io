---
title: "當年我們拼命避免廣播風暴，Meshtastic 卻選擇擁抱它"
pubDate: 2026-08-08
description: "2008 年我的碩士論文在研究車載隨意網路的路由層：下一跳怎麼選、怎麼壓制廣播風暴、怎麼把封包到達率拉高。十幾年後 Meshtastic 把 multi-hop ad hoc 網路做成了商品，卻幾乎不做路由。這篇用當年的問題意識重新檢視它的每一個設計決策。"
author: "wemee (with AI assistant)"
tags: ["Meshtastic", "LoRa", "MANET", "VANET", "routing", "無線網路"]
---

## 一、2008 年，我在煩惱的事

我的碩士論文題目在**車載隨意網路（VANET）的路由層**。那個年代的關鍵字是 AODV、DSR、GPSR，模擬跑在 ns-2 上，一個晚上跑完一組參數，隔天早上看結果。

當時腦袋裡整天轉的問題大概是這幾個：

- **下一跳到底該怎麼決定？** 是先建好一條完整路徑再走，還是每一跳現場挑？
- **hidden terminal 跟 exposed terminal 怎麼壓？**
- **廣播風暴（broadcast storm）怎麼避免？** 這是那個年代的顯學
- **封包到達率、端到端延遲、總傳輸容量**——這三個數字就是論文的成績單

十幾年過去，我幾乎沒再碰過這個領域。直到最近開始看 Meshtastic——一套跑在 LoRa 上的開源網狀通訊系統，有人真的把 multi-hop ad hoc network 做成商品在賣，而且台灣有數萬人的社群在用。

> 如果你完全不知道 LoRa 跟 Meshtastic 是什麼，可以先看[這一篇入門](/blog/lora-meshtastic-intro)。這裡只用三句話帶過：LoRa 是一種用速率換距離的無線電技術；Meshtastic 讓一堆 LoRa 小裝置自動組成不需要基地台的網狀網路；訊息靠節點彼此中繼，一跳一跳送到目的地。

翻完它的設計文件，我的第一個反應是：**這東西怎麼會這樣做？**

第二個反應是：**它這樣做，其實非常清楚自己在幹嘛。**

## 二、第一個衝擊：它幾乎不決定下一跳

2008 年那批協定，核心命題都是**怎麼挑下一跳**。三種代表性的答案：

- **AODV / DSR**：需要傳的時候才發 RREQ 找路，對方回 RREP，建立一條路徑，之後封包沿著這條路徑的 next hop 一路走
- **GPSR**：不建路徑，靠 GPS 座標貪婪轉送——每一跳都把封包丟給「離目的地最近的鄰居」，遇到局部最佳解就切換成 perimeter 模式繞出去

Meshtastic 的答案是：**都不是。它基本上不挑。**

<figure class="mesh-fig">
<svg viewBox="0 0 420 340" role="img" aria-label="三種轉送策略的比較：AODV/DSR 建立路徑、GPSR 用座標貪婪選鄰居、Meshtastic 氾濫式廣播">
  <text class="t-hi" x="14" y="40">AODV / DSR</text>
  <text class="t-sm" x="14" y="58">建立一條路徑</text>
  <text class="t-sm" x="14" y="74">再沿 next hop 走</text>
  <circle class="node" cx="252" cy="24" r="6"/>
  <circle class="node" cx="300" cy="94" r="6"/>
  <circle class="node-on" cx="158" cy="58" r="8"/>
  <circle class="node-on" cx="218" cy="36" r="8"/>
  <circle class="node-on" cx="276" cy="70" r="8"/>
  <circle class="node-on" cx="345" cy="46" r="8"/>
  <line class="link-cy" x1="166" y1="55" x2="210" y2="39"/>
  <line class="link-cy" x1="226" y1="41" x2="268" y2="65"/>
  <line class="link-cy" x1="284" y1="66" x2="337" y2="49"/>
  <line class="link" x1="224" y1="32" x2="246" y2="26"/>
  <line class="link" x1="282" y1="76" x2="295" y2="88"/>
  <text class="t-sm" x="158" y="82" text-anchor="middle">S</text>
  <text class="t-sm" x="345" y="30" text-anchor="middle">D</text>
  <line class="link-dash" x1="14" y1="105" x2="406" y2="105"/>
  <text class="t-hi" x="14" y="150">GPSR</text>
  <text class="t-sm" x="14" y="168">用座標挑最靠近</text>
  <text class="t-sm" x="14" y="184">目的地的鄰居</text>
  <circle class="link-dash" cx="170" cy="175" r="52" fill="none"/>
  <circle class="node-on" cx="170" cy="175" r="8"/>
  <text class="t-sm" x="170" y="199" text-anchor="middle">S</text>
  <circle class="node" cx="198" cy="145" r="6"/>
  <circle class="node" cx="185" cy="212" r="6"/>
  <circle class="node-on" cx="216" cy="186" r="7"/>
  <line class="link-cy" x1="178" y1="178" x2="207" y2="185"/>
  <path class="link-cy" d="M216 186 L232 190" stroke-dasharray="3 3"/>
  <circle class="node" cx="360" cy="152" r="8"/>
  <text class="t-sm" x="360" y="138" text-anchor="middle">D</text>
  <text class="t-sm" x="290" y="216" text-anchor="middle">→ 往 D 的方向貪婪前進</text>
  <line class="link-dash" x1="14" y1="232" x2="406" y2="232"/>
  <text class="t-hi" x="14" y="276">Meshtastic</text>
  <text class="t-sm" x="14" y="294">誰收到誰轉</text>
  <text class="t-sm" x="14" y="310">沒有「路徑」的概念</text>
  <circle class="link-cy" cx="230" cy="288" r="26" fill="none" opacity="0.75"/>
  <circle class="link-cy" cx="230" cy="288" r="44" fill="none" opacity="0.45"/>
  <circle class="link-cy" cx="230" cy="288" r="62" fill="none" opacity="0.2"/>
  <circle class="node-on" cx="230" cy="288" r="8"/>
  <text class="t-sm" x="230" y="312" text-anchor="middle">S</text>
  <circle class="node" cx="256" cy="266" r="5"/>
  <circle class="node" cx="200" cy="258" r="5"/>
  <circle class="node" cx="272" cy="312" r="5"/>
  <circle class="node" cx="186" cy="318" r="5"/>
  <circle class="node" cx="292" cy="264" r="5"/>
  <circle class="node" cx="168" cy="284" r="5"/>
  <text class="t-sm" x="352" y="292" text-anchor="middle">全部往外擴散</text>
</svg>
<figcaption>三種轉送哲學。前兩種都在回答「下一跳給誰」，Meshtastic 則是把這個問題整個取消掉。</figcaption>
</figure>

Meshtastic 用的是 **managed flooding**：節點收到一個封包，只要 hop limit 還沒歸零，就減一然後再廣播出去。沒有 RREQ、沒有路由表、沒有 next hop 的概念。封包不是「走一條路」，而是「向外擴散」，最後碰巧擴散到目的地。

對做過這個題目的人來說，這很難不覺得刺眼。但真正讓我坐直身體的是下面這件事——

**Meshtastic 的節點，身上常常是有 GPS 的。**

它們知道自己的座標，也會週期性地把座標廣播出去，讓大家在地圖上看到彼此。也就是說，**GPSR 需要的那個關鍵輸入，就大剌剌地擺在桌上，而它選擇不用。** 位置資訊在 Meshtastic 裡只是 payload，是給人看的內容，不是給路由用的參數。

2008 年的我如果看到這個設計，大概第一時間會想：這裡有一篇論文可以寫。

## 三、第二個衝擊：廣播風暴不是意外，是預設值

「每個節點收到就再廣播一次」——這句話在 1999 年之後，基本上就是**廣播風暴**的定義。

那篇經典論文 [The Broadcast Storm Problem in a Mobile Ad Hoc Network](https://dl.acm.org/doi/10.1145/313451.313525)（Ni、Tseng、Chen、Sheu，MobiCom '99）講的就是這件事：naive flooding 會造成大量冗餘轉送、嚴重的頻道競爭、以及碰撞。論文提出了幾類抑制手段——probabilistic、counter-based、distance-based、location-based、cluster-based。

這篇論文之後，「怎麼壓制廣播風暴」變成 MANET 領域的基本功。我當年也在做同一件事。

所以當我看到 Meshtastic 直接把 flooding 當成主要轉送機制，第一個反應是：**它不知道這件事嗎？**

**但這裡我原本的判斷是錯的。** 仔細讀它的實作，會發現它其實把當年那套抑制術學走了一大半：

- **重複封包抑制**：每個封包有 ID，收過的就丟掉，不再轉送
- **轉送前先聽**：轉送之前先等一下，如果聽到別人已經轉了同一個封包，就取消自己的轉送——這就是 **counter-based scheme**
- **hop limit**：預設 3 跳，最多 7 跳，硬性限制擴散半徑
- **SNR 決定的競爭視窗**：這一條最精巧。節點的隨機等待時間長短跟收到訊號的 SNR 有關——**SNR 越差（代表離發送者越遠）的節點，等待視窗越小，越優先轉送**；近距離的節點聽到之後就縮手

最後那條，本質上就是 1999 年那篇論文裡的 **distance-based scheme**：離得遠的節點轉送才有價值，因為它能把訊息推到更遠的新區域；離得近的節點轉送幾乎是純浪費。差別只在於 Meshtastic 沒有量測距離，而是**拿 SNR 當距離的代理變數**——在一個節點未必有 GPS、也未必信任彼此座標的網路裡，這是比實際距離更務實的選擇。

所以精確的說法不是「Meshtastic 放任廣播風暴」，而是：

> **它保留了 1999 年那套廣播抑制術，但把整個路由層丟掉了。**

風暴被關在一個半徑三跳的籠子裡，但籠子裡面，它就是風暴。

## 四、它憑什麼敢丟掉路由層？因為瓶頸換了

那接下來的問題就是：為什麼可以這樣？

答案在**空中時間（airtime）**。這是 LoRa 跟 802.11 之間最根本的差異，而且差距大到會改變所有結論。

Meshtastic 預設的 LongFast 模式，實際資料速率是 **1.07 kbps**。對照 802.11g 的 54 Mbps，差了大約**五萬倍**。這意味著同樣一個小封包：

<figure class="mesh-fig">
<svg viewBox="0 0 440 175" role="img" aria-label="同一個封包在 Wi-Fi 與 LoRa LongFast 上佔用空中時間的對比">
  <text class="t-hi" x="20" y="20">同一個 16 bytes 的封包，佔用空中多久？</text>
  <text class="t-sm" x="20" y="46">802.11g（54 Mbps）</text>
  <rect x="20" y="54" width="400" height="16" rx="3" fill="var(--color-base-900)"/>
  <rect x="20" y="54" width="3" height="16" rx="1" fill="var(--color-accent-yellow)"/>
  <text class="t-sm" x="34" y="66">≈ 0.0024 ms — 在這張圖的比例尺上不到一個像素</text>
  <text class="t-sm" x="20" y="98">LoRa LongFast（1.07 kbps）</text>
  <text class="t-cy" x="420" y="98" text-anchor="end">≈ 354 ms</text>
  <rect x="20" y="106" width="400" height="16" rx="3" fill="var(--color-base-900)"/>
  <rect class="mesh-bar mesh-bar-lora" x="20" y="106" width="354" height="16" rx="3" style="--dur:4s"/>
  <line class="link" x1="20" y1="132" x2="420" y2="132"/>
  <g class="t-sm">
    <line class="link" x1="20" y1="132" x2="20" y2="137"/><text x="20" y="150" text-anchor="middle">0</text>
    <line class="link" x1="120" y1="132" x2="120" y2="137"/><text x="120" y="150" text-anchor="middle">100</text>
    <line class="link" x1="220" y1="132" x2="220" y2="137"/><text x="220" y="150" text-anchor="middle">200</text>
    <line class="link" x1="320" y1="132" x2="320" y2="137"/><text x="320" y="150" text-anchor="middle">300</text>
    <line class="link" x1="420" y1="132" x2="420" y2="137"/><text x="420" y="150" text-anchor="end">400 ms</text>
  </g>
  <text class="t-yl" x="220" y="168" text-anchor="middle">LoRa 的一個封包，就把頻道整整佔滿三分之一秒</text>
</svg>
<figcaption>LoRa 的設計哲學是「用速率換距離」。代價就是每個封包都要在空中待上數百毫秒——在這段期間，附近所有節點都不能講話。</figcaption>
</figure>

一旦意識到這件事，很多原本覺得偷懶的設計就變得合理了。

**在這個尺度下，維護路由表的控制封包本身就是奢侈品。** AODV 的一次 route discovery 要 flood 一輪 RREQ、等 RREP 回來——那已經是好幾個封包、好幾秒的空中時間。而在一個「一小時可能只有幾則訊息」的網路裡，**建立路徑的成本很可能高過直接把資料 flood 出去。**

換句話說：2008 年我們願意花控制封包去換取轉送效率，是因為**控制封包很便宜、資料很貴**。在 LoRa 上這個關係倒過來了。

還有第二個理由，這個更關鍵：

**VANET 是高移動性的。** 我當年題目最難的部分就在這裡——車在動，路徑建好可能三秒後就斷了，於是要花更多控制封包去修補、去預測、去繞路。整個領域的複雜度有很大一塊是**移動性逼出來的**。

**而 Meshtastic 的節點，絕大多數是不動的。** 架在屋頂、架在山頂、放在窗邊，一放好幾個月。拓樸幾乎是靜態的。

所以當年那個最難的題目，在這裡根本不存在。它不需要那些聰明的路由，因為它面對的不是那個世界。

## 五、老問題一個都沒少：hidden 與 exposed terminal

不過丟掉路由層，並不代表 MAC 層的老問題會跟著消失。它們全都還在，而且有些更嚴重。

### Hidden terminal

經典場景：A 跟 C 都聽得到 B，但 A 跟 C 彼此聽不到。兩邊都覺得頻道很安靜，於是同時送給 B。

<figure class="mesh-fig">
<svg viewBox="0 0 440 250" role="img" aria-label="Hidden terminal 動畫：A 與 C 互相聽不到，同時傳送給 B 造成碰撞">
  <path class="link-dash" d="M80 52 Q220 6 360 52"/>
  <text class="t-sm" x="220" y="20" text-anchor="middle">A 與 C 互相聽不到彼此</text>
  <line class="link" x1="92" y1="70" x2="208" y2="70"/>
  <line class="link" x1="232" y1="70" x2="348" y2="70"/>
  <circle class="node-on" cx="80" cy="70" r="11"/>
  <circle class="node-on" cx="360" cy="70" r="11"/>
  <circle class="node" cx="220" cy="70" r="11"/>
  <circle class="mesh-crash" cx="220" cy="70" r="15" fill="none" stroke="var(--color-accent-red)" stroke-width="2"/>
  <text class="t-sm" x="80" y="98" text-anchor="middle">A</text>
  <text class="t-sm" x="220" y="98" text-anchor="middle">B（兩邊都送給它）</text>
  <text class="t-sm" x="360" y="98" text-anchor="middle">C</text>
  <text class="t-sm" x="20" y="132">兩者各自佔用空中的時間：</text>
  <text class="t-sm" x="20" y="158">A 的封包</text>
  <rect class="mesh-bar mesh-bar-a" x="90" y="146" width="200" height="14" rx="3"/>
  <text class="t-sm" x="20" y="192">C 的封包</text>
  <rect class="mesh-bar mesh-bar-c" x="155" y="180" width="200" height="14" rx="3"/>
  <rect class="mesh-crash" x="155" y="140" width="135" height="60" rx="4"
        fill="var(--color-accent-red)" fill-opacity="0.16"
        stroke="var(--color-accent-red)" stroke-dasharray="4 3"/>
  <text class="mesh-crash t-rd" x="222" y="222" text-anchor="middle">重疊 → 在 B 那裡兩個封包一起毀了</text>
</svg>
<figcaption>A 與 C 都「聽不到對方在講話」，所以兩邊都認為頻道是空的。碰撞發生在接收端 B，而發送端完全不知情。</figcaption>
</figure>

這是教科書等級的 hidden terminal，但 Meshtastic 的處境比 802.11 更糟，原因有三個：

1. **沒有 RTS/CTS**。802.11 至少有這個（雖然實務上常常關掉）機制可以預約頻道，LoRa 這邊沒有對應的東西
2. **封包佔用時間長達數百毫秒**。碰撞的時間窗口比 Wi-Fi 大了好幾個數量級——你有整整三分之一秒的機會撞到別人
3. **網路本來就是 broadcast-heavy**。flooding 意味著同一個封包會被複製成很多份同時在空中飛

### Exposed terminal

反過來的情況：B 正在傳給 A，C 聽得到 B，於是 C 認為頻道忙碌而不敢傳給 D。但實際上 B→A 跟 C→D 兩組傳輸互不干擾，本來可以同時進行。

<figure class="mesh-fig">
<svg viewBox="0 0 440 175" role="img" aria-label="Exposed terminal：C 因為聽到 B 在傳輸而不敢送給 D，但兩組傳輸其實互不干擾">
  <circle class="node" cx="60" cy="95" r="10"/>
  <circle class="node-on" cx="165" cy="95" r="10"/>
  <circle class="node-on" cx="285" cy="95" r="10"/>
  <circle class="node" cx="390" cy="95" r="10"/>
  <text class="t-sm" x="60" y="122" text-anchor="middle">A</text>
  <text class="t-sm" x="165" y="122" text-anchor="middle">B</text>
  <text class="t-sm" x="285" y="122" text-anchor="middle">C</text>
  <text class="t-sm" x="390" y="122" text-anchor="middle">D</text>
  <path class="link-cy" d="M154 95 L76 95" marker-end="url(#mesh-arrow-cy)"/>
  <text class="t-cy" x="112" y="80" text-anchor="middle">傳輸中</text>
  <line class="link-dash" x1="177" y1="95" x2="273" y2="95"/>
  <text class="t-sm" x="225" y="80" text-anchor="middle">C 聽得到 B</text>
  <path class="link-dash" d="M296 95 L374 95"/>
  <text class="t-rd" x="335" y="80" text-anchor="middle">不敢傳</text>
  <text class="t-yl" x="220" y="152" text-anchor="middle">但 B→A 與 C→D 其實互不干擾，這段等待是純粹的浪費</text>
  <defs>
    <marker id="mesh-arrow-cy" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent-cyan)"/>
    </marker>
  </defs>
</svg>
<figcaption>Exposed terminal 損失的不是正確性而是容量——本來能平行的兩組傳輸被迫排隊。</figcaption>
</figure>

不過這裡 LoRa 跟 802.11 有一個真正的差異值得說：**在 LoRa 上，「同時傳送」不等於「一定死」。**

LoRa 是 chirp spread spectrum 調變，不同的 spreading factor 之間近乎正交，而且它有明顯的 **capture effect**——當兩個訊號同時到達，只要功率差夠大，接收端往往還是能把強的那個解出來。所以碰撞的結果取決於頻率、SF、接收功率差、時間重疊程度，而不是一個乾脆的「撞了就沒了」。

這讓 exposed terminal 造成的保守等待，在 LoRa 上顯得更可惜一點。

### 兩件事疊在一起才是真的麻煩

單獨看，flooding 只是浪費；單獨看，hidden terminal 只是機率性的碰撞。但兩者疊起來會互相放大：

<figure class="mesh-fig">
<svg viewBox="0 0 440 205" role="img" aria-label="Flooding 與 hidden terminal 的相乘效應：B 與 D 轉送同一個封包的兩份副本，同時撞在 C">
  <circle class="node-on" cx="60" cy="100" r="11"/>
  <text class="t-sm" x="60" y="128" text-anchor="middle">A（原始發送者）</text>
  <circle class="node-on" cx="200" cy="42" r="11"/>
  <text class="t-sm" x="200" y="28" text-anchor="middle">B</text>
  <circle class="node-on" cx="200" cy="158" r="11"/>
  <text class="t-sm" x="200" y="182" text-anchor="middle">D</text>
  <circle class="node" cx="345" cy="100" r="11"/>
  <text class="t-rd" x="378" y="104">C 💥</text>
  <line class="link-cy" x1="70" y1="94" x2="190" y2="50"/>
  <line class="link-cy" x1="70" y1="106" x2="190" y2="150"/>
  <line x1="211" y1="48" x2="335" y2="94" stroke="var(--color-accent-red)" stroke-width="2"/>
  <line x1="211" y1="152" x2="335" y2="106" stroke="var(--color-accent-red)" stroke-width="2"/>
  <path class="link-dash" d="M200 53 L200 147"/>
  <text class="t-sm" x="208" y="104">B、D 互相聽不到</text>
  <text class="t-yl" x="220" y="200" text-anchor="middle">B 與 D 轉送的是「同一個封包」的兩份副本，卻在 C 那裡撞在一起</text>
</svg>
<figcaption>最諷刺的部分：撞在一起的兩個封包，內容完全一樣。flooding 製造出來的冗餘副本，反過來變成碰撞的來源。</figcaption>
</figure>

flooding 本來就會製造冗餘的轉送，而這些冗餘副本又剛好來自彼此聽不到的節點。結果是**同一個封包的複製品互相把對方打掉**。這就是為什麼 Meshtastic 那套 SNR 競爭視窗、聽到就縮手的機制不是可有可無的優化，而是它能不能運作的關鍵。

## 六、風暴的代價沒有消失，只是轉嫁給使用者

到這裡可以回答一個很實際的問題：**為什麼 Meshtastic 社群一直在提醒大家「不要一直聊天」？**

因為廣播風暴的成本沒有被工程手段消滅，它只是被**移出了系統，轉嫁到使用規範上**。

一則訊息可能造成多次 RF 傳輸。所以：

- 一則 **「SOS，我在 XX 座標，8 人受困」**——幾十個 bytes，整個網路幫它轉幾次，完全沒問題
- 一百個人開始 **「早安」「收到」「哈哈」「你到了嗎」**——每一句都在同一個共享頻道上引發一輪擴散

這不是假想。Meshtastic 官方部落格記錄過紐西蘭 Wellington 的案例：那張網成長到**超過 150 個活躍節點**之後，繁忙站點的**頻道使用率尖峰超過 65%**，文字訊息變得極度不可靠，最後整個社群被迫從 LongFast 換到速率更快、傳得較近的調變模式。官方的建議是**超過 60 個節點、而且彼此距離不遠時，就該考慮換 preset**。

**六十個節點。** 這在 2008 年是我隨手就會跑的模擬規模，而它在真實世界裡就是天花板。

所以 Meshtastic 的使用守則——訊息要短、頻率要低、別閒聊——不是禮貌問題，是**協定把限制外包給了人類**。系統選擇不用複雜的機制去承受高流量，改成要求使用者不要製造高流量。

從工程角度看，這個決定其實相當誠實：它沒有假裝自己能做到做不到的事。

## 七、用 2008 年的成績單重新打分

如果把它丟進當年的評估框架，逐項來看：

| 指標 | Meshtastic 的表現 |
|---|---|
| **總傳輸容量** | 慘敗。1.07 kbps 的共享頻道，還要扣掉冗餘轉送 |
| **端到端延遲** | 差。每一跳都要重新排隊、隨機等待，秒級起跳 |
| **控制封包 overhead** | **極低**。沒有路由表要維護，這是它最漂亮的一項 |
| **封包到達率** | 稀疏網路下意外地好；密集網路下會崩 |
| **拓樸變動的韌性** | **極高**。沒有路徑可以斷，節點來去自如 |
| **實作複雜度** | **極低**。跑得動在八美元的 MCU 上 |

看這張表就清楚了：**它在我當年最在意的三個數字上全部輸掉，卻在我當年幾乎沒放進評估表的三個項目上大獲全勝。**

而它贏的那三項——控制開銷、拓樸韌性、實作複雜度——恰好就是「一台放在山頂、用太陽能供電、三個月沒人管的小盒子」真正需要的東西。

## 八、有趣的轉折：它正在慢慢走回來

最後這件事是我查資料時才發現的，也讓我對前面的判斷做了修正。

**Meshtastic 從 2.6 版開始，對點對點私訊引入了 next-hop 路由。** 做法大致是：一開始還是用 managed flooding 送，同時記錄哪些節點在幫忙轉送；一旦訊息成功送達並收到回應，那個被驗證過的中繼就被記下來當作 next hop，之後就限定由它轉送。而且——這一點很關鍵——**如果最後一次重傳還是沒聽到指定的 next hop 回應，它會退回 managed flooding。**

如果你熟悉 AODV，這個描述應該會讓你笑出來。**這就是 route discovery 加上 route maintenance**，只是用了一個更懶、也更便宜的形式：不主動發 RREQ 探路，而是拿第一次成功的資料傳輸當作探路的副產品；不維護完整拓樸，只記住「上次是誰幫我送到的」；一旦失效就退回氾濫。

十幾年前我們花很多力氣在爭論 reactive 跟 proactive 的取捨，而這裡出現的是一種**機會主義式的 reactive**——連 route discovery 的成本都不願意單獨付，硬是把它藏在第一次資料傳輸裡。

在一個 airtime 貴到這種程度的網路上，這其實是很聰明的答案。

## 九、結語：不是原始，是題目不同

我一開始覺得 Meshtastic 的設計「很原始」。寫完這篇之後，我認為那個判斷是錯的。

差別在於前提假設整組換掉了：

| | 2008 年的 VANET | 今天的 Meshtastic |
|---|---|---|
| 頻寬 | 幾 Mbps，還算夠用 | 1 kbps，近乎沒有 |
| 拓樸 | 高速移動，隨時在斷 | 幾乎靜止不動 |
| 流量 | 假設會持續、會密集 | 稀疏、突發、以短訊為主 |
| 因此 | 值得花控制封包換效率 | 每一毫秒都該留給資料本身 |

在「頻寬夠、拓樸一直變」的前提下，聰明的路由是划算的投資。在「頻寬近乎沒有、拓樸幾乎不動」的前提下，同樣那套聰明反而是純粹的成本。

**它不是沒學到我們當年的教訓——它留下了廣播抑制那一半，丟掉了路由那一半，因為它的題目跟我們當年的根本不是同一題。**

倒是有件事讓我有點感慨。當年做完論文，我一直覺得那些東西大概就停在模擬器裡了。結果十幾年後，一個開源社群把 multi-hop ad hoc network 真的送到了幾萬個人手上，然後在真實世界裡，一項一項地重新撞上我們當年在 ns-2 裡看過的每一個問題——廣播風暴、hidden terminal、頻道飽和、路徑失效。

只是這一次，撞上去的不是模擬結果，是真的有人在山上等著那則訊息送到。

---

### 參考資料

- [Meshtastic 官方文件：Mesh Algorithm（managed flooding、SNR 競爭視窗、2.6 的 next-hop 路由）](https://meshtastic.org/docs/overview/mesh-algo/)
- [Meshtastic 官方文件：Radio Settings（各調變模式的速率與 link budget）](https://meshtastic.org/docs/overview/radio-settings/)
- [Meshtastic 官方部落格：Is LongFast Holding Your Mesh Back?（Wellington 案例）](https://meshtastic.org/blog/why-your-mesh-should-switch-from-longfast/)
- Ni, Tseng, Chen, Sheu, [The Broadcast Storm Problem in a Mobile Ad Hoc Network](https://dl.acm.org/doi/10.1145/313451.313525), MobiCom '99
- Karp & Kung, [GPSR: Greedy Perimeter Stateless Routing for Wireless Networks](https://dl.acm.org/doi/10.1145/345910.345953), MobiCom '00
</content>
