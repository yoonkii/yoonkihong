/* ============================================================================
   classic v2 — products as a hand-held 3D card fan.
   Each project is a trading card: colored header with its creature sprite,
   name + tagline on warm paper, gold-monogram back. Hover slides a card up
   out of the fan; click opens the detail modal (live screenshot + story +
   link). No physics — calm, precise, tactile.
   ========================================================================== */

import * as THREE from 'three';

const CARD_COLORS = {
  macrodoc: '#7FD4D9', mathstreet: '#F7D75E', mathwings: '#8FB7F0',
  funnify: '#FFB35C', lasthand: '#B8A7F0', gunball: '#FF8E72',
  gomokulike: '#8FD05C', suno: '#F5A8C0', substack: '#C9B79C'
};

const CW = 512, CH = 716, RAD = 40;    // face texture space

/* card silhouette: an extruded rounded-rect. RoundedBoxGeometry rounds
   EDGES, and on a 0.04-thin slab the radius is capped at depth/2 — the
   corners stayed visually square while the painted keyline rounded (r25
   report: "카드 모서리가 각져 보임"). The extruded shape cuts the true
   corner radius (matched to the texture's RAD) into the silhouette. */
function makeCardGeometry(w, h, d, r) {
  const hw = w / 2, hh = h / 2;
  const shape = new THREE.Shape();
  shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2);
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI);
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5);
  shape.absarc(hw - r, -hh + r, r, Math.PI * 1.5, Math.PI * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d, bevelEnabled: false, curveSegments: 10
  });
  geo.translate(0, 0, -d / 2);
  // extrude UVs come out in shape units — remap the caps to 0..1 so the
  // face texture spans the card exactly (the side walls are a solid
  // color material, their UVs don't matter)
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let vi = 0; vi < uv.count; vi++)
    uv.setXY(vi, (pos.getX(vi) + hw) / w, (pos.getY(vi) + hh) / h);
  return geo;
}

/* soft drop shadow quad behind each card: neighboring cards are all the
   same paper white, so where the stack (or fan) overlaps, the boundary
   vanished — a blurred dark rounded-rect behind the card draws the seam */
function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(16px)';
  g.fillStyle = 'rgba(18, 24, 36, 0.62)';
  g.beginPath();
  g.roundRect(40, 40, 176, 176, 36);
  g.fill();
  return new THREE.CanvasTexture(c);
}

