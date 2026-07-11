/* ============================================================================
   classic v2 — work timeline: three soft 3D logo tiles (NAVER, LINE, Google)
   floating on a white stage. Hover lifts a tile and lights its card;
   pointer position tilts the whole shelf a touch (physical, not showy).
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COMPANIES = [
  { id: 'naver', bg: '#03C75A', draw: drawNaver },
  { id: 'line', bg: '#06C755', draw: drawLine },
  { id: 'google', bg: '#FFFFFF', draw: drawGoogle }
];

function tex(draw, bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 256);
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function drawNaver(g) {
  // the real mark: blocky geometric N (two bars + parallelogram diagonal)
  g.fillStyle = '#FFFFFF';
  g.fillRect(70, 66, 38, 124);
  g.fillRect(148, 66, 38, 124);
  g.beginPath();
  g.moveTo(70, 66); g.lineTo(108, 66);
  g.lineTo(186, 190); g.lineTo(148, 190);
  g.closePath();
  g.fill();
}
function drawLine(g) {
  // real app icon: white speech bubble, LINE wordmark in green
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.roundRect(38, 56, 180, 122, 52);
  g.fill();
  g.beginPath();
  g.moveTo(80, 168); g.lineTo(66, 202); g.lineTo(116, 174);
  g.closePath();
  g.fill();
  g.fillStyle = '#06C755';
  g.font = '800 46px Geist, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LINE', 128, 118);
}
function drawGoogle(g) {
  // the real G: a ring in four arcs + the blue horizontal bar. Canvas
  // angles: 0 = east, positive = clockwise.
  const cx = 128, cy = 128, R = 56, W = 42;
  const D = Math.PI / 180;
  const seg = (col, a0, a1) => {
    g.strokeStyle = col;
    g.lineWidth = W;
    g.beginPath();
    g.arc(cx, cy, R, a0 * D, a1 * D);
    g.stroke();
  };
  seg('#4285F4', 0, 45);        // blue: lower-right, rises to meet the bar
  seg('#34A853', 45, 135);      // green: bottom
  seg('#FBBC05', 135, 225);     // yellow: left
  seg('#EA4335', 225, 315);     // red: top — the 315-360 gap is the opening
  // blue bar: from center to the ring's right edge, flush with the arc
  g.fillStyle = '#4285F4';
  g.fillRect(cx - 4, cy - W / 2, R + W / 2 + 4, W);
}

export function initWork() {
  const canvas = document.getElementById('work-canvas');
  const cards = [...document.querySelectorAll('.work-card')];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    cards.forEach((c) => c.classList.add('lit'));   // no WebGL: just show cards
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 0.4, 9.5);
  cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xDDE6F0, 1.15));
  const key = new THREE.DirectionalLight(0xFFF3E0, 1.6);
  key.position.set(-3, 5, 6);
  scene.add(key);

  const shelf = new THREE.Group();
  scene.add(shelf);
  const tiles = COMPANIES.map((co, i) => {
    const geo = new RoundedBoxGeometry(1.9, 1.9, 0.62, 5, 0.22);
    const face = new THREE.MeshStandardMaterial({ map: tex(co.draw, co.bg), roughness: 0.32, metalness: 0 });
    const side = new THREE.MeshStandardMaterial({ color: co.bg, roughness: 0.4 });
    const m = new THREE.Mesh(geo, [side, side, side, side, face, side]);
    m.position.x = (i - 1) * 3.1;
    m.userData = { i, base: m.position.clone(), lift: 0 };
    shelf.add(m);
    return m;
  });
  // connecting timeline thread
  {
    const g = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(-4.4, 0, -0.4), new THREE.Vector3(4.4, 0, -0.4)]);
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xD8CFC0 })));
  }

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2(-2, -2);
  let hover = -1;
  const touch = matchMedia('(pointer: coarse)').matches;

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => ptr.set(-2, -2));
  canvas.addEventListener('click', () => {
    if (touch && hover >= 0) light(hover);          // tap = select on mobile
  });

  function light(i) {
    cards.forEach((c, ci) => c.classList.toggle('lit', ci === i));
  }
  cards.forEach((c) => c.classList.add('lit'));      // default: all readable
  let anyHover = false;

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  addEventListener('resize', fit);
  fit();

  const clock = new THREE.Clock();
  let visible = true;
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); },
    { rootMargin: '100px' }).observe(canvas);

  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(tiles)[0];
    const hi = hit ? hit.object.userData.i : -1;
    if (hi !== hover) {
      hover = hi;
      canvas.style.cursor = hi >= 0 ? 'pointer' : '';
      if (hi >= 0) { light(hi); anyHover = true; }
      else if (anyHover) cards.forEach((c) => c.classList.add('lit'));
    }
    tiles.forEach((m, i) => {
      const want = i === hover ? 1 : 0;
      m.userData.lift += (want - m.userData.lift) * 0.14;
      const L = m.userData.lift;
      m.position.y = m.userData.base.y + Math.sin(t * 1.1 + i * 1.9) * 0.07 + L * 0.34;
      m.rotation.x = Math.sin(t * 0.9 + i) * 0.045 - L * 0.1;
      m.rotation.y = Math.sin(t * 0.7 + i * 2.4) * 0.06 + L * 0.16;
      m.scale.setScalar(1 + L * 0.06);
    });
    shelf.rotation.y = ptr.x > -2 ? ptr.x * 0.05 : 0;
    shelf.rotation.x = ptr.y > -2 ? -ptr.y * 0.03 : 0;
    renderer.render(scene, cam);
  })();
}
