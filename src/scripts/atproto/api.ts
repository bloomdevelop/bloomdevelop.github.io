// oauth.ts --- AT Protocol OAuth sign-in/sign-out flow implementation w/ MicroLog functions
// Author: Amy Bunny <amy+git@amogus.cloud>
// License: Expat (MIT)
// Code:

import { now } from '@atcute/tid';
import type {
    Agent,
    AppBskyEmbedExternal,
    AppBskyFeedPost,
    ComAtprotoRepoApplyWrites,
    ComAtprotoRepoCreateRecord,
} from '@atproto/api';
import type { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import * as dagCbor from '@ipld/dag-cbor';
import { Data, DateTime, Effect, Schema } from 'effect';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { resetAgentState, setDidAllowed, setInitialized, setSharedAgent } from './agent';
import { setSessionHint, clearOAuthCallbackParams } from './session';
import { ALLOWED_DIDS, NEW_LOG_LEXICON, OLD_LOG_LEXICON } from '../consts';
import { constructApiUrl, toGraphemeSegments } from './utils';

/// OAuth scopes for the app, should match the ones in oauth-client-metadata.json
const OAUTH_SCOPES = `atproto include:app.bsky.authViewAll?aud=did:web:api.bsky.app%23bsky_appview repo:app.bsky.feed.post?action=create repo:${OLD_LOG_LEXICON}?action=delete repo:${NEW_LOG_LEXICON}?action=create`;

export class OAuthError extends Data.TaggedError('OAuthError')<{
    readonly message: string;
    readonly cause?: unknown;
}> {}

export class AtprotoError extends Data.TaggedError('AtprotoError')<{
    readonly message: string;
    readonly cause?: unknown;
}> {}

export class NoSessionError extends Data.TaggedError('NoSessionError')<{
    readonly message: string;
}> {}

const HandleResolution = Schema.Struct({
    did: Schema.String,
});

/**
 * Gets the client ID, necesary for the OAuth flow.
 */
function clientID(): string {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocal) {
        // see https://atproto.com/specs/oauth#localhost-client-development
        return `http://localhost?${new URLSearchParams({
            scope: OAUTH_SCOPES,
            redirect_uri: Object.assign(new URL(window.location.origin), {
                hostname: '127.0.0.1',
            }).href,
        })}`;
    }
    return `https://${window.location.host}/oauth-client-metadata.json`;
}

// NOTE: do not compute this at module scope. `clientID()` reads `window.location`,
// which does not exist during SSR, and this module is imported by components that
// Astro renders on the server.
let cachedClientID: string | undefined;
function getClientID(): string {
    return (cachedClientID ??= clientID());
}

// TODO: Refactor to global state
let oauthClient: BrowserOAuthClient | undefined;
let oauthSetupPromise: Promise<boolean> | undefined;
let agent: Agent | undefined;

const requireAgent = (): Effect.Effect<Agent, NoSessionError> =>
    agent
        ? Effect.succeed(agent)
        : Effect.fail(new NoSessionError({ message: 'No ATProto session is active' }));

const causeMessage = (cause: unknown): string =>
    cause instanceof Error && cause.message ? `: ${cause.message}` : '';

/**
 * Resolve a handle through the public AppView and validate the response with
 * Effect Schema instead of trusting `response.json()`.
 */
const resolveHandle = (identifier: string): Effect.Effect<string, OAuthError> =>
    Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
            try: (signal) =>
                fetch(
                    constructApiUrl(
                        'com.atproto.identity.resolveHandle',
                        { handle: identifier },
                        'https://api.bsky.app',
                    ),
                    { signal },
                ),
            catch: (cause) =>
                new OAuthError({
                    message: `Could not resolve handle "${identifier}"`,
                    cause,
                }),
        });

        if (!response.ok) {
            return yield* new OAuthError({
                message: `Handle resolution failed with HTTP ${response.status}`,
            });
        }

        const body = yield* Effect.tryPromise({
            try: () => response.json() as Promise<unknown>,
            catch: (cause) =>
                new OAuthError({
                    message: 'Could not read the handle resolution response',
                    cause,
                }),
        });

        const decoded = yield* Schema.decodeUnknownEffect(HandleResolution)(body).pipe(
            Effect.mapError(
                (cause) =>
                    new OAuthError({
                        message: 'Invalid handle resolution response',
                        cause,
                    }),
            ),
        );

        return decoded.did;
    });

/**
 * Check if the user is able to perform OAuth flow
 */
