/* ============================================================================
   classic v2 — products as a hand-held 3D card fan.
   Each project is a trading card: colored header with its creature sprite,
   name + tagline on warm paper, gold-monogram back. Hover slides a card up
   out of the fan; click opens the detail modal (live screenshot + story +
   link). No physics — calm, precise, tactile.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CARD_COLORS = {
  macrodoc: '#7FD4D9', mathstreet: '#F7D75E', mathwings: '#8FB7F0',
  funnify: '#FFB35C', lasthand: '#B8A7F0', gunball: '#FF8E72',
  gomokulike: '#8FD05C', suno: '#F5A8C0', substack: '#C9B79C'
};

const CW = 512, CH = 716, RAD = 40;    // face texture space

function roundedPath(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function makeFaceTexture(p, isSoon, onReady) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const col = CARD_COLORS[p.id] || '#CFCBC2';

  function blob(x, y, r, alpha) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, colA(col, alpha));
    rg.addColorStop(1, colA(col, 0));
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function paint(sprite) {
    // liquid-glass slab: cool white glass with soft blobs of the project
    // color floating in it — no hard bands, light does the structure
    const base = g.createLinearGradient(0, 0, 0, CH);
    base.addColorStop(0, '#FFFFFF');
    base.addColorStop(0.5, '#F7FAFE');
    base.addColorStop(1, '#EFF3FA');
    g.fillStyle = base;
    g.fillRect(0, 0, CW, CH);
    // the project color suffuses the glass, densest at the top
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
    // creature floats in the upper glass, resting on a soft shadow
    if (sprite) {
      g.fillStyle = 'rgba(30,36,48,0.10)';
      g.beginPath();
      g.ellipse(CW / 2, 300, 92, 16, 0, 0, Math.PI * 2);
      g.fill();
      g.imageSmoothingEnabled = false;             // keep the pixel art crisp
      const S = 232;
      if (isSoon) g.globalAlpha = 0.88;
      g.drawImage(sprite, (CW - S) / 2, 66, S, S);
      g.globalAlpha = 1;
      g.imageSmoothingEnabled = true;
    }
    // name
    g.fillStyle = '#22262E';
    g.font = '800 40px Geist, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(p.name, CW / 2, 424, CW - 80);
    // tagline (wrap to two lines)
    g.font = '500 23px Geist, sans-serif';
    g.fillStyle = '#5D6470';
    wrapText(g, p.tagline || '', CW / 2, 470, CW - 96, 32, 2);
    // footer
    g.strokeStyle = 'rgba(34,38,46,0.12)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(64, CH - 96); g.lineTo(CW - 64, CH - 96); g.stroke();
    g.font = '600 20px "Geist Mono", monospace';
    g.fillStyle = isSoon ? '#9A948A' : '#E8552F';
    g.fillText(isSoon ? 'H A T C H I N G   S O O N' : 'O P E N   P R O J E C T   ↗', CW / 2, CH - 50);
    // glass optics: diagonal sheen sweeping the top + inner glow border
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
    roundedPath(g, 3, 3, CW - 6, CH - 6, RAD - 2);
    g.strokeStyle = 'rgba(34,38,46,0.10)';
    g.lineWidth = 2;
    g.stroke();
    tex.needsUpdate = true;
    onReady && onReady();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  paint(null);
  const img = new Image();
  img.onload = () => paint(img);
  img.src = p.sprite || 'images/game/creatures/egg.png';
  return tex;
}

function colA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

function wrapText(g, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const probe = line ? line + ' ' + w : w;
    if (g.measureText(probe).width > maxW && line) {
      g.fillText(line, x, y + lines * lh);
      if (++lines >= maxLines - 1) { line = w; break; }
      line = w;
    } else line = probe;
  }
  g.fillText(line, x, y + lines * lh, maxW);
}

function makeBackTexture() {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  g.fillStyle = '#242933';
  g.fillRect(0, 0, CW, CH);
  // double gold keyline
  [[14, 2.5], [26, 1.5]].forEach(([inset, w]) => {
    roundedPath(g, inset, inset, CW - inset * 2, CH - inset * 2, RAD - inset * 0.6);
    g.strokeStyle = 'rgba(232,192,112,0.85)';
    g.lineWidth = w;
    g.stroke();
  });
  // monogram
  g.fillStyle = '#E8C070';
  g.font = '900 210px Geist, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Y', CW / 2, CH / 2 - 24);
  g.font = '600 19px "Geist Mono", monospace';
  g.fillStyle = 'rgba(232,192,112,0.7)';
  g.fillText('Y O O N K I . W O R L D', CW / 2, CH - 78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function initCards() {
  const DBG_SP_RAW = new URLSearchParams(location.search).get('sp');
  const DBG_SP = DBG_SP_RAW !== null ? parseFloat(DBG_SP_RAW) : null;
  const canvas = document.getElementById('capsule-canvas');
  const projects = (window.PROJECTS || []);
  const live = projects.filter((p) => p.kind !== 'egg');
  const soon = projects.filter((p) => p.kind === 'egg' && p.id !== 'x');
  const items = [...live, ...soon];

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return fallback(items); }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  // studio env gives the glass slabs their moving reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xDCE6F0, 0.95));
  const key = new THREE.DirectionalLight(0xFFF3E0, 0.5);
  key.position.set(-3, 5, 8);
  scene.add(key);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = items.length;
  const CTR = (N - 1) / 2;
  const backTex = makeBackTexture();
  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: '#F4F7FB', roughness: 0.3, clearcoat: 0.5, envMapIntensity: 0.35
  });
  const fan = new THREE.Group();
  scene.add(fan);

  const cards = items.map((p, i) => {
    const isSoon = p.kind === 'egg';
    // UNLIT face: the texture renders exactly as painted — no light rig
    // can overexpose it (the glass look lives in the painted sheen)
    const faceMat = new THREE.MeshBasicMaterial({
      map: makeFaceTexture(p, isSoon)
    });
    const backMat = new THREE.MeshPhysicalMaterial({
      map: backTex, roughness: 0.35, metalness: 0,
      clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.35
    });
    // a thin glass slab: the fat corner radius does the "liquid" silhouette
    const geo = new RoundedBoxGeometry(1.5, 2.1, 0.04, 5, 0.12);
    const m = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat]);
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
  const STACK = { x: -1.95, gap: 2.0, z: 1.15, s: 1.38 };
  const smooth = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, t) => a + (b - a) * t;
  // continuous stack cursor: 0 = first card centered, N-1 = last
  const jFracOf = (P) =>
    Math.min(N - 1, Math.max(0, (P - FAN_END) / (1 - FAN_END - TAIL) * (N - 1)));
  const pOf = (j) => FAN_END + (N > 1 ? j / (N - 1) : 0) * (1 - FAN_END - TAIL);

  const sticky = document.querySelector('.products-sticky');
  // progress rail: one clickable dot per project
  const rail = document.getElementById('stack-rail');
  const dots = items.map((p, j) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = p.name;
    b.addEventListener('click', () => {
      const total = section.offsetHeight - innerHeight;
      window.scrollTo({ top: section.offsetTop + pOf(j) * total, behavior: 'smooth' });
    });
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
  let lastJFrac = 0;
  function setInfo(j) {
    infoJ = j;
    dots.forEach((d, di) => d.classList.toggle('on', di === j));
    const p = items[j];
    siIdx.textContent = String(j + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
    siName.textContent = p.name;
    siTag.textContent = p.tagline || '';
    siDesc.textContent = p.desc || '';
    if (p.url) { siVisit.href = p.url; siVisit.hidden = false; } else siVisit.hidden = true;
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
  function openCard(p, isSoon) {
    ccName.textContent = p.name;
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
    card.classList.remove('open');
    veil.classList.remove('open');
    setTimeout(() => { card.hidden = true; veil.hidden = true; }, 300);
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
  canvas.addEventListener('click', () => {
    if (hover < 0) return;
    // in stack mode a peeking card is navigation: scroll the stack to it
    if (stackMode && Math.abs(hover - Math.round(lastJFrac)) >= 1) {
      const total = section.offsetHeight - innerHeight;
      window.scrollTo({ top: section.offsetTop + pOf(hover) * total, behavior: 'smooth' });
      return;
    }
    const u = cards[hover].userData;
    openCard(u.p, u.isSoon);
  });

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const halfW = CTR * 0.58 + 1.75;               // fan half-width + margin
    const distW = halfW / Math.tan(cam.fov * Math.PI / 360) / cam.aspect;
    const distH = 2.05 / Math.tan(cam.fov * Math.PI / 360);
    cam.position.set(0, 0.12, Math.max(distW, distH, 5.5));
    cam.lookAt(0, 0.02, 0);
    // narrow viewports center the stack above the bottom info panel
    STACK.x = cam.aspect < 1.1 ? 0 : -2.1;
  }
  addEventListener('resize', fit);
  fit();

  let visible = true;
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); },
    { rootMargin: '100px' }).observe(canvas);

  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
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
    // The blend starts halfway into the fan's held stretch, so the deck
    // sits centered for a beat before it begins to move
    const showPhase = smooth(Math.min(1, Math.max(0, (P - 0.12) / (FAN_END - 0.13))));
    const jFrac = jFracOf(P);
    lastJFrac = jFrac;
    stackMode = showPhase > 0.5;
    sticky.classList.toggle('staged', stackMode);

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
            sy = -rel * STACK.gap + 0.3 + breathe * 0.6,
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
        info.style.opacity = op;
        info.style.setProperty('--dy', ((jFrac - j) * -34) + 'px');
        info.classList.toggle('live', op > 0.5);
      } else {
        info.style.opacity = 0;
        info.classList.remove('live');
      }
    }

    // the whole fan leans with the pointer — held in a hand, not pinned
    const tx = ptr.x > -2 ? ptr.x : 0;
    const ty = ptr.y > -2 ? ptr.y : 0;
    fan.rotation.y += (tx * 0.07 - fan.rotation.y) * 0.06;
    fan.rotation.x += (-ty * 0.035 - fan.rotation.x) * 0.06;

    renderer.render(scene, cam);
  })();

  function fallback(list) {
    const ul = document.getElementById('capsule-fallback');
    ul.hidden = false;
    canvas.hidden = true;
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
  }
}
