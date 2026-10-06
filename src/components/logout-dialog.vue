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
	<dialog ref="dialog" id="logout-confirmation" data-component="dialog">
		<header>
			<h1>Logout?</h1>
		</header>
		<p>Are you sure you want to logout?</p>
		<div data-type="footer">
			<button data-component="button" data-color="neutral" @click="close">
				Cancel
			</button>
			<button data-component="button" data-color="error" @click="logout">
				Logout
			</button>
		</div>
	</dialog>
</template>
