import { Duration, Effect, Schedule } from 'effect';

/** Splits a string into grapheme clusters. */
export function toGraphemeSegments(
    string: string,
    lang: string = 'en',
    options: Intl.SegmenterOptions = { granularity: 'grapheme' },
): string[] {
    return [...new Intl.Segmenter(lang, options).segment(string)].map((s) => s.segment);
}

/**
 * Utility function to construct an XRPC URL
 * @param nsid - XRPC endpoint NSID
 * @param options - Query parameters of said endpoint
 * @param api - Base URL of the AppView or PDS to use, defaults to Bluesky's public API
 */
export function constructApiUrl(
    nsid: string,
    options: Record<string, string>,
    api: string = 'https://api.bsky.app',
): string {
    const url = new URL(`${api}/xrpc/${nsid}`);
    for (const [key, value] of Object.entries(options)) {
        if (!value) continue;
        url.searchParams.set(key, value);
    }

    return url.toString();
}

export function extractRkeyFromPlainAtURI(uri: string) {
    // split() always produces at least one element, so `at(-1)` is never undefined.
    return uri.split('/').at(-1) ?? '';
}

export function formatNoteDate(date: string, timeZone: string = 'UTC') {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short',
        dateStyle: 'medium',
        timeZone,
    });

    return formatter.format(new Date(date));
}

/**
 * Publication dates are authored as plain calendar dates, so they are formatted
 * in UTC to keep the build machine's timezone from shifting the day.
 */
export function formatPostDate(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeZone: 'UTC',
    });

    return formatter.format(date);
}

export interface RetryOptions {
    readonly initialDelay: number;
    readonly maxRetries: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    initialDelay: 200,
    maxRetries: 10,
};

/**
 * Retries a typed Effect failure with exponential backoff and jitter.
 *
 * The Effect itself is re-evaluated on every attempt, so wrap Promise-based
 * work in `Effect.tryPromise` before passing it here.
 */
export const retry = <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Effect.Effect<A, E, R> =>
    Effect.retry(effect, {
        times: options.maxRetries,
        schedule: Schedule.exponential(Duration.millis(options.initialDelay)).pipe(
            Schedule.jittered,
        ),
    });
