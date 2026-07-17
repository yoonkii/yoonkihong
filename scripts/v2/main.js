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
const DBG_P_NUM = DBG.get('p') !== null ? parseFloat(DBG.get('p')) : NaN;
const DBG_P = Number.isFinite(DBG_P_NUM) ? DBG_P_NUM : null;
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
const SCRUB_END = 0.9;           // scroll fraction where the film finishes
                                 // (hero height shrank with it in r26 — the
                                 // film's vh-per-frame pacing is unchanged,
                                 // only the post-film anchor tail is shorter)
const hero = document.querySelector('.hero');
const sticky = document.querySelector('.hero-sticky');
const canvas = document.getElementById('hero-canvas');
const lockin = document.querySelector('.hero-lockin');
const beats = [...document.querySelectorAll('.beat')];
const hint = document.querySelector('.hero-scroll-hint');
const hpRail = document.querySelector('.hero-progress');
const hpFill = document.getElementById('hp-fill');

if (REDUCED) {
  document.body.classList.add('no-scrub');
  document.getElementById('hero-poster').src = 'assets/v2/hero2/poster.webp';
  // the hidden idle video must not keep downloading and looping for a
  // visitor who asked for less motion — cancel its fetch outright
  const idle = document.getElementById('hero-idle');
  idle.removeAttribute('autoplay');
  idle.pause();
  idle.removeAttribute('src');
  idle.load();
} else {
  initScrub();
}

