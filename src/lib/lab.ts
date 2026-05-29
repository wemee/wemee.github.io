// 程式實驗室共用工具：Colab / GitHub URL 組裝、課程查詢、配色對應。

import { getCollection, type CollectionEntry } from 'astro:content';

// notebook 的單一真相來源：repo 裡的 notebooks/ 目錄。
// Colab 透過 GitHub 路徑直接開檔，不經過任何人的 Google Drive。
const GH = {
  owner: 'wemee',
  repo: 'wemee.github.io',
  branch: 'main',
  dir: 'notebooks',
} as const;

/** notebook 相對 notebooks/ 的路徑，例如 'python/matplotlib/01-basics.ipynb' */
export const colabUrl = (notebook: string): string =>
  `https://colab.research.google.com/github/${GH.owner}/${GH.repo}/blob/${GH.branch}/${GH.dir}/${notebook}`;

export const githubUrl = (notebook: string): string =>
  `https://github.com/${GH.owner}/${GH.repo}/blob/${GH.branch}/${GH.dir}/${notebook}`;

export type LabLesson = CollectionEntry<'lab'>;

/** 取得某模組所有「非草稿」課程，依 order 排序 */
export async function getLessons(
  track: string,
  module: string
): Promise<LabLesson[]> {
  const all = await getCollection('lab');
  return all
    .filter(
      (l) => l.data.track === track && l.data.module === module && !l.data.draft
    )
    .sort((a, b) => a.data.order - b.data.order);
}

/** 把 lesson collection id ('python/matplotlib/01-basics') 拆成路由參數 */
export function lessonParams(id: string): {
  track: string;
  module: string;
  lesson: string;
} {
  const [track, module, ...rest] = id.split('/');
  return { track, module, lesson: rest.join('/') };
}

export const lessonHref = (id: string): string => `/lab/${id}`;

// 與站台既有 accent 色系對應（沿用 math/index.astro 的命名）
export const colorMap: Record<
  string,
  { bg: string; hover: string; border: string; text: string }
> = {
  primary: { bg: 'bg-accent-blue', hover: 'hover:border-accent-blue', border: 'border-accent-blue', text: 'group-hover:text-accent-blue' },
  success: { bg: 'bg-accent-green', hover: 'hover:border-accent-green', border: 'border-accent-green', text: 'group-hover:text-accent-green' },
  info: { bg: 'bg-accent-cyan', hover: 'hover:border-accent-cyan', border: 'border-accent-cyan', text: 'group-hover:text-accent-cyan' },
  warning: { bg: 'bg-accent-yellow', hover: 'hover:border-accent-yellow', border: 'border-accent-yellow', text: 'group-hover:text-accent-yellow' },
  danger: { bg: 'bg-accent-red', hover: 'hover:border-accent-red', border: 'border-accent-red', text: 'group-hover:text-accent-red' },
};
