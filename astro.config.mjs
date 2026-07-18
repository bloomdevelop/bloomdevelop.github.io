// @ts-check

import vue from "@astrojs/vue";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [vue()],
  vite: {
    optimizeDeps: {
      include: ["@atproto/oauth-client-browser"],
    },
  },
  fonts: [
    {
      cssVariable: "--inter",
      provider: fontProviders.fontsource(),
      name: "Inter",
    },
    {
      cssVariable: "--maple-mono",
      provider: fontProviders.fontsource(),
      name: "Maple Mono",
    },
  ],
});
