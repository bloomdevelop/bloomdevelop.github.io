import type { Agent } from '@atproto/api';
import { ref, type Ref } from 'vue';

export const isInitialized = ref(false);
export const isDidAllowed = ref(false);
export const sharedAgent: Ref<Agent | null> = ref(null);
