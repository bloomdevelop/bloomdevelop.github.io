<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
	applyProgressiveBlur,
	loadSettings,
	saveSettings,
	type SiteSettings,
} from "../scripts/settings";

const dialog = ref<HTMLDialogElement | null>(null);
const settings = ref<SiteSettings>({ progressiveBlur: false });
// Gate the toggle bounce animation so it only plays on user interaction,
// not when the (unchecked) box is first painted.
const isInit = ref(false);

function open() {
	settings.value = loadSettings();
	dialog.value?.showModal();
}

function close() {
	dialog.value?.close();
}

function persist() {
	saveSettings(settings.value);
	applyProgressiveBlur(settings.value.progressiveBlur);
}

onMounted(() => {
	settings.value = loadSettings();
	applyProgressiveBlur(settings.value.progressiveBlur);
	requestAnimationFrame(() => {
		isInit.value = true;
	});
});

defineExpose({ open, close });
</script>

<template>
	<dialog
		ref="dialog"
		aria-labelledby="settings-title"
		data-component="dialog"
	>
		<header>
			<h1 id="settings-title">Settings</h1>
			<button
				data-component="button"
				type="button"
				data-variant="ghost"
				data-size="icon"
				aria-label="Close settings"
				@click="close"
			>
				<span class="md-symbols" aria-hidden="true">close</span>
			</button>
		</header>

		<div class="setting-row">
			<label for="setting-progressive-blur" class="setting-text">
				<span class="setting-title">Progressive blur</span>
				<span class="setting-desc">
					Fades the page edges. May cause grpahical issue on non-Chromium browsers.
				</span>
			</label>
			<input
				type="checkbox"
				id="setting-progressive-blur"
				class="setting-toggle"
				:class="{ 'is-init': isInit }"
				v-model="settings.progressiveBlur"
				@change="persist"
			/>
		</div>
	</dialog>
</template>

<style scoped>
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xl);
		padding-block: var(--space-lg);
	}

	.setting-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		cursor: pointer;
	}

	.setting-title {
		font-weight: 600;
	}

	.setting-desc {
		font-size: 0.85em;
		opacity: 0.7;
		max-width: 22ch;
	}

	.setting-toggle {
		flex-shrink: 0;
	}
</style>
