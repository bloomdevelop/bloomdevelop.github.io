// oauth.ts --- AT Protocol OAuth sign-in/sign-out flow implementation w/ MicroLog functions
// Author: Amy Bunny <amy+git@amogus.cloud>
// License: Expat (MIT)
// Code:

import { now } from '@atcute/tid';
import type { Agent, AppBskyEmbedExternal, ComAtprotoRepoCreateRecord } from '@atproto/api';
import type { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { isDidAllowed, isInitialized, sharedAgent } from './agent';
import { ALLOWED_DIDS, NEW_LOG_LEXICON, OLD_LOG_LEXICON } from '../consts';
import { toGraphemeSegments, constructApiUrl } from './utils';

/// OAuth scopes for the app, should match the ones in oauth-client-metadata.json
const OAUTH_SCOPES = `atproto include:app.bsky.authViewAll?aud=did:web:api.bsky.app%23bsky_appview repo:app.bsky.feed.post?action=create repo:${OLD_LOG_LEXICON}?action=delete repo:${NEW_LOG_LEXICON}?action=create`;

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
let agent: Agent;

/**
 * Check if the user is able to perform OAuth flow
 */
async function beforeLogin(identifier: string): Promise<boolean> {
    console.debug('[OAUTH]', 'performing beforeLogin check for handle', identifier);

    const res = await fetch(
        constructApiUrl(
            'com.atproto.identity.resolveHandle',
            {
                handle: identifier,
            },
            'https://api.bsky.app',
        ),
    ).then(async (data) => await data.json());

    if (!ALLOWED_DIDS.includes(res.did)) {
        console.warn('[OAUTH]', 'Unauthorized DID', res.did);
        isDidAllowed.value = false;
        return false;
    }

    isDidAllowed.value = true;
    return true;
}

/**
 * Configure the OAuthClient and perform any necesary work to restore a session.
 *
 * Safe to call more than once: concurrent calls share the same setup, and a
 * failed attempt is retried the next time this is called.
 * @returns whether the client was successfully initialized
 * @todo Split off client/agent setup and session restoration
 */
export function setupOAuth(): Promise<boolean> {
    oauthSetupPromise ??= configureOAuth().then((initialized) => {
        // Allow a later call to retry if setup failed.
        if (!initialized) oauthSetupPromise = undefined;
        return initialized;
    });

    return oauthSetupPromise;
}

async function configureOAuth(): Promise<boolean> {
    try {
        const { BrowserOAuthClient } = await import('@atproto/oauth-client-browser');
        const { Agent } = await import('@atproto/api');

        oauthClient = await BrowserOAuthClient.load({
            clientId: getClientID(),
            handleResolver: 'https://bsky.social',
        });

        const result = await oauthClient.init();

        // No stored session: the client is still ready to start a sign-in.
        if (!result) return true;

        const { session, state } = result;
        if (state != null) {
            console.debug('[OAUTH]', 'Authenticated', session.sub, `(state: ${state})`);
        } else {
            console.info('[OAUTH]', 'Restored session', session.sub);
        }

        if (!ALLOWED_DIDS.includes(session.did)) {
            console.warn('[OAUTH]', 'DID', session.did, 'is not allowed!');
            isDidAllowed.value = false;
            return true;
        }

        isDidAllowed.value = true;

        agent = new Agent(session);

        const res = await agent.com.atproto.server.getSession();
        if (!res.success) {
            console.error('[OAUTH]', 'Could not acquire session', res);
            throw new Error(JSON.stringify(res));
        }

        console.info('[OAUTH]', 'Agent initialized');
        sharedAgent.value = agent;
        isInitialized.value = true;

        return true;
    } catch (error) {
        console.error('[OAUTH]', 'An error occurred during OAuth setup:', error);
        // Do not leave a half-initialized client behind; let a later call retry.
        oauthClient = undefined;
        return false;
    }
}

/**
 * Prompt the user to log in via their PDS using OAuth (starts the sign-in flow)
 * @param identifier
 * @example await startLoginFlow("did:plc:z72i7hdynmk6r22z27h6tvur")
 */
export async function startLoginFlow(identifier: string) {
    try {
        // The client is normally set up on page load; initialize it lazily here
        // too in case the user clicks before that finished (or it never ran).
        if (!oauthClient) await setupOAuth();

        const client = oauthClient;
        if (!client) {
            console.error(
                '[OAUTH]',
                'OAuth client could not be initialized (failed to load @atproto/oauth-client-browser). Try reloading the page.',
            );
            return;
        }

        if (!(await beforeLogin(identifier))) return;

        await client.signIn(identifier, {
            state: window.crypto.randomUUID(),
            signal: new AbortController().signal,
        });
    } catch (err) {
        console.error('[OAUTH]', 'Failed to start OAuth client sign-in flow:', err);
    }
}

/**
 * Revoke the current oauth session and reload the page.
 */
export async function revokeSession() {
    const did = sharedAgent.value?.did; // do not revoke if we aren't logged in lol
    if (!oauthClient || !did) return;

    await oauthClient.revoke(did);
    window.location.reload();
}

/**
 * Generate an embed for the given content and TID.
 * @param length - The length of the content as grapheme segments, to avoid recalculating
 * @param content
 * @param generatedTID - A pre-defined TID to use for the embed's URI. It should point to that specific log entry.
 */
function generateEmbedForContent(
    segments: string[],
    generatedTID: string,
): AppBskyEmbedExternal.External {
    return {
        $type: 'app.bsky.embed.external#external',
        uri: `${window.location.href}?log=${generatedTID}`,
        title: "View in Spring's Website",
        description: segments.length > 63 ? `${segments.slice(0, 60).join('')}…` : '', // Skip description because otherwise it looks weird and repetitive
    };
}

/**
 * Create a bluesky post for a log entry.
 * @param tid - TID of the entry
 * @param content - The entry's content
 *
 * YOU SHOULD BE USING {@link createLog}, NOT createCrosspostedLog!!!
 */
async function createCrosspostedLog(
    tid: string,
    content: string,
    createdAt: string,
): Promise<ComAtprotoRepoCreateRecord.Response | undefined> {
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

    return await agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: 'app.bsky.feed.post',
        rkey: tid,
        validate: true,
        record: {
            $type: 'app.bsky.feed.post',
            text,
            embed: {
                $type: 'app.bsky.embed.external',
                external: embedRecord,
            },
            createdAt,
        },
    });
}

