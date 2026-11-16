import { describe, expect, it } from 'vite-plus/test';
import { CARD_THEMES } from '../../integrations/og/theme';
import { parseHexColor, type Rgb } from '../dither-core';
import { WEATHER_CONFIG } from './config';
import {
    buildFrame,
    contrastRatio,
    crossfadeFrames,
    ensureContrast,
    flashEnvelope,
    mixSrgb,
    WEATHER_PALETTE_SIZE,
    relativeLuminance,
    type WeatherFrame,
} from './scene';
import type { TokenSet, WeatherFamily, WeatherSnapshot } from './types';
import { buildSceneSpec } from './wmo';

const PALETTE_INDEX = {
    sumi: 0,
    usuzumi1: 1,
    nijimi2: 6,
    nijimi1: 7,
    nijimi0: 8,
    kami: 9,
    hyoshi: 10,
    chitsu: 11,
    fuji: 15,
    kikyo: 16,
    yamabuki: 20,
    sora: 23,
    ruri: 24,
    ai: 25,
} as const;

const tokensFor = (flavour: 'light' | 'dark'): TokenSet => {
    const theme = CARD_THEMES[flavour];
    const at = (name: keyof typeof PALETTE_INDEX): Rgb =>
        parseHexColor(theme.palette[PALETTE_INDEX[name]]);

    return {
        sumi: at('sumi'),
        usuzumi1: at('usuzumi1'),
        nijimi2: at('nijimi2'),
        nijimi1: at('nijimi1'),
        nijimi0: at('nijimi0'),
        kami: at('kami'),
        hyoshi: at('hyoshi'),
        chitsu: at('chitsu'),
        fuji: at('fuji'),
        link: flavour === 'light' ? at('ai') : at('sora'),
        kikyo: at('kikyo'),
        yamabuki: at('yamabuki'),
        sora: at('sora'),
        ruri: at('ruri'),
        ai: at('ai'),
    };
};

const snapshot = (weatherCode: number, isDay: boolean): WeatherSnapshot => ({
    weatherCode,
    isDay,
    cloudCover: 55,
    windKph: 16,
    precipitationMm: 0.2,
    rainMm: 0.1,
    showersMm: 0.1,
    snowfallCm: 0,
    temperatureC: 24,
    fetchedAt: 0,
});

const FAMILY_CODES: Record<WeatherFamily, number> = {
    clear: 0,
    'mainly-clear': 1,
    'partly-cloudy': 2,
    overcast: 3,
    fog: 45,
    drizzle: 53,
    rain: 63,
    'heavy-rain': 65,
    snow: 73,
    thunderstorm: 95,
};

const FAMILIES: WeatherFamily[] = [
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

const buildFor = (flavour: 'light' | 'dark', family: WeatherFamily, isDay: boolean) =>
    buildFrame(
        tokensFor(flavour),
        buildSceneSpec(snapshot(FAMILY_CODES[family], isDay)),
        WEATHER_CONFIG.render,
    );

const textRoles = (tokens: TokenSet): Rgb[] => [
    tokens.sumi,
    tokens.usuzumi1,
    tokens.fuji,
    tokens.link,
];

const EXPECTED = WEATHER_CONFIG.render.clampTarget - 1e-9;

describe('colour math', () => {
    it('computes known luminance and contrast values', () => {
        expect(relativeLuminance([0, 0, 0])).toBe(0);
        expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 6);
        expect(contrastRatio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 6);
        expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 6);
    });

    it('interpolates sRGB endpoints', () => {
        expect(mixSrgb([0, 0, 0], [1, 1, 1], 0)).toEqual([0, 0, 0]);
        expect(mixSrgb([0, 0, 0], [1, 1, 1], 1)).toEqual([1, 1, 1]);
        expect(mixSrgb([0, 0, 0], [1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5]);
    });

    it('lifts failing candidates toward paper until they pass', () => {
        const paper: Rgb = [1, 1, 1];
        const role: Rgb = [0.2, 0.2, 0.2];
        const candidate: Rgb = [0.35, 0.35, 0.35];

        expect(contrastRatio(candidate, role)).toBeLessThan(4.6);
        const safe = ensureContrast(candidate, paper, [role], 4.6);
        expect(contrastRatio(safe, role)).toBeGreaterThanOrEqual(4.6);
    });
});

