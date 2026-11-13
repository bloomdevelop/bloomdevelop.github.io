import type { Agent } from '@atproto/api';
import { ref, type Ref } from 'vue';

/**
 * Reactive view of the ATProto session, kept free of the Effect OAuth bundle so
 * components can read it without downloading the whole client.
 */
export const isInitialized = ref(false);
export const isDidAllowed = ref(false);
export const sharedAgent: Ref<Agent | null> = ref(null);

const SESSION_HINT_KEY = 'atproto-session';

/**
 * Query parameters the OAuth client uses on the redirect back from a PDS.
 * `state` is deliberately excluded: it is too generic to identify a callback.
 */
const OAUTH_CALLBACK_PARAMS = ['code', 'iss', 'error', 'error_description'] as const;

export function setSessionHint(value: boolean) {
    try {
        if (value) localStorage.setItem(SESSION_HINT_KEY, '1');
        else localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
        // Storage can be unavailable (private mode); the hint is only an optimisation.
    }
}

/**
 * Whether a previous visit left a session behind. Used to avoid downloading the
 * OAuth client for anonymous readers.
 */
export function hasSessionHint(): boolean {
    try {
        return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Whether the current URL is an OAuth redirect. `client.init()` has to run on
 * such a page to exchange the authorization code for a session — even on a
 * first login, when no session hint has been stored yet.
 */
export function isOAuthCallback(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return OAUTH_CALLBACK_PARAMS.some((key) => params.has(key));
}

/**
 * OAuth authorization responses are single-use. Drop their parameters once the
 * client has processed them so a reload does not try to replay the callback.
 */
export function clearOAuthCallbackParams() {
    if (typeof window === 'undefined') return;

    try {
        const url = new URL(window.location.href);
        let changed = false;
        for (const key of ['code', 'state', 'iss', 'error', 'error_description']) {
            if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                changed = true;
            }
        }
        if (changed) window.history.replaceState(window.history.state, '', url);
    } catch {
        // History can be unavailable; the session is restored either way.
    }
}
