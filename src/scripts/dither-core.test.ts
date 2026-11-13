import { describe, expect, it } from 'vite-plus/test';
import {
    bayer8,
    bayerNoise,
    nearestColorIndex,
    paletteToOklab,
    parseHexColor,
    rampColor,
    sortByLuma,
    toOklab,
    type Rgb,
} from './dither-core';

describe('bayer8', () => {
    it('fills a full 8x8 matrix with unique thresholds', () => {
        const values = new Set<number>();
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) values.add(bayer8(x, y));
        }

        expect(values.size).toBe(64);
        for (const value of values) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('is deterministic and tiles every eight cells', () => {
        expect(bayer8(1, 2)).toBe(bayer8(1 + 8, 2));
        expect(bayer8(3, 5)).toBe(bayer8(3, 5 + 8));
        expect(bayerNoise(0, 0)).toBe(bayer8(0, 0) - 0.5);
    });
});

describe('parseHexColor', () => {
    it('parses long and short hex colours', () => {
        expect(parseHexColor('#ffffff')).toEqual([1, 1, 1]);
        expect(parseHexColor('000')).toEqual([0, 0, 0]);
        expect(parseHexColor('#f00')).toEqual([1, 0, 0]);
        expect(parseHexColor('#0f08')).toEqual([0, 1, 0]);
    });

    it('drops alpha and falls back to black', () => {
        expect(parseHexColor('#11223344')).toEqual([17 / 255, 34 / 255, 51 / 255]);
        expect(parseHexColor('not-a-colour')).toEqual([0, 0, 0]);
    });
});

describe('palette matching', () => {
    it('sorts a ramp dark to light', () => {
        const sorted = sortByLuma([
            [1, 1, 1],
            [0, 0, 0],
            [0.5, 0.5, 0.5],
        ]);
        expect(sorted).toEqual([
            [0, 0, 0],
            [0.5, 0.5, 0.5],
            [1, 1, 1],
        ]);
    });

    it('finds the closest colour in OKLab', () => {
        const palette: Rgb[] = [
            [0, 0, 0],
            [1, 1, 1],
            [1, 0, 0],
        ];
        const lab = paletteToOklab(palette);

        expect(nearestColorIndex(toOklab([0.02, 0.02, 0.02]), lab)).toBe(0);
        expect(nearestColorIndex(toOklab([0.98, 0.98, 0.98]), lab)).toBe(1);
        expect(nearestColorIndex(toOklab([0.9, 0.05, 0.05]), lab)).toBe(2);
    });

    it('interpolates a ramp', () => {
        const ramp: Rgb[] = [
            [0, 0, 0],
            [1, 1, 1],
        ];
        expect(rampColor(ramp, 0)).toEqual([0, 0, 0]);
        expect(rampColor(ramp, 0.5)).toEqual([0.5, 0.5, 0.5]);
        expect(rampColor(ramp, 2)).toEqual([1, 1, 1]);
    });
});
