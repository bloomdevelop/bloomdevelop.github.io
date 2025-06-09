// @ts-check
import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";

// Custom Remark plugin
import { remarkReadingTime } from "./plugins/remark-reading-time.mjs";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
	integrations: [mdx(), react()],
	markdown: {
		shikiConfig: {
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
		},
		remarkPlugins: [remarkReadingTime],
	},
});
