/*
 * Small, defensive cache for the current-weather sample.
 *
 * The site is an MPA, so every navigation starts the module again. A fresh
 * localStorage entry keeps that from turning into a request per page view;
 * stale entries are drawn immediately while a background refresh runs.
 */

import type { WeatherLocation } from './config';
import type { WeatherSnapshot } from './types';

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface CacheOptions {
    refreshMinutes: number;
    staleMinutes: number;
}

export type CacheStatus = 'fresh' | 'stale';

export interface CachedWeather {
    snapshot: WeatherSnapshot;
    status: CacheStatus;
}

export const WEATHER_CACHE_KEY = 'madoromi.weather.v1';

/** Future timestamps further than this are treated as stale, not fresh. */
const CLOCK_SKEW_MS = 5 * 60_000;

interface CacheEntry {
    v: 1;
    lat: number;
    lon: number;
    snapshot: WeatherSnapshot;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isNullableNumber = (value: unknown): value is number | null =>
    value === null || isFiniteNumber(value);

const isSnapshot = (value: unknown): value is WeatherSnapshot => {
    if (!isRecord(value)) return false;

    return (
        isFiniteNumber(value.weatherCode) &&
        Number.isInteger(value.weatherCode) &&
        value.weatherCode >= 0 &&
        value.weatherCode <= 99 &&
        typeof value.isDay === 'boolean' &&
        isNullableNumber(value.cloudCover) &&
        isNullableNumber(value.windKph) &&
        isNullableNumber(value.temperatureC) &&
        isFiniteNumber(value.precipitationMm) &&
        isFiniteNumber(value.rainMm) &&
        isFiniteNumber(value.showersMm) &&
        isFiniteNumber(value.snowfallCm) &&
        isFiniteNumber(value.fetchedAt)
    );
};

const roundCoordinate = (value: number): number => Math.round(value * 1000) / 1000;

const locationKey = (location: WeatherLocation): [number, number] => [
    roundCoordinate(location.latitude),
    roundCoordinate(location.longitude),
];

const removeQuietly = (storage: StorageLike, key: string): void => {
    try {
        storage.removeItem(key);
    } catch {
        // Private mode and quota errors are not worth failing over.
    }
};

/** Browser storage access itself can throw, so callers get null instead. */
export const getLocalStorage = (): StorageLike | null => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

/**
 * Reads a cached sample. `fresh` means "no network needed"; `stale` means
 * "draw it now and revalidate"; anything expired or malformed is discarded.
 */
export const readWeatherCache = (
    storage: StorageLike | null,
    location: WeatherLocation,
    now: number,
    options: CacheOptions,
): CachedWeather | null => {
    if (!storage) return null;

    let raw: string | null;
    try {
        raw = storage.getItem(WEATHER_CACHE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        removeQuietly(storage, WEATHER_CACHE_KEY);
        return null;
    }

    if (!isRecord(parsed) || parsed.v !== 1 || !isSnapshot(parsed.snapshot)) {
        removeQuietly(storage, WEATHER_CACHE_KEY);
        return null;
    }

    const [lat, lon] = locationKey(location);
    if (parsed.lat !== lat || parsed.lon !== lon) {
        removeQuietly(storage, WEATHER_CACHE_KEY);
        return null;
    }

    const { snapshot } = parsed;
    const age = now - snapshot.fetchedAt;
    const staleMs = options.staleMinutes * 60_000;

    if (age > staleMs) {
        removeQuietly(storage, WEATHER_CACHE_KEY);
        return null;
    }

    if (age < -CLOCK_SKEW_MS) {
        return { snapshot, status: 'stale' };
    }

    const fresh = age <= options.refreshMinutes * 60_000;
    return { snapshot, status: fresh ? 'fresh' : 'stale' };
};

export const writeWeatherCache = (
    storage: StorageLike | null,
    location: WeatherLocation,
    snapshot: WeatherSnapshot,
): void => {
    if (!storage) return;

    const [lat, lon] = locationKey(location);
    const entry: CacheEntry = { v: 1, lat, lon, snapshot };

    try {
        storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(entry));
    } catch {
        // Quota or private-mode failures leave the cache cold; the effect
        // still renders from the fetch result and falls back next time.
    }
};

export const clearWeatherCache = (storage: StorageLike | null): void => {
    if (storage) removeQuietly(storage, WEATHER_CACHE_KEY);
};
