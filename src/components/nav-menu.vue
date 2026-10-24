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
                <a class="button toolbar-btn" href="/tetris" aria-label="Tetris">
                    <span class="md-symbols" aria-hidden="true">gamepad</span>
                </a>
                <button class="button toolbar-btn" @click="aboutDialog?.open()" aria-label="About">
                    <span class="md-symbols" aria-hidden="true">info</span>
                </button>

                <button v-if="isLoggedIn() && isDidAllowed" class="button toolbar-btn"
                    @click="openCompose()" aria-label="New Log">
                    <span class="md-symbols" aria-hidden="true">add</span>
                </button>

                <button v-if="isLoggedIn()" class="button toolbar-btn"
                    @click="logoutDialog?.open()" aria-label="Logout">
                    <span class="md-symbols" aria-hidden="true">logout</span>
                </button>

                <button v-if="!isLoggedIn()" class="button toolbar-btn"
                    @click="oauthDialog?.open()" aria-label="Login">
                    <span class="md-symbols" aria-hidden="true">login</span>
                </button>
            </div>
        </nav>
    </div>

    <!-- Click-through dimmer; non-modal dialogs get no ::backdrop. -->
    <div v-if="isComposeOpen" class="compose-backdrop" aria-hidden="true"></div>
    <dialog ref="composeDialog" id="compose" class="dialog compose-dialog" @close="isComposeOpen = false"
        @keydown.escape="closeCompose()">
        <Compose />
    </dialog>
    <OAuthDialog ref="oauthDialog" />
    <LogoutDialog ref="logoutDialog" />
    <AboutDialog ref="aboutDialog" />
    <MigrationDialog ref="migrationDialog" />
</template>
