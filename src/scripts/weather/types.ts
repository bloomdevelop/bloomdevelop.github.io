/*
 * Shared types for the weather background. Kept free of DOM and browser APIs
 * so every module that only needs the data model stays unit-testable.
 */

import type { Rgb } from '../dither-core';

export type WeatherFamily =
    | 'clear'
    | 'mainly-clear'
    | 'partly-cloudy'
    | 'overcast'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'heavy-rain'
    | 'snow'
    | 'thunderstorm';

/** Colour tokens the scene recipes can mix into the paper colour. */
export type TokenName =
    | 'kami'
    | 'hyoshi'
    | 'chitsu'
    | 'nijimi0'
    | 'nijimi1'
    | 'nijimi2'
    | 'sumi'
    | 'usuzumi1'
    | 'fuji'
    | 'link'
    | 'sora'
    | 'ruri'
    | 'ai'
    | 'kikyo'
    | 'yamabuki';

export type TokenSet = Record<TokenName, Rgb>;

export type PrecipKind = 'none' | 'rain' | 'snow';

/** Normalized Open-Meteo current-weather sample. */
export interface WeatherSnapshot {
    weatherCode: number;
    isDay: boolean;
    /** Percent, 0-100, or null when the provider omitted it. */
    cloudCover: number | null;
    /** km/h, or null when the provider omitted it. */
    windKph: number | null;
    precipitationMm: number;
    rainMm: number;
    showersMm: number;
    snowfallCm: number;
    temperatureC: number | null;
    /** Epoch milliseconds when the sample was fetched. */
    fetchedAt: number;
}

/** The renderer-facing description of one weather scene. */
export interface WeatherSceneSpec {
    family: WeatherFamily;
    /** Precipitation intensity, 0-1. */
    intensity: number;
    isDay: boolean;
    /** Cloud coverage, 0-1. */
    cover: number;
    cloudScaleX: number;
    cloudScaleY: number;
    cloudSharpness: number;
    /** Screen widths per second. */
    drift: number;
    /** Rain slant, 0-0.30. */
    slant: number;
    /** Sun/moon glow strength, 0-1. */
    glow: number;
    glowRadius: number;
    markRadius: number;
    precipKind: PrecipKind;
    precip: number;
    fog: number;
    lightning: boolean;
    stars: boolean;
}
