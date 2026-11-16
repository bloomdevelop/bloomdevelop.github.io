/*
 * Global WebGL weather background.
 *
 * One custom element, one WebGL1 context, one program, one quad. The canvas
 * backing store is exactly one pixel per dither cell (at most 420x280), so the
 * fragment cost is bounded independently of the screen's DPR; CSS upscales it
 * with `image-rendering: pixelated`. The shader draws a paper-based ink-wash
 * sky and snaps every cell to the same contrast-clamped, sixteen-step palette,
 * matching the look of <dither-image>.
 *
 * Weather data is cached in localStorage and refreshed in the background; the
 * CSS fallback is visible before the first frame and whenever WebGL is
 * unavailable. Animation stops when the tab is hidden, and reduced-motion /
 * reduced-data / high-contrast visitors get a single static frame.
 */

import { WEATHER_CONFIG, type WeatherConfig } from './config';
import { buildSceneSpec, fallbackSnapshot } from './wmo';
import { fetchWeather } from './api';
import { getLocalStorage, readWeatherCache, writeWeatherCache, type StorageLike } from './cache';
import { resolveTokens } from './palette';
import {
    buildFrame,
    crossfadeFrames,
    flashEnvelope,
    WEATHER_PALETTE_SIZE,
    type WeatherFrame,
} from './scene';
import { BAYER_GLSL, OKLAB_GLSL } from '../dither-glsl';
import type { TokenSet, WeatherSceneSpec, WeatherSnapshot } from './types';

const CROSSFADE_MS = 1200;
const RESIZE_DEBOUNCE_MS = 150;
const FRAME_BUDGET_MS = 2000;
const MIN_FRAGMENT_UNIFORM_VECTORS = 52;

