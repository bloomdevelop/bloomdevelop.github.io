import { describe, expect, it } from 'vite-plus/test';
import type { WeatherLocation } from './config';
import { buildWeatherUrl, fetchWeather, normalizeWeatherResponse, type FetchLike } from './api';

const location: WeatherLocation = {
    name: 'Santo Domingo',
    latitude: 18.4861,
    longitude: -69.9312,
    timeZone: 'America/Santo_Domingo',
};

const payload = {
    latitude: 18.523726,
    longitude: -69.90204,
    timezone: 'America/Santo_Domingo',
    current: {
        time: '2026-11-15T19:30',
        interval: 900,
        temperature_2m: 24.7,
        weather_code: 53,
        is_day: 0,
        cloud_cover: 56,
        precipitation: 0.2,
        rain: 0.1,
        showers: 0.1,
        snowfall: 0,
        wind_speed_10m: 5.5,
    },
};

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });

const failingFetch: FetchLike = async () => jsonResponse({}, 500);
const brokenJsonFetch: FetchLike = async () => new Response('not json', { status: 200 });
const malformedFetch: FetchLike = async () => jsonResponse({ current: {} });
const hangingFetch: FetchLike = (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
        });
    });

describe('buildWeatherUrl', () => {
    it('targets the configured coordinates and current fields', () => {
        const url = buildWeatherUrl(location);

        expect(url.origin).toBe('https://api.open-meteo.com');
        expect(url.pathname).toBe('/v1/forecast');
        expect(url.searchParams.get('latitude')).toBe('18.4861');
        expect(url.searchParams.get('longitude')).toBe('-69.9312');
        expect(url.searchParams.get('timezone')).toBe('America/Santo_Domingo');
        expect(url.searchParams.get('forecast_days')).toBe('1');

        const fields = url.searchParams.get('current')?.split(',') ?? [];
        expect(fields).toContain('weather_code');
        expect(fields).toContain('is_day');
        expect(fields).toContain('cloud_cover');
    });
});

describe('normalizeWeatherResponse', () => {
    it('normalizes a real sample', () => {
        const snapshot = normalizeWeatherResponse(payload, 1234);

        expect(snapshot).toEqual({
            weatherCode: 53,
            isDay: false,
            cloudCover: 56,
            windKph: 5.5,
            precipitationMm: 0.2,
            rainMm: 0.1,
            showersMm: 0.1,
            snowfallCm: 0,
            temperatureC: 24.7,
            fetchedAt: 1234,
        });
    });

    it('accepts boolean day flags and clamps measured values', () => {
        const snapshot = normalizeWeatherResponse(
            {
                current: {
                    weather_code: 0,
                    is_day: true,
                    cloud_cover: 150,
                    wind_speed_10m: -4,
                    precipitation: -1,
                    snowfall: 999,
                },
            },
            0,
        );

        expect(snapshot?.isDay).toBe(true);
        expect(snapshot?.cloudCover).toBe(100);
        expect(snapshot?.windKph).toBe(0);
        expect(snapshot?.precipitationMm).toBe(0);
        expect(snapshot?.snowfallCm).toBe(500);
        expect(snapshot?.temperatureC).toBeNull();
    });

    it('rejects malformed required fields', () => {
        expect(normalizeWeatherResponse(null, 0)).toBeNull();
        expect(normalizeWeatherResponse({}, 0)).toBeNull();
        expect(normalizeWeatherResponse({ current: { is_day: 1 } }, 0)).toBeNull();
        expect(
            normalizeWeatherResponse({ current: { weather_code: 100, is_day: 1 } }, 0),
        ).toBeNull();
        expect(
            normalizeWeatherResponse({ current: { weather_code: 1.5, is_day: 1 } }, 0),
        ).toBeNull();
        expect(
            normalizeWeatherResponse({ current: { weather_code: 0, is_day: 'yes' } }, 0),
        ).toBeNull();
    });
});

describe('fetchWeather', () => {
    it('fetches and normalizes a sample with the injected clock', async () => {
        let requested = '';
        const fake: FetchLike = async (url) => {
            requested = url;
            return jsonResponse(payload);
        };

        const snapshot = await fetchWeather(location, { fetchImpl: fake, now: () => 99 });

        expect(requested).toContain('latitude=18.4861');
        expect(requested).toContain('longitude=-69.9312');
        expect(snapshot.fetchedAt).toBe(99);
        expect(snapshot.weatherCode).toBe(53);
    });

    it('throws on HTTP and parse failures', async () => {
        await expect(fetchWeather(location, { fetchImpl: failingFetch })).rejects.toThrow();
        await expect(fetchWeather(location, { fetchImpl: brokenJsonFetch })).rejects.toThrow();
        await expect(fetchWeather(location, { fetchImpl: malformedFetch })).rejects.toThrow();
    });

    it('aborts on timeout and on an external signal', async () => {
        await expect(
            fetchWeather(location, { fetchImpl: hangingFetch, timeoutMs: 20 }),
        ).rejects.toThrow();

        const controller = new AbortController();
        const pending = fetchWeather(location, {
            fetchImpl: hangingFetch,
            signal: controller.signal,
            timeoutMs: 1000,
        });
        controller.abort();
        await expect(pending).rejects.toThrow();
    });
});
