/**
 * Single registry for every lesson subsection on the site — /math/ (linalg,
 * calculus, probstat) and /physics/ alike. One source of truth for: canonical
 * lesson order (drives prev/next in MathPageNav), the "回專區" fallback label,
 * and per-page supplementary reading.
 *
 * The file still lives under src/lib/math/ for historical reasons; nothing in
 * it is /math/-specific — `indexHref` carries the URL prefix, so a section can
 * sit anywhere. Physics pages never import this directly; MathLessonLayout
 * resolves everything from `section` + `slug`.
 *
 * To add a lesson: add an entry to the relevant section's `pages` AND create
 * the matching .astro file. To add a whole subsection: add a MathSection here
 * and point its pages at `/<prefix>/<id>/...`.
 */

export interface MathPage {
  slug: string;
  /** short label used in nav cards (prev/next, index) */
  title: string;
  /**
   * Optional richer title for the page's visible <h1> when it differs from the
   * short nav `title` (e.g. keeps an English subtitle). Defaults to `title`.
   */
  displayTitle?: string;
  emoji: string;
  href: string;
  chapter: string;
}

export interface Supplement {
  label: string;
  description?: string;
  href?: string; // external link or future detail page
}

export interface MathSection {
  /** url segment, e.g. 'calculus' — also the MathPageNav `section` prop */
  id: string;
  /** landing page, e.g. '/math/calculus/' */
  indexHref: string;
  /** section emoji used in the "回專區" label, e.g. '📐' */
  sectionEmoji: string;
  /** bare section name (no emoji, no 專區 suffix), e.g. '微積分' */
  name: string;
  /**
   * Header eyebrow "part" label per chapter, e.g. { 'Chapter 1': '導數' }.
   * Rendered as "{chapter} · {part}" above each lesson title.
   */
  parts: Record<string, string>;
  /** canonical lesson order */
  pages: MathPage[];
  /**
   * Per-page supplementary reading. Keyed by page slug; append entries and
   * they surface in the "📚 補充閱讀" box. Empty arrays are fine.
   */
  supplements: Record<string, Supplement[]>;
}

const LINALG: MathSection = {
  id: 'linalg',
  indexHref: '/math/linalg/',
  sectionEmoji: '📚',
  name: '線性代數',
  parts: { 'Chapter 1': '直覺基礎', 'Chapter 2': '核心工具', 'Chapter 3': '分解與譜論' },
  pages: [
    { slug: 'transform',       title: '4×4 矩陣變換',     emoji: '🧊', href: '/math/linalg/transform',       chapter: 'Chapter 1' },
    { slug: 'composition',     title: '矩陣組合',         emoji: '🔗', href: '/math/linalg/composition',     chapter: 'Chapter 1' },
    { slug: 'projection',      title: '投影',             displayTitle: '投影 (Projection)',      emoji: '📐', href: '/math/linalg/projection',      chapter: 'Chapter 2' },
    { slug: 'change-of-basis', title: '換基底',           displayTitle: '換基底 Change of Basis',  emoji: '🔄', href: '/math/linalg/change-of-basis', chapter: 'Chapter 2' },
    { slug: 'eigen',           title: '特徵向量與對角化', emoji: '🌟', href: '/math/linalg/eigen',           chapter: 'Chapter 3' },
    { slug: 'svd',             title: 'SVD',              displayTitle: '奇異值分解 SVD',          emoji: '🔱', href: '/math/linalg/svd',             chapter: 'Chapter 3' },
  ],
  supplements: {
    transform: [],
    composition: [],
    projection: [],
    'change-of-basis': [],
    eigen: [],
    svd: [],
  },
};

const CALCULUS: MathSection = {
  id: 'calculus',
  indexHref: '/math/calculus/',
  sectionEmoji: '📐',
  name: '微積分',
  parts: { 'Chapter 1': '導數', 'Chapter 2': '積分', 'Chapter 3': '應用' },
  pages: [
    { slug: 'slope-tangent', title: '導數即斜率',     emoji: '📈', href: '/math/calculus/slope-tangent', chapter: 'Chapter 1' },
    { slug: 'chain-rule',    title: '鏈式法則',       emoji: '🔗', href: '/math/calculus/chain-rule',    chapter: 'Chapter 1' },
    { slug: 'riemann',       title: '黎曼和',         emoji: '📊', href: '/math/calculus/riemann',       chapter: 'Chapter 2' },
    { slug: 'ftc',           title: '微積分基本定理', emoji: '🔄', href: '/math/calculus/ftc',           chapter: 'Chapter 2' },
    { slug: 'taylor',        title: '泰勒展開',       emoji: '🎯', href: '/math/calculus/taylor',        chapter: 'Chapter 3' },
    { slug: 'gradient',      title: '梯度與方向導數', emoji: '🧭', href: '/math/calculus/gradient',      chapter: 'Chapter 3' },
  ],
  supplements: {
    'slope-tangent': [],
    'chain-rule': [],
    riemann: [],
    ftc: [],
    taylor: [],
    gradient: [],
  },
};

