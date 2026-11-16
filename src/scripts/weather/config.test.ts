import { describe, expect, it } from 'vite-plus/test';
import { WEATHER_CONFIG, assertValidWeatherConfig, type WeatherConfig } from './config';

const mutableConfig = (): WeatherConfig => structuredClone(WEATHER_CONFIG);

describe('assertValidWeatherConfig', () => {
    it('accepts the shipped config', () => {
        expect(() => assertValidWeatherConfig(WEATHER_CONFIG)).not.toThrow();
    });

    it('rejects out-of-range and malformed locations', () => {
        const latitude = mutableConfig();
        latitude.location.latitude = 91;
        expect(() => assertValidWeatherConfig(latitude)).toThrow(/weather config/);

        const longitude = mutableConfig();
        longitude.location.longitude = -181;
        expect(() => assertValidWeatherConfig(longitude)).toThrow(/weather config/);

        const name = mutableConfig();
        name.location.name = '   ';
        expect(() => assertValidWeatherConfig(name)).toThrow(/weather config/);

        const zone = mutableConfig();
        zone.location.timeZone = 'Mars/Olympus';
        expect(() => assertValidWeatherConfig(zone)).toThrow(/weather config/);
    });

    it('rejects invalid timing and render budgets', () => {
        const refresh = mutableConfig();
        refresh.refreshMinutes = 0;
        expect(() => assertValidWeatherConfig(refresh)).toThrow(/weather config/);

        const stale = mutableConfig();
        stale.staleMinutes = 1;
        expect(() => assertValidWeatherConfig(stale)).toThrow(/weather config/);

        const timeout = mutableConfig();
        timeout.timeoutMs = 100;
        expect(() => assertValidWeatherConfig(timeout)).toThrow(/weather config/);

        const cell = mutableConfig();
        cell.render.minCellCss = 1;
        expect(() => assertValidWeatherConfig(cell)).toThrow(/weather config/);

        const cols = mutableConfig();
        cols.render.maxCols = 1;
        expect(() => assertValidWeatherConfig(cols)).toThrow(/weather config/);

        const fps = mutableConfig();
        fps.render.fps = 60;
        expect(() => assertValidWeatherConfig(fps)).toThrow(/weather config/);

        const lowFps = mutableConfig();
        lowFps.render.lowFps = 40;
        expect(() => assertValidWeatherConfig(lowFps)).toThrow(/weather config/);

        const contrast = mutableConfig();
        contrast.render.clampTarget = 3;
        expect(() => assertValidWeatherConfig(contrast)).toThrow(/weather config/);

        const spread = mutableConfig();
        spread.render.spreadDay = 0.5;
        expect(() => assertValidWeatherConfig(spread)).toThrow(/weather config/);
    });
});
