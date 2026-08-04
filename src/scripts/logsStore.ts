type Listener = () => void;

const STORAGE_KEY = "bloom.logs.pending";

interface LogEntry {
	rkey: string;
	content: string;
	createdAt: string;
	blueskyPost?: boolean;
}

let data: LogEntry[] = [];
const listeners: Set<Listener> = new Set();

function readPending(): LogEntry[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as LogEntry[]) : [];
	} catch {
		return [];
	}
}

function writePending(entries: LogEntry[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {
		// ignore (private mode / storage quota)
	}
}

export function subscribe(fn: Listener) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function notify() {
	listeners.forEach((fn) => {
		fn();
	});
}

export function prependLog(entry: LogEntry) {
	data.unshift(entry);
	const pending = readPending();
	pending.unshift(entry);
	writePending(pending);
	notify();
}

export function setLogs(entries: LogEntry[]) {
	data = entries;
	notify();
}

export function getLogs(): LogEntry[] {
	return data;
}

/**
 * Merge logs created locally (and persisted client-side) into freshly-fetched
 * server logs. Keeps the newest local logs visible even when the server-side
 * cache hasn't caught up with the latest records yet.
 *
 * Pending entries that the server now knows about are dropped on the next load,
 * so the pending list only ever holds genuinely unsynced logs.
 */
export function mergeWithPending(serverLogs: LogEntry[]): LogEntry[] {
	const serverKeys = new Set(serverLogs.map((log) => log.rkey));
	const pending = readPending().filter((log) => !serverKeys.has(log.rkey));
	writePending(pending);

	if (pending.length === 0) {
		return serverLogs;
	}

	const byRkey = new Map<string, LogEntry>();
	for (const log of serverLogs) byRkey.set(log.rkey, log);
	for (const log of pending) byRkey.set(log.rkey, log);

	return [...byRkey.values()].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}
