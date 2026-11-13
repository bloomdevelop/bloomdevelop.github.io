# bloomdevelop.github.io

This is the repository for the bloomdevelop.github.io website.

## Open Graph cards

Every page gets a generated 1200x630 `og:image` — and, when ffmpeg is
available, a looping dithered `og:video` — from
[`src/integrations/og`](./src/integrations/og/README.md). Pages with a header
image use it as the dithered backdrop; pages without one get a procedural
backdrop.
