// Shared by the English (/) and Russian (/ru/) pages. All visible copy lives in the HTML,
// including the email subjects (data-* attributes), so this file holds no text of its own.
(() => {
  const EMAIL = 'dudko.mikalai@gmail.com';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const mailto = (subject, body) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Copy email buttons: the label flips to its "done" text for a moment.
  const copyText = text => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return Promise.resolve();
  };
  $$('[data-copy-email]').forEach(btn => {
    let timer;
    btn.addEventListener('click', () => {
      copyText(EMAIL).finally(() => {
        btn.textContent = btn.dataset.done;
        clearTimeout(timer);
        timer = setTimeout(() => { btn.textContent = btn.dataset.label; }, 1800);
      });
    });
  });

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

  // Pitch form: no backend yet, so Send opens a prefilled email.
  const pitchForm = $('#pitch-form');
  const chips = $$('.chip');
  const pitchText = $('#pitch-text');
  const pitchContact = $('#pitch-contact');
  const sendBtn = $('.send', pitchForm);
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    pitchText.placeholder = chip.dataset.ph;
  }));
  pitchText.addEventListener('input', () => { sendBtn.disabled = pitchText.value.trim().length < 3; });
  pitchForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = pitchText.value.trim();
    if (text.length < 3) return;
    const chip = chips.find(c => c.getAttribute('aria-pressed') === 'true') || chips[0];
    const subject = `${$('#pitch-is').textContent.trim()} ${chip.textContent.trim()}`;
    const contact = pitchContact.value.trim();
    const body = text + (contact ? `\n\n${pitchForm.dataset.contactLabel} ${contact}` : '');
    window.location.href = mailto(subject, body);
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
  }));
  const failsToggle = $('#fails-toggle');
  failsToggle.addEventListener('click', () => {
    const showAll = failsToggle.getAttribute('aria-expanded') !== 'true';
    $$('[data-extra]').forEach(row => { row.hidden = !showAll; });
    failsToggle.setAttribute('aria-expanded', String(showAll));
    failsToggle.textContent = showAll ? failsToggle.dataset.less : failsToggle.dataset.more;
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
  });

  // Follow: no newsletter service yet, so the button opens an email listing the picked topics.
  const switches = $$('.switch');
  const followBtn = $('#follow-btn');
  const updateFollow = () => {
    const topics = switches.filter(s => s.getAttribute('aria-checked') === 'true').map(s => s.dataset.topic).join(', ');
    followBtn.setAttribute('aria-disabled', String(topics === ''));
    followBtn.href = mailto(followBtn.dataset.subject.replace('{topics}', topics), followBtn.dataset.body.replace('{topics}', topics));
  };
  switches.forEach(s => s.addEventListener('click', () => {
    s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'));
    updateFollow();
  }));
  updateFollow();

  // Dock: highlight the section in the middle of the viewport.
  const dockLinks = $$('.dock a');
  const setActive = id => dockLinks.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id)));
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
