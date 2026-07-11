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
const START = 10;                // frames 0-9: Yoonki lands into the street —
                                 // played once on load, scrub owns 10..96
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
  let introPlaying = DBG_P === null;   // the landing plays once on load

  // progressive fill: coarse pass first so scrubbing works within ~1s,
  // then refine — mid-scroll the nearest loaded frame stands in
  function load(i, then) {
    if (imgs[i]) return then && then();
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { imgs[i] = im; draw(true); then && then(); };
    im.src = url(i);
  }
  // the landing frames load first (they play immediately), then the
  // coarse-to-fine passes fill the scrub
  for (let i = 0; i <= START; i++) load(i);
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

  // The scrub is EASED, not linear: a gentle start (the first frames crawl,
  // ~1/3 speed) so the Seoul street breathes, quicker through the morph,
  // slow again as SF settles. tf = film progress 0..1.
  const easeFilm = (x) => 0.35 * x + 0.65 * (x * x * (3 - 2 * x));

  // text beat windows in FILM space (glued to imagery, immune to easing).
  // Scrub covers frames 10-96: Seoul until abs frame 36 (t 0.30), the morph
  // 37-55 (wordless — let it play), SF from 56 (t 0.535).
  // Beat 0 opens at -1: the greeting is ON SCREEN from the first paint
  // and every window holds as long as its scenery allows.
  const WINDOWS = [[-1, 0.135], [0.15, 0.30], [0.55, 0.97]];
  const FADE_IN = 0.045, FADE_OUT = 0.055;

  // split each beat line into word spans so the words cascade up out of
  // the mask — the reveal is MONOTONIC (rise in, fade+lift out; a line
  // never slides back down while you read it)
  beats.forEach((el) => {
    const wrapWords = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/( )/).forEach((tok) => {
            if (tok === ' ') { frag.append(' '); return; }
            if (!tok) return;
            const s = document.createElement('span');
            s.className = 'w2';
            s.textContent = tok;
            frag.append(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === Node.ELEMENT_NODE) wrapWords(ch);
      });
    };
    wrapWords(el.querySelector('.mk'));
    el.querySelectorAll('.w2').forEach((w, wi) => w.style.setProperty('--i', wi));
  });

  // the greeting cascades up once on load (scroll owns only its exit)
  {
    const first = beats[0];
    first.style.opacity = 1;
    const t0 = performance.now();
    (function rise(now) {
      const k = clamp((now - t0 - 1050) / 950, 0, 1);  // rises as he lands
      first.style.setProperty('--r', (1 - Math.pow(1 - k, 3)) * 100);
      if (k < 1) requestAnimationFrame(rise);
    })(t0);
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
      const tf = easeFilm(clamp(p / SCRUB_END, 0, 1));
      if (!introPlaying || p > 0.004)
        target = START + Math.round(tf * (FRAMES - 1 - START));
      draw();
      let maxA = 0;
      beats.forEach((el, bi) => {
        const [a, b] = WINDOWS[bi];
        const tIn = clamp((tf - a) / FADE_IN, 0, 1);
        const tOut = clamp((tf - (b - FADE_OUT)) / FADE_OUT, 0, 1);
        const alpha = tf < a || tf > b + 0.02 ? 0 : tIn * (1 - tOut);
        maxA = Math.max(maxA, alpha);
        el.style.opacity = alpha;
        // words rise while entering (tIn only — never re-descend); on the
        // way out the whole line lifts and fades instead. Beat 0's rise
        // belongs to the load cascade, scroll only lifts it out.
        if (bi > 0) el.style.setProperty('--r', tIn * 100);
        el.style.transform = `translateX(-50%) translateY(${-tOut * 26}px)`;
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
      // bottom scrim carries whichever type is on screen
      document.getElementById('hero-scrim').style.opacity =
        Math.max(maxA, lk) * 0.9;
      hint.style.opacity = p < 0.02 ? 1 : 0;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  fit();
  onScroll();

  // arrival: Yoonki drops into the street once the page opens (frames
  // 0-9 play once; the scrub owns frame 10 onward)
  if (introPlaying) {
    const ti0 = performance.now();
    (function intro(now) {
      const k = clamp((now - ti0 - 250) / 850, 0, 1);
      if (scrollY < 40) {
        target = Math.round((1 - Math.pow(1 - k, 2)) * START);
        draw();
      }
      if (k < 1) requestAnimationFrame(intro);
      else { introPlaying = false; onScroll(); }
    })(ti0);
  }
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
lazy('.products', () => import('./cards.js').then((m) => m.initCards()));

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
