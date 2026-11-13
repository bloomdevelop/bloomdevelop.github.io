import { Duration, Effect, Schedule } from 'effect';

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
