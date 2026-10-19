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

## Shipping widget

The dark Shipping card, full width right after the fuckup counter (Why section), shows this week's days with activity, an 18-week heatmap and the two latest commits, with an All / GitHub / GitLab switch. The page loads it from `/api/shipping` (`src/shipping.js`), which reads public pages only, so no tokens are involved:

- GitHub: daily counts from the contribution calendar at github.com/users/mikdudko/contributions, recent commits from the activity feed at github.com/mikdudko.atom (public repos only).
- GitLab: daily counts from gitlab.com/users/dudko.mikalai/calendar.json. Work there is in private projects, so it only shows up when "Include private contributions on my profile" is on in GitLab's profile settings, and only as counts.

Responses are cached for an hour (5 minutes if a source failed). If nothing loads, the card stays hidden.

## Analytics

Umami Cloud only (no cookies, so no consent banner); dashboard at cloud.umami.is. The script tag sits in the `<head>` of both pages and only runs on dudko.me and www.dudko.me, so local previews aren't counted. To leave your own visits out, run `localStorage.setItem('umami.disabled', 1)` once in each browser you use.

To track a click, give the element `data-track="event-name"` and, if useful, `data-track-<prop>="value"`. Events that need values known only at click time call `track()` in `app.js`; `trackOnce()` sends an event at most once per visit. Every event carries `lang=en|ru`. Untagged links that leave the site are still caught as `outbound` with `to=<host>` (or `mailto`).

| Event | When | Properties |
|---|---|---|
| `section-view` | a section reaches the middle of the screen for the first time | `section` |
| `dock` | a click in the bottom dock | `to` |
| `explore` | the hero's "Explore the journey" link | |
| `lang-switch` | the EN/RU switch | `to` |
| `journey-open` | a wallet card is opened | `card` |
| `pitch-type` | a pitch chip is picked | `type` |
| `pitch-start` | first typing in the pitch form (once per visit) | `type` |
| `pitch-send` | the pitch form is sent | `type`, `result=sent\|failed` |
| `pitch-fallback` | a fallback after a failed send | `via=mailto\|gmail\|copy` |
| `pitch-again` | "Send another" | |
| `follow-start` | first typing in the follow email (once per visit) | |
| `follow-email` | the follow form is sent | `topics`, `result=sent\|failed` |
| `follow-fallback` | the email link after a failed follow | |
| `fail-open`, `fails-show-all` | the fuckup log | `n` |
| `clicker-tap` | the "I failed" clicker (once per visit) | |
| `carousel-swipe` | the people carousel is swiped (once per visit) | |
| `shipping-source`, `shipping-commit` | the Shipping widget | `src`, `repo` |
| `copy-email`, `contact`, `social`, `nodly-link`, `try-nodly`, `refer-hr`, `project-link` | contact and outbound links | `where`, `via`, `to` |
| `outbound` | any other link leaving the site | `to` |

Useful funnels in Umami: `section-view` (journey) → `pitch-start` → `pitch-send` (sent), and `section-view` (life) → `follow-start` → `follow-email` (sent).

## Layout

- `public/` the live site
  - `index.html` English (`/`), `ru/index.html` Russian (`/ru/`). Same markup, different text: change both together.
  - `styles.css` and `app.js` are shared. All visible text lives in the HTML, including email subjects (`data-*` attributes).
- `src/worker.js` the form API (see Forms)
- `drafts/` design drafts (v2 = the Apple-style artifact version, not live)
- `references/` design references, git-ignored