describe('buildFrame', () => {
    it('keeps every palette entry above the contrast target, all flavours and families', () => {
        for (const flavour of ['light', 'dark'] as const) {
            const tokens = tokensFor(flavour);
            const roles = textRoles(tokens);

            for (const family of FAMILIES) {
                for (const isDay of [true, false]) {
                    const frame = buildFor(flavour, family, isDay);

                    expect(frame.slots).toHaveLength(WEATHER_PALETTE_SIZE);
                    expect(frame.slotsLab).toHaveLength(WEATHER_PALETTE_SIZE);
                    expect(frame.paletteFlat).toHaveLength(WEATHER_PALETTE_SIZE * 3);
                    expect(frame.paletteLabFlat).toHaveLength(WEATHER_PALETTE_SIZE * 3);

                    for (const slot of frame.slots) {
                        for (const role of roles) {
                            expect(contrastRatio(slot, role)).toBeGreaterThanOrEqual(EXPECTED);
                        }
                    }
                }
            }
        }
    });

    it('produces finite, in-range uniforms', () => {
        for (const family of FAMILIES) {
            const frame = buildFor('light', family, true);

            expect(frame.cloud[0]).toBeGreaterThanOrEqual(0);
            expect(frame.cloud[0]).toBeLessThanOrEqual(1);
            expect(frame.cloud[1]).toBeGreaterThan(0);
            expect(frame.motion[0]).toBeGreaterThanOrEqual(0);
            expect(frame.motion[0]).toBeLessThanOrEqual(0.012);
            expect(frame.motion[1]).toBeGreaterThanOrEqual(0);
            expect(frame.motion[1]).toBeLessThanOrEqual(0.3);
            expect(frame.read[3]).toBeGreaterThan(0);
            expect(frame.weather[0]).toBeGreaterThanOrEqual(0);
            expect(frame.weather[1]).toBeGreaterThanOrEqual(0);
            expect(frame.weather[1]).toBeLessThanOrEqual(1);

            for (const value of [
                ...frame.cloud,
                ...frame.motion,
                ...frame.sky,
                ...frame.weather,
                ...frame.read,
            ]) {
                expect(Number.isFinite(value)).toBe(true);
            }
        }
    });

    it('changes the palette between day and night', () => {
        const day = buildFor('light', 'clear', true);
        const night = buildFor('light', 'clear', false);

        expect(day.skyTop).not.toEqual(night.skyTop);
        expect(day.sky[3]).toBe(0);
        expect(night.sky[3]).toBe(1);
    });

    it('encodes the precipitation mode for the shader', () => {
        expect(buildFor('light', 'clear', true).weather[2]).toBe(0);
        expect(buildFor('light', 'rain', true).weather[2]).toBe(1);
        expect(buildFor('light', 'snow', true).weather[2]).toBe(2);
    });
});

describe('crossfadeFrames', () => {
    it('keeps every blended entry safe against text roles', () => {
        const pairs: Array<[WeatherFamily, WeatherFamily]> = [
            ['clear', 'thunderstorm'],
            ['rain', 'snow'],
            ['fog', 'overcast'],
        ];

        for (const flavour of ['light', 'dark'] as const) {
            const roles = textRoles(tokensFor(flavour));

            for (const [fromFamily, toFamily] of pairs) {
                const from = buildFor(flavour, fromFamily, true);
                const to = buildFor(flavour, toFamily, false);

                for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                    const frame: WeatherFrame = crossfadeFrames(from, to, t);
                    for (const slot of frame.slots) {
                        for (const role of roles) {
                            expect(contrastRatio(slot, role)).toBeGreaterThanOrEqual(EXPECTED);
                        }
                    }
                }
            }
        }
    });
});

describe('flashEnvelope', () => {
    it('is silent when inactive', () => {
        expect(flashEnvelope(1.2, 7, false)).toBe(0);
    });

    it('stays bounded over a long stretch', () => {
        let previous = 0;
        const rising: number[] = [];

        for (let index = 0; index <= 20_000; index++) {
            const value = flashEnvelope(index / 1000, 13, true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0.55);
            if (previous === 0 && value > 0) rising.push(index / 1000);
            previous = value;
        }

        // Each strike is a double pulse; group pulses closer than 0.5s and
        // assert at most two strikes per nine-second cycle over 20 seconds.
        let strikes = 0;
        let last = Number.NEGATIVE_INFINITY;
        for (const time of rising) {
            if (time - last > 0.5) strikes++;
            last = time;
        }
        expect(strikes).toBeLessThanOrEqual(6);
    });
});
