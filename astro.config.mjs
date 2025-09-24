// @ts-check
import { defineConfig } from "astro/config";

import betterImageService from "astro-better-image-service";
import rehypeCallouts from "rehype-callouts";
import rehypeKatexNoTranslate from "rehype-katex-notranslate";
import rehypeKatex from "rehype-katex";
import rehypeToc from "@jsdevtools/rehype-toc";
import rehypeSlug from "rehype-slug";

// https://astro.build/config
export default defineConfig({
  integrations: [betterImageService()],
  markdown: {
    // @ts-ignore It doesn't need to have an children since it handles automatically
    rehypePlugins: [rehypeCallouts, rehypeKatexNoTranslate, rehypeKatex, rehypeToc, rehypeSlug]
  }
});