/*
 * Builds one Open Graph card: a still PNG, plus an optional animated video
 * with the same dithered background.
 */

import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    imageBackground,
    proceduralBackground,
    renderStill,
    scaleFrame,
    type Background,
} from './background';
import { renderOverlay } from './card';
import { ditherCells } from './dither';
import { detectVideoFormat, encodeVideo, type VideoFormat } from './video';
import { CARD_THEMES, type CardFlavor } from './theme';
import type { CardFontPaths } from './fonts';
import type { OgEntry } from '../../scripts/og/registry';

export interface GenerateCardOptions {
    entry: OgEntry;
    /** Header image bytes; without it the card gets a procedural backdrop. */
    image?: Buffer;
    width: number;
    height: number;
    pixelSize: number;
    theme: CardFlavor;
    video: boolean;
    fps: number;
    duration: number;
    fonts: CardFontPaths;
}

export interface GeneratedCard {
    png: Buffer;
    video?: {
        data: Buffer;
        extension: 'mp4' | 'webm';
        mime: string;
    };
}

const loopFrames = (fps: number, duration: number): number =>
    // A whole number of Bayer cycles keeps the loop seamless.
    Math.max(8, Math.round((fps * duration) / 8) * 8);

const renderVideoFrames = async (
    background: Background,
    overlay: Buffer,
    options: GenerateCardOptions,
    frameCount: number,
    output: string,
    format: VideoFormat,
): Promise<Buffer> => {
    const { width, height } = options;

    await encodeVideo({
        width,
        height,
        fps: options.fps,
        frameCount,
        output,
        format,
        renderFrame: async (index) => {
            // The pattern travels through all eight Bayer offsets and the
            // strength breathes once per loop, so both return to their start.
            const phase = Math.floor((index * 8) / frameCount) % 8;
            const strength =
                0.72 + 0.28 * (0.5 - 0.5 * Math.cos((index / frameCount) * Math.PI * 2));
            const cells = ditherCells(
                background.cells,
                background.cols,
                background.rows,
                background.dither,
                { phase, strength },
            );

            return scaleFrame(cells, background, width, height)
                .composite([{ input: overlay, left: 0, top: 0 }])
                .removeAlpha()
                .raw()
                .toBuffer();
        },
    });

    return readFile(output);
};

export const generateCard = async (options: GenerateCardOptions): Promise<GeneratedCard> => {
    const { entry } = options;
    const theme = CARD_THEMES[options.theme];
    const hasImage = Boolean(options.image);

    const [overlay, background] = await Promise.all([
        renderOverlay(
            {
                title: entry.title,
                description: entry.description,
                date: entry.date,
                hasImage,
            },
            {
                width: options.width,
                height: options.height,
                theme,
                fonts: options.fonts,
            },
        ),
        Promise.resolve(
            options.image
                ? imageBackground(options.image, {
                      width: options.width,
                      height: options.height,
                      pixelSize: options.pixelSize,
                      theme,
                  })
                : proceduralBackground({
                      width: options.width,
                      height: options.height,
                      pixelSize: options.pixelSize,
                      theme,
                  }),
        ),
    ]);

    const png = await renderStill(background, overlay, options.width, options.height);
    const result: GeneratedCard = { png };

    if (!options.video) return result;

    const format = await detectVideoFormat();
    if (!format) return result;

    const frameCount = loopFrames(options.fps, options.duration);
    const output = join(tmpdir(), `og-${randomUUID()}.${format.extension}`);

    try {
        const data = await renderVideoFrames(
            background,
            overlay,
            options,
            frameCount,
            output,
            format,
        );
        result.video = { data, extension: format.extension, mime: format.mime };
    } finally {
        await unlink(output).catch(() => {});
    }

    return result;
};
