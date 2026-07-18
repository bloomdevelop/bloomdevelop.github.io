<script setup lang="ts">
import { ref, computed, type Ref } from "vue";
import { createLog } from "../scripts/oauth";
import { prependLog } from "../scripts/logsStore";

const content = ref("");

const count = computed(() => content.value.length);
const isCrosspostEnabled = ref(false);
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
            type="button"
            data-variant="ghost"
            data-size="icon"
            commandFor="compose"
            command="close"
            aria-label="Close"
        >
            <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
    </header>
    <form style="margin-top: 5px;" @submit.prevent="submit" class="compose">
        <label for="compose-textarea"> Content </label>
        <textarea
            id="compose-textarea"
            v-model="content"
            class="compose-textarea"
            placeholder="Write anything…"
            rows="4"
        ></textarea>

        <div class="compose-footer">
            <span class="compose-counter">{{ count }} Characters</span>
        </div>
        <div
            v-if="isCrosspostEnabled && content.trim().length > 300"
            aria-live="polite"
            data-component="alert"
            data-variant="warning"
        >
            <p>Looks like your content is over 300 characters…</p>
            <p>It will be truncated when submitted.</p>
        </div>
        <div v-if="errorRef" role="alert" data-component="alert" data-variant="error">
            {{ errorRef.message }}
        </div>

        <div data-type="footer">
            <label>
                <input type="checkbox" v-model="isCrosspostEnabled" />
                <span>Crosspost to Bluesky?</span>
            </label>
            <button
                :disabled="isEmpty || isSubmitting"
                type="submit"
                data-variant="primary"
            >
                Submit
            </button>
        </div>
    </form>
</template>

<style scoped>
.compose {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.compose-textarea {
    --duration: 150ms;

    @media (prefers-reduced-motion: reduce) {
        --duration: 0ms;
    }

    width: 100%;
    resize: vertical;
    transition: border-color var(--duration) ease;
    font-family: var(--body);
    font-size: 1rem;
    border: 2px solid var(--surface-primary-2);
    border-radius: var(--rounded-md);
    background: var(--surface-primary);
    color: var(--surface-contrast);
    padding: var(--space-md);
    box-sizing: border-box;
}

.compose-footer {
    display: flex;
    justify-content: flex-end;
}

.compose-counter {
    font-family: var(--body);
    font-size: 0.75rem;
    color: var(--surface-1-contrast);
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
}

label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--body);
    font-size: 0.875rem;
    color: var(--surface-1-contrast);

    & span {
        user-select: none;
        -moz-user-select: none;
        -webkit-user-select: none;
    }
}
</style>
