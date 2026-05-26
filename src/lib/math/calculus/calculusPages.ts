export interface CalculusPage {
  slug: string;
  title: string;
  emoji: string;
  href: string;
  chapter: string;
}

/**
 * Canonical lesson order. Used by CalcPageNav to compute prev/next links.
 * To add a new page: insert it here AND create the .astro file.
 *
 * Chapter 4 (神經網路應用 — backprop / gradient-descent / activation-zoo)
 * is planned but not yet implemented; append entries here when shipping it.
 */
export const CALCULUS_PAGES: CalculusPage[] = [
  { slug: 'slope-tangent', title: '導數即斜率',     emoji: '📈', href: '/math/calculus/slope-tangent', chapter: 'Chapter 1' },
  { slug: 'chain-rule',    title: '鏈式法則',       emoji: '🔗', href: '/math/calculus/chain-rule',    chapter: 'Chapter 1' },
  { slug: 'riemann',       title: '黎曼和',         emoji: '📊', href: '/math/calculus/riemann',       chapter: 'Chapter 2' },
  { slug: 'ftc',           title: '微積分基本定理', emoji: '🔄', href: '/math/calculus/ftc',           chapter: 'Chapter 2' },
  { slug: 'taylor',        title: '泰勒展開',       emoji: '🎯', href: '/math/calculus/taylor',        chapter: 'Chapter 3' },
  { slug: 'gradient',      title: '梯度與方向導數', emoji: '🧭', href: '/math/calculus/gradient',      chapter: 'Chapter 3' },
];

export interface Supplement {
  label: string;
  description?: string;
  href?: string; // external link or future detail page
}

/**
 * Supplementary learning material per page. Free for the human owner to extend.
 * Append entries here and they'll show up in the "📚 補充閱讀" box on that page.
 *
 * Each entry can be:
 *   - { label: "標題", description: "說明" }            — inline note
 *   - { label: "標題", description: "說明", href: ... } — link to external or detail page
 */
export const SUPPLEMENTS: Record<string, Supplement[]> = {
  'slope-tangent': [],
  'chain-rule': [],
  riemann: [],
  ftc: [],
  taylor: [],
  gradient: [],
};