const PROBSTAT: MathSection = {
  id: 'probstat',
  indexHref: '/math/probstat/',
  sectionEmoji: '🎲',
  name: '機率統計',
  parts: { 'Chapter 1': '基礎', 'Chapter 2': '推論', 'Chapter 3': '模擬與資訊' },
  pages: [
    { slug: 'distributions', title: '機率分布動物園',     emoji: '📦', href: '/math/probstat/distributions', chapter: 'Chapter 1' },
    { slug: 'lln-clt',       title: '大數法則與中央極限', displayTitle: '大數法則 與 中央極限定理', emoji: '🎯', href: '/math/probstat/lln-clt',       chapter: 'Chapter 1' },
    { slug: 'bayes',         title: '貝氏定理',           emoji: '🔮', href: '/math/probstat/bayes',         chapter: 'Chapter 2' },
    { slug: 'mle',           title: '最大似然估計',       emoji: '📏', href: '/math/probstat/mle',           chapter: 'Chapter 2' },
    { slug: 'markov',        title: '馬可夫鏈與 MCMC',    emoji: '🚶', href: '/math/probstat/markov',        chapter: 'Chapter 3' },
    { slug: 'entropy',       title: '熵與 KL 散度',       emoji: '🔥', href: '/math/probstat/entropy',       chapter: 'Chapter 3' },
  ],
  supplements: {
    distributions: [],
    'lln-clt': [],
    bayes: [],
    mle: [],
    markov: [],
    entropy: [],
  },
};

const PHYSICS: MathSection = {
  id: 'physics',
  indexHref: '/physics/',
  sectionEmoji: '⚛️',
  name: '物理',
  parts: { 'Chapter 1': '從古典到統計', 'Chapter 2': '波動作為橋樑', 'Chapter 3': '量子的硬骨頭' },
  pages: [
    { slug: 'coupled-oscillator', title: '耦合振子與正常模態', emoji: '🪀', href: '/physics/coupled-oscillator', chapter: 'Chapter 1' },
    { slug: 'ising',              title: '二維 Ising 與相變',   displayTitle: '二維 Ising 模型與相變', emoji: '🧲', href: '/physics/ising',   chapter: 'Chapter 1' },
    { slug: 'uncertainty',        title: '不確定性原理',        displayTitle: '不確定性原理 = 傅立葉對偶', emoji: '🌊', href: '/physics/uncertainty', chapter: 'Chapter 2' },
    { slug: 'double-slit',        title: '雙狹縫與單光子',      displayTitle: '雙狹縫與單光子累積', emoji: '🔦', href: '/physics/double-slit', chapter: 'Chapter 2' },
    { slug: 'tunneling',          title: '量子穿隧',            displayTitle: '量子穿隧 — 解含時薛丁格方程', emoji: '🚧', href: '/physics/tunneling', chapter: 'Chapter 3' },
    { slug: 'bell',               title: '貝爾不等式',          displayTitle: '貝爾不等式與 CHSH 實驗', emoji: '🔗', href: '/physics/bell', chapter: 'Chapter 3' },
  ],
  supplements: {
    'coupled-oscillator': [
      { label: '🌟 特徵向量與對角化', description: '本頁的「正常模態」就是那一頁的特徵向量', href: '/math/linalg/eigen' },
    ],
    ising: [
      { label: '🚶 馬可夫鏈與 MCMC', description: '本頁翻自旋用的 Metropolis 就是那一頁的演算法本人', href: '/math/probstat/markov' },
      { label: '🔥 熵與 KL 散度', description: '自由能 F = E − TS 裡的那個 S', href: '/math/probstat/entropy' },
    ],
    uncertainty: [
      { label: '🎨 傅立葉畫畫', description: '先看「任何波形都能拆成正弦波」', href: '/math/fourier' },
      { label: '🎛️ 波形合成器', description: '諧波疊加與頻譜的互動版本', href: '/math/waveform' },
    ],
    'double-slit': [
      { label: '🌊 不確定性原理', description: '雙峰波包在動量空間就是干涉條紋', href: '/physics/uncertainty' },
    ],
    tunneling: [
      { label: '🌊 不確定性原理', description: '波包有能量寬度，所以模擬的穿透率不會剛好等於單一能量的理論值', href: '/physics/uncertainty' },
    ],
    bell: [
      { label: '📦 機率分布動物園', description: '本頁全程在做取樣與估計，沒有玄學', href: '/math/probstat/distributions' },
      { label: '🎯 大數法則與中央極限', description: '為什麼 S 的誤差棒隨 1/√N 縮小', href: '/math/probstat/lln-clt' },
    ],
  },
};

