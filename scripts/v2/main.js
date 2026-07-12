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

// in-page anchors TELEPORT: smooth-scrolling through the 1800vh scrubbed
// hero (or the pinned products showcase) plays every animation between
// here and there in fast-forward — jarring, not delightful
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'instant', block: 'start' });
    history.pushState(null, '', a.getAttribute('href'));
  });
});

/* ------------------------------------------------------------------ *
 *  HERO — progressive frame-sequence scrub (Seoul -> SF)               *
 * ------------------------------------------------------------------ */
/* The hero is five sequences. Sequence 0 is an idle greeting that LOOPS
   as a <video> while the visitor hasn't scrolled (he breathes, waves).
   The first scroll hands off to a 188-frame scrub built from sequences
   1-4: the white void builds into Seoul (s000-040), Seoul becomes SF
   (s041-089), SF dissolves into the night home office (s090-138), and
   he sits down to build (s139-187) — right where the headline lands. */
const FRAMES = 188;
const SCRUB_END = 0.72;          // scroll fraction where the film finishes
const hero = document.querySelector('.hero');
const sticky = document.querySelector('.hero-sticky');
const canvas = document.getElementById('hero-canvas');
const lockin = document.querySelector('.hero-lockin');
const beats = [...document.querySelectorAll('.beat')];
const hint = document.querySelector('.hero-scroll-hint');

if (REDUCED) {
  document.body.classList.add('no-scrub');
  document.getElementById('hero-poster').src = 'assets/v2/hero2/poster.webp';
} else {
  initScrub();
}

function initScrub() {
  const ctx = canvas.getContext('2d');
  const idle = document.getElementById('hero-idle');
  const imgs = new Array(FRAMES).fill(null);
  const url = (i) => `assets/v2/hero2/s${String(i).padStart(3, '0')}.webp`;
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

  // Mild ease only — the idle loop already gives the opening its pause,
  // and four scenes deserve steady pacing. tf = film progress 0..1.
  const easeFilm = (x) => 0.55 * x + 0.45 * (x * x * (3 - 2 * x));

  // piecewise film map with DWELLS: when a scene finishes (Seoul built,
  // SF settled, office assembled) the frame HOLDS for about half a
  // scene's worth of scroll, so each completed tableau can be looked at
  // before the film moves on. [frameStart, frameEnd, weight]
  const SEGS = [
    [0, 40, 40],       // seq1: void -> Seoul
    [40, 40, 22],      //   dwell on finished Seoul
    [41, 89, 48],      // seq2: Seoul -> SF
    [89, 89, 22],      //   dwell on SF
    [90, 138, 48],     // seq3: SF -> night office
    [138, 138, 22],    //   dwell on the built office
    [139, 187, 48]     // seq4: he sits down and types
  ];
  const SEG_TOTAL = SEGS.reduce((s, g) => s + g[2], 0);
  function frameForT(t) {
    let acc = 0;
    for (const [f0, f1, w] of SEGS) {
      const span = w / SEG_TOTAL;
      if (t <= acc + span || acc + span >= 1 - 1e-6) {
        const k = clamp((t - acc) / span, 0, 1);
        return Math.round(f0 + (f1 - f0) * k);
      }
      acc += span;
    }
    return FRAMES - 1;
  }

  // text beat windows in FILM space (glued to imagery, immune to easing;
  // includes the dwells — a line HOLDS over its finished tableau).
  // Each line enters WITH its scenery, not after it: the greeting hands
  // off the moment the first Seoul pieces materialize, SEOUL rises while
  // the hanok street assembles and holds through its dwell, SAN
  // FRANCISCO rises as the bridge emerges from the fog and holds through
  // its dwell, and the lock-in lands while the night office builds.
  // Beat 0 opens at -1: the greeting is ON SCREEN from the first paint.
  const WINDOWS = [[-1, 0.05], [0.055, 0.235], [0.34, 0.515]];
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
      const k = clamp((now - t0 - 450) / 950, 0, 1);   // rises as he waves
      first.style.setProperty('--r', (1 - Math.pow(1 - k, 3)) * 100);
      if (k < 1) requestAnimationFrame(rise);
    })(t0);
  }

  // seq0 -> seq1 handoff without a jump cut: if the visitor scrolls while
  // the wave is mid-air (idle loop ~3.2-6.85s), keep the video on stage
  // and hurry it along (2.4x) until the hand is back down — only then
  // crossfade to the scrub. Scrolling from a neutral pose hands off
  // immediately, since seq1 opens on the same stance.
  const WAVE_START = 3.2, WAVE_END = 6.85;
  let settling = false;
  function updateStage(scrubbing) {
    if (!scrubbing) {
      settling = false;
      idle.playbackRate = 1;
      canvas.style.opacity = 0;
      idle.classList.remove('off');
      if (idle.paused) idle.play().catch(() => {});
      return;
    }
    const t = idle.currentTime;
    if (!settling) settling = !idle.paused && t > WAVE_START && t < WAVE_END;
    else settling = t < WAVE_END;          // done once the hand lands
    if (settling) {
      idle.playbackRate = 2.4;
      if (idle.paused) idle.play().catch(() => {});
      canvas.style.opacity = 0;
      idle.classList.remove('off');
      requestAnimationFrame(onScroll);     // keep watching even if the
    } else {                               // scroll wheel goes quiet
      idle.playbackRate = 1;
      if (!idle.paused) idle.pause();
      canvas.style.opacity = 1;
      idle.classList.add('off');
    }
  }

  // end-of-film typing loop state (frames 176-187, ping-pong at ~9fps)
  const TYPE_FROM = 176;
  let typing = false, typeFrame = FRAMES - 1, typeDir = -1, typeT = 0;
  function typeLoop(now) {
    if (!typing) return;
    if (now - typeT > 115) {
      typeT = now;
      typeFrame += typeDir;
      if (typeFrame <= TYPE_FROM) { typeFrame = TYPE_FROM; typeDir = 1; }
      else if (typeFrame >= FRAMES - 1) { typeFrame = FRAMES - 1; typeDir = -1; }
      target = typeFrame;
      draw();
    }
    requestAnimationFrame(typeLoop);
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
      // idle loop owns the stage until the first real scroll (finishing
      // the wave if one is mid-air), then the scrub canvas fades in over
      // it — and hands back when you return to the top
      updateStage(p > 0.004);
      // once the film has fully played out, the last beat of typing
      // loops gently (ping-pong) — he keeps building while the visitor
      // reads the headline; any scroll-back returns control to the scrub
      const done = tf >= 0.9995;
      if (!done) {
        typing = false;
        target = frameForT(tf);
      } else if (!typing) {
        typing = true;
        typeFrame = FRAMES - 1;
        typeDir = -1;
        typeT = 0;
        requestAnimationFrame(typeLoop);
      }
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
      // the headline locks in WHILE the night office assembles around him
      // — "by night" settles as he sits down to build, then holds to the
      // hero's end
      const lk = clamp((p - 0.46) / 0.09, 0, 1);
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
