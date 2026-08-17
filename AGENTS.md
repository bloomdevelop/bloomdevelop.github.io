# AGENTS.md

## Development

- pnpm only (enforced via `preinstall`), Node >= 22.12. Use `pnpm` — never npm/yarn.
- Start the dev server in background mode (`astro dev --background`) and manage it with `astro dev stop`, `astro dev status`, and `astro dev logs`. Server runs at http://localhost:4321.

## Verification

There are no test or lint scripts in `package.json`. Before finishing a change:

1. `pnpm astro check` — typecheck (Astro + `@astrojs/check`)
2. `pnpm build` — production build
3. `pnpm biome check` — lint + format (tabs, double quotes, organize imports on save)

Biome only processes `**/*.ts` and `**/*.css` (see `biome.json` includes). Astro/Vue files are not linted — match surrounding style manually.

## Architecture

- **Vue islands only.** `astro.config.mjs` registers only the `vue()` integration (used by `*.vue` in `src/components/`: nav-menu, compose, oauth-dialog, migration-dialog). `solid-js`/`@astrojs/solid-js` in `package.json` are stale dependencies — do not add Solid components.
- **Two near-duplicate layouts**: `src/layouts/base-layout.astro` (index + blog pages) and `spa-layout.astro` (only `dni.md`; adds sky animation + hourly page reload). Head/footer/font changes must be applied to both.
- **Styling**: plain CSS in `src/css/` with design tokens in `colors.css`; UI components are styled via `data-component="..."` attribute selectors in `src/css/components/` (not classes). No Tailwind.
- Fonts come from the Astro `fonts` config (fontsource, CSS vars `--inter`, `--maple-mono`, `--material-symbols-rounded`). `base-layout.astro` preloads all three; `spa-layout.astro` preloads only two.
- Blog posts: markdown in `src/blog/` with frontmatter (`title` + `pubDate` required; `description`/`tags`/`draft` optional). Drafts still render, with a warning banner.

## ATProto micro-logging (the "Logs" section)

- Log entries are records on a Bluesky PDS under the custom lexicon `space.bunniesin.log.entry` (old namespace `space.bunniesin.micro.log`; `src/scripts/migration.ts` + `migration-dialog.vue` handle the rename).
- `src/scripts/consts.ts` is the single source of truth for who can post (`ALLOWED_DIDS`) and where logs are read from (`DEFAULT_PREVIEW_DID` / `DEFAULT_PREVIEW_PDS`).
- Logs are fetched at build time and embedded as a snapshot (`#logs-initial` in `logs.astro`), then re-synced client-side every 60s. If the PDS is unreachable at build time, the logs section renders an error alert but the build still succeeds.
- OAuth scopes in `src/scripts/oauth.ts` must match `public/oauth-client-metadata.json` (only valid on the production origin). Keep the two in sync when changing scopes.

## Deployment

- GitHub Actions (`.github/workflows/astro.yml`) builds and deploys to GitHub Pages on push to **`master`** only.
- CI passes `--site`/`--base` flags from `configure-pages`; local `pnpm build` needs no such flags.
- The OAuth flow and log writes only work fully on the deployed site or on `localhost`/`127.0.0.1` (dev uses an ephemeral localhost client ID).

## Documentation

Full docs: https://docs.astro.build — consult the [routing](https://docs.astro.build/en/guides/routing/), [content collections](https://docs.astro.build/en/guides/content-collections/), and [framework components](https://docs.astro.build/en/guides/framework-components/) guides when working in those areas.