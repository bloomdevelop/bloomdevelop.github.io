export interface SiteSettings {
	/**
	 * Whether the edge progressive-blur effect is rendered. Defaults to off
	 * because `backdrop-filter` + `mask` compositing glitches on non-Chromium
	 * browsers. Opt in from the Settings dialog.
	 */
	progressiveBlur: boolean;
}

const STORAGE_KEY = "bloom.settings";

const DEFAULT_SETTINGS: SiteSettings = {
	progressiveBlur: false,
};

export function loadSettings(): SiteSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<SiteSettings>;
		return { ...DEFAULT_SETTINGS, ...parsed };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings: SiteSettings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore (private mode / storage quota)
	}
}

export function applyProgressiveBlur(enabled: boolean): void {
	const root = document.documentElement;
	if (enabled) {
		root.dataset.progressiveBlur = "on";
	} else {
		delete root.dataset.progressiveBlur;
	}
}
