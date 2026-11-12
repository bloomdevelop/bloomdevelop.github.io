import { Data, Effect, Schema } from 'effect';
import { DEFAULT_PREVIEW_DID, DEFAULT_PREVIEW_PDS, NEW_LOG_LEXICON } from '../consts';
import { retry } from './retry';
import { constructApiUrl } from './utils';

export class NotesError extends Data.TaggedError('NotesError')<{
    readonly message: string;
    readonly cause?: unknown;
}> {}

const BlueskyPost = Schema.Struct({
    uri: Schema.String,
    cid: Schema.String,
});

export const LogEntry = Schema.Struct({
    uri: Schema.String,
    cid: Schema.optional(Schema.String),
    value: Schema.Struct({
        content: Schema.String,
        createdAt: Schema.String,
        blueskyPost: Schema.optional(BlueskyPost),
    }),
});

export type LogEntry = Schema.Schema.Type<typeof LogEntry>;

const ListRecordsResponse = Schema.Struct({
    records: Schema.Array(LogEntry),
    cursor: Schema.optional(Schema.String),
});

const request = (url: string, notFoundMessage: string): Effect.Effect<unknown, NotesError> =>
    Effect.gen(function* () {
        const response = yield* retry(
            Effect.tryPromise({
                try: (signal) =>
                    fetch(url, {
                        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
                    }),
                catch: (cause) =>
                    new NotesError({ message: 'Could not reach the public PDS.', cause }),
            }),
            { initialDelay: 200, maxRetries: 3 },
        );

        if (!response.ok) {
            return yield* new NotesError({
                message:
                    response.status === 400 || response.status === 404
                        ? notFoundMessage
                        : `The public PDS returned HTTP ${response.status}.`,
            });
        }

        return yield* Effect.tryPromise({
            try: () => response.json() as Promise<unknown>,
            catch: (cause) =>
                new NotesError({ message: 'Could not read the PDS response.', cause }),
        });
    });

export interface LoadNotesOptions {
    /** Load a single note by rkey instead of the list. */
    rkey?: string | null;
    /** Cursor returned by a previous list call. */
    cursor?: string;
    limit?: number;
}

export interface LoadNotesResult {
    entries: LogEntry[];
    cursor?: string;
}

function decode<A>(schema: Schema.Codec<A, unknown>, data: unknown): A {
    try {
        return Schema.decodeUnknownSync(schema)(data);
    } catch (cause) {
        throw new NotesError({ message: 'The PDS returned an unexpected response.', cause });
    }
}

/**
 * Read public notes straight from the PDS. Works during SSR and in the browser,
 * so pages can pre-render the list and hydrate it afterwards.
 */
export async function loadNotes(options: LoadNotesOptions = {}): Promise<LoadNotesResult> {
    const { rkey, cursor, limit = 50 } = options;
    const url = rkey
        ? constructApiUrl(
              'com.atproto.repo.getRecord',
              { repo: DEFAULT_PREVIEW_DID, collection: NEW_LOG_LEXICON, rkey },
              DEFAULT_PREVIEW_PDS,
          )
        : constructApiUrl(
              'com.atproto.repo.listRecords',
              {
                  repo: DEFAULT_PREVIEW_DID,
                  collection: NEW_LOG_LEXICON,
                  limit: String(limit),
                  ...(cursor ? { cursor } : {}),
              },
              DEFAULT_PREVIEW_PDS,
          );

    const data = await Effect.runPromise(
        request(url, rkey ? 'This note could not be found.' : 'Could not load notes.'),
    );

    if (rkey) {
        return { entries: [decode(LogEntry, data)] };
    }

    const decoded = decode(ListRecordsResponse, data);
    return {
        entries: decoded.records.toSorted(
            (a, b) => Date.parse(b.value.createdAt) - Date.parse(a.value.createdAt),
        ),
        cursor: decoded.cursor,
    };
}
