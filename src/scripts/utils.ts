/**
 * Utility function to construct an XRPC URL
 * @param nsid - XRPC endpoint NSID
 * @param options - Query parameters of said endpoint
 * @param api - Base URL of the AppView or PDS to use, defaults to Bluesky's public API
 */
export function constructApiUrl(
	nsid: string,
	options: Record<string, string>,
	api: string = "https://api.bsky.app",
): string {
	const url = new URL(`${api}/xrpc/${nsid}`);
	for (const [key, value] of Object.entries(options)) {
		if (!value) continue;
		url.searchParams.set(key, value);
	}

	return url.toString();
}

export function extractRkeyFromPlainAtURI(uri: string) {
	return uri.split("/").at(-1);
}

export function formatDate(date: string) {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeStyle: "long",
		dateStyle: "short",
	});

	return formatter.format(new Date(date));
}

export async function retry<T>(
	fn: () => Promise<T>,
	options: { initialDelay: number; maxRetries: number } = {
		initialDelay: 200,
		maxRetries: 10,
	},
): Promise<T> {
	const { initialDelay, maxRetries } = options;
	let attempt = 0;

	while (attempt <= maxRetries) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === maxRetries) throw error;

			const t = initialDelay * 2 ** (attempt - 1);
			const j = Math.random() * initialDelay;
			const d = t + j;

			await new Promise<void>((r) => setTimeout(() => r(), d));
			attempt++;
		}
	}

	throw new Error("retry: exceeded maximum attempts");
}
