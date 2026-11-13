# og-images

An Astro integration that gives every page its own Open Graph card:

- `1200x630` PNG at `/og/<slug>.png`
- optional `2s` looping MP4 at `/og/<slug>.mp4` (VP9/WebM if no H.264 encoder)

The card is composed of two layers:

1. **Background** — the page's header image, dithered with the same ordered
   dithering as `src/scripts/dither.ts`, or a procedural "ink bloom" backdrop
   for pages without one. Publications without a media header are covered.
2. **Text layer** — title, description and date, rendered with satori (Inter +
   Maple Mono) and composited over a paper scrim.

The animated card walks the Bayer matrix and breathes the dither strength over
two seconds. The WebGL component uses the same loop, so the site and the card
share one look.

## Usage

`astro.config.mjs` already registers the integration:

```js
import ogImages from './src/integrations/og/index.ts';

export default defineConfig({
    integrations: [ogImages()],
});
```

`src/components/astro/head.astro` registers the page metadata and emits the
`og:image` tags. The URL is deterministic (`/og/<slug>.png`); the integration
writes the file in `astro:build:done` and appends the `og:video` tags only when
an animated card was actually produced.

### Development

The integration also mounts middleware in `astro dev`. Cards are rendered on
demand at the same URL, using the request origin (`http://localhost:4321`, IPv6
included) rather than the production site, so preview tools never request a
missing production asset. If a card is requested before the page has been
rendered in the current dev process, the middleware resolves the page through
the referrer (or falls back to a slug-only placeholder).

## Options

```ts
ogImages({
    video: true, // emit og:video for every page (default)
    width: 1200,
    height: 630,
    pixelSize: 6, // dither cell size in card pixels
    duration: 2, // seconds per animation loop
    fps: 12,
    theme: 'light', // or 'dark'
    fonts: {
        sans: 'public/fonts/Intern-Variable.woff2',
        mono: 'public/fonts/MapleMono-Variable.woff2',
    },
    include: (pathname) => true,
    strict: false, // true = fail the build instead of falling back
});
```

`video` needs `ffmpeg` with `libx264`/`libopenh264` (MP4) or `libvpx-vp9`
(WebM). Without one the PNG is still generated and no video tags are emitted.
If a card fails for another reason, the page keeps its original header image as
`og:image` (or loses the image tags) and the build continues unless `strict` is
set.
