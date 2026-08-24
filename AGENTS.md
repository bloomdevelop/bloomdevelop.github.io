# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project overview

Personal website (`bloomdevelop.github.io`) built with Astro 7 and deployed to GitHub Pages. It contains a blog and a micro-logging feature ("Logs") that reads and writes records on a Bluesky PDS via ATProto.

## Development

- Use pnpm exclusively. The `preinstall` script enforces this (`npx only-allow pnpm`), so `npm install` and `yarn` fail. Requires Node >= 22.12.
- Start the dev server with `pnpm astro dev --background`. Manage it with `pnpm astro dev stop`, `pnpm astro dev status`, and `pnpm astro dev logs`. The server runs at http://localhost:4321.

## Verification

There are no test or lint scripts in `package.json`, so do not look for `pnpm test`. Before finishing any change, run all three of these checks:

1. `pnpm astro check` — typecheck (Astro + `@astrojs/check`)
2. `pnpm build` — production build
3. `pnpm biome check` — lint + format check

Biome enforces tabs, double quotes, and organized imports, but it only processes `**/*.ts` and `**/*.css` (see `biome.json`). Astro and Vue files are not covered by any formatter or linter, so match the surrounding style manually.

## Comments

Do not overcomment. Write code that explains itself and add comments only when they are required: non-obvious rationale, workarounds, gotchas, or external constraints (for example, why a `@ts-expect-error` is needed, or why two steps must run in a specific order). Never narrate what obvious code does, and never leave comments describing your changes.

## Architecture

- **Vue islands only.** `astro.config.mjs` registers only the Vue integration. Interactive components are `.vue` files in `src/components/`: nav-menu, compose, oauth-dialog, migration-dialog, settings-dialog. Do not add Solid components — `solid-js` and `@astrojs/solid-js` are stale dependencies left in `package.json`.
- **Two near-duplicate layouts.** `src/layouts/base-layout.astro` is used by the index and blog pages. `src/layouts/spa-layout.astro` is used only by `src/pages/dni.md`. Apply any head, footer, or font change to both layouts.
- **Plain CSS, no Tailwind.** Styles live in `src/css/`, with design tokens in `colors.css`. UI components are styled through `data-component="..."` attribute selectors in `src/css/components/`, not through class names. Follow this pattern for new components.
- **Fonts** are configured in `astro.config.mjs` (fontsource provider) and exposed as CSS variables `--inter`, `--maple-mono`, and `--material-symbols-rounded`. `base-layout.astro` preloads all three; `spa-layout.astro` preloads only two.
- **Blog posts** are Markdown files in `src/blog/`. The schema in `src/content.config.ts` requires `title` and `pubDate` frontmatter; `description`, `tags`, and `draft` are optional. Drafts are hidden in production builds and render only in development, behind a warning banner.

## ATProto micro-logging (the "Logs" section)

- Log entries are records on a Bluesky PDS under the custom lexicon `space.bunniesin.log.entry`. The old namespace `space.bunniesin.micro.log` was renamed; `src/scripts/migration.ts` and `migration-dialog.vue` handle migrating old records.
- `src/scripts/consts.ts` is the single source of truth for who may post (`ALLOWED_DIDS`) and which account/PDS the logs are read from (`DEFAULT_PREVIEW_DID` / `DEFAULT_PREVIEW_PDS`).
- At build time, logs are fetched from the PDS and embedded as a snapshot (`#logs-initial` in `logs.astro`); client-side code then re-syncs every 60 seconds. If the PDS is unreachable at build time, the section renders an error alert but the build must still succeed — preserve that behavior.
- `OAUTH_SCOPES` in `src/scripts/oauth.ts` must exactly match the `scope` field in `public/oauth-client-metadata.json`. When changing scopes, update both files together. The metadata file is only valid on the production origin.

## Deployment

- GitHub Actions (`.github/workflows/astro.yml`) builds and deploys to GitHub Pages on pushes to `master` only. This is the only deploy path.
- CI passes `--site` and `--base` flags obtained from `actions/configure-pages`. A local `pnpm build` needs neither flag.
- The OAuth flow and log writes work fully only on the production origin or on `localhost`/`127.0.0.1`; local development uses an ephemeral localhost client ID (see `clientID()` in `src/scripts/oauth.ts`).

## Other instruction files

`CLAUDE.md` is a symlink to this file. Edit this file instead of creating a separate copy.

## Documentation

Astro docs: https://docs.astro.build — consult the [routing](https://docs.astro.build/en/guides/routing/), [content collections](https://docs.astro.build/en/guides/content-collections/), and [framework components](https://docs.astro.build/en/guides/framework-components/) guides when working in those areas.
