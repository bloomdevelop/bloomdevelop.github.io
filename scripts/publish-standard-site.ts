// Publishes the site's standard.site publication and document records.
//
// Usage:
//   ATPROTO_IDENTIFIER=spring.furrest.net \
//   ATPROTO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//   vpx scripts/publish-standard-site.ts
//
// Add --dry-run to print the records without signing in. See the README for
// the GitHub Actions setup.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AtpAgent } from '@atproto/api';
import { Schema } from 'effect';
import { parse as parseYaml } from 'yaml';
import {
    STANDARD_SITE_DID,
    STANDARD_SITE_DOCUMENT_COLLECTION,
    STANDARD_SITE_PUBLICATION_COLLECTION,
    STANDARD_SITE_PUBLICATION_RKEY,
    STANDARD_SITE_PUBLICATION_URI,
    buildStandardSiteDocumentRecord,
    buildStandardSitePublicationRecord,
    markdownToPlainText,
    standardSiteDocumentRkey,
    type StandardSiteDocumentInput,
} from '../src/scripts/standard-site';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BLOG_DIR = path.join(ROOT, 'blog');
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const BlogFrontmatter = Schema.Record(Schema.String, Schema.Unknown);
const HandleResolution = Schema.Struct({ did: Schema.String });
const DidDocument = Schema.Struct({
    service: Schema.optional(
        Schema.Array(
            Schema.Struct({
                id: Schema.optional(Schema.String),
                type: Schema.optional(Schema.String),
                serviceEndpoint: Schema.optional(Schema.Unknown),
            }),
        ),
    ),
});

const USAGE = `Publish standard.site records for the blog.

Usage: vpx scripts/publish-standard-site.ts [--dry-run]

Environment:
  ATPROTO_IDENTIFIER     Handle or DID of the publishing account
  ATPROTO_APP_PASSWORD   App password for that account
  ATPROTO_PDS            Optional PDS URL override (resolved automatically)`;

function asDate(value: unknown): Date | undefined {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
}

