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
/* The initial value is resolved by the inline head script to avoid a flash;
   this only wires up the toggle. */
function initTheme() {
  const root = document.documentElement;
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* private mode */ }
  });
}

/* ── smooth scroll ────────────────────────────────────────────── */
function initScroll(): Lenis | null {
  if (reduced) return null;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

function initAnchors(lenis: Lenis | null) {
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!;
      if (id === '#') return;
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      const offset = id === '#top' ? 0 : -70;
      if (lenis) lenis.scrollTo(target as HTMLElement | 0, { offset });
      else if (target === 0) window.scrollTo({ top: 0 });
      else (target as HTMLElement).scrollIntoView();
    });
  });

  $('#totop')?.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0 });
  });
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

  // Screen readers should hear the phrase, not the individual letters.
  el.setAttribute('aria-label', words.join(' '));
  return chars;
}

/* ── preloader to hero handoff ────────────────────────────────── */
function initIntro() {
  const pre = $('#preloader');
  const heroAnims = $$('.hero [data-anim]');
  const heroName = $('.hero__name');

  const finish = () => {
    document.documentElement.classList.add('is-booted');
    heroAnims.forEach((el, i) => {
      setTimeout(() => el.classList.add('is-in'), i * 70);
    });
  };

  if (reduced || !pre) {
    pre?.remove();
    finish();
    return;
  }

  const count = $('#preloader-count');
  const fill = $('#preloader-fill');
  const chars = heroName ? split(heroName) : [];
  gsap.set(chars, { yPercent: 118 });

  const n = { v: 0 };
  gsap.timeline()
    .to(n, {
      v: 100,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        const v = Math.round(n.v);
        if (count) count.textContent = String(v).padStart(2, '0');
        if (fill) fill.style.width = v + '%';
      },
    })
    .to('.preloader__inner, .preloader__bar', { opacity: 0, duration: 0.32, ease: 'power2.in' })
    .to(pre, {
      yPercent: -100,
      duration: 0.9,
      ease: 'expo.inOut',
      onComplete: () => { pre.remove(); finish(); },
    })
    .to(chars, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.028 }, '-=0.55');
}

/* ── scroll-in reveals ────────────────────────────────────────── */
function initReveals() {
  // Hero reveals are driven by the preloader handoff instead.
  $$('[data-anim]').filter((el) => !el.closest('.hero')).forEach((el) => {
    const delay = el.dataset.delay;
    if (delay) el.style.setProperty('--d', `${delay}s`);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-in'),
    });
  });

  const big = $('.contact__big');
  if (big && !reduced) {
    const chars = split(big);
    gsap.set(chars, { yPercent: 118 });
    ScrollTrigger.create({
      trigger: big,
      start: 'top 82%',
      once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.03 }),
    });
  }

  // Skill chips pop in one by one rather than as a block.
  if (!reduced) {
    $$('[data-chips]').forEach((list) => {
      const chips = Array.from(list.children);
      gsap.set(chips, { opacity: 0, y: 10, scale: 0.94 });
      ScrollTrigger.create({
        trigger: list,
        start: 'top 90%',
        once: true,
        onEnter: () =>
          gsap.to(chips, {
            opacity: 1, y: 0, scale: 1,
            duration: 0.5, ease: 'back.out(1.7)', stagger: 0.028,
          }),
      });
    });
  }
}

