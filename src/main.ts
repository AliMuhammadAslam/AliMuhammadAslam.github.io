import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initGL } from './gl';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));

/* ── theme ────────────────────────────────────────────────────── */
function initTheme() {
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  root.dataset.theme = stored ?? (prefersLight ? 'light' : 'dark');

  $('#theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

/* ── smooth scroll ────────────────────────────────────────────── */
function initScroll() {
  if (reduced) return null;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchors need to go through Lenis or they fight the smooth scroller.
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement | 0, { offset: id === '#top' ? 0 : -70 });
    });
  });

  return lenis;
}

/* ── split text into animatable characters ────────────────────── */
function split(el: HTMLElement) {
  const words = (el.textContent ?? '').trim().split(/\s+/);
  el.textContent = '';
  const chars: HTMLElement[] = [];

  words.forEach((word, wi) => {
    const wrap = document.createElement('span');
    wrap.className = 'word';
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'char';
      c.textContent = ch;
      wrap.appendChild(c);
      chars.push(c);
    }
    el.appendChild(wrap);
    if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
  });

  // Screen readers should hear the phrase, not the letters.
  el.setAttribute('aria-label', words.join(' '));
  return chars;
}

/* ── preloader → hero handoff ─────────────────────────────────── */
function initIntro(onDone: () => void) {
  const pre = $('#preloader')!;
  const count = $('#preloader-count')!;
  const fill = $('#preloader-fill')!;
  const heroName = $('.hero__name');
  const chars = heroName && !reduced ? split(heroName) : [];

  if (reduced) {
    pre.remove();
    onDone();
    return;
  }

  gsap.set(chars, { yPercent: 118 });

  const tl = gsap.timeline({ onComplete: onDone });
  const n = { v: 0 };

  tl.to(n, {
    v: 100,
    duration: 1.15,
    ease: 'power2.inOut',
    onUpdate: () => {
      const v = Math.round(n.v);
      count.textContent = String(v).padStart(2, '0');
      fill.style.width = v + '%';
    },
  })
    .to('.preloader__inner, .preloader__bar', { opacity: 0, duration: 0.35, ease: 'power2.in' })
    .to(pre, {
      yPercent: -100,
      duration: 0.9,
      ease: 'expo.inOut',
      onComplete: () => pre.remove(),
    })
    .to(chars, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.028 }, '-=0.55')
    .from(
      '.hero__eyebrow',
      { opacity: 0, y: 14, duration: 0.7, ease: 'power3.out' },
      '-=0.85'
    );
}

/* ── scroll-in reveals ────────────────────────────────────────── */
function initReveals() {
  $$('[data-anim]').forEach((el) => {
    const delay = el.dataset.delay;
    if (delay) el.style.setProperty('--d', `${delay}s`);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-in'),
    });
  });

  // Contact headline gets the same char treatment as the hero.
  const big = $('.contact__big');
  if (big && !reduced) {
    const chars = split(big);
    gsap.set(chars, { yPercent: 118 });
    ScrollTrigger.create({
      trigger: big,
      start: 'top 82%',
      once: true,
      onEnter: () =>
        gsap.to(chars, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.03 }),
    });
  }
}

/* ── word-by-word lede ────────────────────────────────────────── */
function initWordLede() {
  const el = $('[data-words]');
  if (!el) return;

  const words = (el.textContent ?? '').trim().split(/\s+/);
  el.textContent = '';
  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });

  if (reduced) return;

  const spans = $$('.w', el);
  ScrollTrigger.create({
    trigger: el,
    start: 'top 78%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      const cut = self.progress * spans.length;
      spans.forEach((s, i) => s.classList.toggle('on', i < cut));
    },
  });
}

/* ── counters ─────────────────────────────────────────────────── */
function initCounters() {
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count ?? 0);
    const suffix = el.dataset.suffix ?? '';

    if (reduced) {
      el.textContent = target + suffix;
      return;
    }

    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: () => (el.textContent = Math.round(obj.v) + suffix),
        }),
    });
  });
}

/* ── nav state ────────────────────────────────────────────────── */
function initNav() {
  const nav = $('#nav')!;
  ScrollTrigger.create({
    start: 'top -60',
    onUpdate: (self) => nav.classList.toggle('is-stuck', self.scroll() > 60),
  });

  const links = $$<HTMLAnchorElement>('.nav__links a');
  links.forEach((link) => {
    const section = $(link.getAttribute('href')!);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => {
        if (!self.isActive) return;
        links.forEach((l) => l.classList.remove('is-active'));
        link.classList.add('is-active');
      },
    });
  });

  const bar = $('#progress')!;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
  });
}

