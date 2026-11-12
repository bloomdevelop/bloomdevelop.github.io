const STORAGE_KEY = 'madoromi';
const LIGHT = 'haru-hiru';
const DARK = 'haru-yoru';

type Flavour = typeof LIGHT | typeof DARK;

const storedFlavour = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
};

export function initTheme() {
    const root = document.documentElement;
    const button = document.getElementById('theme-toggle');
    const meta = document.querySelector('meta[name="theme-color"]');
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');

    const currentFlavour = (): Flavour => (root.dataset.madoromi === DARK ? DARK : LIGHT);

    const applyFlavour = (flavour: Flavour) => {
        const dark = flavour === DARK;
        root.dataset.madoromi = flavour;
        button?.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        button?.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
        meta?.setAttribute('content', dark ? '#241c26' : '#f6eff8');
    };

    // The inline head script already chose a flavour; sync the label and colours.
    applyFlavour(currentFlavour());

    button?.addEventListener('click', () => {
        const next = currentFlavour() === DARK ? LIGHT : DARK;
        applyFlavour(next);

        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage can be unavailable; the choice still applies to this page.
        }
    });

    systemPreference.addEventListener('change', (event) => {
        // An explicit choice always wins over the operating system.
        if (storedFlavour()) return;
        applyFlavour(event.matches ? DARK : LIGHT);
    });
}
