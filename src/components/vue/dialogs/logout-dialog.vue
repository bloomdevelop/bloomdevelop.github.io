<script setup lang="ts">
import { revokeSession } from '@/scripts/atproto/api';
import { dangerButton } from '@/components/vue/ui/button-classes';
import DialogShell from '@/components/vue/ui/dialog-shell.vue';
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
    <DialogShell id="ui-dialog-logout" title="Are you sure?">
        <div class="p-2">
            <p>Logging out won't let you create notes; you can still view them.</p>
        </div>
        <footer class="flex mt-4 p-2">
            <p class="text-ink-subtle">You can log back in anytime.</p>
            <button
                :disabled="loading"
                type="button"
                @click="confirmLogout"
                :class="['ml-auto', dangerButton]"
            >
                Yes
            </button>
        </footer>
    </DialogShell>
</template>
