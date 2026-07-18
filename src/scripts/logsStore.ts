type Listener = () => void;

let data: any[] = [];
const listeners: Set<Listener> = new Set();

export function subscribe(fn: Listener) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function notify() {
	listeners.forEach(fn => fn());
}

export function prependLog(entry: {
	rkey: string;
	content: string;
	createdAt: string;
	isCrosspostEnabled?: boolean;
}) {
	data.unshift(entry);
	notify();
}

export function setLogs(entries: any[]) {
	data = entries;
	notify();
}

export function getLogs(): any[] {
	return data;
}
