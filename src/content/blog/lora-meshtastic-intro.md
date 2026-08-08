---
title: "不用網路也能傳訊息：LoRa 與 Meshtastic 入門"
pubDate: 2026-08-08
description: "手機沒訊號的時候，還有什麼辦法把一句話送出去？LoRa 是一種用速率換距離的無線電技術，Meshtastic 是跑在它上面的開源網狀通訊系統。這篇從零開始講清楚它是什麼、怎麼運作、傳多遠、能做什麼，以及它做不到什麼。"
author: "wemee (with AI assistant)"
tags: ["LoRa", "Meshtastic", "mesh", "無線電", "災害備援"]
---

## 前言：訊號格數歸零之後

爬到稜線上，手機訊號剩一格，然後歸零。或者更糟一點：地震過後，基地台斷電，整個區域的行動網路一起消失。

這種時候，手機還是一台完整的電腦，但它失去了唯一的對外管道。你有電、有螢幕、有輸入法，就是沒辦法把一句「我在這裡、我沒事」送出去。

**LoRa 加上 Meshtastic，就是在解這個問題。** 它不是要取代 4G，而是在沒有任何基礎設施的情況下，讓一小段重要的文字，靠著一台台自願中繼的小裝置，傳到願意聽的人手上。

## 一、LoRa 不等於 Meshtastic

這兩個詞常常一起出現，很容易被當成同一個東西，但它們其實在不同層級：

- **LoRa**（Long Range）是一種**無線電傳輸技術**。它的特色是低功耗、傳得遠，代價是速率非常低。
- **Meshtastic** 是一套**跑在 LoRa 上的開源通訊系統**，讓多台 LoRa 裝置自動組成一張不需要基地台的網狀通訊網。

用一個大家熟的類比：

<figure class="mesh-fig">
<svg viewBox="0 0 480 200" role="img" aria-label="分層對照圖：Meshtastic 建立在 LoRa 之上，就像 LINE 建立在 Wi-Fi 之上">
  <text class="t-hi" x="125" y="26" text-anchor="middle">Meshtastic 這一組</text>
  <rect class="box" x="40" y="42" width="170" height="50" rx="6"/>
  <text class="t-cy" x="125" y="64" text-anchor="middle">Meshtastic</text>
  <text class="t-sm" x="125" y="80" text-anchor="middle">通訊系統（怎麼傳、傳給誰）</text>
  <rect class="box" x="40" y="104" width="170" height="50" rx="6"/>
  <text class="t-cy" x="125" y="126" text-anchor="middle">LoRa</text>
  <text class="t-sm" x="125" y="142" text-anchor="middle">無線電技術（電波怎麼飛）</text>
  <text class="t-hi" x="355" y="26" text-anchor="middle">就像這一組</text>
  <rect class="box" x="270" y="42" width="170" height="50" rx="6"/>
  <text x="355" y="64" text-anchor="middle">LINE</text>
  <text class="t-sm" x="355" y="80" text-anchor="middle">通訊軟體</text>
  <rect class="box" x="270" y="104" width="170" height="50" rx="6"/>
  <text x="355" y="126" text-anchor="middle">Wi-Fi</text>
  <text class="t-sm" x="355" y="142" text-anchor="middle">無線電技術</text>
  <text class="t-yl" x="240" y="180" text-anchor="middle">關鍵差別：右邊那組需要基地台或路由器，左邊那組什麼都不需要</text>
</svg>
<figcaption>LoRa 是「電波怎麼飛」，Meshtastic 是「訊息怎麼送到人」。兩者是上下層關係，不是替代關係。</figcaption>
</figure>

差別在於，LINE 需要網際網路、Wi-Fi 需要路由器；而 Meshtastic 兩者都不需要。

## 二、它實際怎麼運作

你要準備的是一台 LoRa 節點（一個手掌大、有天線的小盒子）。整個流程是這樣：

