export interface LinalgPage {
  slug: string;
  title: string;
  emoji: string;
  href: string;
  chapter: string;
}

/**
 * Canonical lesson order. Used by LinalgPageNav to compute prev/next links.
 * To add a new page: insert it here AND create the .astro file.
 */
export const LINALG_PAGES: LinalgPage[] = [
  { slug: 'transform',       title: '4×4 矩陣變換',  emoji: '🧊', href: '/math/linalg/transform',       chapter: 'Chapter 1' },
  { slug: 'composition',     title: '矩陣組合',      emoji: '🔗', href: '/math/linalg/composition',     chapter: 'Chapter 1' },
  { slug: 'projection',      title: '投影',          emoji: '📐', href: '/math/linalg/projection',      chapter: 'Chapter 2' },
  { slug: 'change-of-basis', title: '換基底',        emoji: '🔄', href: '/math/linalg/change-of-basis', chapter: 'Chapter 2' },
  { slug: 'eigen',           title: '特徵向量與對角化', emoji: '🌟', href: '/math/linalg/eigen',         chapter: 'Chapter 3' },
  { slug: 'svd',             title: 'SVD',           emoji: '🔱', href: '/math/linalg/svd',             chapter: 'Chapter 3' },
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
 *   - { label: "標題", description: "說明" }         — inline note
 *   - { label: "標題", description: "說明", href: ... } — link to external or detail page
 */
export const SUPPLEMENTS: Record<string, Supplement[]> = {
  transform: [],
  composition: [],
  projection: [],
  'change-of-basis': [],
  eigen: [],
  svd: [],
};
