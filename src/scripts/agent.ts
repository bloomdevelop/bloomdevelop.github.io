import type { Agent } from "@atproto/api";
import { type Ref, ref } from "vue";

export const isInitialized = ref(false);
export const isDidAllowed = ref(false);
export const agent: Ref<Agent | null> = ref(null);
