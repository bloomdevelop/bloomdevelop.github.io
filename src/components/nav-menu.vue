<script setup lang="ts">
import Compose from "./compose.vue";
import OAuthDialog from "./oauth-dialog.vue";
import { isInitialized, agent, isDidAllowed } from "../scripts/agent";
import { onMounted, ref } from "vue";
import { revokeSession } from "../scripts/oauth";

const isDev = import.meta.env.DEV;
const avatarUrl = ref("");
const composeDialog = ref<HTMLDialogElement | null>(null);
const oauthDialog = ref<HTMLDialogElement | null>(null);
const logoutDialog = ref<HTMLDialogElement | null>(null);
const aboutDialog = ref<HTMLDialogElement | null>(null);

function isLoggedIn() {
    return isInitialized.value;
}

onMounted(async () => {
    const profile = await agent.value?.getProfile({
        actor: agent.value?.did as string,
    });

    console.log(profile?.data);

    if (profile?.data.avatar) {
        avatarUrl.value = profile.data.avatar;
    }
});

function logout() {
    revokeSession();
}

function openDialog(dialog: HTMLDialogElement | null) {
    dialog?.showModal();
}

function closeDialog(dialog: HTMLDialogElement | null) {
    dialog?.close();
}
</script>

<template>
    <button
        data-variant="ghost"
        data-size="icon"
        popovertarget="menu"
        aria-label="Menu"
    >
        <img
            v-if="isLoggedIn() && avatarUrl"
            width="24"
            height="24"
            :src="avatarUrl"
            alt="Your profile image"
        />

        <span aria-label="Profile" class="md-symbols" aria-hidden="true" v-else>
            account_circle
        </span>
    </button>
    <div id="menu" data-component="menu" popover>
        <div>
            <button @click="openDialog(aboutDialog)">
                <span class="md-symbols" aria-hidden="true">info</span> About
            </button>
            <button
                v-if="isLoggedIn() && isDidAllowed"
                @click="openDialog(composeDialog)"
            >
                <span class="md-symbols" aria-hidden="true">add</span> New Log
            </button>

            <button
                v-if="isLoggedIn()"
                @click="openDialog(logoutDialog)"
            >
                <span class="md-symbols" aria-hidden="true">logout</span> Logout
            </button>

            <button
                v-if="!isLoggedIn()"
                @click="openDialog(oauthDialog)"
            >
                <span class="md-symbols" aria-hidden="true">login</span> Login
            </button>
        </div>
    </div>
    <dialog ref="composeDialog" id="compose" data-component="dialog">
        <Compose />
    </dialog>
    <dialog ref="oauthDialog" id="oauth" data-component="dialog">
        <OAuthDialog />
    </dialog>
    <dialog ref="logoutDialog" id="logout-confirmation" data-component="dialog">
        <header>
            <h1>Logout?</h1>

            <!-- <button
                type="button"
                data-variant="ghost"
                data-size="icon"
                commandFor="logout-confirmation"
                command="close"
            >
                <span class="md-symbols" aria-hidden="true">close</span>
            </button> -->
        </header>
        <p>Are you sure you want to logout?</p>
        <div data-type="footer">
            <button
                data-variant="primary"
                @click="logout"
            >
                Logout
            </button>
            <button
                data-variant="neutral"
                @click="closeDialog(logoutDialog)"
            >
                Cancel
            </button>
        </div>
    </dialog>
    <dialog
        ref="aboutDialog"
        aria-labelledby="about-title"
        id="about"
        data-component="dialog"
    >
        <header>
            <h1 id="about-title">About</h1>
            <button
                type="button"
                data-variant="ghost"
                data-size="icon"
                aria-label="Close about dialog"
                @click="closeDialog(aboutDialog)"
            >
                <span class="md-symbols" aria-hidden="true">close</span>
            </button>
        </header>
        <div
            style="
                width: 100%;
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                margin-block: var(--space-md);
            "
        >
            <img
                v-if="isDev"
                src="/favicon-dev.svg"
                alt="Website Logo"
                width="64"
                height="64"
            />
            <img
                v-else
                src="/favicon.svg"
                alt="Website Logo"
                width="64"
                height="64"
            />
            <div
                style="
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    justify-content: center;
                    gap: 0.5rem;
                "
            >
                <h1 style="font-size: 1.5em; margin: 0">Spring's Website</h1>
                <p style="margin: 0">
                    Fairly minimal website built with Astro and Vue
                </p>
            </div>
        </div>
        <div data-type="footer">
            <p>&copy; {{ new Date().getFullYear() }} Bloom Perez</p>
            <a
                href="https://github.com/bloomdevelop/bloomdevelop.github.io"
                target="_blank"
            >
                View Source
            </a>
        </div>
    </dialog>
</template>
