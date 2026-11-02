import type { Agent } from '@atproto/api';
import { Effect } from 'effect';
import { ref, type Ref } from 'vue';

export const isInitialized = ref(false);
export const isDidAllowed = ref(false);
export const sharedAgent: Ref<Agent | null> = ref(null);

/**
 * The Vue refs above are the UI's observable view of the ATProto session.
 * These helpers keep all writes to that state inside Effect programs.
 */
export const setInitialized = (value: boolean): Effect.Effect<void> =>
    Effect.sync(() => {
        isInitialized.value = value;
    });

export const setDidAllowed = (value: boolean): Effect.Effect<void> =>
    Effect.sync(() => {
        isDidAllowed.value = value;
    });

export const setSharedAgent = (value: Agent | null): Effect.Effect<void> =>
    Effect.sync(() => {
        sharedAgent.value = value;
    });

export const resetAgentState: Effect.Effect<void> = Effect.sync(() => {
    isInitialized.value = false;
    isDidAllowed.value = false;
    sharedAgent.value = null;
});
