/*
 * CPU ordered dithering for Open Graph cards.
 *
 * This is the build-time counterpart of the WebGL shader in
 * `src/scripts/dither.ts`: the same Bayer matrix, OKLab nearest-colour
 * matching and palette ramp, so cards look like the site's dithered art.
 *
 * Input pixels are already reduced to one sample per dither cell (the caller
 * uses sharp's box resize), keeping this loop cheap enough to run per video
 * frame.
 */

import {
    MAX_PALETTE,
    bayerNoise,
    clamp01,
    luma,
    nearestColorIndex,
    paletteToOklab,
    parseHexColor,
    rampColor,
    sortByLuma,
    toOklab,
    type Rgb,
} from '../../scripts/dither-core';

export type DitherMode = 'match' | 'palette' | 'color';

export interface DitherOptions {
    /** Palette as CSS hex colours (2-32 entries). */
    palette: string[];
    /** Defaults to `match`. */
    mode?: DitherMode;
    /** Quantization levels; defaults to the palette size for `palette` mode, else 4. */
    levels?: number;
    /** Dither amplitude, 0 disables the threshold. */
    strength?: number;
    contrast?: number;
    /** Noise amplitude for `match` mode. */
    spread?: number;
}

export interface DitherFrame {
    /** Shifts the Bayer matrix (in cells) to animate the pattern. */
    phase?: number;
    /** Multiplies `strength`; use for a breathing animation. */
    strength?: number;
}

export interface PreparedDither {
    readonly mode: DitherMode;
    readonly levels: number;
    readonly strength: number;
    readonly contrast: number;
    readonly spread: number;
    readonly palette: Rgb[];
    readonly paletteLab: Rgb[];
    readonly ramp: Rgb[];
}

export const prepareDither = (options: DitherOptions): PreparedDither => {
    const mode = options.mode ?? 'match';
    const raw = options.palette.slice(0, MAX_PALETTE).map(parseHexColor);

    // The shader needs at least two entries to interpolate or match.
    const palette = raw.length >= 2 ? raw : [...raw, [0, 0, 0] as Rgb].slice(0, 2);
    const ramp = sortByLuma(palette);

    return {
        mode,
        levels: mode === 'palette' ? palette.length : Math.max(2, Math.round(options.levels ?? 4)),
        strength: options.strength ?? 1,
        contrast: options.contrast ?? 1,
        spread: options.spread ?? 0.2,
        palette,
        paletteLab: mode === 'match' ? paletteToOklab(palette) : [],
        ramp,
    };
};

const toByte = (value: number): number => Math.round(clamp01(value) * 255);

/**
 * Dithers one sample per cell (RGB, row-major) into an RGB byte buffer with
 * `cols * rows * 3` entries.
 */
export const ditherCells = (
    cells: Uint8Array,
    cols: number,
    rows: number,
    dither: PreparedDither,
    frame: DitherFrame = {},
): Uint8Array => {
    const output = new Uint8Array(cols * rows * 3);
    const { mode, levels, palette, paletteLab, ramp } = dither;
    const strength = dither.strength * (frame.strength ?? 1);
    const steps = levels - 1;
    const phase = frame.phase ?? 0;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const input = (y * cols + x) * 3;
            let r = cells[input] / 255;
            let g = cells[input + 1] / 255;
            let b = cells[input + 2] / 255;

            const noise = bayerNoise(x + phase, y + phase);

            if (mode === 'match') {
                r = clamp01((r - 0.5) * dither.contrast + 0.5 + noise * strength * dither.spread);
                g = clamp01((g - 0.5) * dither.contrast + 0.5 + noise * strength * dither.spread);
                b = clamp01((b - 0.5) * dither.contrast + 0.5 + noise * strength * dither.spread);

                const index = nearestColorIndex(toOklab([r, g, b]), paletteLab);
                const color = palette[index] ?? [0, 0, 0];
                output[input] = toByte(color[0]);
                output[input + 1] = toByte(color[1]);
                output[input + 2] = toByte(color[2]);
                continue;
            }

            if (mode === 'palette') {
                const luminance = clamp01((luma([r, g, b]) - 0.5) * dither.contrast + 0.5);
                const threshold = (noise * strength) / steps;
                const level = Math.floor((luminance + threshold) * steps + 0.5) / steps;
                const [cr, cg, cb] = rampColor(ramp, level);
                output[input] = toByte(cr);
                output[input + 1] = toByte(cg);
                output[input + 2] = toByte(cb);
                continue;
            }

            const threshold = (noise * strength) / steps;
            const quantize = (channel: number) =>
                clamp01(
                    Math.floor(
                        (clamp01((channel - 0.5) * dither.contrast + 0.5) + threshold) * steps +
                            0.5,
                    ) / steps,
                );
            output[input] = toByte(quantize(r));
            output[input + 1] = toByte(quantize(g));
            output[input + 2] = toByte(quantize(b));
        }
    }

    return output;
};
