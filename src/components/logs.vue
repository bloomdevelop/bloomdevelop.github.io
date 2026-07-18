<script setup lang="ts">
import {
  DEFAULT_PREVIEW_DID,
  DEFAULT_PREVIEW_PDS,
  NEW_LOG_LEXICON,
} from "../scripts/consts";
import {
  constructApiUrl,
  extractRkeyFromPlainAtURI,
  formatDate,
} from "../scripts/utils";
import { nextTick, onMounted, ref, type Ref } from "vue";
import { logs } from "../scripts/logsStore";

const CACHE_KEY = "bloom-logs";

interface CacheEntry {
  data: any[];
  timestamp: number;
}

function getCachedLogs(): any[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

function setCachedLogs(data: any[]) {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* sessionStorage full */
  }
}

const copiedRkey: Ref<string | null> = ref(null);
const activeRkey: Ref<string | null> = ref(null);
const loading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);
const clipboardErrorRkey: Ref<string | null> = ref(null);
const cardRefs: Record<string, HTMLElement | null> = {};
let preview_cursor = "";

async function fetchPostsFromPreviewDID(previous_cursor: string) {
    console.info(
        "[APP]",
        "Fetching posts from preview DID",
        DEFAULT_PREVIEW_DID,
    );
    const res = await fetch(
        constructApiUrl(
            "com.atproto.repo.listRecords",
            {
                repo: DEFAULT_PREVIEW_DID,
                collection: NEW_LOG_LEXICON,
                cursor: previous_cursor,
            },
            DEFAULT_PREVIEW_PDS,
        ),
    );

    if (!res.ok) {
        throw new Error(`Could not load logs: ${res.statusText}`);
    }

    const { cursor, records } = await res.json();
    preview_cursor = cursor;

    return records.map((record: any) => ({
        ...record.value,
        rkey: extractRkeyFromPlainAtURI(record.uri),
    }));
}

async function copyPermalink(log: any) {
    copiedRkey.value = null;
    clipboardErrorRkey.value = null;

    try {
        const permalink = new URL(window.location.href);
        permalink.searchParams.set("rkey", log.rkey);
        await navigator.clipboard.writeText(permalink.toString());
        copiedRkey.value = log.rkey;
        setTimeout(() => {
            if (copiedRkey.value === log.rkey) {
                copiedRkey.value = null;
            }
        }, 2000);
    } catch (e) {
        clipboardErrorRkey.value = log.rkey;
        console.error("[APP]", "failed to copy permalink:", e);
    }
}

onMounted(async () => {
    const cached = getCachedLogs();
    if (cached) {
      logs.value = cached;
    }

    loading.value = !cached;

    try {
        const posts = await fetchPostsFromPreviewDID(preview_cursor);
        if (posts) {
            logs.value = posts;
            setCachedLogs(posts);
        }
    } catch (e) {
        console.error("[APP]", "failed to fetch latest logs:", e);
        if (!cached) {
            error.value = e instanceof Error ? e.message : String(e);
        }
    } finally {
        loading.value = false;
    }

    const rkey = new URL(window.location.href).searchParams.get("rkey");
    if (rkey && logs.value.some((log) => log.rkey === rkey)) {
        activeRkey.value = rkey;
        await nextTick();
        cardRefs[rkey]?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            block: "center",
        });
    }
});
</script>

<template>
    <div class="logs">
        <p role="status" aria-atomic="true" class="visually-hidden">
            {{
                copiedRkey
                    ? "Permalink copied."
                    : clipboardErrorRkey
                      ? "Unable to copy permalink."
                      : ""
            }}
        </p>
        <div v-if="loading" role="status" data-component="alert" data-variant="warning">
            Loading logs…
        </div>
        <div v-else-if="error" role="alert" data-component="alert" data-variant="error">
            {{ error }}
        </div>
        <div v-else-if="logs.length === 0" data-component="alert" data-variant="warning">
            There's no logs… yet. :(
        </div>
        <div
            v-for="log in logs"
            data-component="card"
            :ref="(el) => (cardRefs[log.rkey] = el as HTMLElement)"
            :data-active="log.rkey === activeRkey"
        >
            <div class="card-content">
                <p>{{ log.content }}</p>
            </div>
            <footer>
                <span data-type="date">{{ formatDate(log.createdAt) }}</span>
                <div
                    v-if="log.blueskyPost"
                    data-component="badge"
                    data-variant="secondary"
                >
                    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3z"/></svg>
                    Crossposted
                </div>

                <button
                    :data-variant="clipboardErrorRkey === log.rkey ? 'error' : 'primary'"
                    @click="copyPermalink(log)"
                >
                    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                    <span>
                        {{
                            copiedRkey === log.rkey
                                ? "Copied!"
                                : clipboardErrorRkey === log.rkey
                                  ? "Unable to copy permalink"
                                  : "Permalink"
                        }}
                    </span>
                </button>
            </footer>
        </div>
    </div>
</template>