<figure class="mesh-fig">
<svg viewBox="0 0 400 160" role="img" aria-label="多跳中繼動畫：訊息從你的手機經藍牙傳到自己的節點，再經過數個節點的 LoRa 中繼，最後送到對方手機">
  <line class="link" x1="40" y1="70" x2="116" y2="70"/>
  <line class="link" x1="116" y1="70" x2="192" y2="70"/>
  <line class="link" x1="192" y1="70" x2="268" y2="70"/>
  <line class="link" x1="268" y1="70" x2="344" y2="70"/>
  <text class="t-sm" x="78" y="60" text-anchor="middle">藍牙</text>
  <text class="t-sm" x="154" y="60" text-anchor="middle">LoRa</text>
  <text class="t-sm" x="230" y="60" text-anchor="middle">LoRa</text>
  <text class="t-sm" x="306" y="60" text-anchor="middle">藍牙</text>
  <circle class="mesh-ping" cx="40" cy="70" r="13" style="--d:0.1s"/>
  <circle class="mesh-ping" cx="116" cy="70" r="13" style="--d:1.5s"/>
  <circle class="mesh-ping" cx="192" cy="70" r="13" style="--d:2.8s"/>
  <circle class="mesh-ping" cx="268" cy="70" r="13" style="--d:4.1s"/>
  <circle class="mesh-ping" cx="344" cy="70" r="13" style="--d:5.4s"/>
  <circle class="node-on" cx="40" cy="70" r="9"/>
  <circle class="node-on" cx="116" cy="70" r="9"/>
  <circle class="node-on" cx="192" cy="70" r="9"/>
  <circle class="node-on" cx="268" cy="70" r="9"/>
  <circle class="node-on" cx="344" cy="70" r="9"/>
  <g class="mesh-packet"><circle cx="40" cy="70" r="5"/></g>
  <text class="t-sm" x="40" y="98" text-anchor="middle">你的手機</text>
  <text class="t-sm" x="116" y="98" text-anchor="middle">你的節點</text>
  <text class="t-sm" x="192" y="98" text-anchor="middle">陌生人的節點</text>
  <text class="t-sm" x="268" y="98" text-anchor="middle">對方的節點</text>
  <text class="t-sm" x="344" y="98" text-anchor="middle">對方手機</text>
  <text class="t-yl" x="200" y="132" text-anchor="middle">全程不經過 4G、5G、Wi-Fi 或網際網路</text>
</svg>
<figcaption>你的手機只跟自己的節點講藍牙，剩下的路由中間那些節點自動幫你跑完。中繼的節點不需要認識你。</figcaption>
</figure>

值得注意的是中間那個「陌生人的節點」。**Meshtastic 網路裡的每一台裝置，預設都會幫別人轉送訊息。** 你架一台節點，除了自己能用，同時也讓經過的其他人多一條路。這是整個系統能運作的前提。

## 三、Mesh 是什麼？為什麼節點越多越好

一般的無線電是點對點：我對你喊話，距離太遠就聽不到，沒有第三種可能。

Mesh（網狀）網路多了一個選項——**找人幫忙傳**：

<figure class="mesh-fig">
<svg viewBox="0 0 480 190" role="img" aria-label="點對點與網狀網路的對比圖">
  <text class="t-hi" x="120" y="26" text-anchor="middle">一般點對點</text>
  <circle class="node" cx="50" cy="90" r="10"/>
  <text class="t-sm" x="50" y="115" text-anchor="middle">A</text>
  <circle class="node" cx="190" cy="90" r="10"/>
  <text class="t-sm" x="190" y="115" text-anchor="middle">D</text>
  <line class="link-dash" x1="62" y1="90" x2="178" y2="90"/>
  <text class="t-rd" x="120" y="84" text-anchor="middle">✕</text>
  <text class="t-sm" x="120" y="145" text-anchor="middle">距離太遠就結束了</text>
  <line class="link-dash" x1="240" y1="40" x2="240" y2="160"/>
  <text class="t-hi" x="360" y="26" text-anchor="middle">Mesh 網狀</text>
  <circle class="node" cx="290" cy="110" r="10"/>
  <text class="t-sm" x="290" y="135" text-anchor="middle">A</text>
  <circle class="node-on" cx="336" cy="65" r="10"/>
  <text class="t-sm" x="336" y="52" text-anchor="middle">B</text>
  <circle class="node-on" cx="386" cy="115" r="10"/>
  <text class="t-sm" x="386" y="140" text-anchor="middle">C</text>
  <circle class="node" cx="435" cy="68" r="10"/>
  <text class="t-sm" x="435" y="55" text-anchor="middle">D</text>
  <line class="link-cy" x1="299" y1="103" x2="327" y2="73"/>
  <line class="link-cy" x1="344" y1="74" x2="378" y2="106"/>
  <line class="link-cy" x1="395" y1="108" x2="426" y2="77"/>
  <text class="t-sm" x="360" y="168" text-anchor="middle">B、C 幫忙轉送，A 就能到 D</text>
