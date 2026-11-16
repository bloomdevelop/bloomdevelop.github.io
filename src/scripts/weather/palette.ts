/*
 * Resolves the madoromi colour tokens the scene needs.
 *
 * Custom properties must be read through a real element: `getPropertyValue`
 * returns the declared token text, and `--madoromi-link` is itself a `var()`
 * alias. A computed-style probe followed by a 2D canvas readback resolves the
 * whole chain to sRGB, which is what the shader and the contrast guard need.
 */

import type { Rgb } from '../dither-core';
import type { TokenName, TokenSet } from './types';

const TOKEN_NAMES: readonly TokenName[] = [
    'kami',
    'hyoshi',
    'chitsu',
    'nijimi0',
    'nijimi1',
    'nijimi2',
    'sumi',
    'usuzumi1',
    'fuji',
    'link',
    'sora',
    'ruri',
    'ai',
    'kikyo',
    'yamabuki',
];

const SENTINEL = 'rgb(1, 0, 1)';

const isSentinel = (value: string): boolean => value.replaceAll(/\s/g, '') === SENTINEL;

/** Returns the active flavour's tokens, or null when they cannot be resolved. */
export const resolveTokens = (): TokenSet | null => {
    if (typeof document === 'undefined') return null;

    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
        'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
    document.documentElement.append(probe);

    const canvas = document.createElement('canvas');
    canvas.width = TOKEN_NAMES.length;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    try {
        if (!context) return null;

        for (const [index, name] of TOKEN_NAMES.entries()) {
            probe.style.color = `var(--madoromi-${name}, ${SENTINEL})`;
            const resolved = getComputedStyle(probe).color;
            if (!resolved || isSentinel(resolved) || !CSS.supports('color', resolved)) {
                return null;
            }

            context.fillStyle = resolved;
            context.fillRect(index, 0, 1, 1);
        }

        const pixels = context.getImageData(0, 0, TOKEN_NAMES.length, 1).data;
        const read = (index: number): Rgb => [
            (pixels[index * 4] ?? 0) / 255,
            (pixels[index * 4 + 1] ?? 0) / 255,
            (pixels[index * 4 + 2] ?? 0) / 255,
        ];

        // Indices follow TOKEN_NAMES above; keep both lists in step.
        return {
            kami: read(0),
            hyoshi: read(1),
            chitsu: read(2),
            nijimi0: read(3),
            nijimi1: read(4),
            nijimi2: read(5),
            sumi: read(6),
            usuzumi1: read(7),
            fuji: read(8),
            link: read(9),
            sora: read(10),
            ruri: read(11),
            ai: read(12),
            kikyo: read(13),
            yamabuki: read(14),
        };
    } catch {
        return null;
    } finally {
        probe.remove();
    }
};