function roundedPath(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function makeFaceTexture(p, isSoon) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const col = CARD_COLORS[p.id] || '#CFCBC2';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let sprite = null, shot = null;

  function blob(x, y, r, alpha) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, colA(col, alpha));
    rg.addColorStop(1, colA(col, 0));
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function keyline() {
    roundedPath(g, 3, 3, CW - 6, CH - 6, RAD - 2);
    g.strokeStyle = 'rgba(34,38,46,0.10)';
    g.lineWidth = 2;
    g.stroke();
  }

  /* LIVE projects: an editorial photo card — the product screenshot up
     top, the creature as a floating badge on the seam, name/tagline on
     warm paper below, a LIVE chip in the project color */
  function paintLive() {
    const PH = 408;                          // photo area height
    // fill the FULL rect — transparent texels render black on the unlit
    // face; the 3D geometry rounds the silhouette anyway
    g.fillStyle = '#FDFCF8';
    g.fillRect(0, 0, CW, CH);
    // the artwork sits INSET on the paper (print margin) — full-bleed
    // pixels smear around the rounded geometry's corner bevel otherwise
    const M = 14;
    g.save();
    roundedPath(g, M, M, CW - M * 2, PH - M, 30);
    g.clip();
    if (shot) {
      const aw = CW - M * 2, ah = PH - M;
      const s = Math.max(aw / shot.width, ah / shot.height);
      g.drawImage(shot, M + (aw - shot.width * s) / 2, M, shot.width * s, shot.height * s);
    } else {
      const ph = g.createLinearGradient(0, 0, 0, PH);
      ph.addColorStop(0, colA(col, 0.6));
      ph.addColorStop(1, colA(col, 0.15));
      g.fillStyle = ph;
      g.fillRect(M, M, CW - M * 2, PH - M);
    }
    // the artwork dissolves into the paper — no hard bottom edge
    const fade = g.createLinearGradient(0, PH - 92, 0, PH + 2);
    fade.addColorStop(0, 'rgba(253,252,248,0)');
    fade.addColorStop(1, 'rgba(253,252,248,1)');
    g.fillStyle = fade;
    g.fillRect(0, PH - 92, CW, 94);
    g.restore();
    // creature badge floating on the seam
    if (sprite) {
      g.save();
      g.shadowColor = 'rgba(30,36,48,0.25)';
      g.shadowBlur = 18;
      g.shadowOffsetY = 6;
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(96, 372, 58, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(34,38,46,0.08)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(96, 372, 58, 0, Math.PI * 2); g.stroke();
      g.imageSmoothingEnabled = false;
      g.drawImage(sprite, 96 - 40, 372 - 40, 80, 80);
      g.imageSmoothingEnabled = true;
    }
    // name + tagline, left aligned like the editorial reference
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#22262E';
    g.font = '800 37px Geist, sans-serif';
    g.fillText(p.name, 36, 496, CW - 72);
    g.font = '500 21px Geist, sans-serif';
    g.fillStyle = '#5D6470';
    wrapText(g, p.tagline || '', 36, 534, CW - 80, 30, 2);
    // footer: live chip in the project color + open cue
    const chipW = 122;
    g.fillStyle = colA(col, 0.3);
    roundedPath(g, 36, CH - 86, chipW, 44, 22);
    g.fill();
    g.fillStyle = '#22262E';
    g.font = '700 18px "Geist Mono", monospace';
    g.textAlign = 'center';
    g.fillText('● LIVE', 36 + chipW / 2, CH - 57);
    g.textAlign = 'right';
    g.fillStyle = '#E8552F';
    g.font = '600 20px "Geist Mono", monospace';
    g.fillText('OPEN →', CW - 36, CH - 57);
    keyline();
  }

  /* eggs keep the liquid-glass look — a promise, not a product yet */
  function paintEgg() {
    const base = g.createLinearGradient(0, 0, 0, CH);
    base.addColorStop(0, '#FFFFFF');
    base.addColorStop(0.5, '#F7FAFE');
    base.addColorStop(1, '#EFF3FA');
    g.fillStyle = base;
    g.fillRect(0, 0, CW, CH);
    const tint = g.createLinearGradient(0, 0, 0, CH);
    tint.addColorStop(0, colA(col, 0.5));
    tint.addColorStop(0.5, colA(col, 0.16));
    tint.addColorStop(1, colA(col, 0.06));
    g.fillStyle = tint;
    g.fillRect(0, 0, CW, CH);
    blob(110, 150, 280, 0.8);
    blob(430, 80, 220, 0.65);
    blob(430, 640, 250, 0.35);
    blob(60, 690, 180, 0.3);
    if (sprite) {
      g.fillStyle = 'rgba(30,36,48,0.10)';
      g.beginPath();
      g.ellipse(CW / 2, 300, 92, 16, 0, 0, Math.PI * 2);
      g.fill();
      g.imageSmoothingEnabled = false;
      const S = 232;
      g.globalAlpha = 0.88;
      g.drawImage(sprite, (CW - S) / 2, 66, S, S);
      g.globalAlpha = 1;
      g.imageSmoothingEnabled = true;
    }
    g.fillStyle = '#22262E';
    g.font = '800 40px Geist, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(p.name, CW / 2, 424, CW - 80);
    g.font = '500 23px Geist, sans-serif';
    g.fillStyle = '#5D6470';
    wrapText(g, p.tagline || '', CW / 2, 470, CW - 96, 32, 2);
    g.strokeStyle = 'rgba(34,38,46,0.12)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(64, CH - 96); g.lineTo(CW - 64, CH - 96); g.stroke();
    g.font = '600 20px "Geist Mono", monospace';
    g.fillStyle = '#9A948A';
    g.fillText('H A T C H I N G   S O O N', CW / 2, CH - 50);
    g.save();
    roundedPath(g, 6, 6, CW - 12, CH - 12, RAD);
    g.clip();
    const sh = g.createLinearGradient(0, 0, CW, CH * 0.6);
    sh.addColorStop(0, 'rgba(255,255,255,0.38)');
    sh.addColorStop(0.28, 'rgba(255,255,255,0.1)');
    sh.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, CW, CH);
    g.restore();
    roundedPath(g, 9, 9, CW - 18, CH - 18, RAD - 6);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3.5;
    g.stroke();
    keyline();
  }

  function paint() {
    (isSoon ? paintEgg : paintLive)();
    tex.needsUpdate = true;
  }

  paint();
  const si = new Image();
  si.onload = () => { sprite = si; paint(); };
  si.src = p.sprite || 'images/game/creatures/egg.png';
  if (!isSoon) {
    const sh = new Image();
    sh.onload = () => { shot = sh; paint(); };
    // illustrated artwork first; the live screenshot is the fallback
    sh.onerror = () => { sh.onerror = null; sh.src = 'images/v2/shots/' + p.id + '.webp'; };
    sh.src = 'images/v2/art/' + p.id + '.webp';
  }
  return tex;
}

