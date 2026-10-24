<script setup lang="ts">
import { ref } from "vue";
import Scritto from "@scritto/vue";
import { startLoginFlow } from "../scripts/oauth";
const dialog = ref<HTMLDialogElement | null>(null);
const handle = ref("");
const loading = ref(false);

function open() {
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

async function login() {
  if (loading.value) return;
  loading.value = true;
  try {
    // startLoginFlow either navigates away (redirect to the PDS) or returns
    // early on failure (e.g. an unauthorized DID); in the latter case the
    // finally block re-enables the button and swaps the label back.
    await startLoginFlow(handle.value);
  } finally {
    loading.value = false;
  }
}

defineExpose({ open, close });
</script>

<template>
  <dialog ref="dialog" id="oauth" class="dialog">
    <header>
      <h1>Login via OAuth</h1>

      <button
        class="button button--icon"
        type="button"
        commandFor="oauth"
        command="close"
        aria-label="Close"
      >
        <span class="md-symbols" aria-hidden="true">close</span>
      </button>
    </header>
    <form class="flex flex-col gap-lg" @submit.prevent="login">
      <label class="flex flex-col gap-sm">
        <span class="inline-flex items-center gap-sm">
          <span class="md-symbols" aria-hidden="true">alternate_email</span>
          Handle</span
        >
        <input
          v-model="handle"
          @keyup.enter="login"
          type="text"
          name="handle"
          autocomplete="username"
          placeholder="spring.furrest.net…"
        />
      </label>
      <footer class="flex items-center justify-end">
        <button
          class="button button--primary w-min"
          type="submit"
          :disabled="loading"
          :aria-busy="loading"
        >
          <Scritto
            :value="loading ? 'Logging in…' : 'Login'"
            :transition="{ duration: 150, easing: 'ease-in-out' }"
          />
        </button>
      </footer>
    </form>
  </dialog>
</template>