const VERTEX_SHADER = /* glsl */ `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uAspect;
uniform float uPhase;
uniform float uBreathe;

uniform vec3 uPaper;
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyBottom;
uniform vec3 uCloudColor;
uniform vec3 uHazeColor;
uniform vec3 uPrecipColor;
uniform vec3 uMarkColor;

uniform vec4 uCloud;   // cover, sharpness, scaleX, scaleY
uniform vec4 uMotion;  // drift, slant, glow, glowRadius
uniform vec4 uSky;     // markX, markY, markRadius, stars
uniform vec4 uWeather; // fog, precip, precipMode, flash
uniform vec4 uRead;    // wash, corridor, topWash, spread

uniform vec3 uPalette[${WEATHER_PALETTE_SIZE}];
uniform vec3 uPaletteLab[${WEATHER_PALETTE_SIZE}];

${BAYER_GLSL}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm3(vec2 p) {
    return 0.55 * vnoise(p)
         + 0.30 * vnoise(p * 2.07 + 13.7)
         + 0.15 * vnoise(p * 4.11 + 41.3);
}

float rainLayer(vec2 uv, float phase, float density) {
    vec2 p = uv;
    p.x += p.y * uMotion.y;
    p.y -= uTime * 0.9 + phase;
    vec2 q = p * vec2(46.0, 9.0);
    vec2 id = floor(q);
    vec2 f = fract(q);
    float h = hash21(id);
    float on = step(1.0 - density, h);
    float dash = smoothstep(0.0, 0.18, f.y) * (1.0 - smoothstep(0.45, 0.95, f.y));
    float thin = 1.0 - smoothstep(0.0, 0.18, abs(f.x - 0.5));
    return on * dash * thin;
}

float snowLayer(vec2 uv, float phase, float density) {
    vec2 p = uv;
    p.x += p.y * uMotion.y * 0.35;
    p.y -= uTime * 0.35 + phase;
    vec2 q = p * vec2(34.0, 24.0);
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash21(id);
    float on = step(1.0 - density, h);
    return on * (1.0 - smoothstep(0.08, 0.30, length(f)));
}

${OKLAB_GLSL}

vec3 nearestPalette(vec3 color) {
    vec3 lab = toOklab(clamp(color, 0.0, 1.0));
    vec3 best = uPalette[0];
    float bestDistance = 1e9;
    for (int i = 0; i < ${WEATHER_PALETTE_SIZE}; i++) {
        vec3 delta = uPaletteLab[i] - lab;
        float distance = dot(delta, delta);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = uPalette[i];
        }
    }
    return best;
}

void main() {
    // Top-left origin so the Bayer grid is anchored to the top of the page.
    vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 uv = frag / uResolution;
    vec2 cell = floor(frag);

    // Sky gradient.
    vec3 scene = mix(uSkyTop, uSkyMid, smoothstep(0.0, 0.55, uv.y));
    scene = mix(scene, uSkyBottom, smoothstep(0.55, 1.0, uv.y));

    // Three-octave cloud field, drifting and slightly shaded. Clear skies skip
    // the noise entirely; the branch is uniform, so it stays coherent.
    float cloud = 0.0;
    if (uCloud.x > 0.03) {
        vec2 cloudP =
            uv * vec2(uCloud.z, uCloud.w) +
            vec2(uTime * uMotion.x, uTime * uMotion.x * 0.35);
        float cloudNoise = fbm3(cloudP);
        float threshold = mix(0.88, 0.16, uCloud.x);
        cloud = smoothstep(threshold, threshold + uCloud.y, cloudNoise);
        cloud *= smoothstep(0.0, 0.05, uCloud.x);
        cloud *= 1.0 - smoothstep(0.42, 0.92, uv.y);
        float shade = vnoise(cloudP * 0.47 + 9.2);
        scene = mix(scene, mix(uCloudColor, uSkyTop, 0.70 * shade), cloud * 0.65);
    }

    // Sun or moon: a soft halo plus a small solid disk.
    vec2 glowP = (uv - vec2(uSky.x, uSky.y)) * vec2(uAspect, 1.0);
    float glowD = length(glowP);
    float visible =
        uMotion.z *
        (1.0 - 0.6 * cloud) *
        (0.92 + 0.08 * sin(uTime * 0.5));
    scene = mix(scene, uMarkColor, exp(-(glowD * glowD) / (uMotion.w * uMotion.w)) * 0.16 * visible);
    scene = mix(scene, uMarkColor, (1.0 - smoothstep(uSky.z * 0.55, uSky.z, glowD)) * visible);

    // Fog band around the lower third; skipped when there is no fog.
    if (uWeather.x > 0.001) {
        float fogY = (uv.y - 0.72) / 0.22;
        float fogBand = exp(-fogY * fogY);
        float fogNoise =
            0.55 + 0.45 * vnoise(vec2(uv.x * 2.2 + uTime * uMotion.x * 0.4, uv.y * 3.0));
        scene = mix(scene, uHazeColor, uWeather.x * fogBand * fogNoise);
    }

    // Precipitation. Uniform branches stay coherent for every pixel in a frame.
    if (uWeather.z > 1.5) {
        float snow = snowLayer(uv, 0.0, 0.16 + 0.28 * uWeather.y);
        snow += snowLayer(uv + vec2(0.31, 0.17), 0.5, 0.10 + 0.18 * uWeather.y);
        scene = mix(scene, uPrecipColor, clamp(snow, 0.0, 1.0) * 0.85);
    } else if (uWeather.z > 0.5) {
        float rain = rainLayer(uv, 0.0, 0.18 + 0.30 * uWeather.y);
        rain += rainLayer(uv + vec2(0.23, 0.41), 0.37, 0.10 + 0.18 * uWeather.y);
        scene = mix(scene, uPrecipColor, clamp(rain, 0.0, 1.0) * 0.75);
    }

    // Stars only when the scene asks for them (clear/mainly-clear nights).
    if (uSky.w > 0.5) {
        vec2 starP = uv * vec2(90.0, 55.0);
        vec2 starCell = floor(starP);
        float starHash = hash21(starCell);
        float star = step(0.993, starHash)
                   * (1.0 - smoothstep(0.0, 0.18, length(fract(starP) - 0.5)));
        star *= 1.0 - smoothstep(0.42, 0.58, uv.y);
        float twinkle = 0.75 + 0.25 * sin(uTime * 0.9 + starHash * 6.2831);
        scene = mix(scene, uMarkColor, star * 0.65 * twinkle);
    }

    // CPU-timed lightning envelope.
    scene = mix(scene, uMarkColor, uWeather.w * mix(0.35, 0.75, cloud));

    // Readability wash: a little toward paper everywhere, a little more behind
    // the reading column and under the navigation. Cosmetic only; the palette
    // clamp is the actual contrast guarantee.
    float corridor = 1.0 - smoothstep(0.28, 0.50, abs(uv.x - 0.5));
    float topCalm = 1.0 - smoothstep(0.0, 0.14, uv.y);
    scene = mix(scene, uPaper, clamp(uRead.x + uRead.y * corridor + uRead.z * topCalm, 0.0, 0.30));

    // A slow ink-wash shimmer keeps even cloudless scenes alive. It only moves
    // the scene between palette entries; the contrast guard still applies.
    float shimmer = vnoise(uv * vec2(1.8, 1.3) + vec2(uTime * 0.03, -uTime * 0.022));
    scene += (shimmer - 0.5) * 0.022;

    // Ordered dither, then snap to the palette. A little per-cell jitter breaks
    // up the regular Bayer grid on wide, flat gradients without turning the
    // output stochastic; the phase walk still animates it slowly.
    float threshold = bayer8(cell + vec2(uPhase)) - 0.5;
    float jitter = hash21(cell + vec2(uPhase * 13.0, uPhase * 7.0)) - 0.5;
    float noise = mix(threshold, jitter, 0.35);
    gl_FragColor = vec4(nearestPalette(scene + noise * uRead.w * uBreathe), 1.0);
}
`;

