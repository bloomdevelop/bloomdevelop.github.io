/*
 * OgImages integration
 * --------------------
 *
 * Generates an Open Graph card for every built page and injects `og:video`
 * when an animated card could be encoded. The cards use the page's header
 * image as a dithered backdrop when there is one, and a procedural ink-bloom
 * backdrop otherwise, so publications without a header image are covered too.
 *
 *   // astro.config.mjs
 *   import ogImages from './src/integrations/og';
 *   export default defineConfig({ integrations: [ogImages({ theme: 'light' })] });
 *
 * The matching meta tags live in src/components/astro/head.astro; they point at
 * the deterministic `/og/<slug>.png` path this integration writes.
 */

import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { CardFontPaths } from './fonts';
import { generateCard } from './generate';
import {
    OG_HEIGHT,
    OG_IMAGE_TYPE,
    OG_OUTPUT_DIRECTORY,
    OG_WIDTH,
    ogImagePath,
    ogSlug,
    ogVideoPath,
} from '../../scripts/og/config';
import { ogRegistry, type OgEntry } from '../../scripts/og/registry';
import { applyImageFallback, injectVideoTags, parseMeta, stripInternalMeta } from './html';
import type { CardFlavor } from './theme';

export interface OgImagesOptions {
    /** Emit animated og:video cards. Requires ffmpeg; skips silently without it. */
    video?: boolean;
    /** Card size. Defaults to the 1200x630 Open Graph size. */
    width?: number;
    height?: number;
    /** Dither cell size in card pixels. */
    pixelSize?: number;
    /** Seconds per animation loop. Must keep the loop seamless. */
    duration?: number;
    /** Video frame rate. */
    fps?: number;
    /** Card palette. */
    theme?: CardFlavor;
    /** woff2/ttf fonts, relative to the project root. */
    fonts?: { sans?: string; mono?: string };
    /** Only render cards for matching routes. */
    include?: (pathname: string) => boolean;
    /** Fail the build when a card cannot be rendered. */
    strict?: boolean;
}

interface ResolvedOptions {
    video: boolean;
    width: number;
    height: number;
    pixelSize: number;
    duration: number;
    fps: number;
    theme: CardFlavor;
    fonts: CardFontPaths;
    include: (pathname: string) => boolean;
    strict: boolean;
}

const resolveFont = (root: URL, publicDir: URL, value: string | undefined, fallback: string) =>
    value ? (isAbsolute(value) ? value : new URL(value, root)) : new URL(fallback, publicDir);

const resolveOptions = (options: OgImagesOptions, root: URL, publicDir: URL): ResolvedOptions => ({
    video: options.video ?? true,
    width: options.width ?? OG_WIDTH,
    height: options.height ?? OG_HEIGHT,
    pixelSize: options.pixelSize ?? 6,
    duration: options.duration ?? 2,
    fps: options.fps ?? 12,
    theme: options.theme ?? 'light',
    fonts: {
        sans: resolveFont(root, publicDir, options.fonts?.sans, 'fonts/Intern-Variable.woff2'),
        mono: resolveFont(root, publicDir, options.fonts?.mono, 'fonts/MapleMono-Variable.woff2'),
    },
    include: options.include ?? (() => true),
    strict: options.strict ?? false,
});

const HTML_EXTENSION = /\.(?:html?|xhtml)$/i;
const FILE_EXTENSION = /\.[a-z0-9]+$/i;

/** Resolves a route to its built HTML file, or null for non-page outputs. */
const findHtml = async (dir: URL, pathname: string): Promise<URL | null> => {
    if (FILE_EXTENSION.test(pathname) && !HTML_EXTENSION.test(pathname)) return null;

    // Astro's build:done pathnames have no leading slash; "/" arrives as "".
    const relative = pathname.replace(/^\/+/, '');
    const trimmed = relative.replace(/\/+$/, '');
    const candidates = [
        new URL(`${trimmed || 'index'}.html`, dir),
        ...(trimmed !== relative || !relative ? [new URL(`${relative || ''}index.html`, dir)] : []),
    ];

    for (const candidate of candidates) {
        try {
            if ((await stat(candidate)).isFile()) return candidate;
        } catch {
            // try the next shape
        }
    }

    return null;
};

