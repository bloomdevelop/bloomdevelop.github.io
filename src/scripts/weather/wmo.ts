/*
 * WMO weather-code mapping and scene parameters.
 *
 * Everything here is pure: no DOM, no fetch, no timers. Given a normalized
 * Open-Meteo sample it returns the shape of the scene the shader draws. The
 * code table follows the WMO 4677 groups Open-Meteo documents for its
 * `weather_code` field.
 */

import { clamp01 } from '../dither-core';
import type { WeatherFamily, WeatherSceneSpec, WeatherSnapshot } from './types';

export interface WeatherCodeInfo {
    family: WeatherFamily;
    /** Precipitation intensity, 0-1. */
    intensity: number;
    /** Extra sun/moon glow for showery codes. */
    glowBoost: number;
    /** False for codes outside the documented groups. */
    known: boolean;
}

interface Geometry {
    cover: number;
    scaleX: number;
    scaleY: number;
    drift: number;
    glowDay: number;
    glowNight: number;
    glowRadiusDay: number;
    glowRadiusNight: number;
    markRadiusDay: number;
    markRadiusNight: number;
    fog: number;
    lightning: boolean;
}

export const WEATHER_FAMILIES: readonly WeatherFamily[] = [
    'clear',
    'mainly-clear',
    'partly-cloudy',
    'overcast',
    'fog',
    'drizzle',
    'rain',
    'heavy-rain',
    'snow',
    'thunderstorm',
];

const FAMILY_GEOMETRY: Record<WeatherFamily, Geometry> = {
    clear: {
        cover: 0.02,
        scaleX: 2.6,
        scaleY: 1.6,
        drift: 0.006,
        glowDay: 0.9,
        glowNight: 0.7,
        glowRadiusDay: 0.15,
        glowRadiusNight: 0.17,
        markRadiusDay: 0.02,
        markRadiusNight: 0.016,
        fog: 0,
        lightning: false,
    },
    'mainly-clear': {
        cover: 0.18,
        scaleX: 2.6,
        scaleY: 1.6,
        drift: 0.0065,
        glowDay: 0.75,
        glowNight: 0.6,
        glowRadiusDay: 0.14,
        glowRadiusNight: 0.16,
        markRadiusDay: 0.019,
        markRadiusNight: 0.015,
        fog: 0,
        lightning: false,
    },
    'partly-cloudy': {
        cover: 0.48,
        scaleX: 2.8,
        scaleY: 1.7,
        drift: 0.007,
        glowDay: 0.55,
        glowNight: 0.42,
        glowRadiusDay: 0.13,
        glowRadiusNight: 0.15,
        markRadiusDay: 0.018,
        markRadiusNight: 0.014,
        fog: 0.02,
        lightning: false,
    },
    overcast: {
        cover: 0.96,
        scaleX: 3.2,
        scaleY: 2,
        drift: 0.008,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.05,
        lightning: false,
    },
    fog: {
        cover: 0.72,
        scaleX: 1.8,
        scaleY: 1.2,
        drift: 0.004,
        glowDay: 0.12,
        glowNight: 0.08,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.011,
        markRadiusNight: 0.009,
        fog: 0.85,
        lightning: false,
    },
    drizzle: {
        cover: 0.84,
        scaleX: 2.7,
        scaleY: 1.8,
        drift: 0.007,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.1,
        lightning: false,
    },
    rain: {
        cover: 0.9,
        scaleX: 3,
        scaleY: 1.9,
        drift: 0.0085,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.07,
        lightning: false,
    },
    'heavy-rain': {
        cover: 1,
        scaleX: 3.2,
        scaleY: 2,
        drift: 0.01,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.14,
        lightning: false,
    },
    snow: {
        cover: 0.9,
        scaleX: 2.4,
        scaleY: 1.6,
        drift: 0.0055,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.25,
        lightning: false,
    },
    thunderstorm: {
        cover: 1,
        scaleX: 3.4,
        scaleY: 2.2,
        drift: 0.011,
        glowDay: 0,
        glowNight: 0,
        glowRadiusDay: 0.11,
        glowRadiusNight: 0.13,
        markRadiusDay: 0.012,
        markRadiusNight: 0.01,
        fog: 0.11,
        lightning: true,
    },
};

interface CodeEntry {
    family: WeatherFamily;
    intensity?: number;
    glowBoost?: number;
}

