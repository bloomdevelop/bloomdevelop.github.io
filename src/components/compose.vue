<script setup lang="ts">
import { ref, computed, type Ref } from "vue";
import Scritto from "@scritto/vue";
import { createLog } from "../scripts/oauth";
import { prependLog } from "../scripts/logsStore";

const content = ref("");

const count = computed(() => content.value.length);
const isCrosspostEnabled = ref(false);
const hasInteracted = ref(false);
const isSubmitting = ref(false);
const isEmpty = computed(() => content.value.trim().length === 0);
const errorRef: Ref<Error | null> = ref(null);

async function submit() {
    isSubmitting.value = true;
    errorRef.value = null;

    try {
        const newEntry = await createLog(
            content.value,
            isCrosspostEnabled.value,
        );
        prependLog(newEntry);
        content.value = "";
    } catch (error) {
        if (error instanceof Error) {
            errorRef.value = error;
        } else {
            errorRef.value = new Error(String(error));
        }
        console.error(error);
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <header>
        <h1>New Log</h1>

        <button
            class="button button--icon"
            type="button"
            commandFor="compose"
            command="close"
            aria-label="Close"
        >
            <span class="md-symbols" aria-hidden="true">close</span>
        </button>
    </header>
    <form class="compose" @submit.prevent="submit">
        <label for="compose-textarea" class="text-sm text-surface-1-contrast"> Content </label>
        <textarea
            id="compose-textarea"
            v-model="content"
            class="min-h-28"
            placeholder="Write anything…"
            rows="4"
        ></textarea>

        <div class="flex justify-end">
            <span class="text-xs text-surface-1-contrast tabular-nums opacity-60">
                <Scritto :value="count" :transition="{ duration: 120 }" /> Characters
            </span>
        </div>
        <div
            v-if="isCrosspostEnabled && content.trim().length > 300"
            aria-live="polite"
            class="alert alert--warning"
        >
            <p>Looks like your content is over 300 characters…</p>
            <p>It will be truncated when submitted.</p>
        </div>
        <div v-if="errorRef" role="alert" class="alert alert--error">
            {{ errorRef.message }}
        </div>

        <div class="actions">
            <label class="flex items-center gap-sm text-sm text-surface-1-contrast select-none">
                <input
                    type="checkbox"
                    v-model="isCrosspostEnabled"
                    :class="{ 'is-init': hasInteracted }"
                    @change="hasInteracted = true"
                />
                <span>Crosspost?</span>
            </label>
            <button
                class="button button--primary"
                :disabled="isEmpty || isSubmitting"
                type="submit"
            >
                Submit
            </button>
        </div>
    </form>
</template>
