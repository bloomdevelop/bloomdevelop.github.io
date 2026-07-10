<script setup lang="ts">
import Compose from "./compose.vue";
import OAuthDialog from "./oauth-dialog.vue";
import { isInitialized, agent, isDidAllowed } from "../scripts/agent";
import { onMounted, ref } from "vue";
import { revokeSession } from "../scripts/oauth";

const avatarUrl = ref("");

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
            <button
                v-if="isLoggedIn() && isDidAllowed"
                commandFor="compose"
                command="show-modal"
            >
                <span class="md-symbols" aria-hidden="true">add</span> New Log
            </button>

            <button
                v-if="isLoggedIn()"
                commandFor="logout-confirmation"
                command="show-modal"
            >
                <span class="md-symbols" aria-hidden="true">logout</span> Logout
            </button>

            <button
                v-if="!isLoggedIn()"
                commandFor="oauth"
                command="show-modal"
            >
                <span class="md-symbols" aria-hidden="true">login</span> Login
            </button>
        </div>
    </div>
    <dialog id="compose" data-component="dialog" popover>
        <Compose />
    </dialog>
    <dialog id="oauth" data-component="dialog" popover>
        <OAuthDialog />
    </dialog>
    <dialog id="logout-confirmation" data-component="dialog" popover>
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
                commandFor="logout-confirmation"
                command="close"
                @click="logout"
            >
                Logout
            </button>
            <button
                data-variant="neutral"
                commandFor="logout-confirmation"
                command="close"
            >
                Cancel
            </button>
        </div>
    </dialog>
</template>
