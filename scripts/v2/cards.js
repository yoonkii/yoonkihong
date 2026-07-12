/* ============================================================================
   classic v2 — products as a hand-held 3D card fan.
   Each project is a trading card: colored header with its creature sprite,
   name + tagline on warm paper, gold-monogram back. Hover slides a card up
   out of the fan; click opens the detail modal (live screenshot + story +
   link). No physics — calm, precise, tactile.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CARD_COLORS = {
  macrodoc: '#7FD4D9', mathstreet: '#F7D75E', mathwings: '#8FB7F0',
  funnify: '#FFB35C', lasthand: '#B8A7F0', gunball: '#FF8E72',
  gomokulike: '#8FD05C', suno: '#F5A8C0', substack: '#C9B79C'
};

const CW = 512, CH = 716, RAD = 30;    // face texture space

function roundedPath(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function makeFaceTexture(p, isSoon, onReady) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const col = CARD_COLORS[p.id] || '#CFCBC2';

  function paint(sprite) {
    // paper body (full bleed — the 3D geometry rounds the corners)
    g.fillStyle = '#FDFAF2';
    g.fillRect(0, 0, CW, CH);
    // header band in the project color (soft vertical ramp)
    const ramp = g.createLinearGradient(0, 0, 0, 340);
    ramp.addColorStop(0, col);
    ramp.addColorStop(1, shade(col, -14));
    g.fillStyle = ramp;
    g.fillRect(0, 0, CW, 330);
    // faint dot grid on the band — collectible-card texture
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let y = 26; y < 320; y += 34)
      for (let x = 22 + (y % 68 ? 17 : 0); x < CW; x += 34)
        g.fillRect(x, y, 3, 3);
    // creature, big and centered on the band
    if (sprite) {
      g.imageSmoothingEnabled = false;             // keep the pixel art crisp
      const S = 224;
      if (isSoon) g.globalAlpha = 0.85;
      g.drawImage(sprite, (CW - S) / 2, 62, S, S);
      g.globalAlpha = 1;
      g.imageSmoothingEnabled = true;
    }
    // name
    g.fillStyle = '#22262E';
    g.font = '800 40px Geist, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(p.name, CW / 2, 420, CW - 70);
    // tagline (wrap to two lines)
    g.font = '500 23px Geist, sans-serif';
    g.fillStyle = '#5D6470';
    wrapText(g, p.tagline || '', CW / 2, 466, CW - 90, 32, 2);
    // divider + footer
    g.strokeStyle = 'rgba(34,38,46,0.14)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(60, CH - 92); g.lineTo(CW - 60, CH - 92); g.stroke();
    g.font = '600 20px "Geist Mono", monospace';
    g.fillStyle = isSoon ? '#9A948A' : '#E8552F';
    g.fillText(isSoon ? 'H A T C H I N G   S O O N' : 'O P E N   P R O J E C T   ↗', CW / 2, CH - 48);
    // card keyline
    roundedPath(g, 7, 7, CW - 14, CH - 14, RAD - 5);
    g.strokeStyle = 'rgba(34,38,46,0.18)';
    g.lineWidth = 3;
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

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xDCE6F0, 1.25));
  const key = new THREE.DirectionalLight(0xFFF3E0, 1.0);
  key.position.set(-3, 5, 8);
  scene.add(key);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = items.length;
  const CTR = (N - 1) / 2;
  const backTex = makeBackTexture();
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#EDE5D4', roughness: 0.7 });
  const fan = new THREE.Group();
  scene.add(fan);

  const cards = items.map((p, i) => {
    const isSoon = p.kind === 'egg';
    const faceMat = new THREE.MeshStandardMaterial({
      map: makeFaceTexture(p, isSoon), roughness: 0.55, metalness: 0
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex, roughness: 0.5, metalness: 0
    });
    // a thin plate: rounded box gives soft edges that catch the light
    const geo = new RoundedBoxGeometry(1.5, 2.1, 0.05, 4, 0.055);
    const m = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat]);
    const k = i - CTR;
    const home = {
      x: k * 0.58,
      y: -Math.pow(Math.abs(k), 1.4) * 0.055,
      z: (N - 1 - i) * 0.015,      // leftmost on top: read the fan L -> R
      rz: -k * 0.072
    };
    m.userData = { i, p, isSoon, home, lift: 0 };
    m.position.set(home.x, home.y, home.z);
    m.rotation.z = home.rz;
    fan.add(m);
    return m;
  });

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
    if (hover >= 0) {
      const u = cards[hover].userData;
      openCard(u.p, u.isSoon);
    }
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

    cards.forEach((m, i) => {
      const u = m.userData;
      const isH = i === hover ? 1 : 0;
      u.lift += (isH - u.lift) * 0.14;
      const L = u.lift;
      // neighbors politely make room for the popped card
      let part = 0;
      if (hover >= 0 && i !== hover) {
        const d = i - hover;
        part = Math.sign(d) * Math.max(0, 0.16 - Math.abs(d) * 0.06);
      }
      u.part = (u.part || 0) + (part - (u.part || 0)) * 0.12;
      const breathe = REDUCED ? 0 : Math.sin(t * 1.1 + i * 1.7) * 0.012;
      m.position.x = u.home.x + u.part;
      m.position.y = u.home.y + breathe + L * 0.5;
      m.position.z = u.home.z + L * 0.55;
      m.rotation.z = u.home.rz * (1 - L * 0.65);
      m.rotation.y = REDUCED ? 0 : Math.sin(t * 0.8 + i) * 0.02 * (1 - L);
      m.rotation.x = -L * 0.05;
      const s = 1 + L * 0.05;
      m.scale.set(s, s, s);
    });

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
