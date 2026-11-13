/*
 * Renders the text layer of an Open Graph card.
 *
 * The background (a dithered image or procedural gradient) is rendered
 * separately, so the same transparent overlay can be composited onto a still
 * PNG and onto every frame of the animated video.
 */

import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import satori from 'satori';
import { type CardTheme } from './theme';
import { loadCardFonts, type CardFontPaths } from './fonts';
type Style = Record<string, string | number>;

interface Element {
    type: string;
    props: {
        style?: Style;
        children?: string | Element | Element[];
    };
}

export interface CardContent {
    title: string;
    description?: string;
    date?: string;
    /** Background image cards get a scrim behind the text. */
    hasImage: boolean;
}

export interface CardRenderOptions {
    width: number;
    height: number;
    theme: CardTheme;
    fonts: CardFontPaths;
}

const element = (style: Style, children?: string | Element | Element[]): Element => ({
    type: 'div',
    props: { style, children },
});

const text = (children: string, style: Style): Element => element(style, children);

const titleSize = (value: string): number => {
    if (value.length <= 30) return 82;
    if (value.length <= 58) return 70;
    if (value.length <= 92) return 60;
    return 50;
};

const formatDate = (iso?: string): string | undefined => {
    if (!iso) return undefined;
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return undefined;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

const buildCard = (
    content: CardContent,
    { width, height, theme }: Pick<CardRenderOptions, 'width' | 'height' | 'theme'>,
): Element => {
    const date = formatDate(content.date);
    const padding = Math.round(width * 0.06);
    const overlays: Element[] = date
        ? [
              element(
                  {
                      position: 'absolute',
                      top: `${padding}px`,
                      right: `${padding}px`,
                      fontSize: 20,
                      fontFamily: 'Maple Mono',
                      letterSpacing: '0.22em',
                      color: theme.inkSubtle,
                      textTransform: 'uppercase',
                  },
                  date,
              ),
          ]
        : [];

    const body = element(
        {
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            margin: 0,
        },
        [
            text(content.title, {
                display: 'flex',
                fontSize: titleSize(content.title),
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                color: theme.ink,
                lineClamp: 3,
                width: '100%',
            }),
            ...(content.description
                ? [
                      text(content.description, {
                          display: 'flex',
                          marginTop: 22,
                          fontSize: 27,
                          fontWeight: 400,
                          lineHeight: 1.42,
                          color: theme.inkMuted,
                          lineClamp: 2,
                          width: '94%',
                      }),
                  ]
                : []),
        ],
    );

    return element(
        {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            width: `${width}px`,
            height: `${height}px`,
            boxSizing: 'border-box',
            padding: `${padding}px`,
            position: 'relative',
            fontFamily: 'Inter',
            backgroundColor: 'transparent',
        },
        [body, ...overlays],
    );
};

/** Renders the transparent text layer as a PNG buffer. */
export const renderOverlay = async (
    content: CardContent,
    options: CardRenderOptions,
): Promise<Buffer> => {
    const fonts = await loadCardFonts(options.fonts);
    // satori's element type is ReactNode from `react` (not a runtime dependency
    // here); the object shape is exactly what it expects.
    const svg = await satori(buildCard(content, options), {
        width: options.width,
        height: options.height,
        fonts,
    });

    const textLayer = await sharp(Buffer.from(svg)).png().toBuffer();
    if (!content.hasImage) return textLayer;

    // Satori does not paint background gradients reliably here, so the scrim
    // is rasterized from a tiny SVG and the text is composited on top.
    const scrim = await sharp(
        Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">
                <defs>
                    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${options.theme.paper}" stop-opacity="0.98" />
                        <stop offset="18%" stop-color="${options.theme.paper}" stop-opacity="0.86" />
                        <stop offset="34%" stop-color="${options.theme.paper}" stop-opacity="0" />
                    </linearGradient>
                    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="34%" stop-color="${options.theme.paper}" stop-opacity="0" />
                        <stop offset="72%" stop-color="${options.theme.paper}" stop-opacity="0.92" />
                        <stop offset="100%" stop-color="${options.theme.paper}" stop-opacity="1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#top)" />
                <rect width="100%" height="100%" fill="url(#bottom)" />
            </svg>`,
        ),
    )
        .png()
        .toBuffer();

    return sharp(scrim)
        .composite([{ input: textLayer }])
        .png()
        .toBuffer();
};
