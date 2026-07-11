/* ============================================================================
   classic v2 — products as two-tone toy capsules hanging on strings.
   Verlet pendulum physics: capsules sway with momentum, the cursor shoves
   them (satisfyingly), click opens the project card. Original capsule
   design: top shell in a per-project color, cream lower shell, gold seam.
   ========================================================================== */

import * as THREE from 'three';

const CAPSULE_COLORS = {
  macrodoc: '#7FD4D9', mathstreet: '#F7D75E', mathwings: '#8FB7F0',
  funnify: '#FFB35C', lasthand: '#B8A7F0', gunball: '#FF8E72',
  gomokulike: '#8FD05C', suno: '#F5A8C0', substack: '#C9B79C'
};

export function initCapsules() {
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
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xD8E4F0, 1.05));
  const key = new THREE.DirectionalLight(0xFFF3E0, 1.7);
  key.position.set(-4, 6, 7);
  scene.add(key);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = items.length;
  const SPACING = 2.05;
  const texLoader = new THREE.TextureLoader();
  // shared glass-gloss dab (radial white fade) — sells the "toy glass" read
  const glossTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(56, 52, 6, 64, 64, 62);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.3, 'rgba(255,255,255,0.85)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const capsules = items.map((p, i) => makeCapsule(p, i));
  capsules.forEach((c) => scene.add(c.group, c.line));
  canvas.__caps = capsules;                      // dev handle for the pane

  // wooden gacha rail the whole row hangs from
  {
    const railLen = (N - 1) * SPACING + 1.7;
    const wood = new THREE.MeshStandardMaterial({ color: '#A9793F', roughness: 0.62 });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, railLen, 18), wood);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 3.4, 0);
    scene.add(rail);
    const knobMat = new THREE.MeshStandardMaterial({ color: '#8A6332', roughness: 0.55 });
    capsules.forEach((c) => {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), knobMat);
      knob.position.copy(c.pivot);
      scene.add(knob);
    });
    const capGeo = new THREE.SphereGeometry(0.11, 14, 12);
    [-railLen / 2, railLen / 2].forEach((x) => {
      const end = new THREE.Mesh(capGeo, knobMat);
      end.position.set(x, 3.4, 0);
      scene.add(end);
    });
  }

  function makeCapsule(p, i) {
    const isSoon = p.kind === 'egg';
    const col = new THREE.Color(CAPSULE_COLORS[p.id] || '#CFCBC2');
    const group = new THREE.Group();
    const R = 0.62;
    // gacha-glass shells: translucent so the creature INSIDE reads through
    const matTop = new THREE.MeshPhysicalMaterial({
      color: col, roughness: 0.18, metalness: 0,
      transparent: true, opacity: isSoon ? 0.34 : 0.44,
      depthWrite: false
    });
    const matBot = new THREE.MeshPhysicalMaterial({
      color: '#FBF6EA', roughness: 0.2,
      transparent: true, opacity: isSoon ? 0.26 : 0.32,
      depthWrite: false
    });
    const top = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), matTop);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matBot);
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#E3BC72', roughness: 0.28, metalness: 0.4,
      emissive: '#5A431C', emissiveIntensity: 0.35,
      transparent: isSoon, opacity: isSoon ? 0.6 : 1
    });
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.005, R * 1.005, 0.07, 40), goldMat);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 10, 18), goldMat);
    loop.position.y = R + 0.06;
    // the resident: project creature floating inside the glass
    const spriteUrl = p.sprite || ('images/game/creatures/' + (isSoon ? 'egg' : p.id) + '.png');
    const stex = texLoader.load(spriteUrl, undefined, undefined, () => {
      const egg = texLoader.load('images/game/creatures/egg.png');
      egg.colorSpace = THREE.SRGBColorSpace;
      resident.material.map = egg;
      resident.material.needsUpdate = true;
    });
    stex.colorSpace = THREE.SRGBColorSpace;
    const resident = new THREE.Sprite(new THREE.SpriteMaterial({
      map: stex, transparent: true, opacity: isSoon ? 0.55 : 1, depthWrite: false
    }));
    resident.scale.setScalar(0.78);
    resident.position.y = -0.03;
    resident.renderOrder = 1;
    [top, bot].forEach((m) => { m.renderOrder = 2; });
    seam.renderOrder = 3;
    const gloss = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glossTex, transparent: true, opacity: 0.9, depthWrite: false
    }));
    gloss.scale.setScalar(0.3);
    gloss.position.set(-0.22, 0.26, 0.56);
    gloss.renderOrder = 4;
    group.add(resident, top, bot, seam, loop, gloss);

    // pendulum state (verlet): pivot fixed, bob = capsule center
    const px = (i - (N - 1) / 2) * SPACING;
    const len = 1.6 + (i % 3) * 0.55;             // varied hang heights
    const pivot = new THREE.Vector3(px, 3.4, 0);
    const bob = pivot.clone().add(new THREE.Vector3(0, -len, 0));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pivot, bob]),
      new THREE.LineBasicMaterial({ color: 0x8A94A6, transparent: true, opacity: isSoon ? 0.4 : 0.8 }));
    return {
      p, group, line, pivot, len, isSoon, shells: [top, bot],
      pos: bob.clone(), prev: bob.clone(), spin: 0, spinV: 0
    };
  }

  /* a quiet name label under EVERY capsule — the row reads as a product
     list at a glance, hover brightens the hovered one */
  const labels = [];
  capsules.forEach((c) => {
    const text = (c.p.name || '').toUpperCase() + (c.isSoon ? ' · SOON' : '');
    const cvs = document.createElement('canvas');
    cvs.width = 512; cvs.height = 64;
    const g = cvs.getContext('2d');
    g.font = '600 30px Geist Mono, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#3A424F';
    g.fillText(text, 256, 34);
    const t = new THREE.CanvasTexture(cvs);
    t.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: t, transparent: true, opacity: c.isSoon ? 0.45 : 0.6
    }));
    spr.scale.set(2.6, 0.325, 1);
    labels.push({ spr, c, base: c.isSoon ? 0.45 : 0.6 });
    scene.add(spr);
  });

  /* card DOM */
  const card = document.getElementById('capsule-card');
  const ccName = document.getElementById('cc-name');
  const ccTag = document.getElementById('cc-tagline');
  const ccDesc = document.getElementById('cc-desc');
  const ccVisit = document.getElementById('cc-visit');
  const ccSprite = document.getElementById('cc-sprite');
  document.getElementById('cc-close').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
  function openCard(p) {
    ccName.textContent = p.name;
    ccTag.textContent = p.tagline || '';
    ccDesc.textContent = p.desc || '';
    ccSprite.src = p.sprite || 'images/game/creatures/' + p.id + '.png';
    ccSprite.onerror = () => { ccSprite.src = 'images/game/creatures/egg.png'; };
    if (p.url) { ccVisit.href = p.url; ccVisit.hidden = false; } else ccVisit.hidden = true;
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('open'));
  }
  function closeCard() {
    card.classList.remove('open');
    setTimeout(() => { card.hidden = true; }, 300);
  }

  /* pointer: world-space shove + click pick */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2(-2, -2);
  const ptrWorld = new THREE.Vector3(1e9, 1e9, 0);
  let ptrPrev = ptrWorld.clone();
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const t = -ray.ray.origin.z / ray.ray.direction.z;   // z=0 plane
    return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
  }
  let hovered = null;
  function pick() {
    ray.setFromCamera(ptr, cam);
    const meshes = capsules.flatMap((c) => c.shells);
    const hit = ray.intersectObjects(meshes)[0];
    return hit ? capsules.find((k) => k.group === hit.object.parent) : null;
  }
  canvas.addEventListener('pointermove', (e) => {
    ptrWorld.copy(toWorld(e));
    hovered = pick();
    canvas.style.cursor = hovered ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { ptrWorld.set(1e9, 1e9, 0); hovered = null; });
  canvas.addEventListener('click', (e) => {
    toWorld(e);
    const c = pick();
    if (!c) return;
    // a happy tug before the card: pull the capsule down, let the string
    // spring it back — the card opens as it rebounds
    c.prev.y = c.pos.y + 0.16;
    setTimeout(() => openCard(c.p), 240);
  });

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    // frame the whole row: pull the camera back until the row fits
    // (+2.0 margin keeps the edge capsules' SOON labels inside the frame)
    const rowHalf = ((N - 1) / 2) * SPACING + 2.0;
    const dist = rowHalf / Math.tan((cam.fov * Math.PI / 360)) / cam.aspect;
    cam.position.set(0, 1.05, Math.max(9, dist));
    cam.lookAt(0, 1.05, 0);
  }
  addEventListener('resize', fit);
  fit();

  let visible = true;
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); },
    { rootMargin: '100px' }).observe(canvas);

  const G = new THREE.Vector3(0, -9.8, 0);
  const tmp = new THREE.Vector3();
  const MAX_SWING = 0.3;           // rad from vertical — capsules sway, never orbit
  let last = performance.now();
  let t = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) { last = now; return; }
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    t += dt;

    // pointer velocity — ONLY when both samples are real (the enter frame
    // against the parked sentinel used to inject a huge impulse and flung
    // the whole row: the "broken physics" bug)
    const ptrLive = ptrWorld.x < 1e8 && ptrPrev.x < 1e8;
    const ptrVel = ptrLive ? tmp.subVectors(ptrWorld, ptrPrev) : tmp.set(0, 0, 0);
    if (ptrVel.length() > 0.5) ptrVel.setLength(0.5);

    capsules.forEach((c, ci) => {
      // verlet integrate with firm damping
      const v = c.pos.clone().sub(c.prev).multiplyScalar(0.958);
      c.prev.copy(c.pos);
      c.pos.add(v).addScaledVector(G, dt * dt);
      // idle breeze: barely-there life even with no cursor around
      if (!REDUCED)
        c.pos.x += Math.sin(t * 0.7 + ci * 1.7) * 0.0006;
      if (!REDUCED && ptrWorld.x < 1e8) {
        const d = c.pos.distanceTo(ptrWorld);
        if (d < 1.0) {                       // gentle, capped shove
          const push = c.pos.clone().sub(ptrWorld).normalize()
            .multiplyScalar((1.0 - d) * 0.03)
            .addScaledVector(ptrVel, 0.12);
          if (push.length() > 0.05) push.setLength(0.05);
          c.pos.add(push);
          c.spinV += clampN(ptrVel.x * 0.03, 0.02);
        }
      }
      // string constraint (inextensible, pivot fixed)
      const dir = c.pos.clone().sub(c.pivot);
      const dLen = dir.length() || 1;
      c.pos.copy(c.pivot).addScaledVector(dir, c.len / dLen);
      // soft swing clamp: past MAX_SWING the string "hits the hook" and
      // eases back — capsules can never wind over the top
      const ang = Math.atan2(c.pos.x - c.pivot.x, -(c.pos.y - c.pivot.y));
      if (Math.abs(ang) > MAX_SWING) {
        const a2 = Math.sign(ang) * (MAX_SWING + (Math.abs(ang) - MAX_SWING) * 0.25);
        c.pos.set(
          c.pivot.x + Math.sin(a2) * c.len,
          c.pivot.y - Math.cos(a2) * c.len,
          c.pos.z);
      }
      // apply
      const hoverK = c === hovered ? 1 : 0;
      c.hoverLerp = (c.hoverLerp || 0) + (hoverK - (c.hoverLerp || 0)) * 0.15;
      c.group.position.copy(c.pos);
      c.group.scale.setScalar(1 + c.hoverLerp * 0.07);
      c.spinV *= 0.96;
      c.spin += c.spinV;
      const swing = c.pos.clone().sub(c.pivot);
      c.group.rotation.z = Math.atan2(-swing.x, -swing.y) * 0.9;
      c.group.rotation.y = c.spin;
      // string attaches at the capsule's top loop, not its center
      const att = c.pos.clone().addScaledVector(swing.normalize(), -0.68);
      c.line.geometry.setFromPoints([c.pivot, att]);
    });
    ptrPrev.copy(ptrWorld);
    for (const L of labels) {
      L.spr.position.set(L.c.pos.x, L.c.pos.y - 1.0, L.c.pos.z);
      const want = L.c === hovered ? 1 : L.base;
      L.spr.material.opacity += (want - L.spr.material.opacity) * 0.15;
    }
    renderer.render(scene, cam);
  })(performance.now());

  function clampN(v, m) { return Math.max(-m, Math.min(m, v)); }

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