</svg>
<figcaption>A 連不到 D，但只要中間有人願意轉送，訊息就能繞過去。這也是為什麼一個地區的節點越多，每個人的可用範圍就越大。</figcaption>
</figure>

這帶來一個很重要的性質：**Meshtastic 的覆蓋範圍不是你買的裝置決定的，是你所在地區有多少人在用決定的。** 一台節點孤零零地放在沒人的地方，能做的事非常有限。

## 四、傳多遠？

這題沒有單一答案，因為它極度受地形、節點高度和天線影響。同一台機器放在陽台跟放在山頂，差距可以是十倍。

大致可以這樣抓：

<figure class="mesh-fig">
<svg viewBox="0 0 480 150" role="img" aria-label="不同環境下的 LoRa 傳輸距離範圍">
  <line class="link" x1="90" y1="118" x2="465" y2="118"/>
  <g class="t-sm">
    <line class="link" x1="90" y1="118" x2="90" y2="124"/><text x="90" y="138" text-anchor="middle">0</text>
    <line class="link" x1="164" y1="118" x2="164" y2="124"/><text x="164" y="138" text-anchor="middle">10</text>
    <line class="link" x1="238" y1="118" x2="238" y2="124"/><text x="238" y="138" text-anchor="middle">20</text>
    <line class="link" x1="312" y1="118" x2="312" y2="124"/><text x="312" y="138" text-anchor="middle">30</text>
    <line class="link" x1="386" y1="118" x2="386" y2="124"/><text x="386" y="138" text-anchor="middle">40</text>
    <line class="link" x1="460" y1="118" x2="460" y2="124"/><text x="460" y="138" text-anchor="middle">50 km</text>
  </g>
  <text class="t-sm" x="82" y="34" text-anchor="end">市區</text>
  <rect x="97" y="24" width="30" height="14" rx="3" fill="var(--color-accent-red)" opacity="0.75"/>
  <text class="t-sm" x="135" y="34">1–5 km（建物遮蔽嚴重）</text>
  <text class="t-sm" x="82" y="62" text-anchor="end">郊區</text>
  <rect x="127" y="52" width="74" height="14" rx="3" fill="var(--color-accent-yellow)" opacity="0.8"/>
  <text class="t-sm" x="209" y="62">5–15 km</text>
  <text class="t-sm" x="82" y="90" text-anchor="end">山頂對山頂</text>
  <rect x="238" y="80" width="222" height="14" rx="3" fill="var(--color-accent-cyan)" opacity="0.85"/>
  <text class="t-sm" x="252" y="90">20–50 km 以上（視線無遮蔽）</text>
</svg>
<figcaption>單跳的大致級距。實際數字受地形、高度、天線影響極大，這裡只能當量級參考。再透過多個節點接力，總距離可以延伸到上百公里。</figcaption>
</figure>

決定距離的因素，重要性大概是：**擺放高度 > 天線 > 地形 > 裝置型號**。很多人升級了機器卻沒感覺，換個位置架上屋頂反而立刻有效。

## 五、能拿來做什麼

實務上常見的用途：

- **登山、露營**：隊伍拉開之後互報位置與狀況
- **車隊、越野**：山區無訊號路段的隊內通聯
- **災害備援**：基地台失效時的最低限度通訊
- **GPS 位置分享**：節點自動回報座標，在地圖上看到彼此
- **IoT 感測回報**：溫濕度、水位之類的低頻率資料

共同點是：**訊息短、頻率低、但很重要。**

## 六、它做不到什麼

這部分比上面那節更該讀。Meshtastic **不是行動網路的替代品**，它的限制是結構性的，不會靠買更貴的機器解決：

- **不能語音通話**，也不能傳照片、影片
- **速率極低**。預設的 LongFast 模式下，實際資料速率大約只有 **1.07 kbps**——不是 Mbps，是 kbps。同一段時間 Wi-Fi 能傳的量，這裡要傳上好幾個鐘頭
- **延遲高**。訊息每經過一次中繼都要重新發送一次，不是即時通訊的體感
- **不能一直聊天**。這是最違反直覺的一點：**訊息量太大反而會讓整個網路癱瘓**，後面會提到
- **附近沒有節點，就沒有 mesh**。這是最現實的一條

