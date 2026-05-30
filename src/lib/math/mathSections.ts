/**
 * Single registry for every /math/ lesson subsection (linalg, calculus,
 * probstat, …). One source of truth for: canonical lesson order (drives
 * prev/next in MathPageNav), the "回專區" fallback label, and per-page
 * supplementary reading.
 *
 * To add a lesson: add an entry to the relevant section's `pages` AND create
 * the matching .astro file. To add a whole subsection: add a MathSection here
 * and point its pages at `/math/<id>/...`.
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

export const MATH_SECTIONS: Record<string, MathSection> = {
  linalg: LINALG,
  calculus: CALCULUS,
  probstat: PROBSTAT,
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
