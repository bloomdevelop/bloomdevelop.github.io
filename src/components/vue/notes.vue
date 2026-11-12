<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { loadNotes, type LogEntry } from '@/scripts/atproto/notes';
import { extractRkeyFromPlainAtURI, formatDate } from '@/scripts/atproto/utils';
import LoginDialog from './dialogs/login-dialog.vue';
import ComposeDialog from './dialogs/compose-dialog.vue';
import { setupOAuth } from '@/scripts/atproto/api';
import { isInitialized } from '@/scripts/atproto/agent';
import LogoutDialog from './dialogs/logout-dialog.vue';

// rkey is not part of the record value; it is the last segment of the AT URI.
const rkeyOf = (entry: LogEntry) => extractRkeyFromPlainAtURI(entry.uri);

const permalink = (entry: LogEntry) => `?log=${rkeyOf(entry)}`;

// at://did/app.bsky.feed.post/rkey -> https://bsky.app/profile/did/post/rkey
function blueskyUrl(uri: string): string {
    const [did, , rkey] = uri.replace('at://', '').split('/');
    return `https://bsky.app/profile/${did}/post/${rkey}`;
}

const entries = ref<LogEntry[]>([]);
const error = ref('');
const loading = ref(true);

async function loadEntries() {
    error.value = '';

    try {
        // ?log=<rkey> shows a single entry (the permalink)
        const rkey = new URLSearchParams(window.location.search).get('log');
        entries.value = (await loadNotes({ rkey })).entries;
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}

onMounted(async () => {
    void setupOAuth();
    await loadEntries();
});
</script>

<template>
    <ComposeDialog @created="loadEntries" />
    <LoginDialog />
    <LogoutDialog />
    <header class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 class="text-2xl">Notes</h2>
        <div role="toolbar" class="flex flex-wrap justify-end gap-2">
            <template v-if="isInitialized">
                <button
                    commandFor="ui-dialog-compose"
                    command="show-modal"
                    aria-label="New Note"
                    class="flex items-center gap-3 px-3 py-2 hover:bg-surface-1 focus-visible:bg-surface-1 active:bg-nijimi-2"
                >
                    <span class="font-md-symbols" aria-hidden="true">add</span>
                    <span class="hidden sm:inline"> New Note </span>
                </button>
                <button
                    commandFor="ui-dialog-logout"
                    command="show-modal"
                    aria-label="Logout"
                    class="flex items-center gap-3 px-3 py-2 hover:bg-surface-1 focus-visible:bg-surface-1 active:bg-nijimi-2"
                >
                    <span class="font-md-symbols" aria-hidden="true">logout</span>
                    <span class="hidden sm:inline"> Logout </span>
                </button>
            </template>
            <button
                v-else
                commandFor="ui-dialog-login"
                command="show-modal"
                aria-label="Login with ATProto"
                class="flex items-center gap-3 px-3 py-2 hover:bg-surface-1 focus-visible:bg-surface-1 active:bg-nijimi-2"
            >
                <span class="font-md-symbols" aria-hidden="true">login</span>
                <span class="hidden sm:inline"> Login with ATProto </span>
            </button>
        </div>
    </header>
    <p aria-busy="true" v-if="loading">Loading…</p>
    <p aria-live="polite" v-else-if="error">Could not load logs: {{ error }}</p>
    <p aria-live="polite" v-else-if="!entries.length">No logs yet.</p>
    <ul class="flex flex-col gap-2" v-else>
        <li
            class="flex flex-col gap-2 border border-nijimi-1 p-2"
            v-for="entry in entries"
            :key="entry.uri"
        >
            <p class="whitespace-pre-wrap">{{ entry.value.content }}</p>

            <div class="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <small class="flex justify-between gap-2 md:justify-start">
                    <time :datetime="entry.value.createdAt">{{
                        formatDate(entry.value.createdAt)
                    }}</time>
                    <a class="hover:text-link hover:underline" :href="permalink(entry)"
                        >({{ rkeyOf(entry) }})</a
                    >
                </small>

                <small class="flex gap-2">
                    <a
                        v-if="entry.value.blueskyPost"
                        :href="blueskyUrl(entry.value.blueskyPost.uri)"
                        class="text-link hover:text-link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in Bluesky
                    </a>
                </small>
            </div>
        </li>
    </ul>
</template>
