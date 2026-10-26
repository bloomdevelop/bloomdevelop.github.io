<script setup lang="ts">
import { ref } from "vue";

const dialog = ref<HTMLDialogElement | null>(null);
const isDev = import.meta.env.DEV;

function open() {
	dialog.value?.showModal();
}

function close() {
	dialog.value?.close();
}

defineExpose({ open, close });
</script>

<template>
	<dialog
		ref="dialog"
		aria-labelledby="about-title"
		id="about"
		class="dialog"
	>
		<header>
			<h1 id="about-title">About</h1>
			<button
				class="ui-button ui-button--ghost ui-button--icon"
				type="button"
				aria-label="Close about dialog"
				@click="close"
			>
				<span class="md-symbols" aria-hidden="true">close</span>
			</button>
		</header>
		<div class="about">
			<img
				:src="isDev ? '/favicon-dev.svg' : '/favicon.svg'"
				alt="Website Logo"
				width="64"
				height="64"
				class="about-logo"
			/>
			<div class="about-text">
				<h1 class="about-name">Spring's Website</h1>
				<p class="about-tagline">
					Fairly minimal website built with Astro and Vue
				</p>
			</div>
		</div>
		<footer>
			<a
				href="https://github.com/bloomdevelop/bloomdevelop.github.io"
				target="_blank"
				class="ui-button ui-button--colored ui-button--neutral"
			>
				View Source
			</a>
		</footer>
	</dialog>
</template>

<style scoped>
.about {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	gap: 1rem;
	margin-block: var(--space-lg);
}

.about-logo {
	border-radius: 50%;
}

.about-text {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: 0.5rem;
}

.about-name {
	margin: 0;
	font-size: 1.375rem;
	font-weight: 600;
	letter-spacing: normal;
}

.about-tagline {
	margin: 0;
}
</style>
