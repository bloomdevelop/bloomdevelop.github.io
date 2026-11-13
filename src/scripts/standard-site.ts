import { create } from '@atcute/tid';
import { DEFAULT_PREVIEW_DID } from './consts';

/**
 * Standard.site integration for the blog.
 *
 * Records live on the AT Protocol under `site.standard.*`; see
 * https://standard.site/docs/introduction/. The publication record is created
 * by `scripts/publish-standard-site.ts`, while the AT-URIs here are derived
 * deterministically so the site can link to records before they are published.
 */

export const STANDARD_SITE_ORIGIN = 'https://bloomdevelop.github.io';
export const STANDARD_SITE_PUBLICATION_COLLECTION = 'site.standard.publication';
export const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';

/**
 * Publication record key. The lexicon requires a TID, and it must stay fixed
 * or the verification file and every link to the publication break. This TID
 * represents 2026-11-13T00:00:00Z.
 */
export const STANDARD_SITE_PUBLICATION_RKEY = '3n25ohzpk2222';

/** The account that owns the publication and document records. */
export const STANDARD_SITE_DID = DEFAULT_PREVIEW_DID;

const PUBLICATION_NAME = "Spring's Website";
const PUBLICATION_DESCRIPTION = "Spring's personal website: notes, publications, and projects.";

export function standardSitePublicationUri(did: string = STANDARD_SITE_DID): string {
    return `at://${did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`;
}

export const STANDARD_SITE_PUBLICATION_URI = standardSitePublicationUri();

function hashSlug(slug: string): number {
    let hash = 2_166_136_261;

    for (const character of slug) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16_777_619);
    }

    return hash >>> 0;
}

/**
 * A stable record key for a document. The lexicon requires a TID, so it is
 * built from the publish date plus a hash of the slug. Changing either value
 * creates a new record instead of updating the old one.
 */
export function standardSiteDocumentRkey(slug: string, publishedAt: Date): string {
    if (!slug.trim()) {
        throw new Error(`Cannot derive a standard.site document rkey from "${slug}"`);
    }

    const time = publishedAt.getTime();
    if (!Number.isSafeInteger(time) || time < 0) {
        throw new Error(
            `Cannot derive a standard.site document rkey from "${publishedAt.toString()}"`,
        );
    }

    const hash = hashSlug(slug);
    const timestamp = time * 1_000 + (hash % 1_000_000);
    const clockid = Math.floor(hash / 1_000_000) % 1_024;

    return create(timestamp, clockid);
}

/** Canonical path used by the rendered page and the document record. */
export function standardSiteDocumentPath(slug: string): string {
    const path = slug
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    if (!path) {
        throw new Error(`Cannot derive a standard.site document path from "${slug}"`);
    }

    return `/blog/${path}/`;
}

export function standardSiteDocumentUri(
    slug: string,
    publishedAt: Date,
    did: string = STANDARD_SITE_DID,
): string {
    return `at://${did}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${standardSiteDocumentRkey(slug, publishedAt)}`;
}

export interface StandardSiteDocumentInput {
    readonly slug: string;
    readonly title: string;
    readonly description?: string;
    readonly publishedAt: Date;
    readonly updatedAt?: Date;
    readonly textContent?: string;
}

export function buildStandardSiteDocumentRecord(
    input: StandardSiteDocumentInput,
): Record<string, unknown> {
    return {
        $type: STANDARD_SITE_DOCUMENT_COLLECTION,
        site: STANDARD_SITE_PUBLICATION_URI,
        path: standardSiteDocumentPath(input.slug),
        title: input.title,
        ...(input.description ? { description: input.description } : {}),
        publishedAt: input.publishedAt.toISOString(),
        ...(input.updatedAt ? { updatedAt: input.updatedAt.toISOString() } : {}),
        ...(input.textContent ? { textContent: input.textContent } : {}),
    };
}

const rgb = (r: number, g: number, b: number) => ({
    $type: 'site.standard.theme.color#rgb',
    r,
    g,
    b,
});

/** Builds the `site.standard.publication` record for this site. */
export function buildStandardSitePublicationRecord(): Record<string, unknown> {
    return {
        $type: STANDARD_SITE_PUBLICATION_COLLECTION,
        url: STANDARD_SITE_ORIGIN,
        name: PUBLICATION_NAME,
        description: PUBLICATION_DESCRIPTION,
        basicTheme: {
            $type: 'site.standard.theme.basic',
            // The day flavour of the madoromi theme.
            background: rgb(246, 239, 248),
            foreground: rgb(88, 74, 92),
            accent: rgb(25, 85, 191),
            accentForeground: rgb(246, 239, 248),
        },
        preferences: {
            showInDiscover: true,
        },
    };
}

/**
 * Converts a Markdown document to the plain text stored in `textContent`.
 * It intentionally keeps code and prose while dropping formatting syntax.
 */
export function markdownToPlainText(markdown: string): string {
    return markdown
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
        .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
        .replace(/~~~[^\n]*\n([\s\S]*?)~~~/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/^[ \t]{0,3}(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, '')
        .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '')
        .replace(/[*_~`]+/g, '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
