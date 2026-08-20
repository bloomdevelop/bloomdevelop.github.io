<script setup lang="ts">
import { ref } from "vue";
import { startLoginFlow } from "../scripts/oauth";
const handle = ref("");
const loading = ref(false);

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
</script>

<template>
  <header>
    <h1>Login via OAuth</h1>

    <button
      data-component="button"
      type="button"
      data-variant="ghost"
      data-size="icon"
      commandFor="oauth"
      command="close"
      aria-label="Close"
    >
      <span class="md-symbols" aria-hidden="true">close</span>
    </button>
  </header>
  <form @submit.prevent="login">
    <label>
      <span>
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
    <footer>
      <button
        data-component="button"
        data-color
        type="submit"
        :disabled="loading"
        :aria-busy="loading"
      >
        <!-- Text states swap (transitions.dev "text states swap"), mirrors the
             Log buttons in logs.astro: the old label exits upward with blur
             while the new label enters from below. -->
        <Transition name="t-swap" mode="out-in">
          <span :key="loading ? 'logging' : 'login'" class="t-text-swap">
            {{ loading ? "Logging in…" : "Login" }}
          </span>
        </Transition>
      </button>
    </footer>
  </form>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);

  & span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
  }

  & label {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  & button {
    width: min-content;
  }

  & footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}

/* Text states swap (transitions.dev "text states swap"). The "Login" label
   exits upward with blur while "Logging in…" enters from below — same visual
   as the Log buttons in logs.astro. nowrap keeps the label on one line so the
   width tween never wraps and changes the button's height. */
.t-text-swap {
  display: inline-block;
  white-space: nowrap;
  will-change: transform, filter, opacity;
}

.t-swap-enter-active,
.t-swap-leave-active {
  transition:
    transform var(--text-swap-dur) var(--text-swap-ease),
    filter var(--text-swap-dur) var(--text-swap-ease),
    opacity var(--text-swap-dur) var(--text-swap-ease);
}

.t-swap-enter-from {
  transform: translateY(var(--text-swap-translate-y));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
  transition: none;
}

.t-swap-leave-to {
  transform: translateY(calc(var(--text-swap-translate-y) * -1));
  filter: blur(var(--text-swap-blur));
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .t-swap-enter-active,
  .t-swap-leave-active {
    transition: none !important;
  }
}
</style>