function colA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

function wrapText(g, text, x, y, maxW, lh, maxLines) {
  // greedy wrap; if the text needs more lines than allowed, the last
  // visible line keeps as many words as fit and gains an ellipsis —
  // nothing is silently dropped mid-sentence
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const probe = line ? line + ' ' + w : w;
    if (g.measureText(probe).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = probe;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    let rest = lines.slice(maxLines - 1).join(' ');
    while (rest.includes(' ') && g.measureText(rest + '…').width > maxW)
      rest = rest.slice(0, rest.lastIndexOf(' '));
    lines.length = maxLines - 1;
    lines.push(rest + '…');
  }
  lines.forEach((ln, li) => g.fillText(ln, x, y + li * lh, maxW));
}

export function initCards(domFallback) {
  const DBG_SP_RAW = new URLSearchParams(location.search).get('sp');
  const DBG_SP_NUM = DBG_SP_RAW !== null ? parseFloat(DBG_SP_RAW) : NaN;
  const DBG_SP = Number.isFinite(DBG_SP_NUM) ? DBG_SP_NUM : null;
  const canvas = document.getElementById('capsule-canvas');
  const projects = (window.PROJECTS || []);
  // 'x' is a social link, not a product — excluded from this page even
  // if it is ever promoted from egg to creature in data/projects.js
  const live = projects.filter((p) => p.kind !== 'egg' && p.id !== 'x');
  const soon = projects.filter((p) => p.kind === 'egg' && p.id !== 'x');
  const items = [...live, ...soon];

  // reduced motion gets the plain accessible list — every project name,
  // description and link reachable with zero animation
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && domFallback)
    return domFallback();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return domFallback && domFallback(); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xDCE6F0, 0.95));
  const key = new THREE.DirectionalLight(0xFFF3E0, 0.5);
  key.position.set(-3, 5, 8);
  scene.add(key);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = items.length;
  const CTR = (N - 1) / 2;
  // the cards never turn far enough to show their backs (max ~7° of
  // sway), so edges and back share one simple lit material
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#F4F7FB', roughness: 0.45 });
  const fan = new THREE.Group();
  scene.add(fan);

  // one geometry for all nine cards; radius = the texture keyline's RAD
  // translated into card units, so silhouette and painted border agree
  const cardGeo = makeCardGeometry(1.5, 2.1, 0.04, RAD / CW * 1.5);
  const shadowGeo = new THREE.PlaneGeometry(1.5 * 1.26, 2.1 * 1.18);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: makeShadowTexture(), transparent: true, opacity: 0.55,
    depthWrite: false
  });

  const cards = items.map((p, i) => {
    const isSoon = p.kind === 'egg';
    // UNLIT face: the texture renders exactly as painted — no light rig
    // can overexpose it (the glass look lives in the painted sheen)
    const faceMat = new THREE.MeshBasicMaterial({
      map: makeFaceTexture(p, isSoon)
    });
    // extrude groups: 0 = front/back caps, 1 = side walls
    const m = new THREE.Mesh(cardGeo, [faceMat, edgeMat]);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, -0.055, -0.1);
    shadow.raycast = () => {};   // picking must only ever hit the card
    m.add(shadow);
    const k = i - CTR;
    const home = {
      x: k * 0.58,
      y: -Math.pow(Math.abs(k), 1.4) * 0.055,
      // leftmost on top; the gap comfortably exceeds card thickness so
      // settling cards can never interpenetrate a neighbor (z-flicker fix)
      z: (N - 1 - i) * 0.06,
      rz: -k * 0.072
    };
    m.userData = { i, p, isSoon, home, lift: 0 };
    m.position.set(home.x, home.y, home.z);
    m.rotation.z = home.rz;
    fan.add(m);
    return m;
  });

  /* ---------------- scroll showcase: split-screen stack ----------------
     Past the fan, the section pins and turns into a split screen: the
     cards re-stack VERTICALLY on the left (active card centered, its
     neighbors peeking above and below) while the active project's
     detail — screenshot, story, live link — sits on the right. Scroll
     walks the stack card by card; clicking a peeking card jumps to it. */
  const section = document.querySelector('.products');
  const SEG_VH = 55;
  if (!REDUCED) section.style.height = `calc(100vh + ${N * SEG_VH}vh)`;
  // the fan holds the stage for the first quarter of the scroll, then
  // hands over to the stack — arriving visitors always see the full deck
  const FAN_END = 0.24, TAIL = 0.06;
  // the presented card is BIG — it anchors the split screen
  // x / s / yOff are re-set per aspect in fit()
  const STACK = { x: -2.1, gap: 2.0, z: 1.15, s: 1.38, yOff: 0.3 };
  const smooth = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, t) => a + (b - a) * t;
  // continuous stack cursor: 0 = first card centered, N-1 = last
  const jFracOf = (P) =>
    Math.min(N - 1, Math.max(0, (P - FAN_END) / (1 - FAN_END - TAIL) * (N - 1)));
  const pOf = (j) => FAN_END + (N > 1 ? j / (N - 1) : 0) * (1 - FAN_END - TAIL);
  function scrollToCard(j) {
    const total = section.offsetHeight - innerHeight;
    window.scrollTo({ top: section.offsetTop + pOf(j) * total, behavior: 'smooth' });
  }

  const sticky = document.querySelector('.products-sticky');
  // progress rail: one clickable dot per project
  const rail = document.getElementById('stack-rail');
  const dots = items.map((p, j) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = p.name;
    b.addEventListener('click', () => scrollToCard(j));
    rail.appendChild(b);
    return b;
  });

  const info = document.getElementById('show-info');
  const siIdx = document.getElementById('si-idx');
  const siName = document.getElementById('si-name');
  const siTag = document.getElementById('si-tag');
  const siDesc = document.getElementById('si-desc');
  const siVisit = document.getElementById('si-visit');
  const siShot = document.getElementById('si-shot');
  let infoJ = -1;
  let stackMode = false;
  let lastStaged = null;
  let lastJFrac = 0;
  // DOM writes are cached — the loop runs at 60fps but the panel only
  // needs touching when its values actually move
  let lastOp = -1, lastDy = 1e9;
  function setPanel(op, dy) {
    op = Math.round(op * 200) / 200;
    dy = Math.round(dy * 2) / 2;
    if (op !== lastOp) {
      lastOp = op;
      info.style.opacity = op;
      info.classList.toggle('live', op > 0.5);
      info.inert = op <= 0.5;
    }
    if (dy !== lastDy) {
      lastDy = dy;
      info.style.setProperty('--dy', dy + 'px');
    }
  }
  function setInfo(j) {
    infoJ = j;
    dots.forEach((d, di) => d.classList.toggle('on', di === j));
    const p = items[j];
    siIdx.textContent = String(j + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
    siName.textContent = p.name;
    siTag.textContent = p.tagline || '';
    siDesc.textContent = p.desc || '';
    if (p.url) { siVisit.href = p.url; siVisit.hidden = false; } else siVisit.hidden = true;
    // the card face carries the illustration, the panel carries the REAL
    // product: live screenshot on top (eggs have nothing to show yet)
    if (p.kind === 'egg') {
      siShot.hidden = true;
    } else {
      siShot.hidden = false;
      siShot.src = 'images/v2/shots/' + p.id + '.webp';
      siShot.onerror = () => { siShot.hidden = true; };
    }
  }

  /* ---------------- detail modal ---------------- */
  const card = document.getElementById('capsule-card');
  const veil = document.getElementById('card-veil');
  const ccName = document.getElementById('cc-name');
  const ccTag = document.getElementById('cc-tagline');
  const ccDesc = document.getElementById('cc-desc');
  const ccVisit = document.getElementById('cc-visit');
  const ccSprite = document.getElementById('cc-sprite');
  const ccShot = document.getElementById('cc-shot');
  document.getElementById('cc-close').addEventListener('click', closeCard);
  veil.addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
  let hideTimer = 0;
  function openCard(p, isSoon) {
    clearTimeout(hideTimer);               // a reopen within the close
    ccName.textContent = p.name;           // animation must not be hidden
                                           // by the stale timer
    ccTag.textContent = p.tagline || '';
    ccDesc.textContent = p.desc || '';
    ccSprite.src = p.sprite || 'images/game/creatures/egg.png';
    ccSprite.onerror = () => { ccSprite.src = 'images/game/creatures/egg.png'; };
    if (isSoon) {
      ccShot.hidden = true;
    } else {
      ccShot.hidden = false;
      ccShot.src = 'images/v2/shots/' + p.id + '.webp';
      ccShot.onerror = () => { ccShot.hidden = true; };
    }
    if (p.url) { ccVisit.href = p.url; ccVisit.hidden = false; } else ccVisit.hidden = true;
    card.hidden = false;
    veil.hidden = false;
    requestAnimationFrame(() => { card.classList.add('open'); veil.classList.add('open'); });
  }
  function closeCard() {
    if (card.hidden) return;               // Escape with no modal open
    card.classList.remove('open');
    veil.classList.remove('open');
    hideTimer = setTimeout(() => { card.hidden = true; veil.hidden = true; }, 300);
  }

  /* ---------------- pointer ---------------- */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2(-2, -2);
  let hover = -1;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => { ptr.set(-2, -2); hover = -1; });
  // clicks pick at the CLICK coordinates, not the hover state — taps on
  // touch devices fire click without any pointermove, so hover-based
  // picking would make the whole section dead on phones
  function pickAt(e) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(cards)[0];
    return hit ? hit.object.userData.i : -1;
  }
  canvas.addEventListener('click', (e) => {
    const j = pickAt(e);
    if (j < 0) return;
    // in stack mode a peeking card is navigation: scroll the stack to it
    if (stackMode && Math.abs(j - Math.round(lastJFrac)) >= 1) {
      scrollToCard(j);
      return;
    }
    const u = cards[j].userData;
    openCard(u.p, u.isSoon);
  });

  let baseDist = 9;
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const halfW = CTR * 0.58 + 1.75;               // fan half-width + margin
    const distW = halfW / Math.tan(cam.fov * Math.PI / 360) / cam.aspect;
    const distH = 2.05 / Math.tan(cam.fov * Math.PI / 360);
    baseDist = Math.max(distW, distH, 5.5);
    cam.position.set(0, 0.12, baseDist);
    cam.lookAt(0, 0.02, 0);
    // narrow viewports: card centered, lifted above the bottom sheet,
    // slightly smaller so it clears the dolly-in camera's frame. Wide
    // viewports pull the card toward center so card + panel read as one
    // tight two-column lockup (the rail owns the far-left edge)
    const mob = cam.aspect < 1.1;
    STACK.x = mob ? 0 : -1.5;
    STACK.s = mob ? 1.18 : 1.38;
    STACK.yOff = mob ? 0.6 : 0.15;   // full-height canvas: near-center
    // phones: the dollied-in camera made the white top/bottom margins of
    // neighboring cards touch the active card — widen the pitch so a
    // strip of sky (plus the drop shadow) separates them
    STACK.gap = mob ? 2.3 : 2.0;
  }
  addEventListener('resize', fit);
  fit();

  // the render loop SLEEPS while the section is offscreen — the observer
  // wakes it, and the loop stops rescheduling itself when hidden
  let visible = true, rafOn = false;
  function startLoop() {
    if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }
  }
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible) startLoop();
  }, { rootMargin: '100px' }).observe(canvas);

  const clock = new THREE.Clock();
  function loop() {
    if (!visible) { rafOn = false; return; }
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();

    // pick — topmost hit wins (raycaster sorts by distance)
    ray.setFromCamera(ptr, cam);
    const hit = ptr.x > -2 ? ray.intersectObjects(cards)[0] : null;
    const hi = hit ? hit.object.userData.i : -1;
    if (hi !== hover) {
      hover = hi;
      canvas.style.cursor = hi >= 0 ? 'pointer' : '';
    }

    // section scroll progress drives the showcase (?sp=0.4 pins it in dev)
    const total = section.offsetHeight - innerHeight;
    const P = DBG_SP !== null ? DBG_SP
      : REDUCED || total <= 0 ? 0
      : Math.min(1, Math.max(0, (scrollY - section.offsetTop) / total));

    // fan -> split-screen blend, then the stack cursor takes over.
    // The blend starts halfway into the fan's held stretch and completes
    // just before the stack cursor starts moving at FAN_END — derived,
    // so retuning FAN_END can't break the invariant (or divide by zero)
    const blendStart = FAN_END * 0.5;
    const showPhase = smooth(Math.min(1, Math.max(0,
      (P - blendStart) / Math.max(0.02, FAN_END - 0.01 - blendStart))));
    const jFrac = jFracOf(P);
    lastJFrac = jFrac;
    // phones: the fan needs a distant camera to frame the whole spread,
    // but the stack presents ONE card — dolly in as the showcase takes
    // over so the presented card actually fills the screen
    if (cam.aspect < 1.1)
      cam.position.z = baseDist - showPhase * (baseDist - 8.6);
    stackMode = showPhase > 0.5;
    if (stackMode !== lastStaged) {
      lastStaged = stackMode;
      sticky.classList.toggle('staged', stackMode);
      rail.inert = !stackMode;     // rail dots leave the tab order while
    }                              // the rail is invisible

    cards.forEach((m, i) => {
      const u = m.userData;
      // hover pop in the fan; a gentle nudge for peeking stack cards
      const isH = i === hover ? (stackMode ? 0.3 : 1) : 0;
      u.lift += (isH - u.lift) * 0.14;
      const L = u.lift;
      // neighbors politely make room for the popped card (fan only)
      let part = 0;
      if (hover >= 0 && i !== hover && !stackMode) {
        const d = i - hover;
        part = Math.sign(d) * Math.max(0, 0.16 - Math.abs(d) * 0.06);
      }
      u.part = (u.part || 0) + (part - (u.part || 0)) * 0.12;
      const breathe = REDUCED ? 0 : Math.sin(t * 1.1 + i * 1.7) * 0.012;
      // fan pose
      const fx = u.home.x + u.part,
            fy = u.home.y + breathe + L * 0.5,
            fz = u.home.z + L * 0.55,
            frz = u.home.rz * (1 - L * 0.65),
            fs = 1 + L * 0.05;
      // vertical stack pose: rel = signed distance from the stack cursor
      const rel = i - jFrac;
      const ar = Math.abs(rel);
      const focus = Math.max(0, 1 - ar);            // 1 at center, 0 past ±1
      const sx = STACK.x + ar * 0.06,
            sy = -rel * STACK.gap + STACK.yOff + breathe * 0.6,
            sz = STACK.z - ar * 0.52 + L * 0.2,
            srz = rel * -0.03,
            ss = lerp(0.88, STACK.s, smooth(focus)) + L * 0.03;
      m.position.set(lerp(fx, sx, showPhase), lerp(fy, sy, showPhase), lerp(fz, sz, showPhase));
      m.rotation.z = lerp(frz, srz, showPhase);
      m.rotation.y = REDUCED ? 0
        : Math.sin(t * 0.8 + i) * 0.02 * (1 - L) * (1 - showPhase)
          + Math.sin(t * 0.9) * 0.045 * showPhase * focus;   // presentation sway
      m.rotation.x = -L * 0.05 * (1 - showPhase);
      const s = lerp(fs, ss, showPhase);
      m.scale.set(s, s, s);
    });

    // the detail panel tracks the active card, dipping between neighbors
    {
      const j = Math.min(N - 1, Math.max(0, Math.round(jFrac)));
      if (showPhase > 0.25) {
        if (j !== infoJ) setInfo(j);
        const between = Math.abs(jFrac - j);         // 0 centered .. 0.5 mid-swap
        const op = showPhase * (1 - smooth(Math.min(1, Math.max(0, (between - 0.14) / 0.3))));
        setPanel(op, (jFrac - j) * -34);
      } else {
        setPanel(0, 0);
      }
    }

    // the whole fan leans with the pointer — held in a hand, not pinned
    const tx = ptr.x > -2 ? ptr.x : 0;
    const ty = ptr.y > -2 ? ptr.y : 0;
    fan.rotation.y += (tx * 0.07 - fan.rotation.y) * 0.06;
    fan.rotation.x += (-ty * 0.035 - fan.rotation.x) * 0.06;

    renderer.render(scene, cam);
  }
  startLoop();
}
