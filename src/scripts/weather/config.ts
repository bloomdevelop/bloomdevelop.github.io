/*
 * The one place to configure the weather background.
 *
 * Change `location` to any city (decimal degrees + IANA time zone) and the
 * effect follows it on every page. No API key is needed: current weather comes
 * from Open-Meteo's public API.
 *
 * The render settings are deliberately conservative. The canvas is one pixel
 * per dither cell, so `maxCols`/`maxRows` cap the fragment work regardless of
 * screen size. Keep `minCellCss` at 3 or more; larger cells are cheaper and
 * match the chunky dither look of the image component.
 */

export interface WeatherLocation {
    /** Human-readable label, used for documentation only. */
    name: string;
    /** Decimal degrees, -90 to 90. */
    latitude: number;
    /** Decimal degrees, -180 to 180. */
    longitude: number;
    /** IANA time zone, used for the fallback day/night scene. */
    timeZone: string;
}

export interface WeatherRenderConfig {
    /** Maximum dither cells across; caps GPU fragment work. */
    maxCols: number;
    /** Maximum dither cells down. */
    maxRows: number;
    /** Smallest dither cell in CSS pixels (larger = cheaper + chunkier). */
    minCellCss: number;
    /** Animated frames per second while the tab is visible. */
    fps: number;
    /** Fallback frame rate after the runtime quality step-down. */
    lowFps: number;
    /** Graphics-safe paper wash over the whole scene, day / night. */
    washDay: number;
    washNight: number;
    /** Extra wash behind the reading column, day / night. */
    corridorDay: number;
    corridorNight: number;
    /** Extra wash under the navigation, 0-1. */
    topWash: number;
    /** Bayer amplitude before palette matching, day / night. */
    spreadDay: number;
    spreadNight: number;
    /** Minimum WCAG contrast for every rendered palette entry. */
    clampTarget: number;
}

export interface WeatherConfig {
    /** Set false to remove the effect entirely (flat paper background). */
    enabled: boolean;
    location: WeatherLocation;
    /** Minutes a cached sample stays fresh. */
    refreshMinutes: number;
    /** Minutes a cached sample may still be drawn while revalidating. */
    staleMinutes: number;
    /** Network timeout for the weather request, in milliseconds. */
    timeoutMs: number;
    render: WeatherRenderConfig;
}

export const WEATHER_CONFIG: WeatherConfig = {
    enabled: true,
    location: {
        name: 'Santo Domingo, Dominican Republic',
        latitude: 18.4861,
        longitude: -69.9312,
        timeZone: 'America/Santo_Domingo',
    },
    refreshMinutes: 30,
    staleMinutes: 360,
    timeoutMs: 4000,
    render: {
        maxCols: 420,
        maxRows: 280,
        minCellCss: 4,
        fps: 20,
        lowFps: 12,
        washDay: 0.015,
        washNight: 0.02,
        corridorDay: 0.04,
        corridorNight: 0.03,
        topWash: 0.05,
        spreadDay: 0.024,
        spreadNight: 0.028,
        clampTarget: 4.6,
    },
};

const finite = (value: number): boolean => Number.isFinite(value);

const validTimeZone = (timeZone: string): boolean => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
        return true;
    } catch {
        return false;
    }
};

const fail = (message: string): never => {
    throw new Error(`weather config: ${message}`);
};

const validateLocation = (location: WeatherLocation): void => {
    if (!location.name.trim()) fail('location.name must not be empty');
    if (!finite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
        fail('location.latitude must be between -90 and 90');
    }
    if (!finite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
        fail('location.longitude must be between -180 and 180');
    }
    if (!validTimeZone(location.timeZone)) fail('location.timeZone must be a valid IANA zone');
};

const validateTiming = (config: WeatherConfig): void => {
    if (!finite(config.refreshMinutes) || config.refreshMinutes <= 0) {
        fail('refreshMinutes must be positive');
    }
    if (!finite(config.staleMinutes) || config.staleMinutes < config.refreshMinutes) {
        fail('staleMinutes must be at least refreshMinutes');
    }
    if (!finite(config.timeoutMs) || config.timeoutMs < 500 || config.timeoutMs > 15_000) {
        fail('timeoutMs must be between 500 and 15000');
    }
};

const validateRender = (render: WeatherRenderConfig): void => {
    if (render.minCellCss < 2 || render.minCellCss > 16) {
        fail('render.minCellCss must be between 2 and 16');
    }
    if (render.maxCols < 64 || render.maxCols > 1024) {
        fail('render.maxCols must be between 64 and 1024');
    }
    if (render.maxRows < 64 || render.maxRows > 1024) {
        fail('render.maxRows must be between 64 and 1024');
    }
    if (render.fps < 5 || render.fps > 30) fail('render.fps must be between 5 and 30');
    if (render.lowFps < 5 || render.lowFps > render.fps) {
        fail('render.lowFps must be between 5 and fps');
    }

    const washes = [
        render.washDay,
        render.washNight,
        render.corridorDay,
        render.corridorNight,
        render.topWash,
    ];
    if (
        render.clampTarget < 4.5 ||
        render.clampTarget > 12 ||
        !washes.every((value) => finite(value) && value >= 0 && value <= 0.3)
    ) {
        fail('render wash and contrast values are out of range');
    }

    if (
        ![render.spreadDay, render.spreadNight].every(
            (value) => finite(value) && value > 0 && value <= 0.25,
        )
    ) {
        fail('render dither spread must be between 0 and 0.25');
    }
};

/** Throws at build time when the editable config is out of range. */
export const assertValidWeatherConfig = (config: WeatherConfig = WEATHER_CONFIG): void => {
    validateLocation(config.location);
    validateTiming(config);
    validateRender(config.render);
};