那個「不能一直聊天」的限制背後有很紮實的技術原因，我另外寫了一篇專門講它：[當年我們拼命避免廣播風暴，Meshtastic 卻選擇擁抱它](/blog/meshtastic-broadcast-storm)。

## 七、要買什麼、多少錢

入門只需要三樣：**一台 LoRa 節點 + 一支手機（Android 或 iPhone）+ Meshtastic App**。

常見的機種像 LilyGO T-Beam、Heltec、Seeed T1000-E，價格大約落在新台幣 1,000–3,000 元。差價主要來自：

| 差異項目 | 影響 |
|---|---|
| 有無 GPS | 能不能自動回報自己的位置 |
| 電池容量 | 能撐幾天不充電 |
| 有無螢幕 | 不接手機時能否直接看訊息 |
| 防水等級 | 能不能長期架在戶外 |
| 天線品質 | 直接影響傳輸距離 |

**在台灣買機器有一個一定要先確認的規格：頻段。** 台灣使用的是 **920–925 MHz**，買錯頻段（例如歐規 868 MHz、美規 915 MHz）的機器不但可能跟在地社群連不上，還牽涉到法規問題。下單前先確認賣家標的是否為 TW 版本。

## 八、台灣現在的情況

如果你在台灣，有兩件事值得先做，再決定要不要花錢：

1. **先查你家附近有沒有節點。** 可以看 [meshmap.net](https://meshmap.net/) 之類的公開節點地圖。這件事比挑機型重要——如果方圓十幾公里內一個節點都沒有，你買回來的會是一台只能自己跟自己講話的機器。
2. **找到在地社群。** 台灣有一個相當活躍的 [臺灣鏈網 Meshtastic Taiwan Community](https://meshtw.github.io/)，社群裡會協調大家用哪個頻道與設定。**Meshtastic 不是插電就能通，頻段、調變模式、頻道設定不一致就是連不上**，跟著在地社群的建議設定是最快的路。

根據媒體報導，台灣的 Meshtastic 社群自 2024 年成立以來已經累積到數萬人規模、上千台裝置在運作，主要集中在幾個都會區與山區的高點。

## 九、為什麼最近變熱門

幾個原因湊在一起：

- **沒有月租費**。買一次機器就結束，不需要 SIM 卡、不需要門號
- **開源**。韌體、App、生態系全部公開，可以自己改
- **耗電低**。一顆行動電源可以撐上好幾天，接小太陽能板就能長期放著
- **有加密**。這點需要精確一點的說法：頻道訊息用 AES-256 加密，但**同一個頻道的人都持有同一把金鑰**，所以那不算真正的端對端加密；而較新版本韌體的**點對點私訊**改用公開金鑰加密，才是真正只有對方能解。另外封包標頭是不加密的（中繼節點必須讀得懂才能轉送），所以誰在跟誰講話這類 metadata 並沒有被藏起來
- **基地台掛掉它還在**。這是 2024 年之後台灣社群成長最主要的動力

## 結語

Meshtastic 適合的是這種人：願意接受「慢、短、可能會漏」的通訊品質，換取「在完全沒有基礎設施的地方也能送出一句話」的能力。它不會取代你的手機，但它可能在手機最沒用的那一刻派上用場。

如果你看完想再往下走，有兩個方向：

- **技術上**，它為什麼刻意不做傳統的路由、而選擇讓訊息在網路裡「氾濫」？這個設計看起來很粗糙，但背後是一組非常清楚的取捨。我用自己十幾年前研究無線隨意網路路由的角度寫了一篇：[當年我們拼命避免廣播風暴，Meshtastic 卻選擇擁抱它](/blog/meshtastic-broadcast-storm)
- **實務上**，「我家附近沒有節點，那我自己架一台有意義嗎？」——這題我打算真的買一台來實測再寫

---

### 參考資料

- [Meshtastic 官方文件：Mesh Algorithm](https://meshtastic.org/docs/overview/mesh-algo/)
- [Meshtastic 官方文件：Radio Settings（調變模式與速率）](https://meshtastic.org/docs/overview/radio-settings/)
- [Meshtastic 官方文件：Encryption](https://meshtastic.org/docs/overview/encryption/)
- [臺灣鏈網 Meshtastic Taiwan Community](https://meshtw.github.io/)
</content>