/* ── marquee ──────────────────────────────────────────────────── */
function initMarquee() {
  const track = $('#marquee-track');
  if (!track || reduced) return;

  // Duplicate until the track is comfortably wider than the viewport,
  // so the -50% loop never shows a gap.
  const original = track.innerHTML;
  while (track.scrollWidth < window.innerWidth * 2) track.innerHTML += original;

  gsap.to(track, {
    xPercent: -50,
    duration: 38,
    ease: 'none',
    repeat: -1,
  });
}

/* ── custom cursor ────────────────────────────────────────────── */
function initCursor() {
  const cursor = $('#cursor');
  if (!cursor || !fine || reduced) return;

  const dot = $('.cursor__dot', cursor)!;
  const ring = $('.cursor__ring', cursor)!;
  const xTo = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const yTo = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const rxTo = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' });
  const ryTo = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });

  window.addEventListener(
    'pointermove',
    (e) => {
      xTo(e.clientX); yTo(e.clientY);
      rxTo(e.clientX); ryTo(e.clientY);
    },
    { passive: true }
  );

  $$('[data-cursor]').forEach((el) => {
    const mode = el.dataset.cursor;
    el.addEventListener('pointerenter', () => {
      cursor.classList.add('is-hot');
      if (mode === 'view') {
        cursor.classList.add('is-view');
        ring.setAttribute('data-label', 'OPEN');
      }
    });
    el.addEventListener('pointerleave', () => {
      cursor.classList.remove('is-hot', 'is-view');
    });
  });
}

/* ── magnetic buttons ─────────────────────────────────────────── */
function initMagnetic() {
  if (!fine || reduced) return;

  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.42);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ── work list: expand + cursor-following preview ─────────────── */
// Gradient stops per project, kept inside the coral/amber/violet family so the
// previews read as one set rather than ten unrelated swatches.
const PREVIEW_HUES: Record<string, [number, number]> = {
  c1: [14, 38],  c2: [280, 330], c3: [34, 52],  c4: [350, 18],
  p1: [8, 30],   p2: [40, 20],   p3: [352, 8],  p4: [268, 315],
  p5: [300, 355], p6: [28, 46],
};

function initWork() {
  const preview = $('#preview');
  const inner = $('#preview-inner');

  const moveTo = preview && fine && !reduced
    ? {
        x: gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3' }),
        y: gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3' }),
      }
    : null;

  if (moveTo) {
    gsap.set(preview, { xPercent: -50, yPercent: -50 });
  }

  $$('.work').forEach((item) => {
    // Expand / collapse, accordion-style within the whole list.
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      const wasOpen = item.classList.contains('is-open');
      $$('.work').forEach((o) => o.classList.remove('is-open'));
      item.classList.toggle('is-open', !wasOpen);
      ScrollTrigger.refresh();

      const href = item.dataset.href;
      if (href && wasOpen) window.open(href, '_blank', 'noopener');
    });

    // Keyboard parity with the click behaviour.
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });

    if (!moveTo || !inner) return;

    item.addEventListener('pointerenter', () => {
      const key = item.dataset.preview ?? 'c1';
      const [a, b] = PREVIEW_HUES[key] ?? [14, 38];
      inner.style.background =
        `linear-gradient(135deg, hsl(${a} 78% 32%), hsl(${b} 92% 58%))`;
      preview!.classList.add('is-on');
    });
    item.addEventListener('pointerleave', () => preview!.classList.remove('is-on'));
  });

  if (moveTo) {
    window.addEventListener(
      'pointermove',
      (e) => { moveTo.x(e.clientX); moveTo.y(e.clientY); },
      { passive: true }
    );
  }
}

/* ── oss card glow follows the pointer ────────────────────────── */
function initGlowCards() {
  if (!fine) return;
  $$('.oss__card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ── footer year ──────────────────────────────────────────────── */
function initYear() {
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ── boot ─────────────────────────────────────────────────────── */
initTheme();
initScroll();

const canvas = $<HTMLCanvasElement>('#gl');
if (canvas && !reduced) initGL(canvas);

initIntro(() => {
  gsap.to('.hero__meta, .hero__actions, .hero__scroll', {
    opacity: 1,
    duration: 0.6,
    stagger: 0.08,
  });
});

initReveals();
initWordLede();
initCounters();
initNav();
initMarquee();
initCursor();
initMagnetic();
initWork();
initGlowCards();
initYear();

// Fonts land after first paint and change metrics, so recalculate positions.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
