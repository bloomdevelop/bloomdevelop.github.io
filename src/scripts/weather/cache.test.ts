import { describe, expect, it } from 'vite-plus/test';
import type { WeatherLocation } from './config';
import {
    WEATHER_CACHE_KEY,
    clearWeatherCache,
    readWeatherCache,
    writeWeatherCache,
    type StorageLike,
} from './cache';
import type { WeatherSnapshot } from './types';

class MemoryStorage implements StorageLike {
    readonly items = new Map<string, string>();

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.items.set(key, value);
    }

    removeItem(key: string): void {
        this.items.delete(key);
    }
}

const throwingStorage: StorageLike = {
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('blocked');
    },
    removeItem: () => {
        throw new Error('blocked');
    },
};

const location: WeatherLocation = {
    name: 'Santo Domingo',
    latitude: 18.4861,
    longitude: -69.9312,
    timeZone: 'America/Santo_Domingo',
};

const options = { refreshMinutes: 30, staleMinutes: 360 };
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const snapshot = (fetchedAt: number): WeatherSnapshot => ({
    weatherCode: 2,
    isDay: true,
    cloudCover: 55,
    windKph: 14,
    precipitationMm: 0,
    rainMm: 0,
    showersMm: 0,
    snowfallCm: 0,
    temperatureC: 24,
    fetchedAt,
});

describe('weather cache', () => {
    it('round-trips a fresh sample without touching the clock', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW));

        const cached = readWeatherCache(storage, location, NOW + 10 * 60_000, options);
        expect(cached?.status).toBe('fresh');
        expect(cached?.snapshot.weatherCode).toBe(2);
    });

    it('reports stale samples for stale-while-revalidate', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW));

        expect(readWeatherCache(storage, location, NOW + 31 * 60_000, options)?.status).toBe(
            'stale',
        );
    });

    it('discards samples older than the stale window', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW));

        expect(readWeatherCache(storage, location, NOW + 361 * 60_000, options)).toBeNull();
        expect(storage.items.has(WEATHER_CACHE_KEY)).toBe(false);
    });

    it('treats far-future timestamps as stale rather than fresh', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW + 10 * 60_000));

        expect(readWeatherCache(storage, location, NOW, options)?.status).toBe('stale');
    });

    it('invalidates a cache entry when the configured city changes', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW));

        const moved = { ...location, latitude: 19.4517 };
        expect(readWeatherCache(storage, moved, NOW, options)).toBeNull();
    });

    it('repairs corrupt JSON, versions, and snapshots', () => {
        const corrupt = new MemoryStorage();
        corrupt.setItem(WEATHER_CACHE_KEY, '{not json');
        expect(readWeatherCache(corrupt, location, NOW, options)).toBeNull();
        expect(corrupt.items.has(WEATHER_CACHE_KEY)).toBe(false);

        const wrongVersion = new MemoryStorage();
        wrongVersion.setItem(
            WEATHER_CACHE_KEY,
            JSON.stringify({ v: 2, lat: 18.486, lon: -69.931 }),
        );
        expect(readWeatherCache(wrongVersion, location, NOW, options)).toBeNull();

        const wrongShape = new MemoryStorage();
        wrongShape.setItem(
            WEATHER_CACHE_KEY,
            JSON.stringify({ v: 1, lat: 18.486, lon: -69.931, snapshot: { weatherCode: 500 } }),
        );
        expect(readWeatherCache(wrongShape, location, NOW, options)).toBeNull();
    });

    it('never throws when storage is unavailable', () => {
        expect(readWeatherCache(throwingStorage, location, NOW, options)).toBeNull();
        expect(() => writeWeatherCache(throwingStorage, location, snapshot(NOW))).not.toThrow();
        expect(() => clearWeatherCache(throwingStorage)).not.toThrow();
        expect(readWeatherCache(null, location, NOW, options)).toBeNull();
    });

    it('clears on demand', () => {
        const storage = new MemoryStorage();
        writeWeatherCache(storage, location, snapshot(NOW));
        clearWeatherCache(storage);
        expect(readWeatherCache(storage, location, NOW, options)).toBeNull();
    });
});
