// @ts-check

import vue from "@astrojs/vue";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [vue()],
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
    {
      cssVariable: "--material-symbols",
      provider: fontProviders.fontsource(),
      name: "Material Symbols",
    },
  ],
});
