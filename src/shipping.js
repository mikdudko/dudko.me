// Data for the Shipping widget: daily contribution counts from GitHub and GitLab for the last
// 18 weeks, plus the latest public GitHub commits. Everything comes from public pages, so there are
// no tokens, and work in private repos only ever shows up as a count. Cached for an hour.
const GITHUB_USER = 'mikdudko';
const GITLAB_USER = 'dudko.mikalai';
const WEEKS = 18;
const HEADERS = { 'User-Agent': 'dudko.me shipping widget (https://dudko.me)' };

const isoDate = d => d.toISOString().slice(0, 10);
// "Today" is Warsaw's date, so the week rolls over at local midnight.
const warsawToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');

const get = async url => {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res;
};

// GitHub's public contribution calendar: each day is a <td data-date id> described by a
// <tool-tip for=id> that reads "5 contributions on ..." or "No contributions on ...".
const githubDays = async () => {
  const html = await (await get(`https://github.com/users/${GITHUB_USER}/contributions`)).text();
  const dates = {};
  for (const [tag] of html.matchAll(/<td\b[^>]*\bdata-date="[^"]+"[^>]*>/g)) {
    const id = tag.match(/\bid="([^"]+)"/);
    if (id) dates[id[1]] = tag.match(/\bdata-date="([^"]+)"/)[1];
  }
  const days = {};
  for (const [, id, text] of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)/g)) {
    if (!dates[id]) continue;
    const n = text.trim().match(/^(\d[\d,]*) contribution/);
    days[dates[id]] = n ? Number(n[1].replace(/,/g, '')) : 0;
  }
  if (!Object.keys(days).length) throw new Error('github contributions: no days parsed');
  return days;
};

// GitLab's calendar is already { "YYYY-MM-DD": count }. It counts private work only when
// "Include private contributions on my profile" is on in GitLab's profile settings.
const gitlabDays = async () => (await get(`https://gitlab.com/users/${GITLAB_USER}/calendar.json`)).json();

// The public activity feed lists recent pushes with their commits. The REST API would be neater,
// but unauthenticated calls from Workers' shared IPs run into its rate limit.
const githubCommits = async () => {
  const xml = await (await get(`https://github.com/${GITHUB_USER}.atom`)).text();
  const commits = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    if (!/<id>[^<]*:push\//.test(entry)) continue;
    const updated = entry.match(/<updated>([^<]+)<\/updated>/);
    const at = updated ? new Date(updated[1].replace(' UTC', 'Z').replace(' ', 'T')).toISOString() : null;
    const content = decode((entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '');
    for (const [, repo, sha, quote] of content.matchAll(/href="\/([^/"]+\/[^/"]+)\/commit\/([0-9a-f]{7,40})"[\s\S]*?<blockquote>([\s\S]*?)<\/blockquote>/g)) {
      const msg = decode(quote.replace(/<[^>]+>/g, '')).trim().split('\n')[0].slice(0, 200);
      if (!msg) continue;
      commits.push({
        src: 'github',
        repo: repo.startsWith(`${GITHUB_USER}/`) ? repo.slice(GITHUB_USER.length + 1) : repo,
        msg,
        at,
        url: `https://github.com/${repo}/commit/${sha}`,
      });
    }
  }
  return commits.slice(0, 5);
};

const build = async () => {
  const today = warsawToday();
  // Weeks start on Monday; the last column is the current week, including days still ahead.
  const t = new Date(`${today}T00:00:00Z`);
  const start = new Date(t);
  start.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) - (WEEKS - 1) * 7);
  const dates = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return isoDate(d);
  });
  const [gh, gl, commits] = await Promise.allSettled([githubDays(), gitlabDays(), githubCommits()]);
  for (const r of [gh, gl, commits]) if (r.status === 'rejected') console.error('shipping source failed', r.reason && r.reason.message);
  const series = r => (r.status === 'fulfilled' ? dates.map(d => Number(r.value[d]) || 0) : null);
  return {
    data: {
      today,
      start: dates[0],
      github: series(gh),
      gitlab: series(gl),
      commits: commits.status === 'fulfilled' ? commits.value : [],
    },
    complete: [gh, gl, commits].every(r => r.status === 'fulfilled'),
  };
};

export const shipping = async (request, ctx) => {
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  const key = new Request(new URL('/api/shipping', request.url).href);
  const cached = await caches.default.match(key);
  if (cached) return cached;
  const { data, complete } = await build();
  // A source that failed is retried after 5 minutes instead of an hour.
  const res = Response.json(data, { headers: { 'Cache-Control': `public, max-age=${complete ? 3600 : 300}` } });
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
};
