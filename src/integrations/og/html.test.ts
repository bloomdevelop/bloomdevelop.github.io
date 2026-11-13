import { describe, expect, it } from 'vite-plus/test';
import { applyImageFallback, injectVideoTags, parseMeta, stripInternalMeta } from './html';

const html = `<!doctype html><html><head>
    <title>Pond Linux Review — Spring's Website</title>
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Spring's Website" />
    <meta property="og:description" content="A review." />
    <meta property="og:image" content="https://example.com/og/blog-pond.png" />
    <meta name="twitter:image" content="https://example.com/og/blog-pond.png" />
    <meta name="og-source" content="https://example.com/_astro/header.jpg" />
    <meta property="article:published_time" content="2026-11-03T00:00:00.000Z" />
</head><body></body></html>`;

describe('parseMeta', () => {
    it('reads the metadata Astro emitted', () => {
        expect(parseMeta(html)).toEqual({
            title: "Pond Linux Review — Spring's Website",
            description: 'A review.',
            source: 'https://example.com/_astro/header.jpg',
            siteName: "Spring's Website",
            date: '2026-11-03T00:00:00.000Z',
            kind: 'article',
            ogImage: 'https://example.com/og/blog-pond.png',
        });
    });

    it('defaults to a website and tolerates missing tags', () => {
        expect(parseMeta('<head></head>').kind).toBe('website');
        expect(parseMeta('<head></head>').title).toBeUndefined();
    });
});

describe('injectVideoTags', () => {
    it('inserts the video metadata once', () => {
        const once = injectVideoTags(html, {
            url: 'https://example.com/og/blog-pond.mp4',
            secureUrl: 'https://example.com/og/blog-pond.mp4',
            type: 'video/mp4',
            width: 1200,
            height: 630,
        });

        expect(once).toContain('property="og:video"');
        expect(once).toContain('property="og:video:secure_url"');
        expect(once).toContain('content="video/mp4"');
        expect(
            injectVideoTags(once, {
                url: 'https://example.com/og/other.mp4',
                type: 'video/mp4',
                width: 1200,
                height: 630,
            }),
        ).toBe(once);
    });
});

describe('applyImageFallback', () => {
    it('points the image tags at the header image', () => {
        const result = applyImageFallback(
            html,
            'https://example.com/og/blog-pond.png',
            'https://example.com/_astro/header.jpg',
        );

        expect(result).toContain('content="https://example.com/_astro/header.jpg"');
        expect(result).not.toContain('/og/blog-pond.png');
    });

    it('removes the image tags when there is no fallback', () => {
        const result = applyImageFallback(html, 'https://example.com/og/blog-pond.png');

        expect(result).not.toContain('og:image');
        expect(result).not.toContain('twitter:image');
    });

    it('leaves other pages alone', () => {
        expect(
            applyImageFallback(
                html,
                'https://example.com/og/other.png',
                'https://example.com/x.jpg',
            ),
        ).toBe(html);
    });
});

describe('stripInternalMeta', () => {
    it('removes the og-source hint', () => {
        expect(stripInternalMeta(html)).not.toContain('og-source');
        expect(stripInternalMeta(html)).toContain('og:image');
    });
});
