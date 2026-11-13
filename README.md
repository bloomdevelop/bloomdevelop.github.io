# bloomdevelop.github.io

This is the repository for the bloomdevelop.github.io website.

## Developing

### Standard.site

The blog publishes [standard.site](https://standard.site/docs/introduction/)
records so publications and posts are discoverable across the AT Protocol.

- The publication lives at
  `at://did:plc:rqpfcwwpcadmlnqxuncywcif/site.standard.publication/3n25ohzpk2222`
  and is verified by
  [`public/.well-known/site.standard.publication`](./public/.well-known/site.standard.publication).
- Every non-draft post becomes a `site.standard.document` record. Its rkey is a
  TID derived from the slug and publish date, and its path matches the canonical
  URL. Changing either value creates a new record rather than moving the old one.
- Page `<head>`s expose `rel="site.standard.publication"` and, on posts,
  `rel="site.standard.document"` discovery links.

#### Publishing records

Records must be created from the account that owns the publication. Use an
[app password](https://bsky.app/settings/app-passwords), not your main password:

```sh
ATPROTO_IDENTIFIER=spring.furrest.net \
ATPROTO_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
pnpm publish:standard-site
```

Preview the records without signing in:

```sh
pnpm publish:standard-site --dry-run
```

The script publishes the publication and all non-draft documents with
`com.atproto.repo.putRecord`, so re-running it updates them in place. If
`ATPROTO_PDS` is set it overrides PDS discovery.

#### Automated publishing

[`publish-standard-site.yml`](./.github/workflows/publish-standard-site.yml)
runs on pushes that change the blog, and can also be triggered manually. Add
`ATPROTO_IDENTIFIER` and `ATPROTO_APP_PASSWORD` as repository secrets; without
the app password the workflow skips publishing.

### Open Graph cards

Every page gets a generated 1200x630 `og:image` — and, when ffmpeg is
available, a looping dithered `og:video` — from
[`src/integrations/og`](./src/integrations/og/README.md). Pages with a header
image use it as the dithered backdrop; pages without one get a procedural
backdrop.
