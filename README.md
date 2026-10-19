# Mikalai Dudko, personal site

Static site, no build step. Everything in `public/` is what goes live, plus one small Worker (`src/worker.js`) behind the pitch and follow forms.

## Deploy

Cloudflare Workers (static assets), connected to this GitHub repo (`mikdudko/dudko.me`). `wrangler.jsonc` tells Cloudflare to serve `public/` and run `src/worker.js` for anything that isn't a file.

- Build command: none (leave empty)
- Deploy command: `npx wrangler deploy`

Every push to `main` deploys. Other branches get preview URLs.

## Forms

The pitch form and the follow form post to `/api/pitch` and `/api/follow`. The Worker emails each one to dudko.mikalai@gmail.com from `forms@dudko.me`, with the visitor's email as reply-to when they gave one. If the send fails, the pitch form offers the visitor's email app, Gmail or copying the text, and the follow form shows a prefilled email link.

This depends on Cloudflare Email Routing being on for dudko.me with dudko.mikalai@gmail.com verified as a destination address. Sends to a verified destination are free on every plan. The `EMAIL` binding is locked to that one address, and a rate limit (5 posts a minute per IP) plus a hidden honeypot field keep bots out.

Local run: `npx wrangler dev` (needs Node). The email binding is simulated locally: nothing is sent, and wrangler prints where it saved each message.

## Analytics

Umami Cloud (no cookies, so no consent banner); dashboard at cloud.umami.is. The script tag sits in the `<head>` of both pages and only runs on dudko.me and www.dudko.me, so local previews aren't counted.

DataFast runs next to it with its cookieless script (`script.cookieless.js`). Its dashboard has "Cookieless / privacy mode" switched on, and the two must match: switching the mode off means swapping in `/js/script.js` and adding a cookie banner.

To track a click, give the element `data-track="event-name"` and, if useful, `data-track-<prop>="value"`. Events that need values known only at click time call `track()` in `app.js`. Form events (`pitch-send`, `follow-email`) carry `result=sent|failed`; clicks on the pitch fallbacks are `pitch-fallback` with `via=mailto|gmail|copy`.

## Layout

- `public/` the live site
  - `index.html` English (`/`), `ru/index.html` Russian (`/ru/`). Same markup, different text: change both together.
  - `styles.css` and `app.js` are shared. All visible text lives in the HTML, including email subjects (`data-*` attributes).
- `src/worker.js` the form API (see Forms)
- `drafts/` design drafts (v2 = the Apple-style artifact version, not live)
- `references/` design references, git-ignored
