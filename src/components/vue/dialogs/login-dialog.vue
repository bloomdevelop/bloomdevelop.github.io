<script setup lang="ts">
import { startLoginFlow } from '@/scripts/atproto/api';
import { ref } from 'vue';

const handle = ref('');
const loading = ref(false);
const error = ref('');

async function attemptLogin() {
    // Don't attempt to login if it's still loading
    if (loading.value) return;
    loading.value = true;
    error.value = '';

    try {
        await startLoginFlow(handle.value);
    } catch (e) {
        console.error('[LOGIN]', 'Failed to log in via OAuth:', e);
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <dialog
        aria-labelledby="ui-dialog-login"
        id="ui-dialog-login"
        class="m-auto max-w-xl w-full bg-surface-0"
    >
        <header class="flex justify-between items-center p-2">
            <h2 class="text-xl font-semibold">Login with ATProto</h2>

            <button
                commandFor="ui-dialog-login"
                command="close"
                class="flex items-center justify-center size-8 hover:bg-surface-1 focus-visible:bg-surface-1"
            >
                <span class="font-md-symbols" aria-label="Close" aria-hidden="true"> close </span>
            </button>
        </header>
        <form @submit.prevent="attemptLogin">
            <div class="p-2">
                <div class="flex flex-col gap-2">
                    <label for="ui-dialog-login-handle">Handle</label>
                    <input
                        v-model="handle"
                        required
                        autofocus="true"
                        id="ui-dialog-login-handle"
                        class="bg-surface-1 px-3 py-2"
                        autocomplete="username"
                        placeholder="whatever.bsky.social"
                        @input="error = ''"
                    />
                </div>
            </div>
            <footer class="flex p-2 justify-between">
                <p v-if="error" role="alert" class="mt-2 text-error">{{ error }}</p>
                <button
                    :disabled="loading"
                    type="submit"
                    class="ml-auto px-4 py-2 bg-accent text-paper hover:bg-shade-accent/10 disabled:bg-accent/50 disabled:cursor-not-allowed"
                >
                    Login
                </button>
            </footer>
        </form>
    </dialog>
</template>