interface NetworkInformation {
    saveData?: boolean;
}

const mediaQuery = (value: string): MediaQueryList => window.matchMedia(value);

const createShader = (
    gl: WebGLRenderingContext,
    type: number,
    source: string,
): WebGLShader | null => {
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
};

const createProgram = (gl: WebGLRenderingContext): WebGLProgram | null => {
    const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return null;

    // The DOM lib types createProgram as non-null, but WebGL returns null when
    // resources are exhausted; widen it so the failure path stays guarded.
    const program = gl.createProgram() as WebGLProgram | null;
    if (!program) return null;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
};

class WeatherBackground extends HTMLElement {
    readonly #config: WeatherConfig = WEATHER_CONFIG;

    #canvas: HTMLCanvasElement | null = null;
    #gl: WebGLRenderingContext | null = null;
    #program: WebGLProgram | null = null;
    #uniforms = new Map<string, WebGLUniformLocation | null>();

    #tokens: TokenSet | null = null;
    #spec: WeatherSceneSpec | null = null;
    #frame: WeatherFrame | null = null;
    #fadeFrom: WeatherFrame | null = null;
    #fadeTo: WeatherFrame | null = null;
    #fadeStart = 0;
    #fading = false;
    #seed = 0;
    /** Last frame whose static uniforms were uploaded; avoids per-frame work. */
    #uploadedFrame: WeatherFrame | null = null;

    #storage: StorageLike | null = null;
    #fetchController: AbortController | null = null;
    #warned = false;

    #cols = 0;
    #rows = 0;
    #cellBoost = 0;
    #fps: number = WEATHER_CONFIG.render.fps;
    #clock = 0;
    #lastTick = 0;
    #accumulator = 0;

    #raf = 0;
    #resizeTimer = 0;
    #refreshTimer = 0;
    #glReady = false;
    #connected = false;

    #degradeStep = 0;
    #slowWindows = 0;
    #windowStart = 0;
    #windowFrames = 0;
    #windowSlow = 0;

    #media: MediaQueryList[] = [];
    #reducedMotion: MediaQueryList | null = null;
    #reducedData: MediaQueryList | null = null;
    #prefersContrast: MediaQueryList | null = null;
    #forcedColors: MediaQueryList | null = null;

    #themeObserver: MutationObserver | null = null;
    #resizeObserver: ResizeObserver | null = null;