const CODE_TABLE: Partial<Record<number, CodeEntry>> = {
    0: { family: 'clear' },
    1: { family: 'mainly-clear' },
    2: { family: 'partly-cloudy' },
    3: { family: 'overcast' },
    45: { family: 'fog' },
    48: { family: 'fog' },
    51: { family: 'drizzle', intensity: 0.25 },
    53: { family: 'drizzle', intensity: 0.42 },
    55: { family: 'drizzle', intensity: 0.62 },
    56: { family: 'drizzle', intensity: 0.32 },
    57: { family: 'drizzle', intensity: 0.58 },
    61: { family: 'rain', intensity: 0.45 },
    63: { family: 'rain', intensity: 0.62 },
    65: { family: 'heavy-rain', intensity: 0.88 },
    66: { family: 'rain', intensity: 0.55 },
    67: { family: 'heavy-rain', intensity: 0.92 },
    71: { family: 'snow', intensity: 0.4 },
    73: { family: 'snow', intensity: 0.62 },
    75: { family: 'snow', intensity: 0.88 },
    77: { family: 'snow', intensity: 0.35 },
    80: { family: 'rain', intensity: 0.5, glowBoost: 0.2 },
    81: { family: 'rain', intensity: 0.72, glowBoost: 0.12 },
    82: { family: 'heavy-rain', intensity: 0.95 },
    85: { family: 'snow', intensity: 0.55 },
    86: { family: 'snow', intensity: 0.82 },
    95: { family: 'thunderstorm', intensity: 0.72 },
    96: { family: 'thunderstorm', intensity: 0.86 },
    99: { family: 'thunderstorm', intensity: 1 },
};

/**
 * Maps a WMO code to a family. Unknown or malformed codes fall back to
 * overcast, never to clear: the background must not claim sunshine it cannot
 * verify.
 */
export const mapWmoCode = (code: number): WeatherCodeInfo => {
    if (!Number.isInteger(code)) {
        return { family: 'overcast', intensity: 0, glowBoost: 0, known: false };
    }

    const entry = CODE_TABLE[code];
    if (!entry) {
        return { family: 'overcast', intensity: 0, glowBoost: 0, known: false };
    }

    return {
        family: entry.family,
        intensity: entry.intensity ?? 0,
        glowBoost: entry.glowBoost ?? 0,
        known: true,
    };
};

const isPrecipFamily = (family: WeatherFamily): boolean =>
    family === 'drizzle' ||
    family === 'rain' ||
    family === 'heavy-rain' ||
    family === 'thunderstorm';

/**
 * Combines the code family with the measured sample. Measured cloud cover and
 * wind nudge the scene; an unknown code with measured precipitation still
 * produces rain or snow rather than an overcast lie.
 */
export const buildSceneSpec = (snapshot: WeatherSnapshot): WeatherSceneSpec => {
    const info = mapWmoCode(snapshot.weatherCode);
    let family = info.family;
    let intensity = info.intensity;

    if (!info.known) {
        if (snapshot.snowfallCm > 0) {
            family = 'snow';
            intensity = 0.5;
        } else if (snapshot.precipitationMm > 0) {
            family = 'rain';
            intensity = 0.5;
        }
    }

    const geometry = FAMILY_GEOMETRY[family];
    const measuredCloud = snapshot.cloudCover === null ? geometry.cover : snapshot.cloudCover / 100;
    const cover = clamp01(0.75 * geometry.cover + 0.25 * measuredCloud);
    const windNorm = Math.min(1.5, Math.max(0, (snapshot.windKph ?? 12) / 50));
    const drift = Math.min(0.012, geometry.drift * (0.65 + 0.55 * windNorm));
    const slant = Math.min(0.3, 0.06 + 0.14 * windNorm);

    const precipKind = isPrecipFamily(family) ? 'rain' : family === 'snow' ? 'snow' : 'none';

    let cloudSharpness = 0.3 + (0.1 - 0.3) * cover;
    if (family === 'fog') cloudSharpness = 0.36;
    else if (family === 'snow') cloudSharpness = 0.14;
    else if (family === 'thunderstorm') cloudSharpness = 0.08;

    const glowBase = snapshot.isDay ? geometry.glowDay : geometry.glowNight;

    return {
        family,
        intensity: clamp01(intensity),
        isDay: snapshot.isDay,
        cover,
        cloudScaleX: geometry.scaleX,
        cloudScaleY: geometry.scaleY,
        cloudSharpness,
        drift,
        slant,
        glow: clamp01(glowBase + info.glowBoost),
        glowRadius: snapshot.isDay ? geometry.glowRadiusDay : geometry.glowRadiusNight,
        markRadius: snapshot.isDay ? geometry.markRadiusDay : geometry.markRadiusNight,
        precipKind,
        precip: precipKind === 'none' ? 0 : clamp01(intensity),
        fog: geometry.fog,
        lightning: geometry.lightning,
        stars: !snapshot.isDay && (family === 'clear' || family === 'mainly-clear'),
    };
};

/**
 * Day/night for the offline fallback scene, in the configured city's zone.
 * Falls back to the browser's local time when the zone is invalid.
 */
export const localDaylight = (timeZone: string, now: Date): boolean => {
    let hour = now.getHours();

    try {
        const value = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hourCycle: 'h23',
        })
            .formatToParts(now)
            .find((part) => part.type === 'hour')?.value;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) hour = parsed;
    } catch {
        // Keep the browser's local hour.
    }

    return hour >= 6 && hour < 20;
};

/** Deterministic, deliberately unexciting scene used before/without weather. */
export const fallbackSnapshot = (timeZone: string, now: number): WeatherSnapshot => ({
    weatherCode: 2,
    isDay: localDaylight(timeZone, new Date(now)),
    cloudCover: 48,
    windKph: 12,
    precipitationMm: 0,
    rainMm: 0,
    showersMm: 0,
    snowfallCm: 0,
    temperatureC: null,
    fetchedAt: 0,
});
