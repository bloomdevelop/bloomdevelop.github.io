/*
 * WebGL ordered-dithering for images.
 *
 * Based on https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
 *
 *  1. Pixelization   - snap the sampling coordinates to a coarse grid.
 *  2. Ordered dither - offset each cell by an 8x8 Bayer threshold.
 *  3. Quantization   - snap the result to N levels, either per colour channel
 *                      ("color"), on luminance mapped to a ramp ("palette"), or
 *                      to the nearest colour of a full palette in OKLab ("match").
 *
 * Usage (see components/astro/dithered-image.astro):
 *
 *   <dither-image data-mode="palette" data-pixel-size="3" data-levels="4" data-palette='["#000","#fff"]'>
 *       <img src="..." />
 *   </dither-image>
 */

const MAX_PALETTE = 32;

const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uImage;
uniform vec2 uResolution;   // canvas size in device pixels
uniform vec2 uImageSize;    // source image size in pixels
uniform float uPixel;       // cell size in device pixels
uniform float uLevels;      // quantization levels per channel
uniform float uStrength;    // dither strength, 0 = plain quantization
uniform float uContrast;
uniform float uSpread;      // dither amplitude for the nearest-colour mode
uniform float uMode;        // 0 = per-channel colour, 1 = luminance ramp, 2 = nearest colour
uniform float uPaletteSize;
uniform vec3 uPalette[${MAX_PALETTE}];
uniform vec3 uPaletteLab[${MAX_PALETTE}];

// Procedural 8x8 Bayer matrix, values in [0, 1).
float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

// Samples the image as if it were drawn with object-fit: cover.
vec3 sampleCover(vec2 p) {
    float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
    vec2 drawn = uImageSize * scale;
    vec2 uv = (p - (uResolution - drawn) * 0.5) / drawn;
    return texture2D(uImage, clamp(uv, 0.0, 1.0)).rgb;
}

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

vec3 nearestColor(vec3 c) {
    vec3 lab = toOklab(c);
    vec3 result = uPalette[0];
    float best = 1e9;
    for (int i = 0; i < ${MAX_PALETTE}; i++) {
        if (float(i) < uPaletteSize) {
            vec3 d = uPaletteLab[i] - lab;
            float dist = dot(d, d);
            if (dist < best) {
                best = dist;
                result = uPalette[i];
            }
        }
    }
    return result;
}

vec3 paletteColor(float t) {
    float pos = clamp(t, 0.0, 1.0) * (uPaletteSize - 1.0);
    vec3 color = uPalette[0];
    for (int i = 1; i < ${MAX_PALETTE}; i++) {
        if (float(i) < uPaletteSize) {
            color = mix(color, uPalette[i], clamp(pos - float(i - 1), 0.0, 1.0));
        }
    }
    return color;
}

