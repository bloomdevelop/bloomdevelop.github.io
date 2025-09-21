// @ts-check
import { defineConfig } from 'astro/config';

import betterImageService from "astro-better-image-service";

// https://astro.build/config
export default defineConfig({
  integrations: [betterImageService()]
});