# Mikalai Dudko, personal site

Static site, no build step. Everything in `public/` is what goes live.

## Deploy

Cloudflare Pages, connected to this GitLab repo:

- Production branch: `main`
- Build command: none (leave empty)
- Build output directory: `public`

Every push to `main` deploys. Other branches get preview URLs.

## Layout

- `public/` the live site
- `drafts/` design drafts (v2 = the Apple-style artifact version, not live)
- `references/` design references, git-ignored
