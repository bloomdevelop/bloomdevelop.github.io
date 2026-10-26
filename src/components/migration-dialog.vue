<script setup lang="ts">
import { ref } from "vue";
import "../scripts/scrittoFix";
import Scritto from "@scritto/vue";
import { agent } from "../scripts/agent";
import { revokeSession } from "../scripts/oauth";
import { startMigration } from "../scripts/migration";

const dialog = ref<HTMLDialogElement | null>(null);
const isMigrating = ref(false);
const error = ref<string | null>(null);
const progress = ref<{
  processed: number;
  total: number;
  batch: number;
  batchCount: number;
} | null>(null);

function open() {
  progress.value = null;
  error.value = null;
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

async function start() {
  if (!agent.value?.did) return;

  isMigrating.value = true;
  error.value = null;
  progress.value = null;

  try {
    await startMigration((info) => {
      progress.value = info;
    });
    close();
    window.location.reload();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    console.error("[MIGRATION]", "Migration was interrupted by an error:", e);
  } finally {
    isMigrating.value = false;
  }
}

function cancelAndLogout() {
  close();
  revokeSession();
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="migration-title"
    class="dialog"
  >
    <header>
      <h1 id="migration-title">Migration required</h1>
    </header>
    <p>
      We have moved the bunny log lexicons to a new namespace, causing old
      entries to be invalid.
    </p>
    <p>We ask you to migrate your entries to this new lexicon.</p>
    <div
      v-if="error"
      role="alert"
      class="alert alert--error"
    >
      <p>Migration was interrupted by an error:</p>
      <p>{{ error }}</p>
    </div>
    <div
      v-if="isMigrating"
      role="status"
      aria-live="polite"
      class="alert alert--warning"
    >
      <p>
        <Scritto
          :value="progress ? `${progress.processed} / ${progress.total}` : 'preparing…'"
        />
        entries
      </p>
      <p v-if="progress">
        <Scritto :value="`Batch ${progress.batch} of ${progress.batchCount}`" />
      </p>
      <progress
        v-if="progress"
        :value="progress.processed"
        :max="progress.total"
      ></progress>
    </div>
    <div class="footer">
      <button
        class="ui-button ui-button--colored"
        :disabled="isMigrating"
        :aria-busy="isMigrating"
        @click="start"
      >
        <Scritto
          :value="isMigrating ? 'Migrating, please wait…' : 'Ok'"
          :transition="{ duration: 150 }"
        />
      </button>
      <button
        class="ui-button ui-button--colored ui-button--neutral danger"

        :disabled="isMigrating"
        @click="cancelAndLogout"
      >
        Cancel and log out
      </button>
    </div>
  </dialog>
</template>
