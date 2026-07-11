/* ============================================================================
   classic v2 — orchestrator
   Hero scroll-scrub runs inline (it IS the first paint experience); the
   three.js sections (work icons, capsules) lazy-import only when scrolled
   near, so the hero owns the whole network budget up front.
   ========================================================================== */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// dev-only hooks (harmless in prod): ?p=0.55 pins the hero scrub progress,
// ?solo=work|products collapses the hero so a section sits in the first
// viewport — the local preview pane can't rasterize scrolled captures
const DBG = new URLSearchParams(location.search);
const DBG_P = DBG.get('p') !== null ? parseFloat(DBG.get('p')) : null;
if (DBG.get('solo')) {
  document.querySelector('.hero').style.display = 'none';
  for (const sel of ['work', 'about', 'products'])
    if (sel !== DBG.get('solo'))
      document.querySelector('.' + sel).style.display = 'none';
}

document.getElementById('year').textContent = String(new Date().getFullYear());

/* ------------------------------------------------------------------ *
 *  HERO — progressive frame-sequence scrub (Seoul -> SF)               *
 * ------------------------------------------------------------------ */
const FRAMES = 97;
const SCRUB_END = 0.68;          // scroll fraction where the film finishes
const hero = document.querySelector('.hero');
const sticky = document.querySelector('.hero-sticky');
const canvas = document.getElementById('hero-canvas');
const lockin = document.querySelector('.hero-lockin');
const beats = [...document.querySelectorAll('.beat')];
const hint = document.querySelector('.hero-scroll-hint');

if (REDUCED) {
  document.body.classList.add('no-scrub');
  document.getElementById('hero-poster').src = 'assets/v2/hero/poster.webp';
} else {
  initScrub();
}

function initScrub() {
  const ctx = canvas.getContext('2d');
  const imgs = new Array(FRAMES).fill(null);
  const url = (i) => `assets/v2/hero/s${String(i).padStart(3, '0')}.webp`;
  let drawn = -1;

  // progressive fill: coarse pass first so scrubbing works within ~1s,
  // then refine — mid-scroll the nearest loaded frame stands in
  function load(i, then) {
    if (imgs[i]) return then && then();
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { imgs[i] = im; draw(true); then && then(); };
    im.src = url(i);
  }
  const passes = [8, 4, 2, 1];
  (function nextPass(p) {
    if (p >= passes.length) return;
    let pending = 0;
    for (let i = 0; i < FRAMES; i += passes[p]) if (!imgs[i]) { pending++; load(i, () => { if (--pending === 0) nextPass(p + 1); }); }
    if (pending === 0) nextPass(p + 1);
  })(0);

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = sticky.clientWidth * dpr;
    canvas.height = sticky.clientHeight * dpr;
    drawn = -1;
    draw(true);
  }
  addEventListener('resize', fit);

  let target = 0;
  function nearest(i) {
    if (imgs[i]) return i;
    for (let d = 1; d < FRAMES; d++) {
      if (imgs[i - d]) return i - d;
      if (imgs[i + d]) return i + d;
    }
    return -1;
  }
  function draw(force) {
    const i = nearest(target);
    if (i < 0 || (i === drawn && !force)) return;
    drawn = i;
    const im = imgs[i];
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / im.width, ch / im.height);
    const w = im.width * s, h = im.height * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  // text beat windows in scroll-progress space
  const WINDOWS = [[0.035, 0.20], [0.25, 0.43], [0.47, 0.645]];
  function beatAlpha(p, [a, b]) {
    const fade = 0.05;
    if (p < a || p > b) return 0;
    return clamp(Math.min(p - a, b - p) / fade, 0, 1);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = hero.offsetHeight - innerHeight;
      const p = DBG_P !== null ? DBG_P
        : clamp((scrollY - hero.offsetTop) / max, 0, 1);
      target = Math.round(clamp(p / SCRUB_END, 0, 1) * (FRAMES - 1));
      draw();
      beats.forEach((el, bi) => {
        const a = beatAlpha(p, WINDOWS[bi]);
        el.style.opacity = a;
        el.style.transform = `translate(-50%, ${(1 - a) * 14}px)`;
        // highlighter bar sweeps open with the beat, closes on the way out
        el.querySelector('.mk').style.setProperty('--r', (a * 100) + '%');
      });
      const lk = clamp((p - 0.70) / 0.10, 0, 1);
      lockin.style.opacity = lk > 0 ? 1 : 0;
      lockin.style.transform = `translateX(-50%) translateY(${(1 - lk) * 20}px)`;
      lockin.style.pointerEvents = lk > 0.5 ? 'auto' : 'none';
      // staggered marker sweep per headline line, then quiet+CTA fade
      const marks = lockin.querySelectorAll('.hero-headline .mk');
      marks.forEach((mk, mi) => {
        const seg = clamp((lk - mi * 0.35) / 0.5, 0, 1);
        mk.style.setProperty('--r', (seg * 100) + '%');
      });
      const tail = clamp((lk - 0.75) / 0.25, 0, 1);
      lockin.querySelector('.hero-quiet').style.opacity = tail;
      lockin.querySelector('.hero-cta').style.opacity = tail;
      hint.style.opacity = p < 0.02 ? 1 : 0;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  fit();
  onScroll();
}

/* ------------------------------------------------------------------ *
 *  LAZY three.js sections                                              *
 * ------------------------------------------------------------------ */
function lazy(selector, loader) {
  const el = document.querySelector(selector);
  if (!el) return;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    io.disconnect();
    loader().catch((err) => console.warn('[v2] section failed, fallback on:', err));
  };
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) go();
  }, { rootMargin: '600px' });
  io.observe(el);
  // safety nets: IO dispatch can lag in throttled/background tabs — load on
  // first scroll intent or after idle anyway (still after first paint)
  addEventListener('scroll', go, { once: true, passive: true });
  setTimeout(go, 3500);
}
lazy('.work', () => import('./work.js').then((m) => m.initWork()));
lazy('.products', () => import('./capsules.js').then((m) => m.initCapsules()));

/* ------------------------------------------------------------------ *
 *  ABOUT — word reveal                                                 *
 * ------------------------------------------------------------------ */
{
  const p = document.querySelector('.about-reveal');
  const words = p.textContent.trim().split(/\s+/);
  p.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  const spans = [...p.querySelectorAll('.w')];
  if (REDUCED) spans.forEach((s) => s.classList.add('on'));
  else {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      spans.forEach((s, i) => setTimeout(() => s.classList.add('on'), 240 + i * 26));
    }, { threshold: 0.35 });
    io.observe(p);
  }
}

/* ------------------------------------------------------------------ *
 *  FOOTER — creature peek easter egg                                   *
 * ------------------------------------------------------------------ */
{
  const f = document.querySelector('.footer');
  const io = new IntersectionObserver((es) => {
    f.classList.toggle('peeking', es.some((e) => e.isIntersecting));
  }, { threshold: 0.6 });
  io.observe(f);
  document.getElementById('peek').addEventListener('click', () => {
    location.href = 'index.html';
  });
}