const beforeLogin = (identifier: string): Effect.Effect<boolean, OAuthError> =>
    Effect.gen(function* () {
        yield* Effect.logDebug('[OAUTH]', 'performing beforeLogin check for', identifier);

        const did = identifier.startsWith('did:') ? identifier : yield* resolveHandle(identifier);
        const allowed = ALLOWED_DIDS.includes(did);

        yield* setDidAllowed(allowed);

        if (!allowed) {
            yield* Effect.logWarning('[OAUTH]', 'Unauthorized DID', did);
        }

        return allowed;
    });

/**
 * Configure the OAuthClient and perform any necesary work to restore a session.
 *
 * This is the Effect-native implementation. Prefer {@link setupOAuth} from UI
 * code; it caches this program and exposes it as a Promise.
 */
export const setupOAuthEffect: Effect.Effect<boolean> = Effect.gen(function* () {
    const { BrowserOAuthClient } = yield* Effect.tryPromise({
        try: () => import('@atproto/oauth-client-browser'),
        catch: (cause) =>
            new OAuthError({
                message: 'Failed to load @atproto/oauth-client-browser',
                cause,
            }),
    });
    const { Agent } = yield* Effect.tryPromise({
        try: () => import('@atproto/api'),
        catch: (cause) => new OAuthError({ message: 'Failed to load @atproto/api', cause }),
    });

    const client = yield* Effect.tryPromise({
        try: () =>
            BrowserOAuthClient.load({
                clientId: getClientID(),
                handleResolver: 'https://bsky.social',
            }),
        catch: (cause) => new OAuthError({ message: 'Could not load the OAuth client', cause }),
    });
    oauthClient = client;

    const result = yield* Effect.tryPromise({
        try: () => client.init(),
        catch: (cause) =>
            new OAuthError({ message: 'Could not initialize the OAuth client', cause }),
    });

    // No stored session: the client is still ready to start a sign-in.
    if (!result) {
        setSessionHint(false);
        return true;
    }

    const { session, state } = result;
    if (state != null) {
        yield* Effect.logDebug('[OAUTH]', 'Authenticated', session.sub, `(state: ${state})`);
    } else {
        yield* Effect.logInfo('[OAUTH]', 'Restored session', session.sub);
    }

    if (!ALLOWED_DIDS.includes(session.did)) {
        yield* Effect.logWarning('[OAUTH]', 'DID', session.did, 'is not allowed!');
        yield* setDidAllowed(false);
        return true;
    }

    yield* setDidAllowed(true);

    const nextAgent = new Agent(session);

    const res = yield* Effect.tryPromise({
        try: () => nextAgent.com.atproto.server.getSession(),
        catch: (cause) => new OAuthError({ message: 'Could not acquire session', cause }),
    });

    if (!res.success) {
        return yield* new OAuthError({
            message: 'Could not acquire session',
            cause: res,
        });
    }

    agent = nextAgent;
    yield* setSharedAgent(nextAgent);
    yield* setInitialized(true);
    setSessionHint(true);
    yield* Effect.logInfo('[OAUTH]', 'Agent initialized');

    return true;
}).pipe(
    // The authorization response is single-use; do not leave it in the URL for
    // a reload to replay. No-op unless this was an OAuth callback page.
    Effect.ensuring(Effect.sync(() => clearOAuthCallbackParams())),
    Effect.catch((error) =>
        Effect.gen(function* () {
            yield* Effect.logError('[OAUTH]', 'An error occurred during OAuth setup:', error);
            // Do not leave a half-initialized client behind; let a later call retry.
            oauthClient = undefined;
            yield* resetAgentState;
            return false;
        }),
    ),
);

/**
 * Configure the OAuthClient and perform any necesary work to restore a session.
 *
 * Safe to call more than once: concurrent calls share the same setup, and a
 * failed attempt is retried the next time this is called.
 * @returns whether the client was successfully initialized
 * @todo Split off client/agent setup and session restoration
 */
export function setupOAuth(): Promise<boolean> {
    oauthSetupPromise ??= Effect.runPromise(setupOAuthEffect).then(
        (initialized) => {
            // Allow a later call to retry if setup failed.
            if (!initialized) oauthSetupPromise = undefined;
            return initialized;
        },
        (defect) => {
            oauthSetupPromise = undefined;
            throw defect;
        },
    );

    return oauthSetupPromise;
}

/**
 * Prompt the user to log in via their PDS using OAuth (starts the sign-in flow)
 * @param identifier
 * @example await startLoginFlow("did:plc:z72i7hdynmk6r22z27h6tvur")
 */
