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
            <button commandFor="about" command="show-modal">
                <span class="md-symbols" aria-hidden="true">info</span> About
            </button>
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
    <dialog style="max-width: 600px" id="about" data-component="dialog" popover>
        <header>
            <h1>About</h1>
            <button
                type="button"
                data-variant="ghost"
                data-size="icon"
                commandFor="about"
                command="close"
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
            <img src="/favicon.svg" alt="Website Logo" width="96" height="96" />
            <div
                style="
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    justify-content: center;
                    gap: 0.5rem;
                "
            >
                <h1 style="margin: 0">Spring's Website</h1>
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
