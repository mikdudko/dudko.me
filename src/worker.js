// The API behind the pitch and follow forms. Files in public/ are served before this Worker runs,
// so it only sees requests that matched no file: /api/pitch, /api/follow and 404s.
// Both forms email Mikalai through Cloudflare Email Routing; the EMAIL binding in wrangler.jsonc
// can only ever send to his address.
const TO = 'dudko.mikalai@gmail.com';
const FROM = { email: 'forms@dudko.me', name: 'dudko.me' };
const PITCH_TYPES = ['problem', 'idea', 'collab', 'coffee'];
const TOPICS = { log: 'Weekly build log', fails: 'Fuckup stories', pm: 'PM insights' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status, data) => Response.json(data, { status });
const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const oneLine = s => s.replace(/\s+/g, ' ');

const send = async (env, message) => {
  try {
    await env.EMAIL.send({ from: FROM, to: TO, ...message });
    return json(200, { ok: true });
  } catch (e) {
    console.error('email send failed', e.code, e.message);
    return json(502, { error: 'send_failed' });
  }
};

const pitch = (env, data, page) => {
  const text = str(data.text, 4000);
  const contact = str(data.contact, 200);
  if (text.length < 3 || contact.length < 3) return json(400, { error: 'invalid' });
  const type = PITCH_TYPES.includes(data.type) ? data.type : 'problem';
  return send(env, {
    subject: `Pitch: ${type} from ${oneLine(contact)}`,
    text: `${text}\n\nContact: ${contact}\nPitch: ${type}, sent from ${page}`,
    replyTo: EMAIL_RE.test(contact) ? contact : undefined,
  });
};

const follow = (env, data, page) => {
  const email = str(data.email, 200);
  const topics = (Array.isArray(data.topics) ? data.topics : []).filter(id => TOPICS[id]).map(id => TOPICS[id]);
  if (!EMAIL_RE.test(email) || !topics.length) return json(400, { error: 'invalid' });
  return send(env, {
    subject: `Follow: ${topics.join(', ')}`,
    text: `${email} wants: ${topics.join(', ')}\n\nSent from ${page}`,
    replyTo: email,
  });
};

const ROUTES = { '/api/pitch': pitch, '/api/follow': follow };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];
    if (!route) return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    // Browsers send Origin on every POST, so this keeps other sites' pages from using the forms.
    if (request.headers.get('Origin') !== url.origin) return json(403, { error: 'forbidden' });
    const { success } = await env.LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) return json(429, { error: 'too_many_requests' });
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return json(400, { error: 'invalid' });
    }
    if (!data || typeof data !== 'object') return json(400, { error: 'invalid' });
    // Honeypot: a field people never see. Bots that fill it get a normal-looking reply and no email.
    if (str(data.website, 200)) return json(200, { ok: true });
    const page = `dudko.me${data.lang === 'ru' ? '/ru/' : '/'}`;
    return route(env, data, page);
  },
};
