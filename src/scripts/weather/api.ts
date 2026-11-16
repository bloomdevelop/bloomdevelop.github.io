/*
 * Open-Meteo client.
 *
 * Free, keyless, CORS-enabled, and driven only by the configured city — no
 * geolocation, no IP lookup, no identifier. Responses are validated and
 * normalized so the renderer never sees arbitrary JSON.
 */

import type { WeatherLocation } from './config';
import type { WeatherSnapshot } from './types';

const API_URL = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_FIELDS = [
    'temperature_2m',
    'weather_code',
    'is_day',
    'cloud_cover',
    'precipitation',
    'rain',
    'showers',
    'snowfall',
    'wind_speed_10m',
].join(',');

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchWeatherOptions {
    fetchImpl?: FetchLike;
    now?: () => number;
    signal?: AbortSignal;
    timeoutMs?: number;
}

export const buildWeatherUrl = (location: WeatherLocation): URL => {
    const url = new URL(API_URL);
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('current', CURRENT_FIELDS);
    url.searchParams.set('timezone', location.timeZone);
    url.searchParams.set('forecast_days', '1');
    return url;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const numberOrNull = (value: unknown): number | null => (isFiniteNumber(value) ? value : null);

const clampOrNull = (value: number | null, min: number, max: number): number | null =>
    value === null ? null : Math.min(max, Math.max(min, value));

const clampOrZero = (value: number | null, max: number): number =>
    value === null ? 0 : Math.min(max, Math.max(0, value));

/**
 * Validates the `current` block. A missing or malformed required field is a
 * failure, not a silent default, so the caller can keep the previous scene.
 */
export const normalizeWeatherResponse = (
    payload: unknown,
    fetchedAt: number,
): WeatherSnapshot | null => {
    if (!isRecord(payload) || !isRecord(payload.current)) return null;
    const current = payload.current;

    const code = current.weather_code;
    if (!isFiniteNumber(code) || !Number.isInteger(code) || code < 0 || code > 99) return null;

    const dayFlag = current.is_day;
    const isDay =
        dayFlag === true || dayFlag === 1
            ? true
            : dayFlag === false || dayFlag === 0
              ? false
              : null;
    if (isDay === null) return null;

    return {
        weatherCode: code,
        isDay,
        cloudCover: clampOrNull(numberOrNull(current.cloud_cover), 0, 100),
        windKph: clampOrNull(numberOrNull(current.wind_speed_10m), 0, 300),
        precipitationMm: clampOrZero(numberOrNull(current.precipitation), 500),
        rainMm: clampOrZero(numberOrNull(current.rain), 500),
        showersMm: clampOrZero(numberOrNull(current.showers), 500),
        snowfallCm: clampOrZero(numberOrNull(current.snowfall), 500),
        temperatureC: clampOrNull(numberOrNull(current.temperature_2m), -100, 100),
        fetchedAt,
    };
};

export const fetchWeather = async (
    location: WeatherLocation,
    options: FetchWeatherOptions = {},
): Promise<WeatherSnapshot> => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const now = options.now ?? Date.now;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);

    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });

    try {
        const response = await fetchImpl(buildWeatherUrl(location).toString(), {
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`weather request failed with ${response.status}`);
        }

        const snapshot = normalizeWeatherResponse(await response.json(), now());
        if (!snapshot) throw new Error('weather response was malformed');

        return snapshot;
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
    }
};
