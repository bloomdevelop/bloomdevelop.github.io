/*
 * Small HTML helpers for the built pages.
 *
 * The integration only touches `<head>`: it reads the metadata Astro already
 * emitted and appends the `og:video` tags once a video has been encoded.
 * No DOM parser dependency is needed for that.
 */

export interface PageMeta {
    title?: string;
    description?: string;
    /** Internal meta emitted by head.astro: the header image, if any. */
    source?: string;
    siteName?: string;
    date?: string;
    kind: 'website' | 'article';
    ogImage?: string;
}

const decodeEntities = (value: string): string =>
    value
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&#x27;', "'");

const escapeAttribute = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

const attribute = (tag: string, name: string): string | undefined => {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    const value = match?.[2] ?? match?.[3];
    return value === undefined ? undefined : decodeEntities(value);
};

export const parseMeta = (html: string): PageMeta => {
    const meta = new Map<string, string>();

    for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
        const key = attribute(tag, 'property') ?? attribute(tag, 'name');
        const value = attribute(tag, 'content');
        if (key && value !== undefined && !meta.has(key)) meta.set(key, value);
    }

    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const kind = meta.get('og:type') === 'article' ? 'article' : 'website';

    return {
        title: title ? decodeEntities(title).trim() : undefined,
        description: meta.get('og:description'),
        source: meta.get('og-source'),
        siteName: meta.get('og:site_name'),
        date: meta.get('article:published_time'),
        kind,
        ogImage: meta.get('og:image'),
    };
};

/** Appends the Open Graph video metadata before `</head>`. */
export const injectVideoTags = (
    html: string,
    video: { url: string; secureUrl?: string; type: string; width: number; height: number },
): string => {
    if (html.includes('property="og:video"')) return html;

    const tags = [
        `<meta property="og:video" content="${escapeAttribute(video.url)}" />`,
        video.secureUrl
            ? `<meta property="og:video:secure_url" content="${escapeAttribute(video.secureUrl)}" />`
            : '',
        `<meta property="og:video:type" content="${escapeAttribute(video.type)}" />`,
        `<meta property="og:video:width" content="${video.width}" />`,
        `<meta property="og:video:height" content="${video.height}" />`,
    ]
        .filter(Boolean)
        .join('\n        ');

    return html.replace('</head>', `        ${tags}\n    </head>`);
};

/** Removes the internal header-image hint from production HTML. */
export const stripInternalMeta = (html: string): string =>
    html.replace(/[ \t]*<meta\b[^>]*\sname=["']og-source["'][^>]*>[ \t]*\r?\n?/gi, '');

/**
 * When a card could not be rendered, point `og:image` at the original header
 * image, or drop the tags so crawlers fall back to a plain link preview.
 */
export const applyImageFallback = (
    html: string,
    generatedUrl: string,
    fallbackUrl?: string,
): string => {
    let result = html;

    result = result.replace(/<meta\b[^>]*>/gi, (tag) => {
        const property = attribute(tag, 'property');
        const name = attribute(tag, 'name');
        const key = property ?? name;
        if (key !== 'og:image' && key !== 'twitter:image') return tag;
        if (attribute(tag, 'content') !== generatedUrl) return tag;
        if (fallbackUrl) {
            return tag.replace(
                /\scontent=("[^"]*"|'[^']*')/i,
                ` content="${escapeAttribute(fallbackUrl)}"`,
            );
        }
        return '';
    });

    if (!fallbackUrl) {
        result = result.replace(
            /(<meta\b[^>]*\s(?:property|name)=["']twitter:card["'][^>]*\scontent=)("[^"]*"|'[^']*')/gi,
            '$1"summary"',
        );
    }

    return result;
};