function parseFrontmatter(source: string): {
    data: Record<string, unknown>;
    body: string;
} {
    const match = FRONTMATTER.exec(source);
    if (!match) {
        return { data: {}, body: source };
    }

    let data: Record<string, unknown>;
    try {
        data = Schema.decodeUnknownSync(BlogFrontmatter)(parseYaml(match[1]) ?? {});
    } catch {
        throw new Error('Blog frontmatter must be a YAML mapping');
    }

    return {
        data,
        body: source.slice(match[0].length),
    };
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

interface PublishablePost extends StandardSiteDocumentInput {
    readonly rkey: string;
}

async function readPosts(): Promise<PublishablePost[]> {
    const entries = await readdir(BLOG_DIR, { recursive: true });
    const posts: PublishablePost[] = [];
    const rkeys = new Map<string, string>();

    for (const entry of entries) {
        if (!/\.(?:md|mdx)$/i.test(entry)) continue;
        if (entry.split(path.sep).some((part) => part.startsWith('_'))) continue;

        const file = path.join(BLOG_DIR, entry);
        const source = await readFile(file, 'utf8');
        const { data, body } = parseFrontmatter(source);

        if (data.draft === true) continue;

        const title = optionalString(data.title);
        const publishedAt = asDate(data.pubDate);

        if (!title || !publishedAt) {
            throw new Error(`${entry}: frontmatter must include title and pubDate`);
        }

        const slug = entry.replace(/\\/g, '/').replace(/\.(?:md|mdx)$/i, '');
        const rkey = standardSiteDocumentRkey(slug, publishedAt);
        const existingSlug = rkeys.get(rkey);

        if (existingSlug) {
            throw new Error(
                `${entry} and ${existingSlug} resolve to the same standard.site rkey (${rkey})`,
            );
        }

        rkeys.set(rkey, slug);
        posts.push({
            slug,
            title,
            description: optionalString(data.description),
            publishedAt,
            updatedAt: asDate(data.updatedDate),
            textContent: markdownToPlainText(body),
            rkey,
        });
    }

    return posts.toSorted((a, b) => a.slug.localeCompare(b.slug));
}

async function resolveIdentifier(identifier: string): Promise<string> {
    if (identifier.startsWith('did:')) return identifier;

    const url = new URL('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle');
    url.searchParams.set('handle', identifier);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not resolve "${identifier}" (HTTP ${response.status})`);
    }

    const body: unknown = await response.json();
    try {
        return Schema.decodeUnknownSync(HandleResolution)(body).did;
    } catch {
        throw new Error(`Handle resolution for "${identifier}" did not return a DID`);
    }
}

async function resolvePds(did: string): Promise<string> {
    const didDocumentUrl = did.startsWith('did:web:')
        ? `https://${did.slice('did:web:'.length).replaceAll(':', '/')}/.well-known/did.json`
        : `https://plc.directory/${did}`;

    const response = await fetch(didDocumentUrl);
    if (!response.ok) {
        throw new Error(`Could not load the DID document for ${did} (HTTP ${response.status})`);
    }

    let document: Schema.Schema.Type<typeof DidDocument>;
    try {
        document = Schema.decodeUnknownSync(DidDocument)(await response.json());
    } catch {
        throw new Error(`The DID document for ${did} does not declare an atproto PDS`);
    }

    const service = document.service?.find(
        (candidate) =>
            candidate.id === '#atproto_pds' || candidate.type === 'AtprotoPersonalDataServer',
    );
    const pds = service?.serviceEndpoint;

    if (typeof pds === 'string') return pds;

    if (pds !== null && typeof pds === 'object' && 'href' in pds && typeof pds.href === 'string') {
        return pds.href;
    }

    throw new Error(`The DID document for ${did} does not declare an atproto PDS`);
}

async function publish(): Promise<void> {
    const identifier = process.env.ATPROTO_IDENTIFIER?.trim();
    const password = process.env.ATPROTO_APP_PASSWORD?.trim();

    if (!identifier || !password) {
        throw new Error(
            'Set ATPROTO_IDENTIFIER and ATPROTO_APP_PASSWORD, or pass --dry-run to preview the records',
        );
    }

    const did = await resolveIdentifier(identifier);
    if (did !== STANDARD_SITE_DID) {
        throw new Error(
            `Refusing to publish as ${did}: the site's publication is owned by ${STANDARD_SITE_DID}`,
        );
    }

    const pds = process.env.ATPROTO_PDS?.trim() || (await resolvePds(did));
    const agent = new AtpAgent({ service: pds });

    await agent.login({ identifier, password });
    console.info(`[standard.site] Signed in as ${did} on ${pds}`);

    const publication = await agent.com.atproto.repo.putRecord({
        repo: did,
        collection: STANDARD_SITE_PUBLICATION_COLLECTION,
        rkey: STANDARD_SITE_PUBLICATION_RKEY,
        record: buildStandardSitePublicationRecord(),
    });
    console.info(`[standard.site] Publication: ${publication.data.uri}`);

    const posts = await readPosts();
    for (const post of posts) {
        const record = buildStandardSiteDocumentRecord(post);
        const response = await agent.com.atproto.repo.putRecord({
            repo: did,
            collection: STANDARD_SITE_DOCUMENT_COLLECTION,
            rkey: post.rkey,
            record,
        });
        console.info(`[standard.site] ${post.slug}: ${response.data.uri}`);
    }

    console.info(`[standard.site] Published ${posts.length} document(s).`);
}

async function dryRun(): Promise<void> {
    const posts = await readPosts();

    console.info(
        JSON.stringify(
            {
                publication: {
                    uri: STANDARD_SITE_PUBLICATION_URI,
                    record: buildStandardSitePublicationRecord(),
                },
                documents: posts.map((post) => ({
                    uri: `at://${STANDARD_SITE_DID}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${post.rkey}`,
                    record: buildStandardSiteDocumentRecord(post),
                })),
            },
            null,
            4,
        ),
    );
}

async function main(): Promise<void> {
    const args = new Set(process.argv.slice(2));

    if (args.has('--help') || args.has('-h')) {
        console.info(USAGE);
        return;
    }

    if (args.has('--dry-run')) {
        await dryRun();
        return;
    }

    await publish();
}

try {
    await main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
