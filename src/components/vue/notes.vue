<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { DEFAULT_PREVIEW_DID, DEFAULT_PREVIEW_PDS, NEW_LOG_LEXICON } from '@/scripts/consts';
import { constructApiUrl, extractRkeyFromPlainAtURI, formatDate } from '@/scripts/atproto/utils';
import LoginDialog from './dialogs/login-dialog.vue';
import ComposeDialog from './dialogs/compose-dialog.vue';
import { setupOAuth } from '@/scripts/atproto/api';
import { isInitialized } from '@/scripts/atproto/agent';
import LogoutDialog from './dialogs/logout-dialog.vue';

interface LogEntry {
    uri: string;
    value: {
        content: string;
        createdAt: string;
        blueskyPost?: { uri: string; cid: string };
    };
}

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

onMounted(async () => {
    void setupOAuth();

    try {
        // Reading public records needs no login: just ask the PDS.
        // ?log=<rkey> shows a single entry (the permalink)
        const rkey = new URLSearchParams(window.location.search).get('log');
        const res = await fetch(
            rkey
                ? constructApiUrl(
                      'com.atproto.repo.getRecord',
                      { repo: DEFAULT_PREVIEW_DID, collection: NEW_LOG_LEXICON, rkey },
                      DEFAULT_PREVIEW_PDS,
                  )
                : constructApiUrl(
                      'com.atproto.repo.listRecords',
                      { repo: DEFAULT_PREVIEW_DID, collection: NEW_LOG_LEXICON, limit: '50' },
                      DEFAULT_PREVIEW_PDS,
                  ),
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        entries.value = rkey ? [data as LogEntry] : (data as { records: LogEntry[] }).records;
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <ComposeDialog />
    <LoginDialog />
    <LogoutDialog />
    <header class="flex items-baseline justify-between gap-2 mb-3">
        <h2 class="text-2xl">Notes</h2>
        <div role="toolbar" class="flex gap-2">
            <template v-if="isInitialized">
                <button
                    commandFor="ui-dialog-compose"
                    command="show-modal"
                    class="flex items-center gap-3 px-3 py-2 hover:bg-nijimi-1 focus-visible:bg-nijimi-1 active:bg-nijimi-2"
                >
                    <span class="font-md-symbols">add</span>
                    New Note
                </button>
                <button
                    commandFor="ui-dialog-logout"
                    command="show-modal"
                    class="flex items-center gap-3 px-3 py-2 hover:bg-nijimi-1 focus-visible:bg-nijimi-1 active:bg-nijimi-2"
                >
                    <span class="font-md-symbols">logout</span>
                    Logout
                </button>
            </template>
            <button
                v-else
                commandFor="ui-dialog-login"
                command="show-modal"
                class="flex items-center gap-3 px-3 py-2 hover:bg-nijimi-1 focus-visible:bg-nijimi-1 active:bg-nijimi-2"
            >
                <span class="font-md-symbols">login</span>
                Login with ATProto
            </button>
        </div>
    </header>
    <p v-if="loading">Loading…</p>
    <p v-else-if="error">Could not load logs: {{ error }}</p>
    <p v-else-if="!entries.length">No logs yet.</p>
    <ul class="flex flex-col gap-2" v-else>
        <li
            class="flex flex-col gap-2 border border-nijimi-1 p-2"
            v-for="entry in entries"
            :key="entry.uri"
        >
            <p class="whitespace-pre-wrap">{{ entry.value.content }}</p>

            <div role="toolbar" class="flex justify-between gap-2">
                <small class="flex gap-2">
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
                        class="text-link hover:text-link-hover"
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
