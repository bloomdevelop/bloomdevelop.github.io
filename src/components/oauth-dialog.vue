<script setup lang="ts">
import { ref } from "vue";
import { startLoginFlow } from "../scripts/oauth";
const handle = ref("");

async function login() {
    await startLoginFlow(handle.value);
}
</script>

<template>
    <header>
        <h1>Login via OAuth</h1>

        <button
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
            <span
                ><span class="md-symbols" aria-hidden="true"
                    >alternate_email</span
                >
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
            <button data-variant="primary" type="submit">Login</button>
        </footer>
    </form>
</template>

<style scoped>
form {
    display: flex;
    flex-direction: column;

    gap: var(--space-md);

    & span:not(.md-symbols) {
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
</style>
