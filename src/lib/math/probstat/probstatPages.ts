export interface ProbStatPage {
  slug: string;
  title: string;
  emoji: string;
  href: string;
  chapter: string;
}

/**
 * Canonical lesson order. Used by ProbStatPageNav to compute prev/next links.
 * To add a new page: insert it here AND create the .astro file.
 */
export const PROBSTAT_PAGES: ProbStatPage[] = [
  { slug: 'distributions', title: '機率分布動物園', emoji: '📦', href: '/math/probstat/distributions', chapter: 'Chapter 1' },
  { slug: 'lln-clt',       title: '大數法則與中央極限', emoji: '🎯', href: '/math/probstat/lln-clt',       chapter: 'Chapter 1' },
  { slug: 'bayes',         title: '貝氏定理',           emoji: '🔮', href: '/math/probstat/bayes',         chapter: 'Chapter 2' },
  { slug: 'mle',           title: '最大似然估計',        emoji: '📏', href: '/math/probstat/mle',           chapter: 'Chapter 2' },
  { slug: 'markov',        title: '馬可夫鏈與 MCMC',     emoji: '🚶', href: '/math/probstat/markov',        chapter: 'Chapter 3' },
  { slug: 'entropy',       title: '熵與 KL 散度',        emoji: '🔥', href: '/math/probstat/entropy',       chapter: 'Chapter 3' },
];

export interface Supplement {
  label: string;
  description?: string;
  href?: string;
}

export const SUPPLEMENTS: Record<string, Supplement[]> = {
  distributions: [],
  'lln-clt': [],
  bayes: [],
  mle: [],
  markov: [],
  entropy: [],
};
