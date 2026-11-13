/*
 * Page metadata handed to the Open Graph integration.
 *
 * Astro renders pages (and can do so in parallel workers), so the registry
 * lives on globalThis. That way every copy of this module in the process -
 * the Vite module graph for pages and the plain Node module used by the
 * integration - sees the same Map.
 */

import { ogSlug } from './config';

export interface OgEntry {
    /** Route pathname, e.g. `/blog/pond/`. */
    pathname: string;
    /** Page title without the site suffix. */
    title: string;
    description?: string;
    /** Source image used as the card background (Astro image `src`). */
    image?: string;
    /** ISO date shown on article cards. */
    date?: string;
    kind?: 'website' | 'article';
    /** Site name shown in the card header. */
    siteName?: string;
}

type RegistryScope = typeof globalThis & {
    bloomOgRegistry?: Map<string, OgEntry>;
};

const scope = globalThis as RegistryScope;

export const ogRegistry: Map<string, OgEntry> = (scope.bloomOgRegistry ??= new Map());

/** Registers (or replaces) the metadata for a page by its slug. */
export const registerOg = (entry: OgEntry): void => {
    ogRegistry.set(ogSlug(entry.pathname), entry);
};
