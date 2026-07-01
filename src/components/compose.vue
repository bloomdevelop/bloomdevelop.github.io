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
            <span aria-hidden="true" class="md-symbols">close</span>
        </button>
    </header>
    <form @submit.prevent="submit" class="compose">
        <textarea
            v-model="content"
            class="compose-textarea"
            placeholder="Write anything…"
            rows="4"
            aria-label="Content"
        ></textarea>
        <div class="compose-footer">
            <span class="compose-counter">{{ count }}</span>
        </div>
        <div
            v-if="isCrosspostEnabled && content.trim().length > 300"
            data-component="alert"
            data-variant="warning"
        >
            <p>Looks like your content is over 300 characters…</p>
            <p>It will be truncated when submitted.</p>
        </div>
        <div v-if="errorRef" data-component="alert" data-variant="error">
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
    outline: none;
    box-sizing: border-box;

    &:focus-visible {
        border-color: var(--primary);
    }
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
}

label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--body);
    font-size: 0.875rem;
    color: var(--surface-1-contrast);
    outline: none;

    & input[type="checkbox"] {
        width: 1rem;
        height: 1rem;

        &:focus-visible {
            outline: 3px dashed color-mix(in oklch, var(--primary), black 35%);
        }
    }

    & span {
        user-select: none;
        -moz-user-select: none;
        -webkit-user-select: none;
    }
}
</style>
