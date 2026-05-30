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
  title: string;
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
  /** "回專區" card label, e.g. '📐 微積分專區' */
  indexLabel: string;
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
  indexLabel: '📚 線性代數專區',
  pages: [
    { slug: 'transform',       title: '4×4 矩陣變換',     emoji: '🧊', href: '/math/linalg/transform',       chapter: 'Chapter 1' },
    { slug: 'composition',     title: '矩陣組合',         emoji: '🔗', href: '/math/linalg/composition',     chapter: 'Chapter 1' },
    { slug: 'projection',      title: '投影',             emoji: '📐', href: '/math/linalg/projection',      chapter: 'Chapter 2' },
    { slug: 'change-of-basis', title: '換基底',           emoji: '🔄', href: '/math/linalg/change-of-basis', chapter: 'Chapter 2' },
    { slug: 'eigen',           title: '特徵向量與對角化', emoji: '🌟', href: '/math/linalg/eigen',           chapter: 'Chapter 3' },
    { slug: 'svd',             title: 'SVD',              emoji: '🔱', href: '/math/linalg/svd',             chapter: 'Chapter 3' },
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
  indexLabel: '📐 微積分專區',
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
  indexLabel: '🎲 機率統計專區',
  pages: [
    { slug: 'distributions', title: '機率分布動物園',     emoji: '📦', href: '/math/probstat/distributions', chapter: 'Chapter 1' },
    { slug: 'lln-clt',       title: '大數法則與中央極限', emoji: '🎯', href: '/math/probstat/lln-clt',       chapter: 'Chapter 1' },
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

export interface SectionNav {
  prev: MathPage | null;
  next: MathPage | null;
  supplements: Supplement[];
  indexHref: string;
  indexLabel: string;
}

/** Resolve prev/next/supplements for one lesson within its section. */
export function getSectionNav(sectionId: string, slug: string): SectionNav {
  const section = MATH_SECTIONS[sectionId];
  if (!section) {
    throw new Error(`Unknown math section "${sectionId}"`);
  }
  const { pages } = section;
  const idx = pages.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null,
    supplements: section.supplements[slug] ?? [],
    indexHref: section.indexHref,
    indexLabel: section.indexLabel,
  };
}
