<script setup lang="ts">
import { constructApiUrl } from "../scripts/oauth";
import {
  DEFAULT_PREVIEW_DID,
  DEFAULT_PREVIEW_PDS,
  NEW_LOG_LEXICON,
} from "../scripts/consts";
import { extractRkeyFromPlainAtURI, formatDate } from "../scripts/utils";
import { nextTick, onMounted, ref, type Ref } from "vue";
import { logs } from "../scripts/logsStore";

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
    loading.value = true;
    try {
        const posts = await fetchPostsFromPreviewDID(preview_cursor);
        if (posts) {
            logs.value = posts;
        }
    } catch (e) {
        console.error("[APP]", "failed to fetch latest logs:", e);
        error.value = e instanceof Error ? e.message : String(e);
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
                    <span class="md-symbols" aria-hidden="true"
                        >call_split</span
                    >
                    Crossposted
                </div>

                <button
                    :data-variant="clipboardErrorRkey === log.rkey ? 'error' : 'primary'"
                    @click="copyPermalink(log)"
                >
                    <span aria-hidden="true" class="md-symbols"> link_2 </span>
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
