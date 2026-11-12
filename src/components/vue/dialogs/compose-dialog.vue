<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { createLog } from '@/scripts/atproto/api';
import { toGraphemeSegments } from '@/scripts/atproto/utils';

// Bluesky posts are limited to 300 graphemes; crossposts reserve 3 for the ellipsis.
const CROSSPOST_LIMIT = 300;
const CROSSPOST_ELLIPSIS = '...';
const CROSSPOST_CONTENT_LIMIT = CROSSPOST_LIMIT - CROSSPOST_ELLIPSIS.length;

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const limitPopover = useTemplateRef<HTMLElement>('limitPopover');

const content = ref('');
const loading = ref(false);
const isCrosspostEnabled = ref(false);
const hasInteracted = ref(false);
const error = ref('');

//  Emit events that only fires once it was created successfully
const emit = defineEmits<{
    created: [created: Awaited<ReturnType<typeof createLog>>];
}>();

// Notes are not limited, but crossposts are counted the same way Bluesky counts them.
const graphemeCount = computed(() => toGraphemeSegments(content.value).length);

const isOverCrosspostLimit = computed(
    () => isCrosspostEnabled.value && graphemeCount.value > CROSSPOST_LIMIT,
);

const counterLabel = computed(() =>
    isCrosspostEnabled.value
        ? `${graphemeCount.value}/${CROSSPOST_LIMIT}`
        : `${graphemeCount.value} character${graphemeCount.value === 1 ? '' : 's'}`,
);

const truncationNotice = computed(() => {
    if (!isOverCrosspostLimit.value) return '';

    const removed = graphemeCount.value - CROSSPOST_CONTENT_LIMIT;
    return `Bluesky posts are limited to ${CROSSPOST_LIMIT} characters. This note will be crossposted as its first ${CROSSPOST_CONTENT_LIMIT} characters plus "${CROSSPOST_ELLIPSIS}", removing ${removed} character${removed === 1 ? '' : 's'}.`;
});

function showLimitTooltip() {
    if (!truncationNotice.value) return;
    limitPopover.value?.showPopover();
}

function hideLimitTooltip() {
    if (limitPopover.value?.matches(':popover-open')) limitPopover.value.hidePopover();
}

function toggleLimitTooltip() {
    if (!truncationNotice.value) return;
    if (limitPopover.value?.matches(':popover-open')) hideLimitTooltip();
    else showLimitTooltip();
}

// Close the tooltip if the note no longer needs truncating (or crossposting was turned off).
watch(truncationNotice, hideLimitTooltip);

async function createNote() {
    if (loading.value) return;
    if (!content.value.trim()) return;

    loading.value = true;
    error.value = '';

    try {
        const created = await createLog(content.value, isCrosspostEnabled.value);
        emit('created', created);

        content.value = '';
        isCrosspostEnabled.value = false;
        hasInteracted.value = false;
        dialog.value?.close();
    } catch (e) {
        console.error('[COMPOSE]', 'Failed to create note:', e);
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <dialog
        ref="dialog"
        id="ui-dialog-compose"
        class="m-auto max-w-xl w-full bg-surface-0"
        aria-labelledby="ui-dialog-compose"
        @close="hideLimitTooltip"
    >
        <header class="flex justify-between items-center p-2">
            <h2 class="text-xl font-semibold">Create Note</h2>

            <button
                commandFor="ui-dialog-compose"
                command="close"
                class="flex items-center justify-center size-8 hover:bg-surface-1 focus-visible:bg-surface-1"
            >
                <span class="font-md-symbols" aria-label="Close" aria-hidden="true"> close </span>
            </button>
        </header>
        <form @submit.prevent="createNote">
            <div class="p-2">
                <div class="flex flex-col gap-2">
                    <label for="ui-dialog-compose-content" class="sr-only">Note</label>
                    <textarea
                        v-model="content"
                        id="ui-dialog-compose-content"
                        class="bg-surface-1 px-3 py-2 w-full resize-none"
                        placeholder="Write anything..."
                    />
                    <small></small>
                </div>
                <p v-if="error" role="alert" class="mt-2 text-error">{{ error }}</p>
            </div>
            <footer class="flex p-2">
                <label class="flex items-center gap-3 select-none">
                    <input
                        class="peer sr-only"
                        type="checkbox"
                        v-model="isCrosspostEnabled"
                        :class="{ 'is-init': hasInteracted }"
                        @change="hasInteracted = true"
                    />
                    <span
                        aria-hidden="true"
                        class="grid size-7 shrink-0 place-content-center rounded-none border-2 border-line bg-surface-1 before:size-5 peer-checked:before:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent"
                    ></span>
                    <span>Crosspost?</span>
                </label>
                <div class="ml-auto flex items-center gap-5">
                    <small class="text-ink-muted">
                        <span
                            class="[anchor-name:--compose-limit]"
                            :class="{ 'text-warning cursor-help': isOverCrosspostLimit }"
                            :tabindex="isOverCrosspostLimit ? 0 : undefined"
                            :aria-describedby="
                                isOverCrosspostLimit ? 'ui-dialog-compose-limit-reason' : undefined
                            "
                            @pointerenter="showLimitTooltip"
                            @pointerleave="hideLimitTooltip"
                            @focus="showLimitTooltip"
                            @blur="hideLimitTooltip"
                            @click="toggleLimitTooltip"
                        >
                            {{ counterLabel }}
                        </span>
                        <span
                            id="ui-dialog-compose-limit-reason"
                            ref="limitPopover"
                            popover="manual"
                            role="tooltip"
                            class="m-0 mb-1 max-w-64 border border-line bg-paper p-2 text-xs text-ink shadow-md [position-anchor:--compose-limit] [position-area:top]"
                        >
                            {{ truncationNotice }}
                        </span>
                    </small>
                    <button
                        :disabled="loading || !content.trim()"
                        type="submit"
                        class="px-4 py-2 bg-accent text-paper hover:bg-shade-accent/10 disabled:bg-accent/50 disabled:cursor-not-allowed"
                    >
                        Create
                    </button>
                </div>
            </footer>
        </form>
    </dialog>
</template>
