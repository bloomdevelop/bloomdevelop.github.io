import { describe, expect, it } from 'vite-plus/test';
import type { WeatherSnapshot } from './types';
import {
    WEATHER_FAMILIES,
    buildSceneSpec,
    fallbackSnapshot,
    localDaylight,
    mapWmoCode,
} from './wmo';

const snapshot = (
    weatherCode: number,
    isDay: boolean,
    extra: Partial<WeatherSnapshot> = {},
): WeatherSnapshot => ({
    weatherCode,
    isDay,
    cloudCover: 50,
    windKph: 12,
    precipitationMm: 0,
    rainMm: 0,
    showersMm: 0,
    snowfallCm: 0,
    temperatureC: 22,
    fetchedAt: 0,
    ...extra,
});

const FAMILY_CODES: Array<[string, number]> = [
    ['clear', 0],
    ['mainly-clear', 1],
    ['partly-cloudy', 2],
    ['overcast', 3],
    ['fog', 45],
    ['drizzle', 51],
    ['rain', 63],
    ['heavy-rain', 65],
    ['snow', 71],
    ['thunderstorm', 95],
];

describe('mapWmoCode', () => {
    it('maps every documented family', () => {
        for (const [family, code] of FAMILY_CODES) {
            expect(mapWmoCode(code).family).toBe(family);
        }
    });

    it('always returns a valid family and intensity for any input', () => {
        for (let code = -5; code <= 110; code++) {
            const info = mapWmoCode(code);
            expect(WEATHER_FAMILIES).toContain(info.family);
            expect(info.intensity).toBeGreaterThanOrEqual(0);
            expect(info.intensity).toBeLessThanOrEqual(1);
        }
    });

    it('treats malformed and undocumented codes as overcast, never clear', () => {
        for (const code of [-1, 4, 42, 98, 100, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            const info = mapWmoCode(code);
            expect(info.family).toBe('overcast');
            expect(info.known).toBe(false);
        }
    });

    it('adds glow to showery codes', () => {
        expect(mapWmoCode(80).glowBoost).toBeGreaterThan(0);
        expect(mapWmoCode(81).glowBoost).toBeGreaterThan(0);
        expect(mapWmoCode(61).glowBoost).toBe(0);
    });
});

describe('buildSceneSpec', () => {
    it('produces in-range geometry for every family, day and night', () => {
        for (const [, code] of FAMILY_CODES) {
            for (const isDay of [true, false]) {
                const spec = buildSceneSpec(snapshot(code, isDay));

                expect(spec.cover).toBeGreaterThanOrEqual(0);
                expect(spec.cover).toBeLessThanOrEqual(1);
                expect(spec.drift).toBeGreaterThanOrEqual(0);
                expect(spec.drift).toBeLessThanOrEqual(0.012);
                expect(spec.slant).toBeGreaterThanOrEqual(0);
                expect(spec.slant).toBeLessThanOrEqual(0.3);
                expect(spec.glow).toBeGreaterThanOrEqual(0);
                expect(spec.glow).toBeLessThanOrEqual(1);
                expect(spec.fog).toBeGreaterThanOrEqual(0);
                expect(spec.fog).toBeLessThanOrEqual(1);
                expect(spec.cloudSharpness).toBeGreaterThan(0);
                expect(spec.markRadius).toBeGreaterThan(0);
                expect(spec.glowRadius).toBeGreaterThan(0);
            }
        }
    });

    it('orders precipitation drizzle < rain < heavy rain', () => {
        const drizzle = buildSceneSpec(snapshot(51, true)).precip;
        const rain = buildSceneSpec(snapshot(63, true)).precip;
        const heavy = buildSceneSpec(snapshot(65, true)).precip;

        expect(drizzle).toBeLessThan(rain);
        expect(rain).toBeLessThan(heavy);
    });

    it('maps snow and thunderstorm to their precipitation modes', () => {
        const snow = buildSceneSpec(snapshot(73, true));
        expect(snow.precipKind).toBe('snow');
        expect(snow.precip).toBeGreaterThan(0);

        const storm = buildSceneSpec(snapshot(95, false));
        expect(storm.precipKind).toBe('rain');
        expect(storm.lightning).toBe(true);
        expect(storm.stars).toBe(false);
    });

    it('shows stars only on clear nights', () => {
        expect(buildSceneSpec(snapshot(0, false)).stars).toBe(true);
        expect(buildSceneSpec(snapshot(1, false)).stars).toBe(true);
        expect(buildSceneSpec(snapshot(0, true)).stars).toBe(false);
        expect(buildSceneSpec(snapshot(2, false)).stars).toBe(false);
    });

    it('blends measured cloud cover and wind into the scene', () => {
        const clear = buildSceneSpec(snapshot(0, true, { cloudCover: 100, windKph: 50 }));
        expect(clear.cover).toBeCloseTo(0.75 * 0.02 + 0.25, 5);
        expect(clear.slant).toBeCloseTo(0.2, 5);

        const unknownCloud = buildSceneSpec(snapshot(2, true, { cloudCover: null }));
        expect(unknownCloud.cover).toBeCloseTo(0.48, 5);
    });

    it('uses measured precipitation for undocumented codes', () => {
        expect(buildSceneSpec(snapshot(42, true, { snowfallCm: 1 })).family).toBe('snow');
        expect(buildSceneSpec(snapshot(42, true, { precipitationMm: 1 })).family).toBe('rain');
        expect(buildSceneSpec(snapshot(42, true)).family).toBe('overcast');
    });
});

describe('localDaylight', () => {
    const zone = 'America/Santo_Domingo';

    it('switches at 06:00 and 20:00 local time', () => {
        expect(localDaylight(zone, new Date('2026-01-15T09:59:00Z'))).toBe(false);
        expect(localDaylight(zone, new Date('2026-01-15T10:00:00Z'))).toBe(true);
        expect(localDaylight(zone, new Date('2026-01-15T23:59:00Z'))).toBe(true);
        expect(localDaylight(zone, new Date('2026-01-16T00:00:00Z'))).toBe(false);
    });

    it('falls back to local time for an invalid zone', () => {
        expect(typeof localDaylight('not/a-zone', new Date('2026-01-15T12:00:00Z'))).toBe(
            'boolean',
        );
    });
});

describe('fallbackSnapshot', () => {
    it('is deterministic, neutral, and never cached', () => {
        const now = new Date('2026-01-15T12:00:00Z').valueOf();
        const fallback = fallbackSnapshot('America/Santo_Domingo', now);

        expect(fallback.weatherCode).toBe(2);
        expect(fallback.fetchedAt).toBe(0);
        expect(fallback.precipitationMm).toBe(0);
        expect(fallback.isDay).toBe(localDaylight('America/Santo_Domingo', new Date(now)));
    });
});
