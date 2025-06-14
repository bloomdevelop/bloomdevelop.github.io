import { defineCollection, z } from "astro:content";

import { glob } from "astro/loaders";

const posts = defineCollection({
	loader: glob({
		pattern: "**/*{.md,.mdx}",
		base: "./src/posts",
	}),
	schema: z.object({
		title: z.string(),
		tags: z.array(z.string()).optional(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
	}),
});

export const collections = { posts };