void main() {
    // Top-left origin so the grid is anchored to the top of the header.
    vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

    vec2 cell = floor(frag / uPixel);
    vec2 center = (cell + 0.5) * uPixel;

    // Box filter over the cell so high-frequency detail doesn't alias.
    float o = uPixel * 0.25;
    vec3 color = (
        sampleCover(center + vec2(-o, -o)) +
        sampleCover(center + vec2( o, -o)) +
        sampleCover(center + vec2(-o,  o)) +
        sampleCover(center + vec2( o,  o))
    ) * 0.25;

    float steps = uLevels - 1.0;
    float noise = bayer8(cell) - 0.5;
    float threshold = noise * uStrength / steps;

    if (uMode > 1.5) {
        color = (color - 0.5) * uContrast + 0.5;
        color = nearestColor(clamp(color + noise * uStrength * uSpread, 0.0, 1.0));
    } else if (uMode < 0.5) {
        color = (color - 0.5) * uContrast + 0.5;
        color = floor((color + threshold) * steps + 0.5) / steps;
    } else {
        float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
        lum = (lum - 0.5) * uContrast + 0.5;
        lum = floor((lum + threshold) * steps + 0.5) / steps;
        color = paletteColor(lum);
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

type Rgb = [number, number, number];

const DEFAULT_PALETTE = ['#000000', '#ffffff'];

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGLRenderingContext) {
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs) return null;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const toOklab = ([r, g, b]: Rgb): Rgb => {
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

class DitherImage extends HTMLElement {
    #canvas = document.createElement('canvas');
    #gl: WebGLRenderingContext | null = null;
    #program: WebGLProgram | null = null;
    #uniforms = new Map<string, WebGLUniformLocation | null>();
    #palette: Rgb[] = [];
    #paletteLab: Rgb[] = [];
    #colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    #resizeObserver: ResizeObserver | null = null;
    #themeObserver: MutationObserver | null = null;
    #frame = 0;
    #connected = false;

    connectedCallback() {
        this.#connected = true;

        const img = this.querySelector('img');
        if (!img) return;

        this.#canvas.setAttribute('aria-hidden', 'true');
        this.#canvas.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .4s ease';
        this.append(this.#canvas);

        this.#canvas.addEventListener('webglcontextlost', this.#onContextLost);
        this.#canvas.addEventListener('webglcontextrestored', this.#onContextRestored);

        this.#resizeObserver = new ResizeObserver(() => this.#schedule());
        this.#resizeObserver.observe(this);

        // Palette colours may be theme variables; re-resolve when the theme flips.
        this.#themeObserver = new MutationObserver(this.#onThemeChange);
        this.#themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-madoromi', 'class', 'style'],
        });
        this.#colorScheme.addEventListener('change', this.#onThemeChange);

        void this.#load(img);
    }

    disconnectedCallback() {
        this.#connected = false;
        cancelAnimationFrame(this.#frame);
        this.#resizeObserver?.disconnect();
        this.#themeObserver?.disconnect();
        this.#colorScheme.removeEventListener('change', this.#onThemeChange);
        this.#canvas.removeEventListener('webglcontextlost', this.#onContextLost);
        this.#canvas.removeEventListener('webglcontextrestored', this.#onContextRestored);
        this.#canvas.remove();
        this.#gl?.getExtension('WEBGL_lose_context')?.loseContext();
        this.#gl = null;
        this.#program = null;
    }

    get #img() {
        return this.querySelector('img');
    }

    #num(name: string, fallback: number) {
        const value = Number.parseFloat(this.dataset[name] ?? '');
        return Number.isFinite(value) ? value : fallback;
    }

    async #load(img: HTMLImageElement) {
        try {
            await img.decode();
        } catch {
            // Fall back to the plain <img> if it can't be decoded.
            return;
        }
        if (!this.#connected) return;

        this.#resolvePalette();
        if (!this.#init()) return;
        this.#schedule();
    }

    #init() {
        const img = this.#img;
        if (!img) return false;

        const gl = this.#canvas.getContext('webgl', {
            antialias: false,
            alpha: false,
            depth: false,
            stencil: false,
        });
        if (!gl) return false;

        const program = createProgram(gl);
        if (!program) return false;

        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );
        const position = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        // NPOT-safe texture setup: no mipmaps, clamped, linear filtering.
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

        this.#gl = gl;
        this.#program = program;
        this.#uniforms.clear();
        return true;
    }

    #uniform(name: string) {
        if (!this.#uniforms.has(name) && this.#gl && this.#program) {
            this.#uniforms.set(name, this.#gl.getUniformLocation(this.#program, name));
        }
        return this.#uniforms.get(name) ?? null;
    }

    #resolvePalette() {
        let colors: string[] = DEFAULT_PALETTE;
        try {
            const parsed: unknown = JSON.parse(this.dataset.palette ?? 'null');
            if (Array.isArray(parsed) && parsed.length >= 2) {
                colors = parsed.slice(0, MAX_PALETTE).map(String);
            }
        } catch {
            // keep default
        }

        const probe = document.createElement('span');
        probe.style.display = 'none';
        this.append(probe);

        const ctx = document.createElement('canvas').getContext('2d', {
            willReadFrequently: true,
        });
        const resolved: Rgb[] = colors.map((value) => {
            if (!ctx) return [0, 0, 0];
            probe.style.color = value;
            ctx.fillStyle = '#000';
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = getComputedStyle(probe).color;
            ctx.fillRect(0, 0, 1, 1);
            const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
            return [r / 255, g / 255, b / 255];
        });
        probe.remove();

        // The luminance ramp needs dark -> light so the image reads correctly
        // whatever the theme; nearest-colour matching is order-independent.
        this.#palette =
            this.dataset.mode === 'palette'
                ? resolved.toSorted((a, b) => luma(a) - luma(b))
                : resolved;
        this.#paletteLab = this.#palette.map(toOklab);
    }

    #schedule() {
        if (!this.#gl) return;
        cancelAnimationFrame(this.#frame);
        this.#frame = requestAnimationFrame(() => this.#draw());
    }

    #draw() {
        const gl = this.#gl;
        const img = this.#img;
        if (!gl || !img || gl.isContextLost()) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(this.clientWidth * dpr));
        const height = Math.max(1, Math.round(this.clientHeight * dpr));
        if (this.#canvas.width !== width || this.#canvas.height !== height) {
            this.#canvas.width = width;
            this.#canvas.height = height;
        }
        gl.viewport(0, 0, width, height);

        const mode = this.dataset.mode === 'color' ? 0 : this.dataset.mode === 'palette' ? 1 : 2;
        const paletteSize = this.#palette.length;
        const levels = Math.max(2, Math.round(this.#num('levels', mode === 1 ? paletteSize : 4)));

        gl.uniform2f(this.#uniform('uResolution'), width, height);
        gl.uniform2f(this.#uniform('uImageSize'), img.naturalWidth, img.naturalHeight);
        gl.uniform1f(this.#uniform('uPixel'), Math.max(1, this.#num('pixelSize', 3) * dpr));
        gl.uniform1f(this.#uniform('uLevels'), levels);
        gl.uniform1f(this.#uniform('uStrength'), this.#num('strength', 1));
        gl.uniform1f(this.#uniform('uContrast'), this.#num('contrast', 1));
        gl.uniform1f(this.#uniform('uSpread'), this.#num('spread', 0.2));
        gl.uniform1f(this.#uniform('uMode'), mode);
        gl.uniform1f(this.#uniform('uPaletteSize'), paletteSize);
        gl.uniform3fv(this.#uniform('uPalette'), this.#palette.flat());
        gl.uniform3fv(this.#uniform('uPaletteLab'), this.#paletteLab.flat());

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Reveal the canvas on first paint; the <img> stays underneath as a fallback.
        this.#canvas.style.opacity = '1';
    }

    #onThemeChange = () => {
        this.#resolvePalette();
        this.#schedule();
    };

    #onContextLost = (event: Event) => {
        event.preventDefault();
        this.#canvas.style.opacity = '0';
    };

    #onContextRestored = () => {
        if (this.#init()) this.#schedule();
    };
}

export function defineDitherImage() {
    if (!customElements.get('dither-image')) {
        customElements.define('dither-image', DitherImage);
    }
}
