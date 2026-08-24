<script setup lang="ts">
import Compose from "./compose.vue";
import OAuthDialog from "./oauth-dialog.vue";
import MigrationDialog from "./migration-dialog.vue";
import SettingsDialog from "./settings-dialog.vue";
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
const settingsDialog = ref<InstanceType<typeof SettingsDialog> | null>(null);
const isHovered = ref(false);

function isLoggedIn() {
    return isInitialized.value;
}

onMounted(async () => {
    await setupOAuth();

    if (!isInitialized.value || !isDidAllowed.value) return;

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
        if (!initialized || !agent.value?.did || !isDidAllowed.value) return;

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

// Non-modal (show()) so grammar-extension overlays (Grammarly/Harper) stay
// clickable; a modal dialog would leave them inert (whatwg/html#9936).
const isComposeOpen = ref(false);

function openCompose() {
    isComposeOpen.value = true;
    composeDialog.value?.show();
}

function closeCompose() {
    composeDialog.value?.close();
}
</script>

<template>
    <div
        v-if="isInitialized && !isDidAllowed"
        class="unauthorized-banner"
        role="alert"
        data-component="alert"
        data-color="warning"
    >
        <div class="unauthorized-banner-content">
            <span class="md-symbols" aria-hidden="true">warning</span>
            <span>You're logged in with an unauthorized account. You don't have permission to post logs.</span>
        </div>
        <button data-component="button" data-color="neutral" @click="logout">Logout</button>
    </div>
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
                <span class="md-symbols" aria-hidden="true">info</span>
            </button>

            <button
                data-component="button"
                class="toolbar-btn"
                @click="settingsDialog?.open()"
                aria-label="Settings"
            >
                <span class="md-symbols" aria-hidden="true">settings</span>
            </button>

            <button
                data-component="button"
                v-if="isLoggedIn() && isDidAllowed"
                class="toolbar-btn"
                @click="openCompose()"
                aria-label="New Log"
            >
                <span class="md-symbols" aria-hidden="true">add</span>
            </button>

            <button
                data-component="button"
                v-if="isLoggedIn()"
                class="toolbar-btn"
                @click="openDialog(logoutDialog)"
                aria-label="Logout"
            >
                <span class="md-symbols" aria-hidden="true">logout</span>
            </button>

            <button
                data-component="button"
                v-if="!isLoggedIn()"
                class="toolbar-btn"
                @click="openDialog(oauthDialog)"
                aria-label="Login"
            >
                <span class="md-symbols" aria-hidden="true">login</span>
            </button>
        </nav>
    </div>

    <!-- Click-through dimmer; non-modal dialogs get no ::backdrop. -->
    <div v-if="isComposeOpen" class="compose-backdrop" aria-hidden="true"></div>
    <dialog
        ref="composeDialog"
        id="compose"
        data-component="dialog"
        @close="isComposeOpen = false"
        @keydown.escape="closeCompose()"
    >
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
            <button data-component="button" data-color="neutral" @click="closeDialog(logoutDialog)">
                Cancel
            </button>
            <button data-component="button" data-color="error" @click="logout">Logout</button>
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
                margin-block: var(--space-lg);
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
                <h1 style="font-size: 1.375rem; font-weight: 600; letter-spacing: normal; margin: 0">Spring's Website</h1>
                <p style="margin: 0">
                    Fairly minimal website built with Astro and Vue
                </p>
            </div>
        </div>
        <footer>
            <a
                href="https://github.com/bloomdevelop/bloomdevelop.github.io"
                target="_blank"
                data-component="button"
                data-color="neutral"
            >
                View Source
            </a>
        </footer>
    </dialog>
    <MigrationDialog ref="migrationDialog" />
    <SettingsDialog ref="settingsDialog" />
</template>

<style scoped>
.toolbar-hover-zone {
    --toolbar-radius: var(--rounded-xl);
    --toolbar-padding: var(--space-lg);

    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(400px, 90vw);
    height: 80px;
    z-index: 10000;
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

/* Every toolbar button rises from below, staggered one after another so
   the row reveals itself control by control. Uses an animation (not a
   hover transition) so it always plays when a button appears — including
   the moment it's rendered after login while the toolbar is already open,
   which a transition would skip. Driven by transform/opacity only, so it
   never triggers layout shift. The base transition smooths the close. */
.toolbar-btn {
    transform: translateY(var(--distance-medium));
    opacity: 0;
    will-change: transform, opacity;
    transition:
        transform var(--duration-fast) var(--ease-smooth-out),
        opacity var(--duration-fast) var(--ease-smooth-out);
}

/* The reveal is a hover interaction, so only run the rise animation on
   hover-capable devices. On touch (hover: none) the toolbar is always shown
   (see the @media (hover: none) block) and tapping a button must not trigger
   the rise — without this gate, :focus-within fires on tap with higher
   specificity than the touch block's animation: none, animating the buttons. */
@media (hover: hover) {
    .floating-toolbar.is-visible .toolbar-btn,
    .toolbar-hover-zone:focus-within .floating-toolbar .toolbar-btn {
        animation: toolbar-btn-rise var(--duration-fast) var(--ease-smooth-out)
            both;
    }

    /* Stagger each control by one step of --duration-stagger (40ms). */
    .floating-toolbar.is-visible .toolbar-btn:nth-child(1),
    .toolbar-hover-zone:focus-within .floating-toolbar .toolbar-btn:nth-child(1) {
        animation-delay: 0ms;
    }

    .floating-toolbar.is-visible .toolbar-btn:nth-child(2),
    .toolbar-hover-zone:focus-within .floating-toolbar .toolbar-btn:nth-child(2) {
        animation-delay: var(--duration-stagger);
    }

    .floating-toolbar.is-visible .toolbar-btn:nth-child(3),
    .toolbar-hover-zone:focus-within .floating-toolbar .toolbar-btn:nth-child(3) {
        animation-delay: calc(var(--duration-stagger) * 2);
    }

    .floating-toolbar.is-visible .toolbar-btn:nth-child(4),
    .toolbar-hover-zone:focus-within .floating-toolbar .toolbar-btn:nth-child(4) {
        animation-delay: calc(var(--duration-stagger) * 3);
    }
}

@keyframes toolbar-btn-rise {
    from {
        opacity: 0;
        transform: translateY(var(--distance-medium));
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
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
        /* No hover on touch, so never transition the toolbar in/out. */
        transition: none;
    }

    .toolbar-btn {
        --size: 48px;
        /* On touch the toolbar is always shown, so reveal the buttons
           without waiting for a hover-driven is-visible class. */
        opacity: 1;
        transform: none;
        animation: none;
        /* The base rule keeps a transform/opacity transition for the rise;
           drop it on touch so inserting/removing buttons (login/logout) or
           :focus-within never slides or fades the buttons. */
        transition: none;
    }
}

@media (prefers-reduced-motion: reduce) {
    .floating-toolbar,
    .toolbar-btn {
        transition: none;
    }

    .toolbar-btn {
        transform: none;
        opacity: 1;
        animation: none;
    }
}

.unauthorized-banner {
    position: fixed;
    top: var(--space-lg);
    left: 50%;
    transform: translateX(-50%);
    width: min(620px, calc(100% - 2 * var(--space-xl)));
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    flex-wrap: wrap;
    box-shadow: var(--shadow-lg);
}

.unauthorized-banner-content {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.9rem;
}

@media (max-width: 600px) {
    .unauthorized-banner {
        top: var(--space-md);
        width: calc(100% - 2 * var(--space-md));
        flex-direction: column;
        align-items: stretch;
    }

    .unauthorized-banner button {
        align-self: flex-end;
    }
}

/* Above the toolbar, below extension-injected UI — on purpose. */
.compose-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    pointer-events: none;
    background-color: color-mix(in oklch, black, transparent 80%);
}

dialog#compose {
    z-index: 10001;
}

</style>
