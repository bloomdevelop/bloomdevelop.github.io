// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import ogImages from './src/integrations/og/index.ts';

// https://astro.build/config
export default defineConfig({
    site: 'https://bloomdevelop.github.io',
    integrations: [vue(), sitemap(), ogImages()],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['@atproto/oauth-client-browser'],
        },
    },
    fonts: [
        {
            cssVariable: '--allo-variable',
            provider: fontProviders.local(),
            name: 'Allo',
            options: {
                variants: [
                    {
                        src: ['allo-font/fonts/webfonts/AlloVariable.woff2'],
                        weight: '100 900',
                        style: 'normal',
                    },
                ],
            },
        },
    ],
});
