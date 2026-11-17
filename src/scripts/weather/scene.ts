/*
 * Weather scene -> dithered palette frame.
 *
 * Pure functions only. The shader draws a continuous ink-wash sky, then snaps
 * every pixel to one of eight palette entries with an 8x8 Bayer threshold.
 * Every entry is contrast-clamped against the roles used for page text, so a
 * rendered cell can never push body copy below the configured WCAG target.
 */

import { clamp01, srgbToLinear, toOklab, type Rgb } from '../dither-core';
import type { TokenName, TokenSet, WeatherFamily, WeatherSceneSpec } from './types';

/* --------------------------------------------------------------------------
 * Colour math
 * -------------------------------------------------------------------------- */

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const mixSrgb = (a: Rgb, b: Rgb, t: number): Rgb => [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
];

export const relativeLuminance = (color: Rgb): number =>
    0.2126 * srgbToLinear(clamp01(color[0])) +
    0.7152 * srgbToLinear(clamp01(color[1])) +
    0.0722 * srgbToLinear(clamp01(color[2]));

export const contrastRatio = (a: Rgb, b: Rgb): number => {
    const first = relativeLuminance(a);
    const second = relativeLuminance(b);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Returns `candidate` if it clears `target` against every text role, otherwise
 * mixes it toward the paper colour in small steps. Mixing toward paper always
 * moves away from both ink extremes, so a passing value is found whenever the
 * paper itself passes. The final fallback is paper.
 */
export const ensureContrast = (
    candidate: Rgb,
    paper: Rgb,
    roles: readonly Rgb[],
    target: number,
): Rgb => {
    if (roles.every((role) => contrastRatio(candidate, role) >= target)) return candidate;

    for (let step = 1; step <= 16; step++) {
        const mixed = mixSrgb(candidate, paper, step / 16);
        if (roles.every((role) => contrastRatio(mixed, role) >= target)) return mixed;
    }

    return paper;
};

/**
 * The brightest continuation of `base` toward white that still clears the
 * target against every role. `ensureContrast` walks toward paper in coarse
 * sixteenths, which can undershoot badly when paper sits far from white
 * (dark themes); this bisects the remaining headroom instead. Luminance is
 * monotone along the mix, so the passing region is a prefix and the search
 * is exact to any practical precision.
 */
export const brightestSafe = (base: Rgb, roles: readonly Rgb[], target: number): Rgb => {
    let lo = 0;
    let hi = 1;

    for (let step = 0; step < 20; step++) {
        const mid = (lo + hi) / 2;
        if (roles.every((role) => contrastRatio(mixSrgb(base, [1, 1, 1], mid), role) >= target)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    return mixSrgb(base, [1, 1, 1], lo);
};

/* --------------------------------------------------------------------------
 * Palette recipes
 * -------------------------------------------------------------------------- */

interface Tint {
    token: TokenName;
    /** Amount of the token mixed into the paper colour, 0-1. */
    amount: number;
}

interface Recipe {
    skyTop: Tint;
    skyMid: Tint;
    skyBottom: Tint;
    cloud: Tint;
    haze: Tint;
    precip: Tint;
    mark: Tint;
}

const T = (token: TokenName, amount: number): Tint => ({ token, amount });
const K = T('kami', 0);

const DAY_RECIPES: Record<WeatherFamily, Recipe> = {
    clear: {
        skyTop: T('sora', 0.17),
        skyMid: T('hyoshi', 0.55),
        skyBottom: K,
        cloud: T('nijimi2', 0.08),
        haze: K,
        precip: K,
        mark: T('yamabuki', 0.3),
    },
    'mainly-clear': {
        skyTop: T('sora', 0.16),
        skyMid: T('hyoshi', 0.45),
        skyBottom: K,
        cloud: T('nijimi0', 0.18),
        haze: K,
        precip: K,
        mark: T('yamabuki', 0.27),
    },
    'partly-cloudy': {
        skyTop: T('sora', 0.14),
        skyMid: T('hyoshi', 0.35),
        skyBottom: K,
        cloud: T('nijimi0', 0.32),
        haze: K,
        precip: K,
        mark: T('yamabuki', 0.26),
    },
    overcast: {
        skyTop: T('nijimi0', 0.5),
        skyMid: T('nijimi0', 0.3),
        skyBottom: T('hyoshi', 0.6),
        cloud: T('nijimi0', 0.5),
        haze: T('nijimi2', 0.18),
        precip: K,
        mark: K,
    },
    fog: {
        skyTop: T('nijimi2', 0.15),
        skyMid: T('nijimi0', 0.25),
        skyBottom: T('hyoshi', 0.4),
        cloud: T('nijimi2', 0.16),
        haze: T('nijimi0', 0.45),
        precip: K,
        mark: T('yamabuki', 0.15),
    },
    drizzle: {
        skyTop: T('sora', 0.14),
        skyMid: T('nijimi0', 0.28),
        skyBottom: T('hyoshi', 0.45),
        cloud: T('nijimi0', 0.4),
        haze: T('nijimi2', 0.14),
        precip: T('sora', 0.18),
        mark: K,
    },
    rain: {
        skyTop: T('sora', 0.17),
        skyMid: T('nijimi0', 0.38),
        skyBottom: T('hyoshi', 0.5),
        cloud: T('nijimi0', 0.48),
        haze: T('nijimi2', 0.16),
        precip: T('ruri', 0.2),
        mark: K,
    },
    'heavy-rain': {
        skyTop: T('nijimi2', 0.25),
        skyMid: T('nijimi0', 0.42),
        skyBottom: T('hyoshi', 0.5),
        cloud: T('nijimi0', 0.5),
        haze: T('nijimi2', 0.18),
        precip: T('ruri', 0.22),
        mark: K,
    },
    snow: {
        skyTop: T('sora', 0.12),
        skyMid: T('nijimi0', 0.32),
        skyBottom: T('hyoshi', 0.45),
        cloud: T('nijimi0', 0.38),
        haze: T('nijimi2', 0.14),
        precip: T('usuzumi1', 0.28),
        mark: K,
    },
    thunderstorm: {
        skyTop: T('nijimi2', 0.3),
        skyMid: T('nijimi0', 0.38),
        skyBottom: T('hyoshi', 0.5),
        cloud: T('nijimi0', 0.5),
        haze: T('nijimi2', 0.16),
        precip: T('ruri', 0.22),
        // Unused: buildFrame overrides the mark for thunderstorms with
        // flash white (see below).
        mark: K,
    },
};

const NIGHT_RECIPES: Record<WeatherFamily, Recipe> = {
    clear: {
        skyTop: T('ai', 0.36),
        skyMid: T('fuji', 0.22),
        skyBottom: T('nijimi0', 0.12),
        cloud: T('nijimi1', 0.55),
        haze: K,
        precip: K,
        mark: T('usuzumi1', 0.33),
    },
    'mainly-clear': {
        skyTop: T('ai', 0.32),
        skyMid: T('fuji', 0.18),
        skyBottom: T('nijimi0', 0.1),
        cloud: T('nijimi1', 0.5),
        haze: K,
        precip: K,
        mark: T('usuzumi1', 0.31),
    },
    'partly-cloudy': {
        skyTop: T('ai', 0.34),
        skyMid: T('fuji', 0.14),
        skyBottom: T('nijimi0', 0.08),
        cloud: T('nijimi1', 0.55),
        haze: K,
        precip: K,
        mark: T('usuzumi1', 0.3),
    },
    overcast: {
        skyTop: T('nijimi1', 0.9),
        skyMid: T('nijimi0', 0.9),
        skyBottom: T('hyoshi', 0.5),
        cloud: T('nijimi2', 0.7),
        haze: T('nijimi0', 0.35),
        precip: K,
        mark: K,
    },
    fog: {
        skyTop: T('nijimi0', 0.9),
        skyMid: T('nijimi0', 0.6),
        skyBottom: T('hyoshi', 0.35),
        cloud: T('nijimi1', 0.6),
        haze: T('nijimi1', 0.7),
        precip: K,
        mark: K,
    },
    drizzle: {
        skyTop: T('ai', 0.3),
        skyMid: T('nijimi0', 0.75),
        skyBottom: T('hyoshi', 0.45),
        cloud: T('nijimi1', 0.7),
        haze: T('nijimi0', 0.28),
        precip: T('sora', 0.28),
        mark: K,
    },
    rain: {
        skyTop: T('ai', 0.34),
        skyMid: T('nijimi1', 0.75),
        skyBottom: T('hyoshi', 0.5),
        cloud: T('nijimi2', 0.62),
        haze: T('nijimi0', 0.35),
        precip: T('ruri', 0.3),
        mark: K,
    },
    'heavy-rain': {
        skyTop: T('nijimi1', 0.9),
        skyMid: T('nijimi2', 0.55),
        skyBottom: T('nijimi0', 0.45),
        cloud: T('nijimi2', 0.76),
        haze: T('nijimi1', 0.55),
        precip: T('ruri', 0.32),
        mark: K,
    },
    snow: {
        skyTop: T('ai', 0.24),
        skyMid: T('nijimi0', 0.65),
        skyBottom: T('hyoshi', 0.45),
        cloud: T('nijimi1', 0.65),
        haze: T('nijimi0', 0.35),
        precip: T('usuzumi1', 0.31),
        mark: K,
    },
    thunderstorm: {
        skyTop: T('nijimi1', 0.9),
        skyMid: T('nijimi2', 0.55),
        skyBottom: T('nijimi0', 0.35),
        cloud: T('nijimi2', 0.78),
        haze: T('nijimi1', 0.5),
        precip: T('ruri', 0.3),
        // Unused: buildFrame overrides the mark for thunderstorms with
        // flash white (see below).
        mark: K,
    },
};

/* --------------------------------------------------------------------------
 * Frame building
 * -------------------------------------------------------------------------- */

export interface FrameSettings {
    washDay: number;
    washNight: number;
    corridorDay: number;
    corridorNight: number;
    topWash: number;
    spreadDay: number;
    spreadNight: number;
    clampTarget: number;
}

export interface WeatherFrame {
    slots: Rgb[];
    slotsLab: Rgb[];
    /** Flat RGB triples for `uniform3fv`, allocated once per frame. */
    paletteFlat: Float32Array;
    paletteLabFlat: Float32Array;
    paper: Rgb;
    skyTop: Rgb;
    skyMid: Rgb;
    skyBottom: Rgb;
    cloudColor: Rgb;
    hazeColor: Rgb;
    precipColor: Rgb;
    markColor: Rgb;
    /** cover, sharpness, scaleX, scaleY */
    cloud: [number, number, number, number];
    /** drift, slant, glow, glowRadius */
    motion: [number, number, number, number];
    /** markX, markY, markRadius, stars */
    sky: [number, number, number, number];
    /** fog, precip, precipMode (0/1/2), flash */
    weather: [number, number, number, number];
    /** wash, corridor, topWash, dither spread */
    read: [number, number, number, number];
}

const flatten = (colors: readonly Rgb[]): Float32Array => {
    const flat = new Float32Array(colors.length * 3);
    for (const [index, color] of colors.entries()) {
        flat[index * 3] = color[0];
        flat[index * 3 + 1] = color[1];
        flat[index * 3 + 2] = color[2];
    }
    return flat;
};

/** Entries the shader's nearest-colour loop and uniform arrays are sized for. */
export const WEATHER_PALETTE_SIZE = 16;

const colorKey = (color: Rgb): string =>
    `${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)}`;

/**
 * The eight semantic slots are often far apart in tone, which turns flat skies
 * into a uniform checkerboard. Fill the tonal gaps with intermediate colours
 * (safe by construction, because luminance lies between the endpoints) so the
 * dither only shows where the scene actually crosses a tone boundary.
 */
const addPaletteSteps = (base: readonly Rgb[]): Rgb[] => {
    const unique: Rgb[] = [];
    const seen = new Set<string>();

    for (const color of base) {
        const key = colorKey(color);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(color);
        }
    }

    const sorted = unique.toSorted((a, b) => relativeLuminance(a) - relativeLuminance(b));
    const palette = [...unique];
    const fractions = [0.5, 1 / 3, 2 / 3, 0.25, 0.75];

    for (const fraction of fractions) {
        for (let index = 0; index < sorted.length - 1; index++) {
            if (palette.length >= WEATHER_PALETTE_SIZE) break;
            palette.push(mixSrgb(sorted[index], sorted[index + 1], fraction));
        }
    }

    while (palette.length < WEATHER_PALETTE_SIZE) palette.push(base[0]);

    return palette.slice(0, WEATHER_PALETTE_SIZE);
};

const precipMode = (kind: WeatherSceneSpec['precipKind']): number =>
    kind === 'snow' ? 2 : kind === 'rain' ? 1 : 0;

export const buildFrame = (
    tokens: TokenSet,
    spec: WeatherSceneSpec,
    settings: FrameSettings,
): WeatherFrame => {
    const recipe = (spec.isDay ? DAY_RECIPES : NIGHT_RECIPES)[spec.family];
    const paper = tokens.kami;
    const roles: Rgb[] = [tokens.sumi, tokens.usuzumi1, tokens.fuji, tokens.link];

    // Flat overcast / fog / snow skies sit almost entirely between two palette
    // entries, where a full-strength spread reads as a uniform checkerboard.
    // Damp the spread there; gradients and precipitation still dither.
    const flatSkies = spec.family === 'overcast' || spec.family === 'fog' || spec.family === 'snow';
    const spread =
        (spec.isDay ? settings.spreadDay : settings.spreadNight) * (flatSkies ? 0.65 : 1);

    const resolve = (tint: Tint): Rgb =>
        ensureContrast(
            mixSrgb(paper, tokens[tint.token], tint.amount),
            paper,
            roles,
            settings.clampTarget,
        );

    // Lightning reads white, not gold. The bolt, its halo and the scene-wide
    // flash all ride the mark slot, so for thunderstorms it is the brightest
    // colour that still clears the contrast target: essentially the paper on
    // light themes, and on dark themes the clamp stops just short of the ink,
    // which still flashes brighter than the night sky.
    const mark =
        spec.family === 'thunderstorm'
            ? brightestSafe(
                  ensureContrast([1, 1, 1], paper, roles, settings.clampTarget),
                  roles,
                  settings.clampTarget,
              )
            : resolve(recipe.mark);

    // Fixed slot order: paper, skyBottom, skyMid, skyTop, cloud, haze, precip, mark.
    const base: Rgb[] = [
        ensureContrast(paper, paper, roles, settings.clampTarget),
        resolve(recipe.skyBottom),
        resolve(recipe.skyMid),
        resolve(recipe.skyTop),
        resolve(recipe.cloud),
        resolve(recipe.haze),
        resolve(recipe.precip),
        mark,
    ];
    const slots = addPaletteSteps(base);
    const slotsLab = slots.map(toOklab);

    return {
        slots,
        slotsLab,
        paletteFlat: flatten(slots),
        paletteLabFlat: flatten(slotsLab),
        paper,
        skyTop: base[3],
        skyMid: base[2],
        skyBottom: base[1],
        cloudColor: base[4],
        hazeColor: base[5],
        precipColor: base[6],
        markColor: base[7],
        cloud: [
            clamp01(spec.cover),
            Math.min(0.5, Math.max(0.02, spec.cloudSharpness)),
            spec.cloudScaleX,
            spec.cloudScaleY,
        ],
        motion: [
            Math.max(0, spec.drift),
            clamp01(spec.slant),
            clamp01(spec.glow),
            Math.max(0.01, spec.glowRadius),
        ],
        sky: [
            spec.isDay ? 0.73 : 0.75,
            spec.isDay ? 0.19 : 0.22,
            Math.max(0.005, spec.markRadius),
            spec.stars ? 1 : 0,
        ],
        weather: [clamp01(spec.fog), clamp01(spec.precip), precipMode(spec.precipKind), 0],
        read: [
            spec.isDay ? settings.washDay : settings.washNight,
            spec.isDay ? settings.corridorDay : settings.corridorNight,
            settings.topWash,
            spread,
        ],
    };
};

const lerpVector = (
    a: readonly [number, number, number, number],
    b: readonly [number, number, number, number],
    t: number,
): [number, number, number, number] => [
    mix(a[0], b[0], t),
    mix(a[1], b[1], t),
    mix(a[2], b[2], t),
    mix(a[3], b[3], t),
];

/**
 * Blends two frames. Palette entries move through sRGB between two values that
 * both clear the contrast target; because luminance is monotonic in each
 * channel, every intermediate entry clears it too.
 */
export const crossfadeFrames = (from: WeatherFrame, to: WeatherFrame, t: number): WeatherFrame => {
    const amount = clamp01(t);
    const slots = from.slots.map((color, index) => mixSrgb(color, to.slots[index], amount));
    const slotsLab = slots.map(toOklab);

    return {
        slots,
        slotsLab,
        paletteFlat: flatten(slots),
        paletteLabFlat: flatten(slotsLab),
        paper: mixSrgb(from.paper, to.paper, amount),
        skyTop: mixSrgb(from.skyTop, to.skyTop, amount),
        skyMid: mixSrgb(from.skyMid, to.skyMid, amount),
        skyBottom: mixSrgb(from.skyBottom, to.skyBottom, amount),
        cloudColor: mixSrgb(from.cloudColor, to.cloudColor, amount),
        hazeColor: mixSrgb(from.hazeColor, to.hazeColor, amount),
        precipColor: mixSrgb(from.precipColor, to.precipColor, amount),
        markColor: mixSrgb(from.markColor, to.markColor, amount),
        cloud: lerpVector(from.cloud, to.cloud, amount),
        motion: lerpVector(from.motion, to.motion, amount),
        sky: lerpVector(from.sky, to.sky, amount),
        weather: lerpVector(from.weather, to.weather, amount),
        read: lerpVector(from.read, to.read, amount),
    };
};

/* --------------------------------------------------------------------------
 * Lightning
 * -------------------------------------------------------------------------- */

const FLASH_CYCLE = 9;

const fract = (value: number): number => value - Math.floor(value);

const hash01 = (value: number): number => fract(Math.sin(value * 127.1 + 311.7) * 43_758.5453);

const bump = (time: number, center: number, width: number): number =>
    Math.max(0, 1 - Math.abs(time - center) / width);

export interface LightningState {
    /** Scene-wide brightening, 0-0.55. Zero for inactive scenes. */
    readonly flash: number;
    /** Bolt core visibility this instant, 0-1. Sharper than `flash`. */
    readonly bolt: number;
    /** Bolt anchor x across the sky, 0.14-0.86. Stable within a strike. */
    readonly x: number;
    /** Shape seed for the bolt's jagged path. Stable within a strike. */
    readonly seed: number;
}

const LIGHTNING_IDLE: LightningState = { flash: 0, bolt: 0, x: 0.5, seed: 0 };

const strikeX = (seed: number, cycle: number, strike: number): number =>
    0.14 + 0.72 * hash01(seed * 7.13 + cycle * 29.3 + strike * 53.1);

const strikeSeed = (seed: number, cycle: number, strike: number): number =>
    89.0 * hash01(seed * 3.71 + cycle * 91.7 + strike * 47.3);

/**
 * Two strikes per nine-second cycle: the first a short double pulse, the
 * second a single pulse. The scene-wide flash and the visible bolt ride the
 * same timing, but the bolt envelope is sharper so the channel flickers on
 * and off while the sky stays lit a beat longer. Per-strike position and
 * shape are hashed from the seed, so every strike lands somewhere new
 * without jumping mid-flash. Returns zeros for inactive scenes so
 * reduced-motion renders never flash.
 */
export const lightningState = (timeSec: number, seed: number, active: boolean): LightningState => {
    if (!active || !Number.isFinite(timeSec)) return LIGHTNING_IDLE;

    const cycle = Math.floor(timeSec / FLASH_CYCLE);
    const local = timeSec - cycle * FLASH_CYCLE;
    const offset = hash01(seed + cycle * 17.13) * 1.4;

    const flash =
        clamp01(
            Math.max(
                bump(local, 1.1 + offset, 0.07) * 0.8 + bump(local, 1.24 + offset, 0.06) * 0.45,
                bump(local, 5.3 + offset * 0.5, 0.06) * 0.6,
            ),
        ) * 0.55;

    const boltFirst = bump(local, 1.1 + offset, 0.05) + bump(local, 1.24 + offset, 0.045) * 0.8;
    const boltSecond = bump(local, 5.3 + offset * 0.5, 0.05);
    const first = boltFirst >= boltSecond;

    return {
        flash,
        bolt: clamp01(Math.max(boltFirst, boltSecond)),
        x: strikeX(seed, cycle, first ? 0 : 1),
        seed: strikeSeed(seed, cycle, first ? 0 : 1),
    };
};

/** Scene-wide flash only; kept for the static/reduced-motion path. */
export const flashEnvelope = (timeSec: number, seed: number, active: boolean): number =>
    lightningState(timeSec, seed, active).flash;
