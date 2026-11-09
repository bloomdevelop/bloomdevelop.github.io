<script setup lang="ts">
import { startLoginFlow } from '@/scripts/atproto/api';
import { ref } from 'vue';

const handle = ref('');
const loading = ref(false);

async function attemptLogin() {
    // Don't attempt to login if it's still loading
    if (loading.value) return;
    loading.value = true;

    try {
        await startLoginFlow(handle.value);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <dialog id="ui-dialog-login" class="m-auto max-w-xl w-full bg-surface-0">
        <header class="flex justify-between items-center p-2">
            <h1 class="text-xl font-semibold">Login with ATProto</h1>

            <button
                commandFor="ui-dialog-login"
                command="close"
                class="flex items-center justify-center size-8 hover:bg-surface-1 focus-visible:bg-surface-1"
            >
                <span class="font-md-symbols" aria-hidden="true"> close </span>
            </button>
        </header>
        <form @submit.prevent="attemptLogin">
            <div class="p-2">
                <div class="flex flex-col gap-2">
                    <label for="ui-dialog-login-handle">Handle</label>
                    <input
                        v-model="handle"
                        id="ui-dialog-login-handle"
                        class="bg-surface-1 px-3 py-2"
                        autocomplete="username"
                        placeholder="whatever.bsky.social"
                    />
                </div>
            </div>
            <footer class="flex p-2">
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
