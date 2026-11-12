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
