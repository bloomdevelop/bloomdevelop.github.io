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
            <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
    </header>
    <form @submit.prevent="login">
        <label>
            <span
                >                <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10h5v-2h-5c-4.34 0-8-3.66-8-8s3.66-8 8-8 8 3.66 8 8v1.43c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57V12c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5c1.38 0 2.64-.56 3.54-1.47.65.89 1.77 1.47 2.96 1.47 1.97 0 3.5-1.6 3.5-3.57V12c0-5.52-4.48-10-10-10zm0 13c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg>
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
</style>
