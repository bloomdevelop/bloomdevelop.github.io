/*
 * Fonts for the card renderer.
 *
 * The site ships woff2 files; satori only understands sfnt (ttf/otf), so the
 * woff2 is decompressed in memory once per process and cached.
 */

import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decompress } from 'wawoff2';
import type { Font } from 'satori';

const cache = new Map<string, Promise<Buffer>>();

// wawoff2's wasm decoder cannot be called concurrently, so decompressions are
// chained even when several pages render at the same time.
let decompression: Promise<unknown> = Promise.resolve();

const decompressExclusive = (data: Buffer): Promise<Buffer> => {
    const job = decompression.then(async () => Buffer.from(await decompress(data)));
    decompression = job.catch(() => undefined);
    return job;
};

const readFont = (path: string): Promise<Buffer> => {
    let font = cache.get(path);
    if (!font) {
        font = readFile(path).then((data) =>
            path.endsWith('.woff2') ? decompressExclusive(data) : data,
        );
        cache.set(path, font);
    }
    return font;
};

export interface CardFontPaths {
    sans: URL | string;
    mono: URL | string;
}

const toPath = (value: URL | string): string =>
    value instanceof URL ? fileURLToPath(value) : value;

export const loadCardFonts = async ({ sans, mono }: CardFontPaths): Promise<Font[]> => {
    const [sansData, monoData] = await Promise.all([
        readFont(toPath(sans)),
        readFont(toPath(mono)),
    ]);

    // A variable font is reused for every weight; satori resolves the CSS
    // weight to the face and the variation is kept by the rasterizer.
    return [
        { name: 'Inter', data: sansData, weight: 400, style: 'normal' },
        { name: 'Inter', data: sansData, weight: 500, style: 'normal' },
        { name: 'Inter', data: sansData, weight: 600, style: 'normal' },
        { name: 'Inter', data: sansData, weight: 700, style: 'normal' },
        { name: 'Inter', data: sansData, weight: 800, style: 'normal' },
        { name: 'Maple Mono', data: monoData, weight: 400, style: 'normal' },
        { name: 'Maple Mono', data: monoData, weight: 600, style: 'normal' },
    ];
};
