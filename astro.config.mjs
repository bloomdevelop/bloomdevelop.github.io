// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    site: 'https://bloomdevelop.github.io',
    integrations: [vue(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['@atproto/oauth-client-browser'],
        },
    },
    fonts: [
        {
            cssVariable: '--inter-variable',
            provider: fontProviders.fontsource(),
            name: 'Inter Variable',
            weights: ['100 900'],
        },
        {
            cssVariable: '--md-symbols',
            provider: fontProviders.fontsource(),
            name: 'Material Symbols Rounded',
        },
    ],
});
