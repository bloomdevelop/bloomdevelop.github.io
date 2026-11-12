<script setup lang="ts">
import { useTemplateRef } from 'vue';

interface Props {
    id: string;
    title: string;
}

const { id, title } = defineProps<Props>();

const emit = defineEmits<{ close: [] }>();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');

function open() {
    dialog.value?.showModal();
}

function close() {
    dialog.value?.close();
}

function isOpen() {
    return dialog.value?.open ?? false;
}

defineExpose({ open, close, isOpen });
</script>

<template>
    <dialog
        ref="dialog"
        :id="id"
        :aria-labelledby="`${id}-title`"
        class="m-auto max-w-xl w-full bg-surface-0"
        @close="emit('close')"
    >
        <header class="flex justify-between items-center p-2">
            <h2 :id="`${id}-title`" class="text-xl font-semibold">{{ title }}</h2>

            <button
                :commandFor="id"
                command="close"
                aria-label="Close"
                class="flex items-center justify-center size-8 hover:bg-surface-1 focus-visible:bg-surface-1"
            >
                <span class="font-md-symbols" aria-hidden="true">close</span>
            </button>
        </header>
        <slot />
    </dialog>
</template>
