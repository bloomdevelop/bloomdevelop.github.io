<script setup lang="ts">
import { ref, computed, type Ref } from "vue";
import "../../../scripts/scrittoFix";
import Scritto from "@scritto/vue";
import { createLog } from "../../../scripts/oauth";
import { prependLog } from "../../../scripts/logsStore";
import { toGraphemeSegments } from "../../../scripts/segments";

const content = ref("");
const count = computed(() => toGraphemeSegments(content.value).length);
const isCrosspostEnabled = ref(false);
const hasInteracted = ref(false);
const isSubmitting = ref(false);
const isEmpty = computed(() => content.value.trim().length === 0);
const errorRef: Ref<Error | null> = ref(null);

async function submit() {
    if (isSubmitting.value || isEmpty.value) return;
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
    <header class="compose-heading">
        <h1>New Log</h1>

        <button
            class="ui-button ui-button--ghost ui-button--icon rounded-concentric"
            type="button"
            commandFor="compose"
            command="close"
            aria-label="Close"
        >
            <span class="md-symbols" aria-hidden="true">close</span>
        </button>
    </header>
    <form @submit.prevent="submit" class="flex flex-col gap-2">
        <textarea
            id="compose-textarea"
            v-model="content"
            class="compose-textarea"
            placeholder="A thought, a tiny win, something you noticed…"
            rows="5"
        ></textarea>
        <Scritto
            :value="
                String(`${count} ${count < 1 ? 'character' : 'characters'}`)
            "
            :transition="{ duration: 250, easing: 'ease-out' }"
            class="text-surface-contrast/75"
        />
        <div
            v-if="isCrosspostEnabled && count > 300"
            aria-live="polite"
            class="alert alert--warning"
        >
            <p>Heads up: crossposts are limited to 300 characters. The extra text will be trimmed when posted.</p>
        </div>
        <div v-if="errorRef" role="alert" class="alert alert--error">
            {{ errorRef.message }}
        </div>

        <footer class="flex flex-row justify-between">
            <label class="flex flex-row items-center gap-2">
                <input
                    type="checkbox"
                    v-model="isCrosspostEnabled"
                    :class="{ 'is-init': hasInteracted }"
                    @change="hasInteracted = true"
                />
                <span class="text-sm text-surface-contrast/75"
                    >Share it to Bluesky</span
                >
            </label>
            <button
                class="ui-button ui-button--colored rounded-concentric inline-flex items-center flex-row justify-start h-min max-w-[7rem]"
                :disabled="isEmpty || isSubmitting"
                :aria-busy="isSubmitting"
                type="submit"
            >
                <span class="md-symbols block-[1cap]" aria-hidden="true"
                    >post_add</span
                >
                <span>{{ isSubmitting ? "Posting…" : "Post" }}</span>
            </button>
        </footer>
    </form>
</template>
