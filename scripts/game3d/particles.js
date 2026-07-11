/* ============================================================================
   YOONKI WORLD 3D — particles
   One pooled point-sprite system, several personalities: footstep dust,
   flora pops, fountain spray, chimney smoke, fireflies, drifting petals,
   interaction sparkles, VISIT ember bursts, fireworks + confetti.
   Sized in world units (ortho-correct via uPPU uniform).
   ========================================================================== */

import * as THREE from 'three';
import { REDUCED, hash2, FOUNTAIN, MAP_W, MAP_H } from './const.js';

function makeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'soft') {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  } else if (kind === 'star') {
    g.translate(32, 32);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 28 : 7;
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  } else {                                    // square (confetti / petals)
    // fill the WHOLE canvas: a square point IS the point quad, and any
    // transparent-black border would darken the mips at tiny sizes
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Pool {
  constructor(scene, capacity, texture, blending) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);   // remaining
    this.ttl = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.tw = new Float32Array(capacity);     // twinkle amount
    this.seed = new Float32Array(capacity);
    this.head = 0;
    this.alive = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(MAP_W / 2, 2, MAP_H / 2), 80);

    this.uPPU = { value: 60 };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      uniforms: { uTex: { value: texture }, uPPU: this.uPPU },
      vertexShader: /* glsl */`
        attribute vec3 aCol; attribute float aAlpha; attribute float aSize;
        varying vec3 vCol; varying float vAlpha;
        uniform float uPPU;
        void main() {
          vCol = aCol; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPPU;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying vec3 vCol; varying float vAlpha;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a * vAlpha < 0.02) discard;
          gl_FragColor = vec4(vCol * t.rgb, t.a * vAlpha);
        }`
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    const cTmp = new THREE.Color();
    this._c = cTmp;
    // park everything far underground
    for (let i = 0; i < capacity; i++) this.pos[i * 3 + 1] = -999;
  }

  spawn(o) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.vel[i * 3] = o.vx || 0; this.vel[i * 3 + 1] = o.vy || 0; this.vel[i * 3 + 2] = o.vz || 0;
    this.ttl[i] = this.life[i] = o.ttl || 1;
    this.grav[i] = o.gravity || 0;
    this.drag[i] = o.drag != null ? o.drag : 0.2;
    this.grow[i] = o.grow || 0;
    this.tw[i] = o.twinkle || 0;
    this.seed[i] = Math.random() * 40;
    this.baseSize[i] = this.size[i] = o.size || 0.1;
    this._c.set(o.color || '#ffffff');
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
    this.alpha[i] = o.alpha != null ? o.alpha : 1;
    return i;
  }

  update(dt, t) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        this.alpha[i] = 0;
        continue;
      }
      const k = Math.pow(1 - this.drag[i], dt * 60);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const frac = this.life[i] / this.ttl[i];
      let a = Math.min(1, frac * 3);
      if (this.tw[i] > 0) a *= 1 - this.tw[i] * (0.5 + 0.5 * Math.sin(t * 7 + this.seed[i]));
      this.alpha[i] = a;
      if (this.grow[i]) this.size[i] = this.baseSize[i] * (1 + (1 - frac) * this.grow[i]);
    }
    if (any) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.attributes.aCol.needsUpdate = true;
    }
    this.points.visible = any;
  }
}

/* ------------------------------------------------------------------ */
/** Tiny standalone sparkle pool for mini-scenes (the house interior).
    Reuses the star texture + Pool but carries NONE of the overworld's
    ambient emitters (smoke/fireflies/petals are world-coordinate-bound
    and would spawn inside the room at nonsense positions). */
export function createSparklePool(scene) {
  const glow = new Pool(scene, 64, makeTexture('star'), THREE.AdditiveBlending);
  return {
    burst(x, y, z, color = '#FFE9A8') {
      if (REDUCED) return;
      for (let i = 0; i < 12; i++) glow.spawn({
        x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.4) * 0.7,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.7, vy: 0.4 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.35,
        ttl: 0.5 + Math.random() * 0.45, size: 0.11 + Math.random() * 0.09,
        color, drag: 0.1, twinkle: 0.5
      });
    },
    update(dt, t, camHalfH, viewH) {
      glow.uPPU.value = viewH / (2 * camHalfH);
      glow.update(dt, t);
    }
  };
}

