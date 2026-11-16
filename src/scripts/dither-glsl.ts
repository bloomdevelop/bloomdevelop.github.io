/*
 * GLSL snippets shared by the image ditherer (scripts/dither.ts) and the
 * weather background (scripts/weather/background.ts).
 *
 * Keep these in sync with the JavaScript implementations in dither-core.ts:
 * the Bayer matrix and OKLab conversion must produce the same values on the
 * CPU (Open Graph cards) and the GPU (the site).
 */

/** Procedural 8x8 Bayer matrix, values in [0, 1). */
export const BAYER_GLSL = /* glsl */ `
// Procedural 8x8 Bayer matrix, values in [0, 1).
float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`;

/** sRGB (0-1 per channel) to OKLab, matching `toOklab()` in dither-core.ts. */
export const OKLAB_GLSL = /* glsl */ `
vec3 toOklab(vec3 c) {
    c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 1.0 / 3.0);
    float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 1.0 / 3.0);
    float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 1.0 / 3.0);
    return vec3(
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    );
}
`;
