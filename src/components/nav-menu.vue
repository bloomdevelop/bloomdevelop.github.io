<script setup lang="ts">
import Compose from "./compose.vue";
import OAuthDialog from "./oauth-dialog.vue";
import MigrationDialog from "./migration-dialog.vue";
import { isInitialized, agent, isDidAllowed } from "../scripts/agent";
import { onMounted, ref, watch } from "vue";
import { revokeSession, setupOAuth } from "../scripts/oauth";
import { shouldMigrate } from "../scripts/migration";

const isDev = import.meta.env.DEV;
const avatarUrl = ref("");
const composeDialog = ref<HTMLDialogElement | null>(null);
const oauthDialog = ref<HTMLDialogElement | null>(null);
const logoutDialog = ref<HTMLDialogElement | null>(null);
const aboutDialog = ref<HTMLDialogElement | null>(null);
const migrationDialog = ref<InstanceType<typeof MigrationDialog> | null>(null);
const isHovered = ref(false);

function isLoggedIn() {
    return isInitialized.value;
}

onMounted(async () => {
    await setupOAuth();

    if (!isInitialized.value) return;

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

watch(
    isInitialized,
    async (initialized) => {
        if (!initialized || !agent.value?.did) return;

        try {
            if (await shouldMigrate(agent.value.did)) {
                migrationDialog.value?.open();
            }
        } catch (e) {
            console.error(
                "[MIGRATION]",
                "Could not check migration eligibility:",
                e,
            );
        }
    },
    { immediate: true },
);

function openDialog(dialog: HTMLDialogElement | null) {
    dialog?.showModal();
}

function closeDialog(dialog: HTMLDialogElement | null) {
    dialog?.close();
}
</script>

<template>
    <div
        role="toolbar"
        class="toolbar-hover-zone"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
    >
        <nav class="floating-toolbar" :class="{ 'is-visible': isHovered }">
            <button
                data-component="button"
                class="toolbar-btn"
                @click="openDialog(aboutDialog)"
                aria-label="About"
            >
                <svg
                    aria-hidden="true"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                    />
                </svg>
            </button>

            <button
                data-component="button"
                v-if="isLoggedIn() && isDidAllowed"
                class="toolbar-btn"
                @click="openDialog(composeDialog)"
                aria-label="New Log"
            >
                <svg
                    aria-hidden="true"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
            </button>

            <button
                data-component="button"
                v-if="isLoggedIn()"
                class="toolbar-btn"
                @click="openDialog(logoutDialog)"
                aria-label="Logout"
            >
                <svg
                    aria-hidden="true"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
                    />
                </svg>
            </button>

            <button
                data-component="button"
                v-if="!isLoggedIn()"
                class="toolbar-btn"
                @click="openDialog(oauthDialog)"
                aria-label="Login"
            >
                <svg
                    aria-hidden="true"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"
                    />
                </svg>
            </button>
        </nav>
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
        </header>
        <p>Are you sure you want to logout?</p>
        <div data-type="footer">
            <button data-component="button" data-variant="primary" @click="logout">Logout</button>
            <button data-component="button" data-variant="neutral" @click="closeDialog(logoutDialog)">
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
                data-component="button"
                type="button"
                data-variant="ghost"
                data-size="icon"
                aria-label="Close about dialog"
                @click="closeDialog(aboutDialog)"
            >
                <svg
                    aria-hidden="true"
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
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
                style="border-radius: 50%"
            />
            <img
                v-else
                src="/favicon.svg"
                alt="Website Logo"
                width="64"
                height="64"
                style="border-radius: 50%"
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
    <MigrationDialog ref="migrationDialog" />
</template>

<style scoped>
.toolbar-hover-zone {
    --toolbar-radius: var(--rounded-xl);
    --toolbar-padding: var(--space-md);

    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(400px, 90vw);
    height: 80px;
    z-index: 100;
    pointer-events: auto;
}

.floating-toolbar {
    position: absolute;
    bottom: var(--space-lg);
    left: 50%;
    transform: translateX(-50%) translateY(50px);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--toolbar-padding);
    border-radius: var(--toolbar-radius);
    background: linear-gradient(
        color-mix(in oklch, var(--surface), white 6%) 0%,
        var(--surface) 45%,
        var(--surface) 65%,
        color-mix(in oklch, var(--surface), white 4%) 100%
    );
    box-shadow:
        inset 0 2px 6px
            color-mix(in oklch, var(--surface-contrast), transparent 80%),
        inset 0 0 0 1px
            color-mix(in oklch, var(--surface-contrast), transparent 80%),
        var(--shadow-lg);
    opacity: 0.35;
    transition:
        opacity var(--duration-medium) var(--ease-smooth-out),
        transform var(--duration-medium) var(--ease-smooth-out);
}

.floating-toolbar.is-visible,
.toolbar-hover-zone:focus-within .floating-toolbar {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.toolbar-btn {
    --size: 44px;
    display: grid;
    place-content: center;
    width: var(--size);
    height: var(--size);
    border: none;
    background: transparent;
    border-radius: max(
        0px,
        calc(var(--toolbar-radius) - var(--toolbar-padding))
    );
    cursor: pointer;
    color: var(--surface-contrast);
    font-size: 1.2rem;
}

.toolbar-btn:hover {
    background: var(--surface-1);
    color: var(--surface-1-contrast);
}

.toolbar-btn:active {
    background: linear-gradient(
        color-mix(in oklch, var(--primary), white 25%),
        var(--primary),
        color-mix(in oklch, var(--primary), white 20%)
    );
    color: var(--primary-contrast);
}

@media (hover: none) {
    .toolbar-hover-zone {
        pointer-events: none;
    }

    .floating-toolbar {
        pointer-events: auto;
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        gap: var(--space-md);
    }

    .toolbar-btn {
        --size: 48px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .floating-toolbar {
        transition: none;
    }
}
</style>
