// oauth.ts --- AT Protocol OAuth sign-in/sign-out flow implementation w/ MicroLog functions
// Author: Amy Bunny <amy+git@amogus.cloud>
// License: Expat (MIT)
// Code:

import { now } from "@atcute/tid";
import {
  Agent,
  type AppBskyEmbedExternal,
  type ComAtprotoRepoCreateRecord,
} from "@atproto/api";
import { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { isDidAllowed, isInitialized, agent as sharedAgent } from "./agent";
import { toGraphemeSegments } from "./segments";
import { ALLOWED_DIDS, OLD_LOG_LEXICON, NEW_LOG_LEXICON } from "./consts";

/// OAuth scopes for the app, should match the ones in oauth-client-metadata.json
const OAUTH_SCOPES =
  `atproto include:app.bsky.authViewAll?aud=did:web:api.bsky.app%23bsky_appview repo:app.bsky.feed.post?action=create repo:${OLD_LOG_LEXICON}?action=delete repo:${NEW_LOG_LEXICON}?action=create`;

/**
 * Utility function to construct an XRPC URL
 * If you want to PATCH or POST, please use {@link Agent} instead.
 * @param nsid - XRPC endpoint NSID
 * @param options - Query parameters of said endpoint
 * @param api - Base URL of the AppView or PDS to use, defaults to Bluesky's public API
 * @example
 * constructApiUrl("com.atproto.repo.getRecord", { repo: "did:plc:...", rkey: "self", collection: "app.bsky.actor.profile"})
 * // => "https://api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=did:plc:...&rkey=self&collection=app.bsky.actor.profile"
 */
export function constructApiUrl(
  nsid: string,
  options: Record<string, string>,
  api: string = "https://api.bsky.app",
): string {
  const url = new URL(`${api}/xrpc/${nsid}`);
  for (const [key, value] of Object.entries(options)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * Gets the client ID, necesary for the OAuth flow.
 */
function clientID(): string {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) {
    // see https://atproto.com/specs/oauth#localhost-client-development
    return `http://localhost?${new URLSearchParams({
      scope: OAUTH_SCOPES,
      redirect_uri: Object.assign(new URL(window.location.origin), {
        hostname: "127.0.0.1",
      }).href,
    })}`;
  }
  return `https://${window.location.host}/oauth-client-metadata.json`;
}

const CLIENT_ID = clientID();

// TODO: Refactor to global state
let oauthClient: BrowserOAuthClient;
let agent: Agent;

/**
 * Check if the user is able to perform OAuth flow
 */
async function beforeLogin(identifier: string): Promise<boolean> {
  console.debug(
    "[OAUTH]",
    "performing beforeLogin check for handle",
    identifier,
  );

  const res = await fetch(
    constructApiUrl(
      "com.atproto.identity.resolveHandle",
      {
        handle: identifier,
      },
      "https://api.bsky.app",
    ),
  ).then(async (res) => await res.json());

  if (!ALLOWED_DIDS.includes(res.did)) {
    console.warn("[OAUTH]", "Unauthorized DID", res.did);
    isDidAllowed.value = false;
    return false;
  }

  isDidAllowed.value = true;
  return true;
}

/**
 * Configure the OAuthClient and perform any necesary work to restore a session.
 * @todo Split off client/agent setup and session restoration
 */
export async function setupOAuth() {
  try {
    oauthClient = await BrowserOAuthClient.load({
      clientId: CLIENT_ID,
      handleResolver: "https://bsky.social",
    });

    const result = await oauthClient.init();

    if (!result) return;

    const { session, state } = result;
    if (state != null) {
      console.debug(
        "[OAUTH]",
        "Authenticated",
        session.sub,
        `(state: ${state})`,
      );
    } else {
      console.info("[OAUTH]", "Restored session", session.sub);

      if (!ALLOWED_DIDS.includes(session.did)) {
        console.warn("[OAUTH]", "DID", session.did, "is not allowed!");
        isDidAllowed.value = false;
        return;
      }

      isDidAllowed.value = true;
    }

    agent = new Agent(session);

    const res = await agent.com.atproto.server.getSession();
    if (!res.success) {
      console.error("[OAUTH]", "Could not acquire session", res);
      throw new Error(JSON.stringify(res));
    }

    console.info("[OAUTH]", "Agent initialized");
    sharedAgent.value = agent;
    isInitialized.value = true;
  } catch (error) {
    console.error("[OAUTH]", "An error occurred during OAuth setup:", error);
  }
}

/**
 * Prompt the user to log in via their PDS using OAuth (starts the sign-in flow)
 * @param identifier
 * @example await startLoginFlow("did:plc:z72i7hdynmk6r22z27h6tvur")
 */
export async function startLoginFlow(identifier: string) {
  try {
    if (!(await beforeLogin(identifier))) return;

    await oauthClient.signIn(identifier, {
      state: window.crypto.randomUUID(),
      signal: new AbortController().signal,
    });
  } catch (err) {
    console.error("[OAUTH]", "Failed to start OAuth client sign-in flow:", err);
  }
}

/**
 * Revoke the current oauth session and reload the page.
 */
export function revokeSession() {
  if (!agent?.did) return; // do not revoke if we aren't logged in lol

  oauthClient.revoke(agent.did);
  window.location.reload();
}

/**
 * Generate an embed for the given content and TID.
 * @param length - The length of the content as grapheme segments, to avoid recalculating
 * @param content
 * @param generatedTID - A pre-defined TID to use for the embed's URI. It should point to that specific log entry.
 */
function generateEmbedForContent(
  length: number,
  content: string,
  generatedTID: string,
): AppBskyEmbedExternal.External {
  return {
    $type: "app.bsky.embed.external#external",
    uri: `${window.location.href}?log=${generatedTID}`,
    title: "View in Spring's Website",
    description: length > 63 ? `${content.substring(0, 60)}…` : "", // Skip description because otherwise it looks weird and repetitive
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
  let text: string[] | string = toGraphemeSegments(content);
  const embedRecord = generateEmbedForContent(length, text.join(""), tid);
  if (text.length > 300) {
    text = [...content.slice(0, 299), "..."];
  }

  text = text.join("");

  return await agent.com.atproto.repo.createRecord({
    repo: agent.did as string, // They are one and the same, not sure why typescript is complaining about it
    collection: "app.bsky.feed.post",
    rkey: tid,
    validate: true,
    record: {
      $type: "app.bsky.feed.post",
      text,
      embed: {
        $type: "app.bsky.embed.external",
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
  const crosspost = await createCrosspostedLog(tid, content, createdAt);
  // @ts-expect-error this might seem nonsensical, but that's also what bluesky does themselves
  if (!crosspost?.success) throw new Error(crosspost as object);

  await agent.com.atproto.repo.createRecord({
    repo: agent.did as string, // god fucking dammit
    collection: NEW_LOG_LEXICON,
    rkey: tid,
    record: {
      $type: NEW_LOG_LEXICON,
      content: content,
      createdAt,
      blueskyPost: {
        uri: crosspost.data.uri,
        cid: crosspost.data.cid,
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
      repo: agent.did as string,
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

// Set up the OAuth client as soon as the module is loaded
setupOAuth();

// oauth.ts ends here
