/*
 * Shared Open Graph settings. Imported by the build integration (Node) and by
 * components that render the meta tags (browser/build), so it must stay free of
 * Node-only imports.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_IMAGE_TYPE = 'image/png';
export const OG_OUTPUT_DIRECTORY = 'og';

/** Public path of the generated card for a page, e.g. `/og/blog-pond.png`. */
export const ogImagePath = (pathname: string): string =>
    `/${OG_OUTPUT_DIRECTORY}/${ogSlug(pathname)}.png`;

/** Public path of the animated card for a page. */
export const ogVideoPath = (pathname: string, extension: 'mp4' | 'webm'): string =>
    `/${OG_OUTPUT_DIRECTORY}/${ogSlug(pathname)}.${extension}`;

/**
 * Turns a route into a stable, filesystem-safe slug:
 * `/` -> `index`, `/blog/pond/` -> `blog-pond`.
 */
export const ogSlug = (pathname: string): string => {
    const [path = '/'] = pathname.split(/[?#]/);
    const trimmed = path
        .replaceAll('\\', '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/index\.html?$/i, '')
        .replace(/\.html?$/i, '');
    if (!trimmed) return 'index';

    return trimmed
        .split('/')
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        })
        .join('-')
        .replace(/[^a-z0-9._-]+/gi, '_')
        .toLowerCase();
};
