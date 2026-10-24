<script setup lang="ts">
import { ref } from "vue";
import { revokeSession } from "../scripts/oauth";

const dialog = ref<HTMLDialogElement | null>(null);

function open() {
	dialog.value?.showModal();
}

function close() {
	dialog.value?.close();
}

function logout() {
	// revokeSession() reloads the page, so no need to close the dialog.
	revokeSession();
}

defineExpose({ open, close });
</script>

<template>
	<dialog ref="dialog" id="logout-confirmation" class="dialog">
		<header>
			<h1>Logout?</h1>
		</header>
		<p>Are you sure you want to logout?</p>
		<div class="actions">
			<button class="button button--neutral" @click="close">Cancel</button>
			<button class="button button--error" @click="logout">Logout</button>
		</div>
	</dialog>
</template>
