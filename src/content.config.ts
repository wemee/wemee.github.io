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

export const collections = {
    blog: blogCollection,
};
