<script setup lang="ts">
import { revokeSession } from '@/scripts/atproto/api';
import { ref } from 'vue';

const loading = ref(false);

async function confirmLogout() {
    if (loading.value) return;
    loading.value = true;

    try {
        await revokeSession();
    } catch (e) {
        console.error('[LOGOUT]', 'Failed to revoke session:', e);
        loading.value = false;
    }
}
</script>

<template>
    <dialog
        aria-labelledby="ui-dialog-logout"
        id="ui-dialog-logout"
        class="m-auto max-w-xl w-full bg-surface-0"
    >
        <header class="flex justify-between items-center p-2">
            <h2 class="text-xl font-semibold">Are you sure?</h2>
            <button
                commandFor="ui-dialog-logout"
                command="close"
                class="flex items-center justify-center size-8 hover:bg-surface-1 focus-visible:bg-surface-1"
            >
                <span class="font-md-symbols" aria-label="Close" aria-hidden="true"> close </span>
            </button>
        </header>
        <div class="p-2">
            <p>Logging out won't let you create notes; you can still view them.</p>
        </div>
        <footer class="flex mt-4 p-2">
            <p class="text-ink-subtle">You can log back in anytime.</p>
            <button
                :disabled="loading"
                type="button"
                @click="confirmLogout"
                class="ml-auto px-4 py-2 bg-error text-paper hover:bg-shade-error/10 disabled:bg-error/50 disabled:cursor-not-allowed"
            >
                Yes
            </button>
        </footer>
    </dialog>
</template>