export function createParticles(scene) {
  const soft = new Pool(scene, 420, makeTexture('soft'), THREE.NormalBlending);
  const glow = new Pool(scene, 520, makeTexture('star'), THREE.AdditiveBlending);
  const paper = new Pool(scene, 420, makeTexture('square'), THREE.NormalBlending);

  let enabled = !REDUCED;
  const timers = { smoke: 0, fireflies: 0, nursery: 0, petals: 0, fountain: 0 };
  const fireworks = [];                       // scheduled rockets

  const api = {
    setPPU(v) { soft.uPPU.value = glow.uPPU.value = paper.uPPU.value = v; },
    setEnabled(v) { enabled = v && !REDUCED; },

    dust(x, z, n = 4) {
      if (!enabled) return;
      for (let i = 0; i < n; i++) soft.spawn({
        x: x + (Math.random() - 0.5) * 0.3, y: 0.05, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.5,
        ttl: 0.35 + Math.random() * 0.2, size: 0.1 + Math.random() * 0.08,
        color: '#E8D5A8', drag: 0.12, grow: 1.6, alpha: 0.6
      });
    },

    pop(x, z, color) {
      if (!enabled) return;
      for (let i = 0; i < 6; i++) paper.spawn({
        x, y: 0.35 + Math.random() * 0.3, z,
        vx: (Math.random() - 0.5) * 2.2, vy: 1.2 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 2.2,
        ttl: 0.6 + Math.random() * 0.4, size: 0.07 + Math.random() * 0.05,
        color, gravity: 5.5, drag: 0.08
      });
    },

    sparkle(x, y, z, color = '#FFE9A8') {
      if (!enabled) return;
      for (let i = 0; i < 10; i++) glow.spawn({
        x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.3) * 0.5,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.8, vy: 0.6 + Math.random(), vz: (Math.random() - 0.5) * 0.8,
        ttl: 0.5 + Math.random() * 0.4, size: 0.12 + Math.random() * 0.1,
        color, drag: 0.1, twinkle: 0.5
      });
    },

    emberBurst(x, y, z) {                     // VISIT celebration (art bible)
      if (!enabled) return;
      const cols = ['#FFD166', '#FFB070', '#EAF7EF'];
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, up = Math.PI / 6 + Math.random() * Math.PI / 4;
        const sp = 3 + Math.random();
        paper.spawn({
          x, y, z,
          vx: Math.cos(a) * Math.cos(up) * sp, vy: Math.sin(up) * sp, vz: Math.sin(a) * Math.cos(up) * sp,
          ttl: 1.0, size: 0.09, color: cols[i % 3], gravity: 9.8, drag: 0.04
        });
      }
    },

    splash(x, y, z) {
      if (!enabled) return;
      for (let i = 0; i < 8; i++) soft.spawn({
        x, y, z,
        vx: (Math.random() - 0.5) * 1.6, vy: 1.4 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 1.6,
        ttl: 0.55, size: 0.07, color: '#D9F2F8', gravity: 7, drag: 0.06
      });
    },

    fireworksShow(cx, cz) {
      const now = performance.now() / 1000;
      for (let i = 0; i < 7; i++) {
        fireworks.push({
          t: now + i * 0.7 + Math.random() * 0.3,
          x: cx + (Math.random() - 0.5) * 14,
          z: cz + (Math.random() - 0.1) * 8,     // biased south: on-camera
          hue: Math.random()
        });
      }
    },

    update(dt, t, camHalfH, viewH) {
      api.setPPU(viewH / (2 * camHalfH));

      if (enabled) {
        // chimney smoke (About house — flue top of the taller chimney)
        timers.smoke -= dt;
        if (timers.smoke <= 0) {
          timers.smoke = 0.9;
          soft.spawn({
            x: 19.44 + (Math.random() - 0.5) * 0.1, y: 3.68, z: 5.8,
            vx: 0.12, vy: 0.5, vz: 0.02,
            ttl: 3.2, size: 0.16, color: '#F5EBDC', drag: 0.02, grow: 2.2, alpha: 0.4
          });
        }
        // fireflies over the greens
        timers.fireflies -= dt;
        if (timers.fireflies <= 0) {
          timers.fireflies = 0.22;
          const i = Math.floor(Math.random() * 1e4);
          glow.spawn({
            x: 4 + hash2(i, 1) * 32, y: 0.4 + hash2(i, 2) * 1.2, z: 3 + hash2(i, 3) * 24,
            vx: (Math.random() - 0.5) * 0.3, vy: 0.1 + Math.random() * 0.12, vz: (Math.random() - 0.5) * 0.3,
            ttl: 3.4, size: 0.07 + Math.random() * 0.05, color: '#FFDD88',
            drag: 0.01, twinkle: 0.85
          });
        }
        // extra pollen motes inside the nursery fence (2x local density —
        // the nests should shimmer a little)
        timers.nursery -= dt;
        if (timers.nursery <= 0) {
          timers.nursery = 0.5;
          const i = Math.floor(Math.random() * 1e4);
          glow.spawn({
            x: 16 + hash2(i, 11) * 10, y: 0.3 + hash2(i, 12) * 0.9,
            z: 22.6 + hash2(i, 13) * 3.2,
            vx: (Math.random() - 0.5) * 0.25, vy: 0.1 + Math.random() * 0.1,
            vz: (Math.random() - 0.5) * 0.25,
            ttl: 3.2, size: 0.06 + Math.random() * 0.05, color: '#FFE3B3',
            drag: 0.01, twinkle: 0.85
          });
        }
        // drifting petals
        timers.petals -= dt;
        if (timers.petals <= 0) {
          timers.petals = 0.35;
          const i = Math.floor(Math.random() * 1e4);
          paper.spawn({
            x: 3 + hash2(i, 5) * 34, y: 2.2 + hash2(i, 6) * 1.6, z: 2 + hash2(i, 7) * 26,
            vx: 0.35 + Math.random() * 0.2, vy: -0.28 - Math.random() * 0.15,
            vz: 0.15 + Math.random() * 0.15,
            ttl: 6, size: 0.06, color: Math.random() < 0.5 ? '#F5A8C0' : '#FFF3D6',
            drag: 0, alpha: 0.9
          });
        }
        // fountain spray
        timers.fountain -= dt;
        while (timers.fountain <= 0) {
          timers.fountain += 0.045;
          const a = Math.random() * Math.PI * 2;
          soft.spawn({
            x: FOUNTAIN.x + Math.cos(a) * 0.06, y: 0.98, z: FOUNTAIN.z + Math.sin(a) * 0.06,
            vx: Math.cos(a) * (0.3 + Math.random() * 0.5), vy: 2.0 + Math.random() * 1.1,
            vz: Math.sin(a) * (0.3 + Math.random() * 0.5),
            ttl: 0.85, size: 0.07 + Math.random() * 0.05,
            color: Math.random() < 0.15 ? '#FFFFFF' : '#BFEAF2',
            gravity: 6.5, drag: 0.02, alpha: 0.85
          });
        }
      }

      // fireworks rockets + bursts (allowed even when 'enabled' is false only
      // if not reduced — celebration is opt-in via visiting everything)
      if (!REDUCED) {
        const now = performance.now() / 1000;
        for (let i = fireworks.length - 1; i >= 0; i--) {
          const f = fireworks[i];
          if (now < f.t) continue;
          fireworks.splice(i, 1);
          // rocket trail
          for (let s = 0; s < 7; s++) glow.spawn({
            x: f.x, y: 0.4 + s * 0.5, z: f.z,
            vx: 0, vy: 2, vz: 0,
            ttl: 0.22 + s * 0.05, size: 0.12, color: '#FFE9A8', drag: 0
          });
          // burst (kept low so the quarter-view camera actually frames it)
          const c = new THREE.Color().setHSL(f.hue, 0.85, 0.66);
          const c2 = new THREE.Color().setHSL((f.hue + 0.13) % 1, 0.85, 0.7);
          const y0 = 3.4 + Math.random() * 1.6;
          for (let s = 0; s < 80; s++) {
            const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            const sp = 2.4 + Math.random() * 1.6;
            // normal-blended solid squares: additive would wash out on the
            // bright grass. A few extra additive stars ride along for glow.
            (s % 5 === 0 ? glow : paper).spawn({
              x: f.x, y: y0, z: f.z,
              vx: Math.sin(ph) * Math.cos(th) * sp, vy: Math.cos(ph) * sp,
              vz: Math.sin(ph) * Math.sin(th) * sp,
              ttl: 1.1 + Math.random() * 0.5, size: 0.12 + Math.random() * 0.09,
              color: (s % 2 ? c : c2).getStyle(), gravity: 2.6, drag: 0.06, twinkle: 0.3
            });
          }
          // confetti raining from the burst
          for (let s = 0; s < 26; s++) paper.spawn({
            x: f.x + (Math.random() - 0.5) * 3, y: y0 + Math.random(), z: f.z + (Math.random() - 0.5) * 3,
            vx: (Math.random() - 0.5) * 1.2, vy: -0.4, vz: (Math.random() - 0.5) * 1.2,
            ttl: 2.8, size: 0.07,
            color: ['#F7D75E', '#F5A8C0', '#7FD4D9', '#8FD05C', '#FF8E72'][s % 5],
            gravity: 1.1, drag: 0.06
          });
        }
      }

      soft.update(dt, t);
      glow.update(dt, t);
      paper.update(dt, t);
    }
  };
  return api;
}
