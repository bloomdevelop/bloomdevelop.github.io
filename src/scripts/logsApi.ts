import {
	DEFAULT_PREVIEW_DID,
	DEFAULT_PREVIEW_PDS,
	NEW_LOG_LEXICON,
} from "./consts";
import type { LogEntry } from "./logsStore";
import { constructApiUrl, extractRkeyFromPlainAtURI } from "./utils";

/**
 * Fetch the latest log entries from the preview DID's PDS.
 *
 * Used both at build time (to embed the initial snapshot in the page) and at
 * runtime (to re-sync the cached page state with the latest records).
 *
 * Results are sorted newest-first here so the rendered order is deterministic
 * and always matches the store's sorting, regardless of what order the PDS
 * happens to return records in.
 */
export async function fetchLogsFromPreviewDID(): Promise<LogEntry[]> {
	const res = await fetch(
		constructApiUrl(
			"com.atproto.repo.listRecords",
			{
				repo: DEFAULT_PREVIEW_DID,
				collection: NEW_LOG_LEXICON,
			},
			DEFAULT_PREVIEW_PDS,
		),
	);

	if (!res.ok) {
		throw new Error(`Could not load logs: ${res.statusText}`);
	}

	const { records } = await res.json();

	return (records as Array<{ uri: string; value: LogEntry }>)
		.map((record) => ({
			...record.value,
			rkey: extractRkeyFromPlainAtURI(record.uri),
		}))
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
}
