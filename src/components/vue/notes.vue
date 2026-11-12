<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import { loadNotes, type LogEntry } from '@/scripts/atproto/notes';
import { extractRkeyFromPlainAtURI, formatNoteDate } from '@/scripts/atproto/utils';
import { outlineButton } from '@/components/vue/ui/button-classes';
import LoginDialog from './dialogs/login-dialog.vue';
import ComposeDialog from './dialogs/compose-dialog.vue';
import { hasSessionHint, setupOAuth } from '@/scripts/atproto/api';
import { isInitialized } from '@/scripts/atproto/agent';
import LogoutDialog from './dialogs/logout-dialog.vue';

interface Props {
    /** Notes rendered at build time, so the list is readable before hydration. */
    initialEntries?: LogEntry[];
    initialCursor?: string;
    initialError?: string;
}

const props = defineProps<Props>();

// rkey is not part of the record value; it is the last segment of the AT URI.
const rkeyOf = (entry: LogEntry) => extractRkeyFromPlainAtURI(entry.uri);

const permalink = (entry: LogEntry) => `?log=${rkeyOf(entry)}`;

// at://did/app.bsky.feed.post/rkey -> https://bsky.app/profile/did/post/rkey
function blueskyUrl(uri: string): string {
    const [did, , rkey] = uri.replace('at://', '').split('/');
    return `https://bsky.app/profile/${did}/post/${rkey}`;
}

const entries = ref<LogEntry[]>(props.initialEntries ?? []);
const error = ref(props.initialError ?? '');
const loading = ref(!props.initialEntries?.length && !props.initialError);
const loadingMore = ref(false);
const cursor = ref<string | undefined>(props.initialCursor);
const isHydrated = ref(false);
const loginDialog = useTemplateRef<InstanceType<typeof LoginDialog>>('loginDialog');

// The server has no reliable local timezone; render UTC first and switch once
// the browser knows where the visitor is.
const noteDate = (createdAt: string) =>
    formatNoteDate(createdAt, isHydrated.value ? undefined : 'UTC');

async function loadEntries() {
    error.value = '';

    try {
        // ?log=<rkey> shows a single entry (the permalink)
        const rkey = new URLSearchParams(window.location.search).get('log');
        const result = await loadNotes({ rkey });
        entries.value = result.entries;
        cursor.value = rkey ? undefined : result.cursor;
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}

async function loadMore() {
    if (loadingMore.value || !cursor.value) return;
    loadingMore.value = true;
    error.value = '';

    try {
        const result = await loadNotes({ cursor: cursor.value });
        const seen = new Set(entries.value.map((entry) => entry.uri));
        entries.value = [
            ...entries.value,
            ...result.entries.filter((entry) => !seen.has(entry.uri)),
        ];
        cursor.value = result.cursor;
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loadingMore.value = false;
    }
}

async function openLoginDialog() {
    // Restoring a session needs the OAuth bundle; only pay for it when there is
    // a hint that this visitor has logged in before, or when they ask to log in.
    if (hasSessionHint()) {
        const initialized = await setupOAuth();
        if (!initialized) error.value = 'Could not restore your session. Try logging in again.';
        if (isInitialized.value) return;
    }

    loginDialog.value?.open();
}

onMounted(async () => {
    isHydrated.value = true;

    // Readers never triggered a login do not download the auth bundle.
    if (hasSessionHint()) void setupOAuth();
    await loadEntries();
});
</script>

<template>
    <ComposeDialog @created="loadEntries" />
    <LoginDialog ref="loginDialog" />
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
                type="button"
                aria-label="Login with ATProto"
                class="flex items-center gap-3 px-3 py-2 hover:bg-surface-1 focus-visible:bg-surface-1 active:bg-nijimi-2"
                @click="openLoginDialog"
            >
                <span class="font-md-symbols" aria-hidden="true">login</span>
                <span class="hidden sm:inline"> Login with ATProto </span>
            </button>
        </div>
    </header>
    <p aria-busy="true" v-if="loading">Loading…</p>
    <p aria-live="polite" v-if="error">Could not load logs: {{ error }}</p>
    <p aria-live="polite" v-else-if="!loading && !entries.length">No logs yet.</p>
    <ul class="flex flex-col gap-2" v-else-if="entries.length">
        <li
            class="flex flex-col gap-2 border border-nijimi-1 p-2"
            v-for="entry in entries"
            :key="entry.uri"
        >
            <p class="whitespace-pre-wrap">{{ entry.value.content }}</p>

            <div class="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <small class="flex justify-between gap-2 md:justify-start">
                    <time :datetime="entry.value.createdAt">{{
                        noteDate(entry.value.createdAt)
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
    <div v-if="cursor" class="mt-3 flex justify-center">
        <button type="button" :disabled="loadingMore" :class="outlineButton" @click="loadMore">
            {{ loadingMore ? 'Loading…' : 'Load more notes' }}
        </button>
    </div>
</template>
