<script setup lang="ts">
import { constructApiUrl } from "../scripts/oauth";
import { DEFAULT_PREVIEW_DID, DEFAULT_PREVIEW_PDS } from "../scripts/consts";
import { extractRkeyFromPlainAtURI, formatDate } from "../scripts/utils";
import { nextTick, onMounted, ref, type Ref } from "vue";
import { logs } from "../scripts/logsStore";

const copiedRkey: Ref<string | null> = ref(null);
const activeRkey: Ref<string | null> = ref(null);
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
                collection: "space.bunniesin.micro.log",
                cursor: previous_cursor,
            },
            DEFAULT_PREVIEW_PDS,
        ),
    );

    if (!res.ok) {
        console.error("[APP]", "failed to fetch latest logs:", res.statusText);

        return;
    }

    const { cursor, records } = await res.json();
    preview_cursor = cursor;

    return records.map((record: any) => ({
        ...record.value,
        rkey: extractRkeyFromPlainAtURI(record.uri),
    }));
}

function copyPermalink(log: any) {
    const permalink = new URL(window.location.href);
    permalink.searchParams.set("rkey", log.rkey);
    navigator.clipboard.writeText(permalink.toString());
    copiedRkey.value = log.rkey;
    setTimeout(() => {
        copiedRkey.value = null;
    }, 2000);
}

onMounted(async () => {
    const posts = await fetchPostsFromPreviewDID(preview_cursor);
    if (posts) {
        logs.value = posts;
    }

    const rkey = new URL(window.location.href).searchParams.get("rkey");
    if (rkey && logs.value.some((log) => log.rkey === rkey)) {
        activeRkey.value = rkey;
        await nextTick();
        cardRefs[rkey]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }
});
</script>

<template>
    <div class="logs">
        <div data-component="error" v-if="logs.length === 0">
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

                <button data-variant="primary" @click="copyPermalink(log)">
                    <span aria-hidden="true" class="md-symbols"> link_2 </span>
                    <span aria-live="polite">
                        {{ copiedRkey === log.rkey ? "Copied!" : "Permalink" }}
                    </span>
                </button>
            </footer>
        </div>
    </div>
</template>

<style scoped>
.logs {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

[data-component="card"][data-active="true"] {
    outline: 2px solid var(--color-accent, currentColor);
    outline-offset: var(--space-sm);
}

[data-component="card"][data-active="true"] {
    scroll-margin: var(--space-lg);
}
</style>
