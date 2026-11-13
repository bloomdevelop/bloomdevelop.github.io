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
            description: z.string().optional(),
            pubDate: z.coerce.date(),
            updatedDate: z.coerce.date().optional(),
            headerImage: image().optional(),
            headerImageAlt: z.string().optional(),
            draft: z.boolean().default(false),
        }),
});

export const collections = { blog };