function initScrub() {
  const ctx = canvas.getContext('2d');
  const idle = document.getElementById('hero-idle');
  const imgs = new Array(FRAMES).fill(null);
  // phones get the 960px rung (~8.5MB) instead of the 1920px one (~21MB)
  // — chosen once at init off the same breakpoint the CSS uses
  const DIR = matchMedia('(max-width: 720px)').matches
    ? 'assets/v2/hero2/m/' : 'assets/v2/hero2/';
  const url = (i) => `${DIR}s${String(i).padStart(3, '0')}.webp`;
  let drawn = -1;

  // progressive fill: coarse pass first so scrubbing works within ~1s,
  // then refine — mid-scroll the nearest loaded frame stands in
  function load(i, then) {
    if (imgs[i]) return then && then();
    const im = new Image();
    im.decoding = 'async';
    // unforced: draw() skips when the nearest frame for the current
    // target is already on the canvas — no 188-redraw flood during load
    im.onload = () => { imgs[i] = im; draw(); then && then(); };
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
    [138, 138, 12],    //   dwell on the built office (short — the
                       //   headline already holds here; auto-play SKIPS it)
    [139, 150, 8],     // seq4a: he turns toward the desk — brisk, because
                       //   the source frames 143-150 are near-identical and
                       //   a slow pass here reads as a stutter (r26 fix)
    [150, 187, 40]     // seq4b: sit down, start typing
  ];
  const SEG_TOTAL = SEGS.reduce((s, g) => s + g[2], 0);
  // auto-play must never freeze mid-flight: a dwell is for scrub-watchers
  // who control their own pace — when the film is playing ITSELF, a held
  // frame reads as a hitch, so the clock jumps a dwell the moment it
  // lands inside one
  function skipDwell(t) {
    let acc = 0;
    for (const [f0, f1, w] of SEGS) {
      const span = w / SEG_TOTAL;
      if (f0 === f1 && t > acc && t < acc + span) return acc + span;
      acc += span;
    }
    return t;
  }
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
  // the wave is mid-air, keep the video on stage and hurry it along
  // (2.4x) until the hand is back down — only then crossfade to the
  // scrub. The idle video is a baked palindrome (8s forward + 8s
  // reversed, so its loop point is seamless), which means the wave
  // happens twice: once forward, once mirrored in the reversed half.
  const WAVES = [[3.2, 6.85], [9.23, 12.88]];
  let settling = false, settleUntil = 0;
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
    if (!settling) {
      const w = !idle.paused && WAVES.find(([a, b]) => t > a && t < b);
      if (w) { settling = true; settleUntil = w[1]; }
    } else settling = t < settleUntil;     // done once the hand lands
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

  // end-of-film typing loop state: frames 182-187 only — the pose and
  // chair are fully settled there, so the ping-pong reads as pure typing
  const TYPE_FROM = 182;
  let typing = false, typeFrame = FRAMES - 1, typeDir = -1, typeT = 0;
  function typeLoop(now) {
    if (!typing) return;
    if (scrollY >= hero.offsetHeight) {  // hero left the screen — sleep;
      typing = false;                    // onScroll rearms on the way back
      return;
    }
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

  // once the lock-in headline is on screen, the rest of the film plays
  // ITSELF — the visitor can park and watch him sit down and start
  // typing. Scrolling only ever fast-forwards past it (the film never
  // rewinds unless you scroll back above the lock-in, which resets).
  const AUTO_FROM = 0.55;                // scroll p that arms auto-play
  // reset only well ABOVE the arm line: without this hysteresis a visitor
  // idling right at the boundary flip-flops arm/reset and the same beat
  // (the head turn into seq4) replays over and over
  const AUTO_RESET = AUTO_FROM - 0.05;
  const AUTO_RATE = 0.085;               // film-t per second (~4.5s tail)
  let autoTf = 0, autoOn = false, autoClock = 0;
  function autoLoop(now) {
    if (!autoOn) return;
    if (scrollY >= hero.offsetHeight || document.hidden) { autoOn = false; return; }
    const max = hero.offsetHeight - innerHeight;
    const p = DBG_P !== null ? DBG_P
      : clamp((scrollY - hero.offsetTop) / max, 0, 1);
    if (p < AUTO_RESET) { autoOn = false; autoTf = 0; return; }
    const dt = Math.min(0.05, (now - autoClock) / 1000 || 0.016);
    autoClock = now;
    autoTf = Math.min(1, Math.max(autoTf, easeFilm(clamp(p / SCRUB_END, 0, 1))) + AUTO_RATE * dt);
    autoTf = skipDwell(autoTf);
    target = frameForT(autoTf);
    draw();
    if (autoTf >= 0.9995) {              // film finished — typing takes over
      autoOn = false;
      if (!typing && scrollY < hero.offsetHeight) {
        typing = true;
        typeFrame = FRAMES - 1;
        typeDir = -1;
        typeT = 0;
        requestAnimationFrame(typeLoop);
      }
      return;
    }
    requestAnimationFrame(autoLoop);
  }

  /* -------------------- scene-anchor drift (r27) --------------------
     Park anywhere mid-scene and the page glides ITSELF to the next
     anchor — the moment a scene finishes assembling — then rests there
     until the visitor scrolls again. Because the glide moves the real
     scroll position, everything scroll-derived (film, beats, scrim,
     progress rail) follows for free and no reconciliation between a
     "drifted" film and the scrollbar is ever needed. Anchors:
       1. Seoul complete  (start of the Seoul dwell)
       2. SF complete     (start of the SF dwell)
       3. the lock-in tableau (p 0.7 — past AUTO_FROM, so the film
          autoplay carries seq4 while the page rises the headline)
     Wheel / touch / key input cancels instantly: the visitor always
     outranks the glide. */
  const DWELLS = [];
  {
    let acc = 0;
    for (const [f0, f1, w] of SEGS) {
      const span = w / SEG_TOTAL;
      if (f0 === f1) DWELLS.push([acc, acc + span]);
      acc += span;
    }
  }
  // invert easeFilm (monotonic) -> the scroll p that shows film-t
  function pForT(t) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (easeFilm(mid) < t) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2 * SCRUB_END;
  }
  const DRIFT_STOPS = [pForT(DWELLS[0][0]), pForT(DWELLS[1][0]), 0.7];
  const DRIFT_RATE = 0.0325;  // hero-p per second — a gentle glide
                              // (r27 0.05 rushed -> r28 0.025 -> r29
                              // nudged +30% to 0.0325, still calm)
  const IDLE_MS = 550;
  let idleTimer = 0, drifting = false, driftRaf = 0, expectY = -1;

  function cancelDrift() {
    drifting = false;
    cancelAnimationFrame(driftRaf);
  }
  function armIdle() {
    clearTimeout(idleTimer);
    if (DBG_P !== null) return;          // pinned progress: never glide
    idleTimer = setTimeout(tryDrift, IDLE_MS);
  }
  function tryDrift() {
    if (drifting || document.hidden) return;
    if (document.querySelector('.capsule-card.open')) return;
    const max = hero.offsetHeight - innerHeight;
    if (max <= 0) return;
    const p = (scrollY - hero.offsetTop) / max;
    // only a committed scroller (past the greeting), only inside the
    // hero, and never once the lock-in tableau is reached — the typing
    // loop owns the rest
    if (p < 0.03 || p > DRIFT_STOPS[2] - 0.012) return;
    const tf = Math.max(easeFilm(clamp(p / SCRUB_END, 0, 1)), autoTf);
    // already resting on a finished scene (inside the Seoul/SF dwell)?
    // that IS the anchor — stay put. (The office dwell is not a resting
    // place: its anchor experience is the lock-in tableau at p 0.7.)
    if (DWELLS.slice(0, 2).some(([a, b]) => tf > a - 0.012 && tf < b + 0.008)) return;
    const stop = DRIFT_STOPS.find((s) => s > p + 0.012);
    if (stop === undefined) return;
    drifting = true;
    let driftP = p, last = 0;
    (function glide(now) {
      if (!drifting) return;
      if (document.hidden) return cancelDrift();
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      driftP = Math.min(stop, driftP + DRIFT_RATE * dt);
      expectY = Math.round(hero.offsetTop + driftP * (hero.offsetHeight - innerHeight));
      scrollTo(0, expectY);
      if (driftP >= stop) { drifting = false; return; }  // rest at anchor
      driftRaf = requestAnimationFrame(glide);
    })(0);
  }
  // bookkeeping: our own scrollTo lands exactly on expectY — anything
  // else is the visitor, who cancels the glide and re-arms the idle
  addEventListener('scroll', () => {
    if (drifting && Math.abs(scrollY - expectY) < 3) return;
    cancelDrift();
    armIdle();
  }, { passive: true });
  for (const ev of ['wheel', 'touchstart'])
    addEventListener(ev, () => { cancelDrift(); armIdle(); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (/^(Arrow|Page|Home|End)/.test(e.key) || e.key === ' ') { cancelDrift(); armIdle(); }
  });

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
      if (p < AUTO_RESET) autoTf = 0;    // back above the lock-in: scroll owns
      const eff = Math.max(tf, autoTf);  // the film never rewinds mid-auto
      // idle loop owns the stage until the first real scroll (finishing
      // the wave if one is mid-air), then the scrub canvas fades in over
      // it — and hands back when you return to the top
      updateStage(p > 0.004);
      // once the film has fully played out, the last beat of typing
      // loops gently (ping-pong) — he keeps building while the visitor
      // reads the headline; any scroll-back returns control to the scrub
      const done = eff >= 0.9995;
      if (!done) {
        typing = false;
        target = frameForT(eff);
        if (p >= AUTO_FROM && !autoOn) { // headline on screen: roll film
          autoOn = true;
          autoClock = 0;
          requestAnimationFrame(autoLoop);
        }
      } else if (!typing && scrollY < hero.offsetHeight) {
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
      const lk = clamp((p - 0.6) / 0.09, 0, 1);
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
      lockin.querySelector('.hero-cta').style.opacity = tail;
      // bottom scrim carries whichever type is on screen
      document.getElementById('hero-scrim').style.opacity =
        Math.max(maxA, lk) * 0.9;
      hint.style.opacity = p < 0.02 ? 1 : 0;
      // film progress rail: visible while the story scrubs, gone at rest
      hpFill.style.height = (p * 100) + '%';
      hpRail.classList.toggle('on', p > 0.01 && p < 0.985);
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  fit();
  onScroll();
}

/* ------------------------------------------------------------------ *
 *  LAZY three.js sections                                              *
 * ------------------------------------------------------------------ */
function lazy(selector, loader, onFail) {
  const el = document.querySelector(selector);
  if (!el) return;
  let done = false, poll = 0;
  const go = () => {
    if (done) return;
    done = true;
    io.disconnect();
    clearInterval(poll);
    loader().catch((err) => {
      console.warn('[v2] section failed, fallback on:', err);
      onFail && onFail();      // import failure (CDN down) must still
    });                        // leave a working section behind
  };
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) go();
  }, { rootMargin: '600px' });
  io.observe(el);
  // safety net for throttled tabs where IO dispatch lags: a light poll
  // that loads only when the section is genuinely CLOSE — the old
  // load-on-first-scroll net used to boot both 3D sections right at the
  // top of the hero, stealing bandwidth from the film
  poll = setInterval(() => {
    if (el.getBoundingClientRect().top < innerHeight + 900) go();
  }, 2000);
}
// the DOM fallback for products lives HERE (not in cards.js) so it still
// works when the three.js import itself fails; cards.js also calls it
// for the no-WebGL and reduced-motion paths
function productsFallback() {
  const ul = document.getElementById('capsule-fallback');
  if (!ul || !ul.hidden) return;
  const list = (window.PROJECTS || []).filter((p) => !(p.kind === 'egg' && p.id === 'x'));
  for (const p of list) {
    const li = document.createElement('li');
    const a = document.createElement(p.url ? 'a' : 'span');
    if (p.url) { a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; }
    const img = document.createElement('img');
    img.src = p.sprite || 'images/game/creatures/egg.png';
    img.alt = '';
    a.append(img, document.createTextNode(p.name + (p.kind === 'egg' ? ' · soon' : '')));
    li.appendChild(a);
    ul.appendChild(li);
  }
  ul.hidden = false;
  document.getElementById('capsule-canvas').hidden = true;
  const stage = document.querySelector('.capsule-stage');
  if (stage) stage.classList.add('fall');   // back to normal flow
}

// wait for the webfonts too — the 3D sections bake Geist into canvas
// textures, and a cold-cache paint before the woff2 arrives would bake
// the fallback font permanently
const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
lazy('.work',
  () => Promise.all([import('./work.js'), fontsReady]).then(([m]) => m.initWork()),
  () => document.querySelectorAll('.work-card').forEach((c) => c.classList.add('lit')));
lazy('.products',
  () => Promise.all([import('./cards.js'), fontsReady]).then(([m]) => m.initCards(productsFallback)),
  productsFallback);

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
