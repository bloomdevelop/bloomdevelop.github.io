<script setup lang="ts">
import { ref } from "vue";
import Compose from "./compose.vue";
import DialogShell from "../dialog-shell.vue";

const dialog = ref<InstanceType<typeof DialogShell> | null>(null);
const isOpen = ref(false);

function open() {
    isOpen.value = true;
    dialog.value?.open();
}

function close() {
    dialog.value?.close();
}

defineExpose({ open, close });
</script>

<template>
    <!-- Non-modal so grammar-extension overlays remain interactive. -->
    <div v-if="isOpen" class="fixed inset-0 z-10000 pointer-events-none bg-[color-mix(in_oklch,black,transparent_80%)]" aria-hidden="true"></div>
    <DialogShell
        ref="dialog"
        id="compose"
        :modal="false"
        class="z-10001 max-w-87.5 w-full"
        @close="isOpen = false"
        @keydown.escape="close()"
    >
        <Compose />
    </DialogShell>
</template>
