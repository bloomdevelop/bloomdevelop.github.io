<script setup lang="ts">
import { ref } from "vue";
import Compose from "./compose.vue";

const dialog = ref<HTMLDialogElement | null>(null);
const isOpen = ref(false);

function open() {
    isOpen.value = true;
    dialog.value?.show();
}

function close() {
    dialog.value?.close();
}

defineExpose({ open, close });
</script>

<template>
    <!-- Non-modal so grammar-extension overlays remain interactive. -->
    <div v-if="isOpen" class="fixed inset-0 z-[10000] pointer-events-none bg-[color-mix(in_oklch,black,transparent_80%)]" aria-hidden="true"></div>
    <dialog class="z-[10001] dialog" ref="dialog" id="compose" @close="isOpen = false" @keydown.escape="close()">
        <Compose />
    </dialog>
</template>

