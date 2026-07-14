/**
 * Migration logic for the bunny-log lexicon namespace rename.
 *
 * Old lexicon: space.bunniesin.micro.log
 * New lexicon: space.bunniesin.log.entry
 *
 * Ported from bunny-log (feat!: lexicon namespace rename, #10).
 */

import { agent } from "./agent";
import { NEW_LOG_LEXICON, OLD_LOG_LEXICON } from "./consts";
import { extractRkeyFromPlainAtURI, retry } from "./utils";

/** Progress information reported while a migration is running. */
export interface MigrationProgress {
	/** Records migrated so far */
	processed: number;
	/** Total records to migrate */
	total: number;
	/** Current batch index (1-based) */
	batch: number;
	/** Total number of batches */
	batchCount: number;
}

interface BunnyLogEntry {
	content: string;
	createdAt: string;
	blueskyPost?: { uri: string; cid: string };
	$type?: string;
}

interface ListRecordsResponse<T> {
	cursor?: string;
  records: { uri: string; cid: string, value: T }[];
}

/**
 * Split an array into partitions of at most `n` elements.
 * @template T
 * @param {T[]} array
 * @param {number} n - Partition size, must be greater than 1
 * @returns {T[][]}
 */
function partition<T>(array: T[], n: number): T[][] {
	let local_idx = 0;
	let initial = true;

	return Object.values(
		array.reduce(
			(acc, val, idx) => {
				if (idx % n === 0 && !initial) local_idx++;
				if (initial) initial = false; // hack

				if (!acc[local_idx]) acc[local_idx] = [];
				acc[local_idx].push(val);

				return acc;
			},
			{} as Record<number, T[]>,
		),
	);
}

/**
 * Check if target is eligible for the lexicon namespace migration (one-time).
 *
 * Uses the authenticated agent so the request is routed to the user's PDS
 * (the public AppView does not implement com.atproto.repo.describeRepo).
 * @param {string} target - The DID to check
 * @returns {Promise<boolean>}
 */
export async function shouldMigrate(target: string): Promise<boolean> {
	if (!agent.value) return false;

	const res = await agent.value.com.atproto.repo.describeRepo({
		repo: target,
	});

	return res.data.collections.includes(OLD_LOG_LEXICON);
}

/**
 * List every record still living under the old lexicon namespace.
 * @param {string} target - The DID to read records from
 * @returns {Promise<(BunnyLogEntry & { rkey: string })[]>}
 */
export async function queryAllRecordsToBeMigrated(
	target: string,
): Promise<(BunnyLogEntry & { rkey: string })[]> {
	let cursor: string | null = "";
	const records: (BunnyLogEntry & { rkey: string })[] = [];

	async function next(): Promise<ListRecordsResponse<BunnyLogEntry>> {
		const res = await agent.value?.com.atproto.repo.listRecords({
			repo: target,
			collection: OLD_LOG_LEXICON,
			cursor: cursor ?? undefined,
			limit: 100,
		});

		if (!res?.success) {
			return retry(next); // /technically/ recursive, but it isn't
		}

		return {
			cursor: res.data.cursor,
			records: res.data.records as unknown as ListRecordsResponse<BunnyLogEntry>["records"],
		};
	}

	while (cursor != null) {
		const p = await next();
		cursor = p.cursor ?? null;
		records.push(
			...p.records.map((r) => ({
				...r.value,
				rkey: extractRkeyFromPlainAtURI(r.uri) as string,
			})),
		);
	}

	return records;
}

/**
 * Migrate all old-lexicon records to the new namespace & lexicon.
 * @param {string} target - The DID that owns the records
 * @param {number} [batchSize=50] - Records per applyWrites batch
 * @param {(info: MigrationProgress) => void} [onProgress] - Called after each batch
 * @returns {Promise<boolean>}
 */
export async function migrateRecordsToNewLexicon(
	target: string,
	batchSize = 50,
	onProgress?: (info: MigrationProgress) => void,
): Promise<boolean> {
	const records = await queryAllRecordsToBeMigrated(target);

	console.info("[MIGRATION]", "Records to be migrated:", records.length);

	const batches = partition(records, batchSize);
	const batchCount = batches.length;
	let processed = 0;
	let currentBatch = 1;

	// Part 2 --- Migrate them to the new namespace & lexicon using com.atproto.repo.applyWrites
	for (const rx of batches) {
		const creates = rx.map((r) => {
			const { rkey, $type, ...value } = r;
			return {
				$type: "com.atproto.repo.applyWrites#create" as const,
				collection: NEW_LOG_LEXICON,
				rkey,
				value: { ...value, $type: NEW_LOG_LEXICON },
			};
		});

		const deletes = rx.map((r) => ({
			$type: "com.atproto.repo.applyWrites#delete" as const,
			collection: OLD_LOG_LEXICON,
			rkey: r.rkey,
		}));

		let res = await agent.value?.com.atproto.repo.applyWrites({
			repo: agent.value?.did as string,
			writes: creates,
			validate: false, // Most, if not all PDSes do not include our lexicons, so validation is not possible
		});

		if (!res?.success)
			throw new Error(
				`FAILED TO CREATE RECORDS!!!!! FUCK!!!!!\n${JSON.stringify(res)}`,
			);

		console.info("[MIGRATION]", `Created ${creates.length} records.`);

		res = await agent.value?.com.atproto.repo.applyWrites({
			repo: agent.value?.did as string,
			writes: deletes,
			validate: false,
		});

		if (!res?.success)
			throw new Error(
				`FAILED TO DELETE OLD RECORDS!!!!! FUCK!!!!!\n${JSON.stringify(res)}`,
			);

		processed += rx.length;
		onProgress?.({
			processed,
			total: records.length,
			batch: currentBatch,
			batchCount,
		});

		console.info("[MIGRATION]", `Deleted ${deletes.length} old records.`);
		console.info(
			"[MIGRATION]",
			`Batch ${currentBatch} was migrated without issue.`,
		);
		currentBatch++;
	}

	console.info("[MIGRATION]", "All batches were migrated successfully.");

	return true;
}

/**
 * Orchestrate the whole migration flow for the currently logged-in user.
 * @param {(info: MigrationProgress) => void} [onProgress] - Progress reporter
 * @returns {Promise<boolean>}
 */
export async function startMigration(
	onProgress?: (info: MigrationProgress) => void,
): Promise<boolean> {
	if (!agent.value?.did) {
		throw new Error("Cannot migrate without an authenticated session");
	}

	const migrated = await migrateRecordsToNewLexicon(
		agent.value.did,
		50,
		onProgress,
	);
	return migrated;
}
