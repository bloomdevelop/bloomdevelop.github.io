/*
 * Card backgrounds.
 *
 * Both variants reduce the artwork to one colour per dither cell, which is
 * what `ditherCells` consumes. The image variant uses a box downsample so the
 * cells average the source pixels, like the shader's box filter.
 */

import sharp, { type Sharp } from 'sharp';
import { parseHexColor, type Rgb } from '../../scripts/dither-core';
import { ditherCells, prepareDither, type PreparedDither } from './dither';
import type { CardTheme } from './theme';

export interface BackgroundOptions {
    width: number;
    height: number;
    /** Cell size in card pixels. */
    pixelSize: number;
    theme: CardTheme;
    mode?: 'match' | 'palette' | 'color';
    levels?: number;
    strength?: number;
    contrast?: number;
    spread?: number;
}

export interface Background {
    cells: Uint8Array;
    cols: number;
    rows: number;
    dither: PreparedDither;
}

const grid = ({ width, height, pixelSize }: BackgroundOptions) => ({
    cols: Math.max(1, Math.ceil(width / pixelSize)),
    rows: Math.max(1, Math.ceil(height / pixelSize)),
});

const prepare = (
    options: BackgroundOptions,
    overrides: { strength?: number; spread?: number } = {},
): PreparedDither =>
    prepareDither({
        // A luminance ramp needs a dark-to-light order; the neutrals already
        // are, so the theme palette works for both modes.
        palette: options.theme.palette,
        mode: options.mode ?? 'match',
        levels: options.levels,
        strength: overrides.strength ?? options.strength ?? 1,
        contrast: options.contrast ?? 1,
        spread: overrides.spread ?? options.spread ?? 0.22,
    });

/** Covers the card with a dithered version of the source image. */
export const imageBackground = async (
    source: Buffer | string,
    options: BackgroundOptions,
): Promise<Background> => {
    const { cols, rows } = grid(options);
    const cells = await sharp(source)
        .resize(options.width, options.height, { fit: 'cover', position: 'centre' })
        .removeAlpha()
        .resize(cols, rows, { kernel: 'linear' })
        .raw()
        .toBuffer();

    return { cells, cols, rows, dither: prepare(options) };
};

const smoothstep = (edge0: number, edge1: number, value: number): number => {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

const mix = (a: Rgb, b: Rgb, amount: number): Rgb => [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
];

const blob = (x: number, y: number, cx: number, cy: number, radius: number): number =>
    Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * radius * radius));

/**
 * Procedural backdrop for pages without a header image: a few soft ink blooms
 * on paper, faded towards the text area, then dithered with the theme palette.
 */
export const proceduralBackground = (options: BackgroundOptions): Background => {
    const { cols, rows } = grid(options);
    const { theme } = options;
    const paper = parseHexColor(theme.paper);
    const blooms: Array<{ color: Rgb; cx: number; cy: number; radius: number; alpha: number }> = [
        { color: parseHexColor(theme.secondary), cx: 0.86, cy: 0.14, radius: 0.5, alpha: 0.34 },
        { color: parseHexColor(theme.accent), cx: 0.72, cy: 0.82, radius: 0.56, alpha: 0.3 },
        { color: parseHexColor(theme.accentAlt), cx: 0.26, cy: 0.1, radius: 0.38, alpha: 0.18 },
    ];

    const cells = new Uint8Array(cols * rows * 3);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const u = cols === 1 ? 0.5 : x / (cols - 1);
            const v = rows === 1 ? 0.5 : y / (rows - 1);

            let color = paper;
            for (const bloom of blooms) {
                const amount = bloom.alpha * blob(u, v, bloom.cx, bloom.cy, bloom.radius);
                color = mix(color, bloom.color, amount);
            }

            // Wash the blooms back towards paper, and keep the lower-left
            // corner especially calm so the title always has room.
            color = mix(color, paper, 0.55 + 0.4 * smoothstep(0.4, 0.9, v));

            const offset = (y * cols + x) * 3;
            cells[offset] = Math.round(color[0] * 255);
            cells[offset + 1] = Math.round(color[1] * 255);
            cells[offset + 2] = Math.round(color[2] * 255);
        }
    }

    return { cells, cols, rows, dither: prepare(options, { strength: 0.8, spread: 0.04 }) };
};

/** Upscales a dithered frame to card size. */
export const scaleFrame = (
    cells: Uint8Array,
    { cols, rows }: Pick<Background, 'cols' | 'rows'>,
    width: number,
    height: number,
): Sharp =>
    sharp(cells, { raw: { width: cols, height: rows, channels: 3 } }).resize(width, height, {
        kernel: 'nearest',
    });

/** Renders a still card (background + overlay). */
export const renderStill = async (
    background: Background,
    overlay: Buffer,
    width: number,
    height: number,
): Promise<Buffer> => {
    const frame = ditherCells(
        background.cells,
        background.cols,
        background.rows,
        background.dither,
    );
    const scaled = await scaleFrame(frame, background, width, height).png().toBuffer();

    return sharp(scaled)
        .composite([{ input: overlay, left: 0, top: 0 }])
        .png({ compressionLevel: 9 })
        .toBuffer();
};
