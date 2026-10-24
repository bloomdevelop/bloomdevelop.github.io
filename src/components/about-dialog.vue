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
	<dialog ref="dialog" aria-labelledby="about-title" id="about" class="dialog">
		<header>
			<h1 id="about-title">About</h1>
			<button
				class="button button--icon"
				type="button"
				aria-label="Close about dialog"
				@click="close"
			>
				<span class="md-symbols" aria-hidden="true">close</span>
			</button>
		</header>
		<div class="flex items-center justify-center gap-4 my-lg">
			<img
				:src="isDev ? '/favicon-dev.svg' : '/favicon.svg'"
				alt="Website Logo"
				width="64"
				height="64"
				class="rounded-full"
			/>
			<div class="flex flex-col items-start justify-center gap-2">
				<h1 class="m-0 text-[1.375rem] font-semibold tracking-normal">Spring's Website</h1>
				<p class="m-0">Fairly minimal website built with Astro and Vue</p>
			</div>
		</div>
		<footer>
			<a
				href="https://github.com/bloomdevelop/bloomdevelop.github.io"
				target="_blank"
				class="button button--neutral"
			>
				View Source
			</a>
		</footer>
	</dialog>
</template>
