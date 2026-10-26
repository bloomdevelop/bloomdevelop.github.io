<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import AboutDialog from "./about-dialog.vue";
import ComposeDialog from "./compose-dialog.vue";
import LogoutDialog from "./logout-dialog.vue";
import MigrationDialog from "./migration-dialog.vue";
import OAuthDialog from "./oauth-dialog.vue";
import { agent, isDidAllowed, isInitialized } from "../scripts/agent";
import { shouldMigrate } from "../scripts/migration";
import { setupOAuth } from "../scripts/oauth";

const composeDialog = ref<InstanceType<typeof ComposeDialog> | null>(null);
const oauthDialog = ref<InstanceType<typeof OAuthDialog> | null>(null);
const logoutDialog = ref<InstanceType<typeof LogoutDialog> | null>(null);
const aboutDialog = ref<InstanceType<typeof AboutDialog> | null>(null);
const migrationDialog = ref<InstanceType<typeof MigrationDialog> | null>(null);
function isLoggedIn() {
    return isInitialized.value;
}

onMounted(() => setupOAuth());

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

</script>

<template>
    <div role="toolbar" class="fixed top-0 inset-x-0 z-[10000] pt-[env(safe-area-inset-top)]">
        <nav class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-md min-h-[32px] pt-sm pb-md pl-[max(var(--space-xl),env(safe-area-inset-right))] pr-[max(var(--space-xl),env(safe-area-inset-left))] max-[640px]:grid-cols-[auto_minmax(0,1fr)]">
            <a href="/" class="col-start-2 flex items-center justify-self-center max-[640px]:col-start-1 max-[640px]:justify-self-start">
                <picture>
                    <source srcset="/logomark-dark.svg" media="(prefers-color-scheme: dark)" />
                    <img class="my-lg block h-[var(--nav-logo-size)] w-auto" src="/logomark-light.svg" alt="Spring's Website Logo" width="135" height="44" />
                </picture>
            </a>
            <div class="col-start-3 flex items-center justify-end gap-md max-[640px]:col-start-2">
                <a class="toolbar-button" href="/tetris" aria-label="Tetris">
                    <span class="md-symbols" aria-hidden="true">gamepad</span>
                </a>
                <button class="toolbar-button" @click="aboutDialog?.open()" aria-label="About">
                    <span class="md-symbols" aria-hidden="true">info</span>
                </button>

                <button v-if="isLoggedIn() && isDidAllowed" class="toolbar-button"
                    @click="composeDialog?.open()" aria-label="New Log">
                    <span class="md-symbols" aria-hidden="true">add</span>
                </button>

                <button v-if="isLoggedIn()" class="toolbar-button"
                    @click="logoutDialog?.open()" aria-label="Logout">
                    <span class="md-symbols" aria-hidden="true">logout</span>
                </button>

                <button v-if="!isLoggedIn()" class="toolbar-button"
                    @click="oauthDialog?.open()" aria-label="Login">
                    <span class="md-symbols" aria-hidden="true">login</span>
                </button>
            </div>
        </nav>
    </div>

    <ComposeDialog ref="composeDialog" />
    <OAuthDialog ref="oauthDialog" />
    <LogoutDialog ref="logoutDialog" />
    <AboutDialog ref="aboutDialog" />
    <MigrationDialog ref="migrationDialog" />
</template>
