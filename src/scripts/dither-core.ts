/*
 * Pure dithering math shared by the WebGL generator (scripts/dither.ts) and
 * the build-time rasterizer used for Open Graph cards.
 *
 * The fragment shader in dither.ts keeps the GLSL copy of these formulas, so
 * keep the two in sync when changing the algorithm.
 */

export type Rgb = [number, number, number];

/** Upper bound of palette entries the shader can hold. */
export const MAX_PALETTE = 32;

/** Side length of the ordered-dither matrix. */
export const BAYER_SIZE = 8;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const fract = (value: number): number => value - Math.floor(value);

export const luma = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const srgbToLinear = (channel: number): number =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export const linearToSrgb = (channel: number): number =>
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

/** sRGB (0-1 per channel) to OKLab, matching the shader's toOklab(). */
export const toOklab = ([r, g, b]: Rgb): Rgb => {
    const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] as const;
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
};

/* --------------------------------------------------------------------------
 * Ordered dithering
 * -------------------------------------------------------------------------- */

// Procedural 8x8 Bayer matrix, values in [0, 1). This mirrors bayer2/bayer4/
// bayer8 in the fragment shader, including the floor()s that make the
// half-resolution lookups land on whole matrix cells.
const bayer2 = (x: number, y: number): number =>
    fract(Math.floor(x) / 2 + Math.floor(y) * Math.floor(y) * 0.75);

const bayer4 = (x: number, y: number): number => bayer2(x * 0.5, y * 0.5) * 0.25 + bayer2(x, y);

/** Ordered-dither threshold for a matrix cell, in [0, 1). */
export const bayer8 = (x: number, y: number): number =>
    bayer4(x * 0.5, y * 0.5) * 0.25 + bayer2(x, y);

/** Signed threshold in [-0.5, 0.5). */
export const bayerNoise = (x: number, y: number): number => bayer8(x, y) - 0.5;

/* --------------------------------------------------------------------------
 * Palette helpers
 * -------------------------------------------------------------------------- */

const HEX = /^[0-9a-f]{6}$/i;

/** Parses `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` (alpha is dropped). */
export const parseHexColor = (value: string): Rgb => {
    let hex = value.trim().replace(/^#/, '');

    if (hex.length === 3 || hex.length === 4) {
        hex = Array.from(hex.slice(0, 3), (channel) => channel.repeat(2)).join('');
    }

    if (hex.length === 8) hex = hex.slice(0, 6);
    if (!HEX.test(hex)) return [0, 0, 0];

    return [
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4, 6), 16) / 255,
    ];
};

export const rgbToHex = ([r, g, b]: Rgb): string =>
    `#${[r, g, b]
        .map((channel) =>
            Math.round(clamp01(channel) * 255)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;

export const paletteToOklab = (palette: readonly Rgb[]): Rgb[] => palette.map(toOklab);

/** Index of the closest palette entry in OKLab, or -1 for an empty palette. */
export const nearestColorIndex = (lab: Rgb, paletteLab: readonly Rgb[]): number => {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [index, candidate] of paletteLab.entries()) {
        const dl = candidate[0] - lab[0];
        const da = candidate[1] - lab[1];
        const db = candidate[2] - lab[2];
        const distance = dl * dl + da * da + db * db;

        if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
        }
    }

    return best;
};

/** Interpolates a dark-to-light luminance ramp at `t` in [0, 1]. */
export const rampColor = (ramp: readonly Rgb[], t: number): Rgb => {
    if (ramp.length === 0) return [0, 0, 0];
    if (ramp.length === 1) return ramp[0];

    const position = clamp01(t) * (ramp.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(ramp.length - 1, lower + 1);
    const mix = position - lower;
    const a = ramp[lower];
    const b = ramp[upper];

    return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix];
};

/** Sorts a palette dark -> light, as required by the luminance ramp mode. */
export const sortByLuma = (palette: readonly Rgb[]): Rgb[] =>
    [...palette].toSorted((a, b) => luma(a) - luma(b));
