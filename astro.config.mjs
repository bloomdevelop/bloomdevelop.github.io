// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";

import betterImageService from "astro-better-image-service";

// https://astro.build/config
export default defineConfig({
  vite: {
      plugins: [tailwindcss()]
  },

  integrations: [betterImageService()]
});