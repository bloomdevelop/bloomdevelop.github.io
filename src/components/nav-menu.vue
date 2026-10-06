<script setup lang="ts">
import Compose from "./compose.vue";
import OAuthDialog from "./oauth-dialog.vue";
import MigrationDialog from "./migration-dialog.vue";
import LogoutDialog from "./logout-dialog.vue";
import AboutDialog from "./about-dialog.vue";
import { isInitialized, agent, isDidAllowed } from "../scripts/agent";
import { onMounted, ref, watch } from "vue";
import { setupOAuth } from "../scripts/oauth";
import { shouldMigrate } from "../scripts/migration";

const avatarUrl = ref("");
const composeDialog = ref<HTMLDialogElement | null>(null);
const oauthDialog = ref<InstanceType<typeof OAuthDialog> | null>(null);
const logoutDialog = ref<InstanceType<typeof LogoutDialog> | null>(null);
const aboutDialog = ref<InstanceType<typeof AboutDialog> | null>(null);
const migrationDialog = ref<InstanceType<typeof MigrationDialog> | null>(null);
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
    <div role="toolbar" class="toolbar-dock">
        <nav class="full-width-toolbar">
            <a href="/" class="logomark-link">
                <picture>
                    <source srcset="/logomark-dark.svg" media="(prefers-color-scheme: dark)" />
                    <img src="/logomark-light.svg" alt="Spring's Website Logo" width="135" height="44" />
                </picture>
            </a>
            <div>
                <a data-component="button" class="toolbar-btn" href="/tetris" aria-label="Tetris">
                    <span class="md-symbols" aria-hidden="true">gamepad</span>
                </a>
                <button data-component="button" class="toolbar-btn" @click="aboutDialog?.open()" aria-label="About">
                    <span class="md-symbols" aria-hidden="true">info</span>
                </button>

                <button data-component="button" v-if="isLoggedIn() && isDidAllowed" class="toolbar-btn"
                    @click="openCompose()" aria-label="New Log">
                    <span class="md-symbols" aria-hidden="true">add</span>
                </button>

                <button data-component="button" v-if="isLoggedIn()" class="toolbar-btn"
                    @click="logoutDialog?.open()" aria-label="Logout">
                    <span class="md-symbols" aria-hidden="true">logout</span>
                </button>

                <button data-component="button" v-if="!isLoggedIn()" class="toolbar-btn"
                    @click="oauthDialog?.open()" aria-label="Login">
                    <span class="md-symbols" aria-hidden="true">login</span>
                </button>
            </div>
        </nav>
    </div>

    <!-- Click-through dimmer; non-modal dialogs get no ::backdrop. -->
    <div v-if="isComposeOpen" class="compose-backdrop" aria-hidden="true"></div>
    <dialog ref="composeDialog" id="compose" data-component="dialog" @close="isComposeOpen = false"
        @keydown.escape="closeCompose()">
        <Compose />
    </dialog>
    <OAuthDialog ref="oauthDialog" />
    <LogoutDialog ref="logoutDialog" />
    <AboutDialog ref="aboutDialog" />
    <MigrationDialog ref="migrationDialog" />
</template>

<style scoped>
.toolbar-dock {
    position: fixed;
    top: 0;
    inset-inline: 0;
    z-index: 10000;
    padding-top: env(safe-area-inset-top);
}

.full-width-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-md);
    min-height: 32px;
    padding: var(--space-sm) max(var(--space-xl), env(safe-area-inset-left)) var(--space-md) max(var(--space-xl), env(safe-area-inset-right));

    & div {
        grid-column: 3;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-md);
    }
}

.logomark-link {
    grid-column: 2;
    justify-self: center;
    display: flex;
    align-items: center;
}

.logomark-link img {
    display: block;
    height: 44px;
    width: auto;
    margin: var(--space-lg) 0;
}

/* On narrow screens the centered logo would crowd the buttons, so pin it left. */
@media (max-width: 640px) {
    .full-width-toolbar {
        grid-template-columns: auto minmax(0, 1fr);
    }

    .logomark-link {
        grid-column: 1;
        justify-self: start;
    }

    .full-width-toolbar div {
        grid-column: 2;
    }
}

.toolbar-btn {
    --size: 42px;
    display: grid;
    place-content: center;
    width: var(--size);
    height: var(--size);
    border: none;
    background: transparent;
    border-radius: var(--rounded-md);
    cursor: pointer;
    color: var(--surface-contrast);
    font-size: 1.2rem;
    flex: 0 1 64px;
}

.toolbar-btn:hover {
    background: color-mix(in oklch, var(--surface-1), transparent 40%);
    color: var(--surface-1-contrast);
}

.toolbar-btn:active {
    background: var(--surface-primary);
    color: constrast-color(var(--surface-primary));
}

:global(main) {
    padding-top: calc(var(--space-3xl) + 64px + env(safe-area-inset-top));
}

@media (prefers-reduced-motion: reduce) {
    .toolbar-btn {
        transition: none;
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
