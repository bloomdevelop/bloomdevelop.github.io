<script setup lang="ts">
import { ref } from "vue";
import { revokeSession } from "../../scripts/oauth";
import DialogShell from "./dialog-shell.vue";

const dialog = ref<InstanceType<typeof DialogShell> | null>(null);

function open() {
	dialog.value?.open();
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
	<DialogShell ref="dialog" id="logout-confirmation">
		<header>
			<h1>Logout?</h1>
		</header>
		<p>Are you sure you want to logout?</p>
		<div class="footer">
			<button class="ui-button ui-button--colored ui-button--neutral rounded-concentric" @click="close">
				Cancel
			</button>
			<button class="ui-button ui-button--colored ui-button--error rounded-concentric" @click="logout">
				Logout
			</button>
		</div>
	</DialogShell>
</template>
