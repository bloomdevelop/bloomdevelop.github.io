<script setup lang="ts">
import { isInitialized } from '@/scripts/atproto/session';
import { primaryButton } from '@/components/vue/ui/button-classes';
import DialogShell from '@/components/vue/ui/dialog-shell.vue';
import { ref, useTemplateRef, watch } from 'vue';

const dialog = useTemplateRef<InstanceType<typeof DialogShell>>('dialog');
const handle = ref('');
const loading = ref(false);
const error = ref('');

function open() {
    dialog.value?.open();
}

defineExpose({ open });

// Setup may restore a session while this dialog is open; it is no longer needed.
watch(isInitialized, (initialized) => {
    if (initialized && dialog.value?.isOpen()) dialog.value.close();
});

async function attemptLogin() {
    // Don't attempt to login if it's still loading
    if (loading.value) return;
    loading.value = true;
    error.value = '';

    try {
        const { startLoginFlow } = await import('@/scripts/atproto/api');
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
    <DialogShell ref="dialog" id="ui-dialog-login" title="Login with ATProto">
        <form @submit.prevent="attemptLogin">
            <div class="p-2">
                <div class="flex flex-col gap-2">
                    <label for="ui-dialog-login-handle">Handle or DID</label>
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
                <button :disabled="loading" type="submit" :class="['ml-auto', primaryButton]">
                    Login
                </button>
            </footer>
        </form>
    </DialogShell>
</template>