const RF: MathSection = {
  id: 'rf',
  indexHref: '/physics/rf/',
  sectionEmoji: '📡',
  name: '電波',
  parts: { 'Chapter 1': '把訊號送出去', 'Chapter 2': '真實世界的破壞', 'Chapter 3': '極限與網路' },
  pages: [
    { slug: 'link-budget', title: '路徑損耗與鏈路預算', emoji: '📉', href: '/physics/rf/link-budget', chapter: 'Chapter 1' },
    { slug: 'antenna',     title: '天線陣列與波束成形', emoji: '📶', href: '/physics/rf/antenna',     chapter: 'Chapter 1' },
    { slug: 'fresnel',     title: '菲涅耳區與刀鋒繞射', emoji: '⛰️', href: '/physics/rf/fresnel',     chapter: 'Chapter 2' },
    { slug: 'multipath',   title: '多路徑衰落與都卜勒', emoji: '🌫️', href: '/physics/rf/multipath',   chapter: 'Chapter 2' },
    { slug: 'shannon',     title: '香農容量極限',       displayTitle: '香農容量極限 — 這條線誰都過不去', emoji: '🧮', href: '/physics/rf/shannon', chapter: 'Chapter 3' },
    { slug: 'mesh',        title: '多跳網路與廣播抑制', displayTitle: '多跳網路：氾濫、抑制與空中時間', emoji: '🕸️', href: '/physics/rf/mesh', chapter: 'Chapter 3' },
  ],
  supplements: {
    'link-budget': [
      { label: '📻 LoRa 與 Meshtastic 入門', description: '這頁算出來的距離，那篇在講它能拿來做什麼', href: '/blog/lora-meshtastic-intro' },
    ],
    antenna: [
      { label: '🎨 傅立葉畫畫', description: '陣列因子就是激發分布的傅立葉變換', href: '/math/fourier' },
      { label: '🌊 不確定性原理', description: '孔徑越大、波束越窄 — 就是 Δx·Δk ≥ ½ 換了個名字', href: '/physics/uncertainty' },
    ],
    fresnel: [
      { label: '🔦 雙狹縫與單光子累積', description: '繞射是同一件事，只是這裡的障礙物是一座山', href: '/physics/double-slit' },
    ],
    multipath: [
      { label: '🎯 大數法則與中央極限', description: '為什麼多重反射的合成會收斂成 Rayleigh 分布', href: '/math/probstat/lln-clt' },
      { label: '📦 機率分布動物園', description: 'Rayleigh 與指數分布長什麼樣', href: '/math/probstat/distributions' },
    ],
    shannon: [
      { label: '🔥 熵與 KL 散度', description: '容量的單位是 bit，而 bit 的定義在那一頁', href: '/math/probstat/entropy' },
    ],
    mesh: [
      { label: '🌪️ 當年我們拼命避免廣播風暴，Meshtastic 卻選擇擁抱它', description: '這個模擬器就是那篇文章的可操作版本', href: '/blog/meshtastic-broadcast-storm' },
      { label: '📻 LoRa 與 Meshtastic 入門', description: '沒碰過 Meshtastic 的話先看這篇', href: '/blog/lora-meshtastic-intro' },
    ],
  },
};

export const MATH_SECTIONS: Record<string, MathSection> = {
  linalg: LINALG,
  calculus: CALCULUS,
  probstat: PROBSTAT,
  physics: PHYSICS,
  rf: RF,
};

/** "📐 微積分專區" — the emoji label used by the MathPageNav fallback cards. */
export function sectionIndexLabel(section: MathSection): string {
  return `${section.sectionEmoji} ${section.name}專區`;
}

export interface SectionNav {
  prev: MathPage | null;
  next: MathPage | null;
  supplements: Supplement[];
  indexHref: string;
  indexLabel: string;
}

/** Resolve prev/next/supplements for one lesson within its section. */
export function getSectionNav(sectionId: string, slug: string): SectionNav {
  const section = requireSection(sectionId);
  const { pages } = section;
  const idx = pages.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null,
    supplements: section.supplements[slug] ?? [],
    indexHref: section.indexHref,
    indexLabel: sectionIndexLabel(section),
  };
}

export interface LessonHeader {
  /** emoji + title, e.g. '🎯 泰勒展開' (visible <h1>) */
  emoji: string;
  title: string;
  /** "Chapter 3 · 應用" — chapter plus the section's part label */
  eyebrow: string;
  /** back-link target, e.g. '/math/calculus/' */
  indexHref: string;
  /** breadcrumb text, e.g. '回微積分專區' */
  backLabel: string;
}

/** Everything MathLessonLayout needs to render the breadcrumb + header. */
export function getLessonHeader(sectionId: string, slug: string): LessonHeader {
  const section = requireSection(sectionId);
  const page = section.pages.find((p) => p.slug === slug);
  if (!page) {
    throw new Error(`Unknown lesson "${slug}" in math section "${sectionId}"`);
  }
  const part = section.parts[page.chapter];
  return {
    emoji: page.emoji,
    title: page.displayTitle ?? page.title,
    eyebrow: part ? `${page.chapter} · ${part}` : page.chapter,
    indexHref: section.indexHref,
    backLabel: `回${section.name}專區`,
  };
}

function requireSection(sectionId: string): MathSection {
  const section = MATH_SECTIONS[sectionId];
  if (!section) {
    throw new Error(`Unknown math section "${sectionId}"`);
  }
  return section;
}
