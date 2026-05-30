import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogCollection = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
    schema: z.object({
        title: z.string(),
        pubDate: z.date(),
        description: z.string(),
        author: z.string().default('wemee'),
        tags: z.array(z.string()).default([]),
        image: z.string().optional(),
        related: z.array(z.string()).default([]),
    }),
});

const labCollection = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/lab' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        track: z.string(),
        module: z.string(),
        order: z.number(),
        notebook: z.string(),
        preview: z.string().optional(),
        difficulty: z.enum(['入門', '進階', '專題']).default('入門'),
        tags: z.array(z.string()).default([]),
        updated: z.date().optional(),
        draft: z.boolean().default(false),
        // 跨軌道相關課程（其他課的 collection id，例如 'cv/deep-vision/07-grad-cam'）
        related: z.array(z.string()).default([]),
    }),
});

export const collections = {
    blog: blogCollection,
    lab: labCollection,
};
