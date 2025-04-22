// @ts-check
import { defineConfig, envField } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
  },

  integrations: [react()],

  env: {
    schema: {
      SUPABASE_ANON_KEY: envField.string({
        context: "client", access: "public"
      }),
      SUPABASE_URL: envField.string({
        context: "client", access: "public"
      })
    }
  }
});