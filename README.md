# Mikalai Dudko, personal site

Static site, no build step. Everything in `public/` is what goes live.

## Deploy

Cloudflare Workers (static assets), connected to this GitHub repo (`mikdudko/dudko.me`). `wrangler.jsonc` tells Cloudflare to serve `public/`.

- Build command: none (leave empty)
- Deploy command: `npx wrangler deploy`

Every push to `main` deploys. Other branches get preview URLs.

## Analytics

Umami Cloud (no cookies, so no consent banner); dashboard at cloud.umami.is. The script tag sits in the `<head>` of both pages and only runs on dudko.me and www.dudko.me, so local previews aren't counted.

To track a click, give the element `data-track="event-name"` and, if useful, `data-track-<prop>="value"`. Events that need values known only at click time call `track()` in `app.js`.

## Layout

- `public/` the live site
  - `index.html` English (`/`), `ru/index.html` Russian (`/ru/`). Same markup, different text: change both together.
  - `styles.css` and `app.js` are shared. All visible text lives in the HTML, including email subjects (`data-*` attributes).
- `drafts/` design drafts (v2 = the Apple-style artifact version, not live)
- `references/` design references, git-ignored
