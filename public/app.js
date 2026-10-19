// Shared by the English (/) and Russian (/ru/) pages. All visible copy lives in the HTML,
// including the email subjects (data-* attributes), so this file holds no text of its own.
(() => {
  const EMAIL = 'dudko.mikalai@gmail.com';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const mailto = (subject, body) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Analytics (Umami, loaded by its own script tag; a no-op when it's blocked or not loaded).
  // Links and buttons opt in with data-track="event-name" plus data-track-<prop>="value";
  // events that need values known only at click time call track() directly below.
  // Every event carries the page language, so EN and RU can be compared on one event.
  const track = (name, data) => {
    try {
      if (window.umami) window.umami.track(name, { lang: document.documentElement.lang, ...data });
    } catch (e) {}
  };
  // Track something once per visit: some controls get used dozens of times and every event counts against the plan.
  const tracked = new Set();
  const trackOnce = (name, data) => {
    if (tracked.has(name)) return;
    tracked.add(name);
    track(name, data);
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-track]');
    if (el) {
      const data = {};
      Object.keys(el.dataset).forEach(key => {
        if (key.length > 5 && key.startsWith('track')) data[key.slice(5).toLowerCase()] = el.dataset[key];
      });
      track(el.dataset.track, data);
      return;
    }
    // Safety net for links nobody tagged: anything leaving the site still shows up, by destination.
    const a = e.target.closest('a[href]');
    if (!a || a.protocol === 'javascript:') return;
    if (a.protocol === 'mailto:' || a.protocol === 'tel:') track('outbound', { to: a.protocol.slice(0, -1) });
    else if (a.host && a.host !== location.host) track('outbound', { to: a.host.replace(/^www\./, '') });
  });

  // Copy email buttons: the label flips to its "done" text for a moment.
  const copyText = text => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    };
    // The Clipboard API can still refuse (no focus, denied permission), so fall back instead of failing silently.
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    fallback();
    return Promise.resolve();
  };
  const copyButton = (btn, getText) => {
    let timer;
    btn.addEventListener('click', () => {
      copyText(getText()).finally(() => {
        btn.textContent = btn.dataset.done;
        clearTimeout(timer);
        timer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1800);
      });
    });
  };
  $$('[data-copy-email]').forEach(btn => copyButton(btn, () => EMAIL));

  // Journey wallet: one card open at a time, its article shown next to it.
  const slots = $$('.w-slot');
  const fitOpenSlot = animate => {
    const slot = $('.w-slot.is-open');
    if (!slot) return;
    if (!animate) slot.style.transition = 'none';
    slot.style.height = slot.firstElementChild.offsetHeight + 16 + 'px';
    if (!animate) {
      void slot.offsetHeight;
      slot.style.transition = '';
    }
  };
  slots.forEach(slot => {
    const card = slot.firstElementChild;
    card.addEventListener('click', () => {
      slots.forEach(s => {
        const c = s.firstElementChild;
        const on = c === card;
        s.classList.toggle('is-open', on);
        s.style.height = '';
        c.setAttribute('aria-expanded', String(on));
        $('#' + c.getAttribute('aria-controls')).hidden = !on;
      });
      fitOpenSlot(true);
      // On one column the article sits below the wallet, so bring it into view.
      if (window.innerWidth < 900) {
        const article = $('#' + card.getAttribute('aria-controls'));
        setTimeout(() => article.scrollIntoView({ behavior: 'smooth', block: 'start' }), 460);
      }
    });
  });
  let fitQueued = false;
  window.addEventListener('resize', () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => { fitQueued = false; fitOpenSlot(false); });
  }, { passive: true });
  fitOpenSlot(false);
  if (document.fonts) document.fonts.ready.then(() => fitOpenSlot(false));

  // POST to the form API in src/worker.js. Anything but a 2xx counts as a failure, so callers can fall back.
  const postForm = (path, data) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, lang: document.documentElement.lang }),
  }).then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); });

  // Pitch form: Send posts the pitch to the API, which emails it to me. If that fails, the visitor
  // gets three ways to send it themselves: their email app, Gmail in the browser, or copying the text.
  const pitchForm = $('#pitch-form');
  const chips = $$('.chip');
  const pitchText = $('#pitch-text');
  const pitchContact = $('#pitch-contact');
  const sendBtn = $('.send', pitchForm);
  const pitchMessage = () => {
    const chip = chips.find(c => c.getAttribute('aria-pressed') === 'true') || chips[0];
    const contact = pitchContact.value.trim();
    return {
      type: chip.dataset.type,
      subject: `${$('#pitch-is').textContent.trim()} ${chip.textContent.trim()}`,
      body: pitchText.value.trim() + (contact ? `\n\n${pitchForm.dataset.contactLabel} ${contact}` : ''),
    };
  };
  const setFallbackLinks = () => {
    const { subject, body } = pitchMessage();
    $('#pitch-mailto').href = mailto(subject, body);
    $('#pitch-gmail').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    pitchText.placeholder = chip.dataset.ph;
  }));
  // A contact is required: without one I have no way to reply. No second Send while one is in flight.
  let pitchSending = false;
  const pitchReady = () => !pitchSending && pitchText.value.trim().length >= 3 && pitchContact.value.trim().length >= 3;
  // Also run on load and on back/forward: a browser that restores typed text fires no input event.
  const syncSend = () => { sendBtn.disabled = !pitchReady(); };
  pitchText.addEventListener('input', syncSend);
  pitchContact.addEventListener('input', syncSend);
  // Starting to type is the top of the pitch funnel: compare pitch-start with pitch-send.
  [pitchText, pitchContact].forEach(field => field.addEventListener('input', () => trackOnce('pitch-start', { type: pitchMessage().type })));
  window.addEventListener('pageshow', syncSend);
  syncSend();
  pitchForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!pitchReady()) return;
    const { type } = pitchMessage();
    pitchSending = true;
    syncSend();
    postForm('/api/pitch', { type, text: pitchText.value.trim(), contact: pitchContact.value.trim(), website: $('.hp', pitchForm).value })
      .then(() => {
        track('pitch-send', { type, result: 'sent' });
        pitchText.value = '';
        $('#pitch-note').hidden = false;
        $('#pitch-fallback').hidden = true;
        pitchForm.hidden = true;
        $('#pitch-done').hidden = false;
      })
      .catch(() => {
        track('pitch-send', { type, result: 'failed' });
        setFallbackLinks();
        $('#pitch-note').hidden = true;
        $('#pitch-fallback').hidden = false;
      })
      .finally(() => { pitchSending = false; syncSend(); });
  });
  // The pitch can be edited after a failed Send, so the fallbacks read the form again when used.
  $$('#pitch-mailto, #pitch-gmail').forEach(a => a.addEventListener('click', setFallbackLinks));
  copyButton($('#pitch-copy'), () => {
    const { subject, body } = pitchMessage();
    return `${subject}\n\n${body}`;
  });
  $('#pitch-again').addEventListener('click', () => {
    $('#pitch-done').hidden = true;
    pitchForm.hidden = false;
    pitchText.focus();
  });

  // Fuckup log: accordion rows, first three shown until "Show all".
  $$('.fail-btn').forEach(btn => btn.addEventListener('click', () => {
    const lesson = $('#' + btn.getAttribute('aria-controls'));
    const open = lesson.hidden;
    $$('.fail-btn').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      $('#' + b.getAttribute('aria-controls')).hidden = true;
    });
    lesson.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) track('fail-open', { n: btn.getAttribute('aria-controls').replace('fl-', '') });
  }));
  const failsToggle = $('#fails-toggle');
  failsToggle.addEventListener('click', () => {
    const showAll = failsToggle.getAttribute('aria-expanded') !== 'true';
    $$('[data-extra]').forEach(row => { row.hidden = !showAll; });
    failsToggle.setAttribute('aria-expanded', String(showAll));
    failsToggle.textContent = showAll ? failsToggle.dataset.less : failsToggle.dataset.more;
    if (showAll) track('fails-show-all');
  });

  // People carousel: position counter and dots follow the scroll.
  const carousel = $('#carousel');
  const dots = $$('#photo-dots span');
  const pos = $('#photo-pos');
  let idx = 0;
  carousel.addEventListener('scroll', () => {
    const first = carousel.firstElementChild;
    const step = first ? first.offsetWidth + 8 : 1;
    const i = Math.max(0, Math.min(dots.length - 1, Math.round(carousel.scrollLeft / step)));
    if (i === idx) return;
    idx = i;
    trackOnce('carousel-swipe');
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    pos.textContent = `${i + 1} / ${dots.length}`;
  }, { passive: true });

  // Fuckup clicker: the visitor's own count, kept in their browser only.
  const clkCount = $('#clk-count');
  const CLK_KEY = 'md-clicks';
  let clicks = 0;
  try { clicks = parseInt(localStorage.getItem(CLK_KEY), 10) || 0; } catch (e) {}
  clkCount.textContent = clicks;
  $('#clk-btn').addEventListener('click', () => {
    clicks += 1;
    clkCount.textContent = clicks;
    try { localStorage.setItem(CLK_KEY, String(clicks)); } catch (e) {}
    trackOnce('clicker-tap');
  });

  // Follow: no newsletter service yet. The form emails me the address and the picked topics and
  // I add people by hand; if that fails, the visitor gets a prefilled email link instead.
  const switches = $$('.switch');
  const followForm = $('#follow-form');
  const followEmail = $('#follow-email');
  const followBtn = $('.follow-btn', followForm);
  const pickedTopics = () => switches.filter(s => s.getAttribute('aria-checked') === 'true');
  // Same check as the API, so a typo is caught here rather than coming back as a failed send.
  let followSending = false;
  const followReady = () => !followSending && pickedTopics().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followEmail.value.trim());
  const syncFollow = () => { followBtn.disabled = !followReady(); };
  switches.forEach(s => s.addEventListener('click', () => {
    s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'));
    syncFollow();
  }));
  followEmail.addEventListener('input', syncFollow);
  followEmail.addEventListener('input', () => trackOnce('follow-start'));
  window.addEventListener('pageshow', syncFollow);
  syncFollow();
  followForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!followReady()) return;
    const picked = pickedTopics();
    const ids = picked.map(s => s.dataset.id).join(',');
    followSending = true;
    syncFollow();
    postForm('/api/follow', { email: followEmail.value.trim(), topics: picked.map(s => s.dataset.id), website: $('.hp', followForm).value })
      .then(() => {
        track('follow-email', { topics: ids, result: 'sent' });
        followForm.hidden = true;
        $('#follow-done').hidden = false;
      })
      .catch(() => {
        track('follow-email', { topics: ids, result: 'failed' });
        const topics = picked.map(s => s.dataset.topic).join(', ');
        $('#follow-mailto').href = mailto(followForm.dataset.subject.replace('{topics}', topics), followForm.dataset.body.replace('{topics}', topics));
        $('#follow-fail').hidden = false;
      })
      .finally(() => { followSending = false; syncFollow(); });
  });

  // Shipping: daily activity from GitHub and GitLab (src/shipping.js), shown as this week's bars,
  // an 18-week heatmap and the latest public commits. The widget stays hidden if the data can't be
  // loaded. Day names, relative times and plural rules come from Intl, so the copy stays in the HTML.
  const ship = $('#shipping');
  const pageLang = document.documentElement.lang;
  const node = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const plural = (forms, n) => {
    const f = JSON.parse(forms);
    return (f[new Intl.PluralRules(pageLang).select(n)] || f.other).replace('{n}', n.toLocaleString(pageLang));
  };
  const timeAgo = iso => {
    const s = (new Date(iso) - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(pageLang, { numeric: 'auto' });
    for (const [unit, size] of [['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
    }
    return rtf.format(0, 'minute');
  };
  const warsawDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(iso));
  const heatLevel = n => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);
  if (ship) fetch('/api/shipping').then(res => (res.ok ? res.json() : Promise.reject(res.status))).then(data => {
    if (!data.github && !data.gitlab) return;
    const start = Date.parse(`${data.start}T00:00:00Z`);
    const dates = (data.github || data.gitlab).map((_, i) => new Date(start + i * 86400000));
    const iso = dates.map(d => d.toISOString().slice(0, 10));
    const todayIdx = iso.indexOf(data.today);
    if (todayIdx < 0) return;
    const weekStart = iso.length - 7;
    const dayName = (d, weekday) => {
      const s = new Intl.DateTimeFormat(pageLang, { weekday, timeZone: 'UTC' }).format(d);
      return s[0].toUpperCase() + s.slice(1);
    };
    let src = 'all';
    let pick = todayIdx;
    const counts = () => iso.map((_, i) => (src !== 'gitlab' && data.github ? data.github[i] : 0) + (src !== 'github' && data.gitlab ? data.gitlab[i] : 0));
    // Only GitHub commits are public; GitLab work shows up as counts alone.
    const commits = () => (src === 'gitlab' ? [] : data.commits.filter(c => c.at));
    const dayText = (i, n) => {
      const c = commits().find(x => warsawDate(x.at) === iso[i]);
      if (c) return c.msg;
      if (n > 0) return plural(ship.dataset.day, n);
      if (i === todayIdx) return ship.dataset.today;
      return i > todayIdx ? ship.dataset.ahead : ship.dataset.none;
    };

    // Cells and bars are built once; render() only updates their state.
    const cells = iso.map(() => $('#ship-heat').appendChild(node('span')));
    const bars = dates.slice(weekStart).map((d, j) => {
      const b = node('button', 'ship-bar');
      b.type = 'button';
      b.setAttribute('aria-label', dayName(d, 'long'));
      b.append(node('i'), dayName(d, 'narrow'));
      ['mouseenter', 'focus', 'click'].forEach(ev => b.addEventListener(ev, () => { pick = weekStart + j; render(); }));
      return $('#ship-bars').appendChild(b);
    });
    const render = () => {
      const n = counts();
      cells.forEach((c, i) => { c.className = i > todayIdx ? 'ahead' : `l${heatLevel(n[i])}`; });
      bars.forEach((b, j) => {
        const i = weekStart + j;
        b.className = `ship-bar${n[i] > 0 ? ' on' : ''}${i === todayIdx ? ' today' : ''}${i > todayIdx ? ' ahead' : ''}`;
        b.setAttribute('aria-pressed', String(i === pick));
      });
      $('#ship-count').textContent = n.slice(weekStart, todayIdx + 1).filter(x => x > 0).length;
      $('#ship-pick').replaceChildren(node('span', null, dayName(dates[pick], 'short')), ` · ${dayText(pick, n[pick])}`);
      $('#ship-caption').textContent = plural(ship.dataset.caption, n.slice(0, todayIdx + 1).reduce((a, x) => a + x, 0));
      $('#ship-commits').replaceChildren(...(src === 'gitlab'
        ? [node('div', 'ship-note', ship.dataset.private)]
        : commits().slice(0, 2).map(c => {
          const a = node('a', 'ship-commit');
          a.href = c.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.dataset.track = 'shipping-commit';
          a.dataset.trackRepo = c.repo;
          a.append(node('span', 'ship-src', 'GitHub'), node('span', 'ship-msg', c.msg), node('span', 'ship-meta', `${c.repo} · ${timeAgo(c.at)}`));
          return a;
        })));
    };
    $$('.seg-btn', ship).forEach(btn => btn.addEventListener('click', () => {
      src = btn.dataset.src;
      $$('.seg-btn', ship).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      render();
    }));
    render();
    ship.hidden = false;
  }).catch(() => {});

  // Dock: highlight the section in the middle of the viewport. Reaching a section for the
  // first time also counts as a section-view, which shows how far down people read.
  const dockLinks = $$('.dock a');
  const sectionsSeen = new Set(['me']);
  const setActive = id => {
    dockLinks.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id)));
    if (sectionsSeen.has(id)) return;
    sectionsSeen.add(id);
    track('section-view', { section: id });
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    }), { rootMargin: '-45% 0px -50% 0px' });
    dockLinks.forEach(a => { const el = $(a.getAttribute('href')); if (el) io.observe(el); });
  }
  // Contact is shorter than the viewport, so its middle never reaches the band above; the page bottom counts as Contact.
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) setActive('contact');
  }, { passive: true });
})();
