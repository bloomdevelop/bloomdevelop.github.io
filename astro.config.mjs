// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    integrations: [vue()],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['@atproto/oauth-client-browser'],
        },
    },
    fonts: [
        {
            cssVariable: '--md-symbols',
            provider: fontProviders.fontsource(),
            name: 'Material Symbols Rounded',
        },
    ],
});
