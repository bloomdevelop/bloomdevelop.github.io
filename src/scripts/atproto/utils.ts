const segmenters = new Map<string, Intl.Segmenter>();

function getSegmenter(lang: string, options: Intl.SegmenterOptions) {
    const key = `${lang}:${JSON.stringify(options)}`;
    let segmenter = segmenters.get(key);
    if (!segmenter) {
        segmenter = new Intl.Segmenter(lang, options);
        segmenters.set(key, segmenter);
    }
    return segmenter;
}

/** Splits a string into grapheme clusters. */
export function toGraphemeSegments(
    string: string,
    lang: string = 'en',
    options: Intl.SegmenterOptions = { granularity: 'grapheme' },
): string[] {
    return [...getSegmenter(lang, options).segment(string)].map((s) => s.segment);
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

const noteDateFormatters = new Map<string | undefined, Intl.DateTimeFormat>();

function noteDateFormatter(timeZone?: string) {
    let formatter = noteDateFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeStyle: 'short',
            dateStyle: 'medium',
            ...(timeZone ? { timeZone } : {}),
        });
        noteDateFormatters.set(timeZone, formatter);
    }
    return formatter;
}

const postDateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
});

export function formatNoteDate(date: string, timeZone: string = 'UTC') {
    return noteDateFormatter(timeZone).format(new Date(date));
}

/**
 * Publication dates are authored as plain calendar dates, so they are formatted
 * in UTC to keep the build machine's timezone from shifting the day.
 */
export function formatPostDate(date: Date) {
    return postDateFormatter.format(date);
}
