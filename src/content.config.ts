import { defineCollection, z } from "astro:content";

import { glob } from "astro/loaders";

const posts = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/posts" }),
    schema: z.object({
        hero: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        draft: z.boolean().optional()
    }),
});

export const collections = { posts };
