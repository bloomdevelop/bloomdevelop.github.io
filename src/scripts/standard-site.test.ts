import { validate } from '@atcute/tid';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import {
    STANDARD_SITE_DID,
    STANDARD_SITE_PUBLICATION_URI,
    buildStandardSiteDocumentRecord,
    buildStandardSitePublicationRecord,
    markdownToPlainText,
    standardSiteDocumentPath,
    standardSiteDocumentRkey,
    standardSiteDocumentUri,
    standardSitePublicationUri,
} from './standard-site';

const PUBLISHED_AT = new Date('2026-11-03T00:00:00.000Z');

describe('standard.site URIs', () => {
    it('builds the publication AT-URI from the site DID and TID', () => {
        expect(standardSitePublicationUri()).toBe(
            `at://${STANDARD_SITE_DID}/site.standard.publication/3n25ohzpk2222`,
        );
        expect(STANDARD_SITE_PUBLICATION_URI).toBe(standardSitePublicationUri());
    });

    it('keeps the well-known verification file in sync with the publication URI', () => {
        const body = readFileSync(
            new URL('../../public/.well-known/site.standard.publication', import.meta.url),
            'utf8',
        );

        expect(body.trim()).toBe(STANDARD_SITE_PUBLICATION_URI);
    });

    it('builds document AT-URIs from the slug and publish date', () => {
        const uri = standardSiteDocumentUri('pond', PUBLISHED_AT);
        const rkey = uri.split('/').at(-1) ?? '';

        expect(uri).toMatch(
            new RegExp(
                `^at://${STANDARD_SITE_DID}/site\\.standard\\.document/[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$`,
            ),
        );
        expect(validate(rkey)).toBe(true);
    });
});

describe('standardSiteDocumentRkey', () => {
    it('returns a valid TID', () => {
        const rkey = standardSiteDocumentRkey('pond', PUBLISHED_AT);

        expect(validate(rkey)).toBe(true);
        expect(rkey).toHaveLength(13);
    });

    it('is stable for the same slug and publish date', () => {
        expect(standardSiteDocumentRkey('pond', PUBLISHED_AT)).toBe(
            standardSiteDocumentRkey('pond', PUBLISHED_AT),
        );
    });

    it('changes when the slug or publish date changes', () => {
        const rkey = standardSiteDocumentRkey('pond', PUBLISHED_AT);

        expect(standardSiteDocumentRkey('pond-linux-review', PUBLISHED_AT)).not.toBe(rkey);
        expect(standardSiteDocumentRkey('pond', new Date('2026-11-04T00:00:00.000Z'))).not.toBe(
            rkey,
        );
    });

    it('handles nested and non-ASCII slugs', () => {
        expect(validate(standardSiteDocumentRkey('notes/hello world', PUBLISHED_AT))).toBe(true);
        expect(validate(standardSiteDocumentRkey('日本語', PUBLISHED_AT))).toBe(true);
    });

    it('rejects empty slugs', () => {
        expect(() => standardSiteDocumentRkey('', PUBLISHED_AT)).toThrow();
        expect(() => standardSiteDocumentRkey('   ', PUBLISHED_AT)).toThrow();
    });
});

describe('standardSiteDocumentPath', () => {
    it('matches the canonical blog URL', () => {
        expect(standardSiteDocumentPath('pond')).toBe('/blog/pond/');
    });

    it('keeps nested slugs and encodes URL-unsafe segments', () => {
        expect(standardSiteDocumentPath('notes/hello world')).toBe('/blog/notes/hello%20world/');
    });
});

describe('buildStandardSiteDocumentRecord', () => {
    it('includes the required fields and optional metadata', () => {
        expect(
            buildStandardSiteDocumentRecord({
                slug: 'pond',
                title: 'Pond Linux Review',
                description: 'A hands-on look.',
                publishedAt: new Date('2026-11-03T00:00:00.000Z'),
                updatedAt: new Date('2026-11-04T00:00:00.000Z'),
                textContent: 'Hello!',
            }),
        ).toEqual({
            $type: 'site.standard.document',
            site: STANDARD_SITE_PUBLICATION_URI,
            path: '/blog/pond/',
            title: 'Pond Linux Review',
            description: 'A hands-on look.',
            publishedAt: '2026-11-03T00:00:00.000Z',
            updatedAt: '2026-11-04T00:00:00.000Z',
            textContent: 'Hello!',
        });
    });

    it('omits unset optional fields', () => {
        const record = buildStandardSiteDocumentRecord({
            slug: 'pond',
            title: 'Pond Linux Review',
            publishedAt: new Date('2026-11-03T00:00:00.000Z'),
        });

        expect(record).not.toHaveProperty('description');
        expect(record).not.toHaveProperty('updatedAt');
        expect(record).not.toHaveProperty('textContent');
    });
});

describe('buildStandardSitePublicationRecord', () => {
    it('describes the site without a trailing slash', () => {
        const record = buildStandardSitePublicationRecord();

        expect(record).toMatchObject({
            $type: 'site.standard.publication',
            url: 'https://bloomdevelop.github.io',
            name: "Spring's Website",
            preferences: { showInDiscover: true },
        });
        expect(record.url).not.toMatch(/\/$/);
        expect(record.basicTheme).toMatchObject({
            $type: 'site.standard.theme.basic',
            background: { $type: 'site.standard.theme.color#rgb', r: 246, g: 239, b: 248 },
        });
    });
});

describe('markdownToPlainText', () => {
    it('drops frontmatter, formatting, and HTML comments', () => {
        const plain = markdownToPlainText(`---
title: Pond
---

# Heading

Some **bold** and [linked](https://example.com) text.

<!-- hidden -->
`);

        expect(plain).toBe('Heading\n\nSome bold and linked text.');
    });

    it('keeps code block contents without the fences', () => {
        const plain = markdownToPlainText('Before\n\n```ts\nconst x = 1;\n```\n\nAfter');

        expect(plain).toBe('Before\n\nconst x = 1;\n\nAfter');
    });

    it('uses image alt text and keeps list items', () => {
        const plain = markdownToPlainText('- ![A cat](./cat.png)\n- Item two');

        expect(plain).toBe('A cat\nItem two');
    });
});
