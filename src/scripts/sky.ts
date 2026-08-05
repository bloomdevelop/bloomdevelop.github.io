const SKY_ORDER = ["night", "sunrise", "noon", "sunset"] as const;
type Sky = (typeof SKY_ORDER)[number];

// Hourly mapping of local time to a sky theme. Pick the times that best
// describe the locale the site is viewed in.
const HOURLY_SKY: Sky[] = [
	...new Array<Sky>(6).fill("night"), // 00:00–05:59
	...new Array<Sky>(3).fill("sunrise"), // 06:00–08:59
	...new Array<Sky>(8).fill("noon"), // 09:00–16:59
	...new Array<Sky>(3).fill("sunset"), // 17:00–19:59
	...new Array<Sky>(4).fill("night"), // 20:00–23:59
];

export function initSky() {
	document.documentElement.dataset.sky = HOURLY_SKY[new Date().getHours()];
}
