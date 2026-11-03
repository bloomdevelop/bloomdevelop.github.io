import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

const blog = defineCollection({
    loader: glob({
        base: './blog/',
        pattern: '**/*.{md,mdx}',
    }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            pubDate: z.coerce.date(),
            updatedDate: z.coerce.date().optional(),
            headerImage: image().optional(),
            headerImageAlt: z.string().optional(),
            draft: z.boolean().default(false).optional(),
        }),
});

export const collections = { blog };
