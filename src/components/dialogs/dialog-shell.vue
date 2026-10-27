<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
	defineProps<{
		id?: string;
		ariaLabelledby?: string;
		modal?: boolean;
	}>(),
	{ modal: true },
);
const emit = defineEmits<{ close: [] }>();
const element = ref<HTMLDialogElement | null>(null);

function open() {
	if (props.modal) element.value?.showModal();
	else element.value?.show();
}

function close() {
	element.value?.close();
}

defineExpose({ open, close });
</script>

<template>
	<dialog
		ref="element"
		:id="id"
		:aria-labelledby="ariaLabelledby"
		class="dialog rounded-xl border p-[calc(var(--space-lg)+5px)]"
		@close="emit('close')"
	>
		<slot />
	</dialog>
</template>