    connectedCallback(): void {
        if (!this.#config.enabled || this.#connected) return;
        this.#connected = true;

        this.setAttribute('aria-hidden', 'true');
        this.#storage = getLocalStorage();
        this.#setupMedia();

        const cached = readWeatherCache(this.#storage, this.#config.location, Date.now(), {
            refreshMinutes: this.#config.refreshMinutes,
            staleMinutes: this.#config.staleMinutes,
        });

        if (cached) {
            this.#applySnapshot(cached.snapshot, false);
        } else {
            this.#applySnapshot(
                fallbackSnapshot(this.#config.location.timeZone, Date.now()),
                false,
            );
        }

        this.#setupObservers();
        this.#scheduleIdle(this.#initGl);

        if (!cached || cached.status === 'stale') {
            this.#scheduleIdle(() => {
                void this.#refresh();
            });
        }

        this.#refreshTimer = window.setInterval(() => {
            if (!document.hidden) void this.#refresh();
        }, this.#config.refreshMinutes * 60_000);
    }

    disconnectedCallback(): void {
        this.#connected = false;
        this.#stopLoop();

        window.clearTimeout(this.#resizeTimer);
        window.clearInterval(this.#refreshTimer);
        this.#fetchController?.abort();
        this.#fetchController = null;

        this.#themeObserver?.disconnect();
        this.#resizeObserver?.disconnect();
        this.#themeObserver = null;
        this.#resizeObserver = null;

        for (const media of this.#media) {
            media.removeEventListener('change', this.#onMediaChange);
        }
        this.#media = [];

        document.removeEventListener('visibilitychange', this.#onVisibility);
        window.removeEventListener('pagehide', this.#onPageHide);
        window.removeEventListener('pageshow', this.#onPageShow);
        window.removeEventListener('online', this.#onOnline);

        this.#destroyGl();
    }

    /* ---------------------------------------------------------------------
     * Setup
     * ------------------------------------------------------------------- */

    #setupMedia(): void {
        this.#reducedMotion = mediaQuery('(prefers-reduced-motion: reduce)');
        this.#reducedData = mediaQuery('(prefers-reduced-data: reduce)');
        this.#prefersContrast = mediaQuery('(prefers-contrast: more)');
        this.#forcedColors = mediaQuery('(forced-colors: active)');

        this.#media = [
            this.#reducedMotion,
            this.#reducedData,
            this.#prefersContrast,
            this.#forcedColors,
        ];
        for (const media of this.#media) {
            media.addEventListener('change', this.#onMediaChange);
        }
    }

    #setupObservers(): void {
        this.#themeObserver = new MutationObserver(this.#onThemeChange);
        this.#themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-madoromi', 'class', 'style'],
        });

        this.#resizeObserver = new ResizeObserver(this.#onResize);
        this.#resizeObserver.observe(this);

        document.addEventListener('visibilitychange', this.#onVisibility);
        window.addEventListener('pagehide', this.#onPageHide);
        window.addEventListener('pageshow', this.#onPageShow);
        window.addEventListener('online', this.#onOnline);
    }

    #scheduleIdle(callback: () => void): void {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => callback(), { timeout: 800 });
        } else {
            window.setTimeout(callback, 1);
        }
    }

    /* ---------------------------------------------------------------------
     * WebGL
     * ------------------------------------------------------------------- */

    #initGl = (): void => {
        if (!this.#connected || this.#glReady || this.#isSuppressed()) return;

        this.#tokens ??= resolveTokens();
        if (!this.#tokens) {
            this.#setState('fallback');
            return;
        }

        if (!this.#canvas) {
            const canvas = document.createElement('canvas');
            canvas.className = 'wb-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.addEventListener('webglcontextlost', this.#onContextLost);
            canvas.addEventListener('webglcontextrestored', this.#onContextRestored);
            this.append(canvas);
            this.#canvas = canvas;
        }

        const gl =
            this.#gl ??
            this.#canvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                powerPreference: 'low-power',
                failIfMajorPerformanceCaveat: true,
            });

        if (!gl || gl.isContextLost()) {
            this.#failGl();
            return;
        }

        const vectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        if (typeof vectors === 'number' && vectors < MIN_FRAGMENT_UNIFORM_VECTORS) {
            this.#failGl();
            return;
        }

        const program = createProgram(gl);
        if (!program) {
            this.#failGl();
            return;
        }

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

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);

        this.#gl = gl;
        this.#program = program;
        this.#uniforms.clear();
        this.#uploadedFrame = null;
        this.#glReady = true;
        this.#cols = 0;
        this.#rows = 0;

        this.#layout(true);
        this.#setState('ready');
        this.#syncPlayback();
    };

    #failGl(): void {
        this.#glReady = false;
        this.#stopLoop();
        this.#canvas?.remove();
        this.#canvas = null;
        this.#gl = null;
        this.#program = null;
        this.#uniforms.clear();
        this.#uploadedFrame = null;
        this.#setState('fallback');
    }

    #destroyGl(): void {
        if (this.#canvas) {
            this.#canvas.removeEventListener('webglcontextlost', this.#onContextLost);
            this.#canvas.removeEventListener('webglcontextrestored', this.#onContextRestored);
        }

        const canvas = this.#canvas;
        const gl = this.#gl;

        this.#glReady = false;
        this.#gl = null;
        this.#program = null;
        this.#uniforms.clear();
        this.#uploadedFrame = null;
        this.#canvas = null;

        if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas?.remove();
    }

    #uniform(name: string): WebGLUniformLocation | null {
        if (!this.#uniforms.has(name) && this.#gl && this.#program) {
            this.#uniforms.set(name, this.#gl.getUniformLocation(this.#program, name));
        }
        return this.#uniforms.get(name) ?? null;
    }

    /* ---------------------------------------------------------------------
     * Sizing and painting
     * ------------------------------------------------------------------- */

    #layout(force = false): void {
        const gl = this.#gl;
        const canvas = this.#canvas;
        if (!gl || !canvas || !this.#glReady) return;

        const width = Math.max(1, this.clientWidth || window.innerWidth || 1);
        const height = Math.max(1, this.clientHeight || window.innerHeight || 1);
        const render = this.#config.render;
        const cell = Math.max(
            render.minCellCss + this.#cellBoost,
            Math.ceil(width / render.maxCols),
            Math.ceil(height / render.maxRows),
        );
        const cols = Math.max(1, Math.ceil(width / cell));
        const rows = Math.max(1, Math.ceil(height / cell));

        if (!force && cols === this.#cols && rows === this.#rows) return;

        this.#cols = cols;
        this.#rows = rows;
        canvas.width = cols;
        canvas.height = rows;
        gl.viewport(0, 0, cols, rows);

        this.#drawFrame(this.#motionAllowed());
    }

    #drawFrame(animate: boolean): void {
        const gl = this.#gl;
        if (!gl || !this.#glReady || !this.#frame) return;

        let frame = this.#frame;

        if (this.#fading && this.#fadeFrom && this.#fadeTo) {
            const progress = Math.min(1, (performance.now() - this.#fadeStart) / CROSSFADE_MS);
            const eased = progress * progress * (3 - 2 * progress);
            frame = crossfadeFrames(this.#fadeFrom, this.#fadeTo, eased);

            if (progress >= 1) {
                this.#frame = this.#fadeTo;
                this.#fading = false;
                this.#fadeFrom = null;
                this.#fadeTo = null;
            }
        }

        this.#upload(frame, animate);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (this.dataset.state !== 'ready') this.#setState('ready');
    }

    #upload(frame: WeatherFrame, animate: boolean): void {
        const gl = this.#gl;
        if (!gl) return;

        const moving = animate && this.#motionAllowed();
        const time = moving ? this.#clock : 0;
        // Walk the Bayer matrix one cell per second and breathe the amplitude
        // over roughly fourteen seconds. Both stop for reduced motion.
        const phase = moving ? Math.floor(this.#clock) % 8 : 0;
        const breathe = moving ? 0.75 + 0.25 * Math.sin(this.#clock * 0.45) : 1;
        const flash =
            moving && this.#spec?.lightning ? flashEnvelope(this.#clock, this.#seed, true) : 0;

        gl.uniform2f(this.#uniform('uResolution'), this.#cols, this.#rows);
        gl.uniform1f(this.#uniform('uTime'), time);
        gl.uniform1f(this.#uniform('uAspect'), this.#cols / Math.max(1, this.#rows));
        gl.uniform1f(this.#uniform('uPhase'), phase);
        gl.uniform1f(this.#uniform('uBreathe'), breathe);

        // The palette and scene colours change only when the weather, theme or
        // fade step changes; during steady animation only time/flash update.
        if (frame !== this.#uploadedFrame) {
            gl.uniform3fv(this.#uniform('uPaper'), frame.paper);
            gl.uniform3fv(this.#uniform('uSkyTop'), frame.skyTop);
            gl.uniform3fv(this.#uniform('uSkyMid'), frame.skyMid);
            gl.uniform3fv(this.#uniform('uSkyBottom'), frame.skyBottom);
            gl.uniform3fv(this.#uniform('uCloudColor'), frame.cloudColor);
            gl.uniform3fv(this.#uniform('uHazeColor'), frame.hazeColor);
            gl.uniform3fv(this.#uniform('uPrecipColor'), frame.precipColor);
            gl.uniform3fv(this.#uniform('uMarkColor'), frame.markColor);

            gl.uniform4fv(this.#uniform('uCloud'), frame.cloud);
            gl.uniform4fv(this.#uniform('uMotion'), frame.motion);
            gl.uniform4fv(this.#uniform('uSky'), frame.sky);
            gl.uniform4fv(this.#uniform('uRead'), frame.read);
            gl.uniform3fv(this.#uniform('uPalette'), frame.paletteFlat);
            gl.uniform3fv(this.#uniform('uPaletteLab'), frame.paletteLabFlat);

            this.#uploadedFrame = frame;
        }

        gl.uniform4f(
            this.#uniform('uWeather'),
            frame.weather[0],
            frame.weather[1],
            frame.weather[2],
            flash,
        );
    }

    #renderNow(): void {
        if (!this.#glReady) return;
        this.#drawFrame(this.#motionAllowed());
    }

    /* ---------------------------------------------------------------------
     * Animation loop
     * ------------------------------------------------------------------- */

    #startLoop(): void {
        if (
            this.#raf !== 0 ||
            !this.#glReady ||
            !this.#connected ||
            document.hidden ||
            !this.#motionAllowed()
        ) {
            return;
        }

        this.#lastTick = 0;
        this.#accumulator = 0;
        this.#raf = requestAnimationFrame(this.#tick);
    }

    #stopLoop(): void {
        cancelAnimationFrame(this.#raf);
        this.#raf = 0;
    }

    #tick = (now: number): void => {
        this.#raf = 0;

        if (!this.#connected || !this.#glReady || document.hidden || !this.#motionAllowed()) {
            return;
        }

        this.#raf = requestAnimationFrame(this.#tick);

        const last = this.#lastTick === 0 ? now : this.#lastTick;
        this.#lastTick = now;

        const delta = Math.min(250, Math.max(0, now - last));
        this.#accumulator += delta;

        const interval = 1000 / this.#fps;
        const steps = Math.floor(this.#accumulator / interval);
        if (steps < 1) return;

        this.#accumulator -= steps * interval;
        this.#clock += (steps * interval) / 1000;
        this.#drawFrame(true);
        this.#monitor(now, delta);
    };

    #monitor(now: number, delta: number): void {
        if (this.#degradeStep >= 2) return;

        const interval = 1000 / this.#fps;
        if (this.#windowStart === 0) this.#windowStart = now;
        this.#windowFrames++;
        if (delta > interval * 1.8) this.#windowSlow++;

        if (now - this.#windowStart < FRAME_BUDGET_MS) return;

        const ratio = this.#windowSlow / Math.max(1, this.#windowFrames);
        if (ratio > 0.2) {
            this.#slowWindows++;
            if (this.#slowWindows >= 2) this.#degrade();
        } else {
            this.#slowWindows = 0;
        }

        this.#windowStart = now;
        this.#windowFrames = 0;
        this.#windowSlow = 0;
    }

    #degrade(): void {
        if (this.#degradeStep === 0) {
            this.#degradeStep = 1;
            this.#cellBoost = 1;
            this.#slowWindows = 0;
            this.#layout(true);
            return;
        }

        this.#degradeStep = 2;
        this.#slowWindows = 0;
        this.#fps = this.#config.render.lowFps;
    }

    #syncPlayback(): void {
        if (!this.#connected) return;

        if (this.#isSuppressed()) {
            this.#stopLoop();
            return;
        }

        if (!this.#glReady) {
            this.#scheduleIdle(this.#initGl);
            return;
        }

        if (this.#motionAllowed()) {
            this.#startLoop();
            return;
        }

        this.#stopLoop();

        // Reduced motion: finish any fade immediately and paint one static frame.
        if (this.#fading && this.#fadeTo) {
            this.#frame = this.#fadeTo;
            this.#fading = false;
            this.#fadeFrom = null;
            this.#fadeTo = null;
        }
        this.#renderNow();
    }

    #motionAllowed(): boolean {
        return (
            !this.#isSuppressed() && this.#reducedMotion?.matches !== true && !this.#isReducedData()
        );
    }

    #isSuppressed(): boolean {
        return this.#prefersContrast?.matches === true || this.#forcedColors?.matches === true;
    }

    #isReducedData(): boolean {
        const connection = (navigator as Navigator & { connection?: NetworkInformation })
            .connection;
        return this.#reducedData?.matches === true || connection?.saveData === true;
    }

    /* ---------------------------------------------------------------------
     * Weather state
     * ------------------------------------------------------------------- */

    #applySnapshot(snapshot: WeatherSnapshot, fade: boolean): void {
        this.#spec = buildSceneSpec(snapshot);
        this.#seed = snapshot.weatherCode * 7 + (Math.floor(snapshot.fetchedAt / 60_000) % 997);
        this.dataset.weather = this.#spec.family;
        this.dataset.daylight = this.#spec.isDay ? 'day' : 'night';
        this.#rebuildFrame(fade);
    }

    #rebuildFrame(fade: boolean): void {
        if (!this.#tokens || !this.#spec) return;

        const frame = buildFrame(this.#tokens, this.#spec, this.#config.render);

        if (fade && this.#frame && this.#glReady && this.#motionAllowed()) {
            this.#fadeFrom = this.#frame;
            this.#fadeTo = frame;
            this.#fadeStart = performance.now();
            this.#fading = true;
            this.#startLoop();
            return;
        }

        this.#frame = frame;
        this.#fading = false;
        this.#fadeFrom = null;
        this.#fadeTo = null;
        this.#renderNow();
    }

    async #refresh(): Promise<void> {
        if (!this.#connected || this.#fetchController || this.#isReducedData()) return;

        const controller = new AbortController();
        this.#fetchController = controller;

        try {
            const snapshot = await fetchWeather(this.#config.location, {
                signal: controller.signal,
                timeoutMs: this.#config.timeoutMs,
                now: Date.now,
            });

            // The element may have disconnected while the request was in flight.
            if (!this.#isActive()) return;

            writeWeatherCache(this.#storage, this.#config.location, snapshot);
            this.#applySnapshot(snapshot, true);
        } catch (error) {
            if (controller.signal.aborted) return;
            if (!this.#warned) {
                this.#warned = true;
                console.warn('weather background: could not refresh weather', error);
            }
        } finally {
            if (this.#fetchController === controller) this.#fetchController = null;
        }
    }

    #isActive(): boolean {
        return this.#connected;
    }

    #refreshIfStale(): void {
        if (!this.#connected || this.#isReducedData()) return;

        const cached = readWeatherCache(this.#storage, this.#config.location, Date.now(), {
            refreshMinutes: this.#config.refreshMinutes,
            staleMinutes: this.#config.staleMinutes,
        });

        if (!cached || cached.status === 'stale') void this.#refresh();
    }

    /* ---------------------------------------------------------------------
     * Events
     * ------------------------------------------------------------------- */

    #onThemeChange = (): void => {
        const tokens = resolveTokens();
        if (!tokens) {
            this.#tokens = null;
            this.#stopLoop();
            this.#setState('fallback');
            return;
        }

        this.#tokens = tokens;
        // Theme flips snap: an intermediate light/dark background would sit
        // between the two ink ranges and could fail contrast.
        this.#rebuildFrame(false);

        if (!this.#glReady) this.#scheduleIdle(this.#initGl);
    };

    #onResize = (): void => {
        window.clearTimeout(this.#resizeTimer);
        this.#resizeTimer = window.setTimeout(() => {
            if (this.#connected) this.#layout();
        }, RESIZE_DEBOUNCE_MS);
    };

    #onMediaChange = (): void => {
        this.#syncPlayback();
    };

    #onVisibility = (): void => {
        if (document.hidden) {
            this.#stopLoop();
            this.#fetchController?.abort();
            this.#fetchController = null;
            return;
        }

        this.#lastTick = 0;
        this.#accumulator = 0;
        this.#refreshIfStale();
        this.#syncPlayback();
    };

    #onPageHide = (): void => {
        this.#stopLoop();
        this.#fetchController?.abort();
        this.#fetchController = null;
    };

    #onPageShow = (event: PageTransitionEvent): void => {
        if (!event.persisted || !this.#connected) return;

        this.#lastTick = 0;
        this.#accumulator = 0;
        this.#refreshIfStale();

        if (this.#glReady) {
            this.#renderNow();
            this.#syncPlayback();
        } else {
            this.#scheduleIdle(this.#initGl);
        }
    };

    #onOnline = (): void => {
        this.#refreshIfStale();
    };

    #onContextLost = (event: Event): void => {
        event.preventDefault();
        this.#stopLoop();
        this.#glReady = false;
        this.#setState('fallback');
    };

    #onContextRestored = (): void => {
        if (!this.#connected) return;
        this.#setState('idle');
        this.#initGl();
    };

    #setState(state: 'idle' | 'ready' | 'fallback'): void {
        if (this.dataset.state !== state) this.dataset.state = state;
    }
}

export const defineWeatherBackground = (): void => {
    if (!customElements.get('weather-background')) {
        customElements.define('weather-background', WeatherBackground);
    }
};