export const startLoginFlowEffect = (identifier: string): Effect.Effect<void, OAuthError> =>
    Effect.gen(function* () {
        // The client is normally set up on page load; initialize it lazily here
        // too in case the user clicks before that finished (or it never ran).
        if (!oauthClient) {
            yield* Effect.tryPromise({
                try: () => setupOAuth(),
                catch: (cause) =>
                    new OAuthError({ message: 'Could not initialize the OAuth client', cause }),
            });
        }

        const client = oauthClient;
        if (!client) {
            return yield* new OAuthError({
                message:
                    'Could not initialize the OAuth client (failed to load @atproto/oauth-client-browser). Try reloading the page.',
            });
        }

        // Setup may have restored an existing session just now (for example when
        // the caller could not know about it up front); no sign-in is needed.
        if (agent) return undefined;

        if (!(yield* beforeLogin(identifier))) {
            return yield* new OAuthError({
                message: `"${identifier}" is not authorized to log in`,
            });
        }

        // Remember that a sign-in is in flight. The OAuth client only creates a
        // session after the redirect, so on a first login the callback page
        // would otherwise have no hint that it should run `init()`.
        setSessionHint(true);

        yield* Effect.tryPromise({
            try: (signal) =>
                client.signIn(identifier, {
                    state: crypto.randomUUID(),
                    signal,
                }),
            catch: (cause) =>
                new OAuthError({
                    message: 'Failed to start the OAuth sign-in flow',
                    cause,
                }),
        });

        return undefined;
    }).pipe(
        Effect.tapError((error) =>
            Effect.logError('[OAUTH]', 'Failed to start OAuth client sign-in flow:', error),
        ),
    );

/**
 * Prompt the user to log in via their PDS using OAuth (starts the sign-in flow)
 */
export function startLoginFlow(identifier: string): Promise<void> {
    return Effect.runPromise(startLoginFlowEffect(identifier));
}

/**
 * Revoke the current oauth session and reload the page.
 */
export const revokeSessionEffect: Effect.Effect<void, OAuthError> = Effect.gen(function* () {
    const client = oauthClient;
    const did = agent?.did; // do not revoke if we aren't logged in lol
    if (!client || !did) return;

    yield* Effect.tryPromise({
        try: () => client.revoke(did),
        catch: (cause) => new OAuthError({ message: 'Failed to revoke the OAuth session', cause }),
    });
    setSessionHint(false);
    yield* Effect.sync(() => window.location.reload());
});

/**
 * Revoke the current oauth session and reload the page.
 */
export function revokeSession(): Promise<void> {
    return Effect.runPromise(revokeSessionEffect);
}

/**
 * Generate an embed for the given content and TID.
 * @param segments - The content as grapheme segments, to avoid recalculating
 * @param generatedTID - A pre-defined TID to use for the embed's URI. It should point to that specific log entry.
 */
function generateEmbedForContent(
    segments: string[],
    generatedTID: string,
): AppBskyEmbedExternal.External {
    // Do not reuse location.href: composing from a permalink would append a
    // second ?log= query instead of replacing it.
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('log', generatedTID);

    return {
        $type: 'app.bsky.embed.external#external',
        uri: url.toString(),
        title: "View in Spring's Website",
        description: segments.length > 63 ? `${segments.slice(0, 60).join('')}…` : '', // Skip description because otherwise it looks weird and repetitive
    };
}

const createRecord = (
    input: ComAtprotoRepoCreateRecord.InputSchema,
): Effect.Effect<ComAtprotoRepoCreateRecord.Response, AtprotoError | NoSessionError> =>
    Effect.gen(function* () {
        const currentAgent = yield* requireAgent();

        const response = yield* Effect.tryPromise({
            try: () => currentAgent.com.atproto.repo.createRecord(input),
            catch: (cause) =>
                new AtprotoError({
                    message: `Failed to create an ATProto record${causeMessage(cause)}`,
                    cause,
                }),
        });

        if (!response.success) {
            return yield* new AtprotoError({
                message: 'ATProto record creation was not successful',
                cause: response,
            });
        }

        return response;
    });

const applyWrites = (
    input: ComAtprotoRepoApplyWrites.InputSchema,
): Effect.Effect<ComAtprotoRepoApplyWrites.Response, AtprotoError | NoSessionError> =>
    Effect.gen(function* () {
        const currentAgent = yield* requireAgent();

        const response = yield* Effect.tryPromise({
            try: () => currentAgent.com.atproto.repo.applyWrites(input),
            catch: (cause) =>
                new AtprotoError({
                    message: `Failed to apply ATProto writes${causeMessage(cause)}`,
                    cause,
                }),
        });

        if (!response.success) {
            return yield* new AtprotoError({
                message: 'ATProto writes were not successful',
                cause: response,
            });
        }

        return response;
    });