/**
 * Create both an entry and a bluesky post at (almost) the same time
 * @todo Use applyWrites to actually create both in a single transaction
 *
 * Please use {@link createLog} instead
 */
async function crosspost(content: string, tid: string, createdAt: string) {
    const crosspostLog = await createCrosspostedLog(tid, content, createdAt);
    if (!crosspostLog?.success) throw new Error(JSON.stringify(crosspostLog));

    await agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: NEW_LOG_LEXICON,
        rkey: tid,
        record: {
            $type: NEW_LOG_LEXICON,
            content: content,
            createdAt,
            blueskyPost: {
                uri: crosspostLog.data.uri,
                cid: crosspostLog.data.cid,
            },
        },
    });
}

/**
 * Create a log entry and optionally crosspost it to Bluesky
 * @param content - Content of the log entry
 * @param shouldCrosspost - Whether a bluesky post should be created alongside the entry, defaults to `false`
 */
export async function createLog(
    content: string,
    shouldCrosspost: boolean = false,
): Promise<{
    rkey: string;
    content: string;
    createdAt: string;
}> {
    const tid = now();
    const createdAt = new Date().toISOString();

    if (shouldCrosspost) {
        await crosspost(content, tid, createdAt);
    } else {
        await agent.com.atproto.repo.createRecord({
            repo: agent.assertDid,
            collection: NEW_LOG_LEXICON,
            rkey: tid,
            record: {
                $type: NEW_LOG_LEXICON,
                content: content,
                createdAt,
            },
        });
    }

    return {
        rkey: tid,
        content,
        createdAt,
    };
}

// oauth.ts ends here
