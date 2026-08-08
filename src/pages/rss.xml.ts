import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

/**
 * 部落格 RSS feed。BaseLayout 會在每頁 <head> 宣告 rel="alternate"，
 * 讓爬蟲與閱讀器都能自動發現。
 */
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: '挫屎勇的部落格',
    description:
      '挫屎勇 (wemee) 的技術部落格。跟 AI Agent 一起寫程式的實戰心得、前端與全端開發筆記、無線網路實驗，以及把想法做成產品的過程。',
    site: context.site!,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: post.data.tags,
      link: `/blog/${post.id}/`,
    })),
    customData: '<language>zh-Hant</language>',
  });
}