const stripQuery = (value: string): string => value.split(/[?#]/)[0] ?? value;

/** Rewrites a production asset URL onto the running dev server. */
const devAssetUrl = (source: string | undefined, base: string): string | undefined => {
    if (!source) return undefined;
    const url = new URL(source, base);
    return url.origin === base
        ? url.toString()
        : new URL(`${url.pathname}${url.search}`, base).toString();
};

const loadImage = async (
    source: string | undefined,
    context: { dir: URL; root: URL; site?: URL },
): Promise<Buffer | undefined> => {
    if (!source) return undefined;

    const path = stripQuery(source);

    if (/^https?:/i.test(path)) {
        try {
            const url = new URL(path);
            if (context.site && url.origin === context.site.origin) {
                return readFile(new URL(`.${url.pathname}`, context.dir)).catch(() => undefined);
            }

            const response = await fetch(url);
            if (!response.ok) return undefined;
            return Buffer.from(await response.arrayBuffer());
        } catch {
            return undefined;
        }
    }

    const candidates: URL[] = [];
    if (path.startsWith('/')) candidates.push(new URL(`.${path}`, context.dir));
    if (isAbsolute(path)) candidates.push(new URL(`file://${path}`));
    if (!isAbsolute(path) && !path.startsWith('/')) {
        candidates.push(new URL(path, context.root), new URL(path, context.dir));
    }

    for (const candidate of candidates) {
        try {
            return await readFile(candidate);
        } catch {
            // try the next candidate
        }
    }

    return undefined;
};

const entryFromMeta = (pathname: string, html: string): OgEntry => {
    const meta = parseMeta(html);
    const suffix = meta.siteName ? ` — ${meta.siteName}` : '';
    const title =
        meta.title && suffix && meta.title.endsWith(suffix)
            ? meta.title.slice(0, -suffix.length)
            : meta.title;

    return {
        pathname,
        title: title?.trim() || ogSlug(pathname),
        description: meta.description,
        image: meta.source,
        date: meta.date,
        kind: meta.kind,
        siteName: meta.siteName,
    };
};

/**
 * Resolves a dev request. Normally head.astro has registered the page
 * metadata; a card can still be requested cold (a crawler, or a reload after
 * the dev server restarted), so fall back to the referrer page, then to the
 * route the slug can be inverted to, and finally to a placeholder.
 */
const resolveDevEntry = async (
    slug: string,
    referer: string | undefined,
    base: string,
): Promise<OgEntry> => {
    const registered = ogRegistry.get(slug);
    if (registered) return registered;

    const fromPage = async (pathname: string): Promise<OgEntry | undefined> => {
        try {
            const response = await fetch(new URL(pathname, base));
            const type = response.headers.get('content-type') ?? '';
            if (response.ok && type.includes('text/html')) {
                return entryFromMeta(pathname, await response.text());
            }
        } catch {
            // try the next candidate
        }
        return undefined;
    };

    if (referer) {
        const url = new URL(referer);
        // Never chase a referrer that is itself an og asset.
        if (!url.pathname.startsWith('/og/')) {
            const entry = await fromPage(url.pathname);
            if (entry) return entry;
        }
    }

    // Best-effort route guess for cold requests without a referrer:
    // `/og/index.png` -> `/`, `/og/projects.png` -> `/projects/`. Dynamic
    // routes fall through to the placeholder below.
    const guessed = slug === 'index' ? '/' : `/${slug}/`;
    const entry = await fromPage(guessed);
    if (entry) return entry;

    return {
        pathname: `/${slug}`,
        title: slug.replaceAll('-', ' '),
        kind: 'website',
    };
};

const mapLimit = async <T, R>(
    values: readonly T[],
    limit: number,
    task: (value: T) => Promise<R>,
): Promise<R[]> => {
    const results: R[] = [];

    for (let start = 0; start < values.length; start += limit) {
        const chunk = values.slice(start, start + limit);
        results.push(...(await Promise.all(chunk.map((value) => task(value)))));
    }

    return results;
};

export default function ogImages(options: OgImagesOptions = {}): AstroIntegration {
    let resolved!: ResolvedOptions;
    let site: URL | undefined;
    let root!: URL;
    let publicDir!: URL;

    return {
        name: 'og-images',
        hooks: {
            'astro:config:setup': ({ config }) => {
                root = config.root;
                publicDir = config.publicDir;
                site = config.site ? new URL(config.site) : undefined;
                resolved = resolveOptions(options, root, publicDir);
            },

            'astro:server:setup': ({ server, logger }) => {
                const cache = new Map<string, Buffer>();
                const pending = new Map<string, Promise<Buffer | undefined>>();

                const address = server.httpServer?.address();
                const configuredPort = server.config.server.port;
                const port =
                    typeof address === 'object' && address ? address.port : configuredPort || 4321;

                // The dev server may listen on IPv6 only (localhost -> ::1),
                // so 127.0.0.1 is not always reachable. Vite's resolved local
                // URL is the reliable origin; the request host is next best.
                const originFor = (request: IncomingMessage): string => {
                    const local = server.resolvedUrls?.local[0];
                    if (local) return new URL(local).origin;
                    const host = request.headers.host;
                    return `http://${host ?? `localhost:${port}`}`;
                };

                const render = async (entry: OgEntry, extension: string, base: string) => {
                    const source = devAssetUrl(entry.image, base);
                    const image = source
                        ? await loadImage(source, { dir: new URL('.', root), root, site })
                        : undefined;
                    logger.debug(
                        `OG dev ${entry.pathname}: image=${source ?? 'none'} loaded=${Boolean(image)}`,
                    );

                    const card = await generateCard({
                        entry,
                        image,
                        width: resolved.width,
                        height: resolved.height,
                        pixelSize: resolved.pixelSize,
                        theme: resolved.theme,
                        video: resolved.video,
                        fps: resolved.fps,
                        duration: resolved.duration,
                        fonts: resolved.fonts,
                    });

                    if (extension === 'png') return card.png;
                    return card.video?.data;
                };

                const handle = async (
                    request: IncomingMessage,
                    response: ServerResponse,
                    next: () => void,
                ) => {
                    const match = (request.url ?? '').match(
                        /^\/og\/([^/]+)\.(png|mp4|webm)(?:[?#].*)?$/,
                    );
                    if (!match) return next();

                    const [, slug, extension] = match;
                    const base = originFor(request);

                    try {
                        const entry = await resolveDevEntry(slug, request.headers.referer, base);
                        const type =
                            extension === 'png'
                                ? OG_IMAGE_TYPE
                                : `video/${extension === 'mp4' ? 'mp4' : 'webm'}`;
                        const key = `${slug}.${extension}:${JSON.stringify(entry)}`;
                        const cached = cache.get(key);

                        if (cached) {
                            response.setHeader('Content-Type', type);
                            response.setHeader('Cache-Control', 'no-store');
                            response.end(cached);
                            return;
                        }

                        let job = pending.get(key);
                        if (!job) {
                            job = render(entry, extension, base)
                                .then((data) => {
                                    if (data && cache.size < 24) cache.set(key, data);
                                    return data;
                                })
                                .finally(() => pending.delete(key));
                            pending.set(key, job);
                        }

                        const data = await job;
                        if (!data) return next();

                        response.setHeader('Content-Type', type);
                        response.setHeader('Cache-Control', 'no-store');
                        response.end(data);
                    } catch (error) {
                        logger.warn(`Could not render ${slug}.${extension}: ${String(error)}`);
                        response.statusCode = 500;
                        response.end('Open Graph card could not be rendered.');
                    }
                };

                server.middlewares.use((request, response, next) => {
                    void handle(request, response, next).catch((error: unknown) => {
                        logger.warn(`Open Graph middleware failed: ${String(error)}`);
                        if (!response.writableEnded) {
                            response.statusCode = 500;
                            response.end('Open Graph card could not be rendered.');
                        }
                    });
                });
            },

            'astro:build:done': async ({ dir, pages, logger }) => {
                const outputDir = fileURLToPath(new URL(`${OG_OUTPUT_DIRECTORY}/`, dir));
                await mkdir(outputDir, { recursive: true });

                const pathnames = [
                    ...new Set(
                        pages
                            .map((page) => page.pathname)
                            .filter((pathname) => resolved.include(pathname)),
                    ),
                ];

                let cards = 0;
                let videos = 0;
                let failures = 0;

                await mapLimit(pathnames, 3, async (pathname) => {
                    const htmlFile = await findHtml(dir, pathname);
                    if (!htmlFile) {
                        logger.debug(`No built HTML found for "${pathname}"; skipping its card.`);
                        return;
                    }

                    let html = await readFile(htmlFile, 'utf8');
                    const entry = ogRegistry.get(ogSlug(pathname)) ?? entryFromMeta(pathname, html);
                    const generatedUrl = site
                        ? new URL(ogImagePath(pathname), site).toString()
                        : ogImagePath(pathname);

                    try {
                        const imageSource = entry.image ?? parseMeta(html).source;
                        const image = await loadImage(imageSource, {
                            dir,
                            root,
                            site,
                        });
                        if (imageSource && !image) {
                            logger.warn(
                                `Could not load ${imageSource} for ${pathname}; using a procedural background.`,
                            );
                        }
                        const card = await generateCard({
                            entry,
                            image,
                            width: resolved.width,
                            height: resolved.height,
                            pixelSize: resolved.pixelSize,
                            theme: resolved.theme,
                            video: resolved.video,
                            fps: resolved.fps,
                            duration: resolved.duration,
                            fonts: resolved.fonts,
                        });

                        await writeFile(join(outputDir, `${ogSlug(pathname)}.png`), card.png);
                        cards++;

                        if (card.video) {
                            const videoPath = ogVideoPath(pathname, card.video.extension);
                            await writeFile(
                                join(outputDir, `${ogSlug(pathname)}.${card.video.extension}`),
                                card.video.data,
                            );
                            const url = site ? new URL(videoPath, site).toString() : videoPath;
                            html = injectVideoTags(html, {
                                url,
                                secureUrl: site?.protocol === 'https:' ? url : undefined,
                                type: card.video.mime,
                                width: resolved.width,
                                height: resolved.height,
                            });
                            videos++;
                        }
                    } catch (error) {
                        failures++;
                        html = applyImageFallback(html, generatedUrl, parseMeta(html).source);

                        if (resolved.strict) throw error;
                        logger.warn(
                            `Open Graph card for ${pathname} fell back to the header image: ${String(error)}`,
                        );
                    }

                    await writeFile(htmlFile, stripInternalMeta(html));
                });

                logger.info(
                    `Generated ${cards} Open Graph card${cards === 1 ? '' : 's'}` +
                        (videos ? ` and ${videos} animated card${videos === 1 ? '' : 's'}` : '') +
                        ` in ${outputDir}${failures ? ` (${failures} fell back)` : ''}`,
                );
            },
        },
    };
}
