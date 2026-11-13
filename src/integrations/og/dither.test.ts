import { describe, expect, it } from 'vite-plus/test';
import { ditherCells, prepareDither } from './dither';

// One cell per sample keeps the fixture readable: 4x1 pixels.
const cells = new Uint8Array([0, 0, 0, 255, 255, 255, 128, 128, 128]);
const trim = (values: Uint8Array) => Array.from(values).map((value) => Math.round(value / 85) * 85);

describe('build-time dithering', () => {
    it('produces one RGB sample per cell', () => {
        const dither = prepareDither({ palette: ['#000000', '#ffffff'], mode: 'palette' });
        const output = ditherCells(cells, 3, 1, dither);

        expect(output).toHaveLength(9);
        // A black ramp has nowhere to go, white stays white.
        expect(trim(output).slice(0, 3)).toEqual([0, 0, 0]);
        expect(trim(output).slice(3, 6)).toEqual([255, 255, 255]);
    });

    it('shifts the pattern when the phase advances', () => {
        const dither = prepareDither({
            palette: ['#000000', '#555555', '#aaaaaa', '#ffffff'],
            mode: 'palette',
        });
        const grid = new Uint8Array(8 * 8 * 3);
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const value = ((x * 31 + y * 17) % 200) + 30;
                const offset = (y * 8 + x) * 3;
                grid[offset] = value;
                grid[offset + 1] = value;
                grid[offset + 2] = value;
            }
        }

        const base = ditherCells(grid, 8, 8, dither, { phase: 0 });
        const shifted = ditherCells(grid, 8, 8, dither, { phase: 3 });

        expect(base).not.toEqual(shifted);
        expect(ditherCells(grid, 8, 8, dither, { phase: 0 })).toEqual(base);
    });

    it('keeps the nearest palette colour', () => {
        const dither = prepareDither({ palette: ['#ff0000', '#0000ff'], mode: 'match' });
        const red = new Uint8Array([240, 10, 10, 10, 10, 240]);
        const output = ditherCells(red, 2, 1, dither);

        expect(output[0]).toBe(255);
        expect(output[2]).toBe(0);
        expect(output[3]).toBe(0);
        expect(output[5]).toBe(255);
    });
});
