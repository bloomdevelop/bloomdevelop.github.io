/*
 * Card colours for the Open Graph renderer.
 *
 * Tokens are the madoromi (微睡) palette used by the site, written as OKLCH
 * and converted to sRGB hex here because social cards cannot resolve CSS
 * variables or colour functions.
 */

import { clamp01, linearToSrgb, rgbToHex, type Rgb } from '../../scripts/dither-core';

interface Oklch {
    /** Lightness, 0-1. */
    l: number;
    /** Chroma. */
    c: number;
    /** Hue in degrees. */
    h: number;
}

export const oklchToHex = ({ l, c, h }: Oklch): string => {
    const hue = (h * Math.PI) / 180;
    const a = c * Math.cos(hue);
    const b = c * Math.sin(hue);

    const long = l + 0.3963377774 * a + 0.2158037573 * b;
    const medium = l - 0.1055613458 * a - 0.0638541728 * b;
    const short = l - 0.0894841775 * a - 1.291485548 * b;

    const L = long ** 3;
    const M = medium ** 3;
    const S = short ** 3;

    // OKLab -> linear sRGB
    const linear: Rgb = [
        4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
        -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
        -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
    ];

    const rgb: Rgb = [
        clamp01(linearToSrgb(linear[0])),
        clamp01(linearToSrgb(linear[1])),
        clamp01(linearToSrgb(linear[2])),
    ];
    return rgbToHex(rgb);
};

const token = (l: number, c: number, h: number): string => oklchToHex({ l, c, h });

export interface CardTheme {
    paper: string;
    ink: string;
    inkMuted: string;
    inkSubtle: string;
    accent: string;
    accentAlt: string;
    secondary: string;
    /** Dither palette: 12 neutrals followed by the inks. */
    palette: string[];
}

const light: CardTheme = {
    paper: token(0.9601, 0.014, 318.7),
    ink: token(0.43, 0.0342, 318.66),
    inkMuted: token(0.4986, 0.0343, 317.16),
    inkSubtle: token(0.5994, 0.029, 316.07),
    accent: token(0.4606, 0.2126, 296.73),
    accentAlt: token(0.61, 0.0838, 351.32),
    secondary: token(0.5914, 0.1108, 223.73),
    palette: [
        token(0.43, 0.0342, 318.66),
        token(0.4986, 0.0343, 317.16),
        token(0.5405, 0.0336, 317.18),
        token(0.5994, 0.029, 316.07),
        token(0.6594, 0.0284, 316.09),
        token(0.7093, 0.0284, 318.22),
        token(0.7598, 0.0274, 316.11),
        token(0.8103, 0.0269, 316.12),
        token(0.8608, 0.0271, 318.23),
        token(0.9601, 0.014, 318.7),
        token(0.9303, 0.0153, 315.96),
        token(0.8999, 0.0154, 315.96),
        token(0.61, 0.0838, 351.32),
        token(0.6192, 0.1904, 352.38),
        token(0.5996, 0.1359, 337.26),
        token(0.4606, 0.2126, 296.73),
        token(0.5209, 0.1527, 269.5),
        token(0.5502, 0.2052, 32.59),
        token(0.6205, 0.2209, 22.17),
        token(0.6701, 0.2162, 36.73),
        token(0.7201, 0.1185, 94.02),
        token(0.5796, 0.1255, 131.7),
        token(0.5802, 0.1279, 161.67),
        token(0.5914, 0.1108, 223.73),
        token(0.5505, 0.115, 242.88),
        token(0.4789, 0.1775, 260.99),
    ],
};

const dark: CardTheme = {
    paper: token(0.2403, 0.0221, 319.46),
    ink: token(0.8802, 0.0344, 316.88),
    inkMuted: token(0.8203, 0.0333, 316.4),
    inkSubtle: token(0.6791, 0.0282, 316.09),
    accent: token(0.8299, 0.1129, 309.27),
    accentAlt: token(0.8809, 0.071, 355.06),
    secondary: token(0.8396, 0.083, 213.39),
    palette: [
        token(0.8802, 0.0344, 316.88),
        token(0.8203, 0.0333, 316.4),
        token(0.7509, 0.034, 316.39),
        token(0.6791, 0.0282, 316.09),
        token(0.6095, 0.0289, 316.07),
        token(0.54, 0.0279, 315.37),
        token(0.4692, 0.0275, 317.06),
        token(0.3997, 0.0286, 317.03),
        token(0.319, 0.0287, 318.94),
        token(0.2403, 0.0221, 319.46),
        token(0.209, 0.0221, 315.64),
        token(0.1818, 0.0211, 318.63),
        token(0.8809, 0.071, 355.06),
        token(0.8395, 0.1106, 345.69),
        token(0.7794, 0.1475, 352.59),
        token(0.8299, 0.1129, 309.27),
        token(0.77, 0.1004, 268.27),
        token(0.7596, 0.144, 30.02),
        token(0.8102, 0.1122, 6.59),
        token(0.8405, 0.118, 66.23),
        token(0.8603, 0.1515, 84.55),
        token(0.8499, 0.1713, 119.5),
        token(0.8102, 0.0996, 169.08),
        token(0.8396, 0.083, 213.39),
        token(0.79, 0.1135, 227.14),
        token(0.7398, 0.1362, 255.56),
    ],
};

export const CARD_THEMES = { light, dark } as const;
export type CardFlavor = keyof typeof CARD_THEMES;