/**
 * Compute the CID a PDS assigns to a record: a DAG-CBOR encoding hashed with
 * SHA-256. This lets a record reference another record that is created in the
 * same `applyWrites` transaction.
 */
const cidForRecord = (record: Record<string, unknown>): Effect.Effect<string, AtprotoError> =>
    Effect.tryPromise({
        try: async () => {
            const bytes = dagCbor.encode(record);
            const digest = await sha256.digest(bytes);
            return CID.createV1(dagCbor.code, digest).toString();
        },
        catch: (cause) =>
            new AtprotoError({
                message: `Failed to compute the ATProto record CID${causeMessage(cause)}`,
                cause,
            }),
    });

/**
 * Build the bluesky post record for a log entry.
 * @param tid - TID of the entry
 * @param content - The entry's content
 *
 * YOU SHOULD BE USING {@link createLogEffect}, NOT buildCrosspostedPost!!!
 */
const buildCrosspostedPost = (
    tid: string,
    content: string,
    createdAt: string,
): AppBskyFeedPost.Record => {
    const segments = toGraphemeSegments(content);
    const embedRecord = generateEmbedForContent(segments, tid);

    let text: string;
    if (segments.length > 300) {
        // Truncate by grapheme so we never split a surrogate pair (emoji /
        // astral characters) and produce replacement-character "garbage".
        // Reserve 3 graphemes for the ellipsis so the post stays within
        // Bluesky's 300-grapheme limit.
        text = `${segments.slice(0, 300 - 3).join('')}...`;
    } else {
        text = content;
    }

    return {
        $type: 'app.bsky.feed.post',
        text,
        embed: {
            $type: 'app.bsky.embed.external',
            external: embedRecord,
        },
        createdAt,
    };
};

/**
 * Create both an entry and a bluesky post in a single transaction, so a
 * failure can never leave a post pointing at a log entry that doesn't exist.
 *
 * Please use {@link createLogEffect} instead
 */
const crosspost = (
    content: string,
    tid: string,
    createdAt: string,
): Effect.Effect<void, AtprotoError | NoSessionError> =>
    Effect.gen(function* () {
        const currentAgent = yield* requireAgent();
        const post = buildCrosspostedPost(tid, content, createdAt);
        const postCid = yield* cidForRecord(post);

        yield* applyWrites({
            repo: currentAgent.assertDid,
            writes: [
                {
                    $type: 'com.atproto.repo.applyWrites#create',
                    collection: 'app.bsky.feed.post',
                    rkey: tid,
                    value: post,
                },
                {
                    $type: 'com.atproto.repo.applyWrites#create',
                    collection: NEW_LOG_LEXICON,
                    rkey: tid,
                    value: {
                        $type: NEW_LOG_LEXICON,
                        content,
                        createdAt,
                        blueskyPost: {
                            uri: `at://${currentAgent.assertDid}/app.bsky.feed.post/${tid}`,
                            cid: postCid,
                        },
                    },
                },
            ],
        });
    });

/**
 * Create a log entry and optionally crosspost it to Bluesky.
 */
export const createLogEffect = (
    content: string,
    shouldCrosspost: boolean = false,
): Effect.Effect<
    {
        rkey: string;
        content: string;
        createdAt: string;
    },
    AtprotoError | NoSessionError
> =>
    Effect.gen(function* () {
        const savedContent = content.trim();
        if (!savedContent) {
            return yield* new AtprotoError({ message: 'A note cannot be empty.' });
        }

        const tid = now();
        const nowUtc = yield* DateTime.now;
        const createdAt = DateTime.formatIso(nowUtc);

        if (shouldCrosspost) {
            yield* crosspost(savedContent, tid, createdAt);
        } else {
            const currentAgent = yield* requireAgent();

            yield* createRecord({
                repo: currentAgent.assertDid,
                collection: NEW_LOG_LEXICON,
                rkey: tid,
                record: {
                    $type: NEW_LOG_LEXICON,
                    content: savedContent,
                    createdAt,
                },
            });
        }

        return {
            rkey: tid,
            content: savedContent,
            createdAt,
        };
    });

/**
 * Create a log entry and optionally crosspost it to Bluesky
 * @param content - Content of the log entry
 * @param shouldCrosspost - Whether a bluesky post should be created alongside the entry, defaults to `false`
 */
export function createLog(
    content: string,
    shouldCrosspost: boolean = false,
): Promise<{
    rkey: string;
    content: string;
    createdAt: string;
}> {
    return Effect.runPromise(createLogEffect(content, shouldCrosspost));
}

// oauth.ts ends here