/* ── hero parallax ────────────────────────────────────────────── */
function initParallax() {
  if (reduced) return;
  const body = $('#hero-body');
  const canvas = $('#gl');
  if (!body) return;

  gsap.to(body, {
    yPercent: 16,
    opacity: 0.25,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
  if (canvas) {
    gsap.to(canvas, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
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

  if (reduced) {
    $$('.w', el).forEach((s) => s.classList.add('on'));
    return;
  }

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

/* ── nav, progress, back-to-top ───────────────────────────────── */
function initNav() {
  const nav = $('#nav');
  const bar = $('#progress');
  const totop = $('#totop');

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav?.classList.toggle('is-stuck', y > 60);
      totop?.classList.toggle('is-on', y > window.innerHeight * 0.9);
      if (bar) gsap.set(bar, { scaleX: self.progress });
    },
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

  // Timeline rail fills as the section scrolls past.
  const rail = $('#rail-fill');
  if (rail && !reduced) {
    gsap.to(rail, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.timeline', start: 'top 75%', end: 'bottom 75%', scrub: 0.5 },
    });
  }
}

/* ── marquee ──────────────────────────────────────────────────── */
function initMarquee(lenis: Lenis | null) {
  const track = $('#marquee-track');
  if (!track || reduced) return;

  // Fill past the viewport, then duplicate the whole strip exactly once.
  // The tween travels -50%, so the two halves must be identical or the loop
  // visibly jumps. Appending copies one at a time can leave an odd count.
  const unit = track.innerHTML;
  let guard = 0;
  while (track.scrollWidth < window.innerWidth * 1.5 && guard++ < 12) {
    track.innerHTML += unit;
  }
  track.innerHTML += track.innerHTML;

  const tween = gsap.to(track, { xPercent: -50, duration: 34, ease: 'none', repeat: -1 });

  // Scroll velocity leans the strip and nudges its speed. Subtle, but it makes
  // the page feel physically connected to the wheel.
  if (lenis) {
    const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    lenis.on('scroll', (e: { velocity: number }) => {
      const v = e.velocity ?? 0;
      skewTo(gsap.utils.clamp(-9, 9, v * 0.32));
      tween.timeScale(gsap.utils.clamp(0.4, 4, 1 + Math.abs(v) * 0.035));
    });
  }
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

  window.addEventListener('pointermove', (e) => {
    xTo(e.clientX); yTo(e.clientY);
    rxTo(e.clientX); ryTo(e.clientY);
  }, { passive: true });

  // Delegated, so elements added or swapped later still get the treatment.
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null;
    if (!el) return;
    cursor.classList.add('is-hot');
    if (el.dataset.cursor === 'view') {
      cursor.classList.add('is-view');
      ring.setAttribute('data-label', 'OPEN');
    }
  });
  document.addEventListener('pointerout', (e) => {
    if ((e.target as HTMLElement)?.closest?.('[data-cursor]')) {
      cursor.classList.remove('is-hot', 'is-view');
    }
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
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ── 3D tilt on cards ─────────────────────────────────────────── */
function initTilt() {
  if (!fine || reduced) return;

  $$('[data-tilt]').forEach((card) => {
    gsap.set(card, { transformPerspective: 900 });
    const rxTo = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ryTo = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(card, 'y', { duration: 0.6, ease: 'power3' });

    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      ryTo((px - 0.5) * 9);
      rxTo((0.5 - py) * 9);
      yTo(-4);
    });
    card.addEventListener('pointerleave', () => { rxTo(0); ryTo(0); yTo(0); });
  });
}

/* ── work list: accordion + cursor-following preview ──────────── */
const PREVIEW_HUES: Record<string, [number, number]> = {
  c1: [14, 38],   c2: [280, 330], c3: [34, 52],  c4: [350, 18],
  p1: [8, 30],    p2: [40, 20],   p3: [352, 8],  p4: [268, 315],
  p5: [300, 355], p6: [28, 46],
};

function initWork(lenis: Lenis | null) {
  const preview = $('#preview');
  const inner = $('#preview-inner');
  const usePreview = Boolean(preview && inner) && fine && !reduced;

  // Kept so the looping gradient tween can be killed. Without this every
  // hover stacked another infinite tween on the same element.
  let shimmer: gsap.core.Tween | null = null;

  const hidePreview = () => {
    if (!preview) return;
    shimmer?.kill();
    shimmer = null;
    gsap.to(preview, { opacity: 0, scale: 0.85, duration: 0.25, ease: 'power2.in' });
  };

  if (usePreview && preview) {
    gsap.set(preview, { xPercent: -50, yPercent: -50, scale: 0.85, opacity: 0 });
    const moveX = gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3' });
    const moveY = gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { moveX(e.clientX); moveY(e.clientY); }, { passive: true });

    // The preview is position:fixed and follows the pointer globally. If you
    // hover a row and then scroll without moving the mouse, no pointerleave
    // ever fires and it stays pinned on screen over whatever scrolls beneath.
    lenis?.on('scroll', hidePreview);
    window.addEventListener('scroll', hidePreview, { passive: true });
    $('#work')?.addEventListener('pointerleave', hidePreview);
    document.addEventListener('visibilitychange', hidePreview);
  }

  $$('.work').forEach((item) => {
    const toggle = $<HTMLButtonElement>('.work__toggle', item);
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      // Accordion: only one row expanded at a time.
      $$('.work').forEach((o) => {
        o.classList.remove('is-open');
        $('.work__toggle', o)?.setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
      // Row heights changed, so every trigger below this point has moved.
      ScrollTrigger.refresh();
    });

    if (!usePreview || !preview || !inner) return;

    toggle.addEventListener('pointerenter', () => {
      const [a, b] = PREVIEW_HUES[item.dataset.preview ?? ''] ?? [14, 38];
      inner.style.background =
        `linear-gradient(135deg, hsl(${a} 80% 30%), hsl(${b} 92% 58%), hsl(${a} 80% 30%))`;
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' });
      shimmer?.kill();
      shimmer = gsap.fromTo(inner,
        { backgroundPosition: '0% 50%' },
        { backgroundPosition: '100% 50%', duration: 4, ease: 'none', repeat: -1, yoyo: true }
      );
    });
    toggle.addEventListener('pointerleave', hidePreview);
  });
}

/* ── copy email ───────────────────────────────────────────────── */
function initCopy() {
  const toast = $('#toast');
  let timer = 0;

  const flash = (msg: string) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => toast.classList.remove('is-on'), 2200);
  };

  $$<HTMLButtonElement>('[data-mail]').forEach((btn) => {
    const mail = btn.dataset.mail!;
    const label = $('.btn__label', btn);
    const original = label?.textContent ?? '';

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(mail);
      } catch {
        // Clipboard API needs a secure context and permission; fall back to
        // handing the address to the mail client instead of failing silently.
        window.location.href = `mailto:${mail}`;
        return;
      }
      flash('Email copied to clipboard');
      btn.classList.add('is-copied');
      if (label) label.textContent = 'Copied';
      window.setTimeout(() => {
        btn.classList.remove('is-copied');
        if (label) label.textContent = original;
      }, 1800);
    });
  });
}

/* ── footer year ──────────────────────────────────────────────── */
function initYear() {
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ── boot ─────────────────────────────────────────────────────── */
/* Each step is isolated so one failure cannot leave the rest of the page
   uninitialised (and, worse, invisible behind its opacity:0 state). */
function run(name: string, fn: () => void) {
  try { fn(); } catch (err) { console.error(`init ${name} failed:`, err); }
}

const lenis = initScroll();

run('theme', initTheme);
run('anchors', () => initAnchors(lenis));
run('gl', () => {
  const canvas = $<HTMLCanvasElement>('#gl');
  if (canvas && !reduced) initGL(canvas);
});
run('intro', initIntro);
run('reveals', initReveals);
run('parallax', initParallax);
run('wordLede', initWordLede);
run('counters', initCounters);
run('nav', initNav);
run('marquee', () => initMarquee(lenis));
run('cursor', initCursor);
run('magnetic', initMagnetic);
run('tilt', initTilt);
run('work', () => initWork(lenis));
run('copy', initCopy);
run('year', initYear);

// Fonts land after first paint and change metrics, so recalculate positions.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
