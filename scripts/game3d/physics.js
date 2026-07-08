/* ============================================================================
   YOONKI WORLD 3D — playground physics toys
   A featherweight impulse system: bowling pins you can scatter, pushable
   crates, and a beach ball that bounces off everything. Circle collisions
   vs the player, each other, and the world colliders. No physics lib.
   ========================================================================== */

import * as THREE from 'three';
import { buildMesh } from '../voxel/voxel.js';
import { getModel } from '../voxel/voxel.js';
import { PLAYGROUND, REDUCED, hash2 } from './const.js';
import { makeBlobShadow } from './actors.js';

function toyMesh(name, scale) {
  let mesh;
  if (getModel(name)) mesh = buildMesh(name);
  else {
    console.warn('[yw3] missing model "' + name + '" — placeholder toy');
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xFF5DA2 }));
  }
  // toys move: blob shadows instead of the (possibly static) shadow map
  mesh.castShadow = false;
  mesh.scale.setScalar(scale);
  return mesh;
}

export function createToys(scene, colliders, hooks) {
  const bodies = [];

  function addBody(b) {
    const group = new THREE.Group();
    group.add(b.mesh);
    group.add(makeBlobShadow(b.kind === 'crate' ? b.r * 1.35 : b.r * 1.5));
    // place immediately: the title screen renders the world before the
    // first physics tick, so toys must never pile up at the world origin
    group.position.set(b.pos.x, 0, b.pos.z);
    scene.add(group);
    b.group = group;
    b.vel = new THREE.Vector2(0, 0);
    b.vy = 0;
    bodies.push(b);
    return b;
  }

  /* ---- bowling pins: triangle rack of 6 ------------------------------- */
  const pinHome = [];
  {
    const { x, z } = PLAYGROUND.pins;
    const s = 0.46;
    const rows = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2]];
    for (const [ox, oz] of rows) pinHome.push({ x: x + ox * s, z: z - oz * s });
  }
  pinHome.forEach((h, i) => {
    addBody({
      kind: 'pin', mesh: toyMesh('toy_bowling_pin', 0.5),
      pos: new THREE.Vector3(h.x, 0, h.z), home: h, i,
      r: 0.16, mass: 0.4, rest: 0.2, fric: 4,
      state: 'up', fallT: 0, fallAxis: new THREE.Vector2(1, 0), resetAt: 0
    });
  });

  /* ---- crates ----------------------------------------------------------- */
  for (const c of PLAYGROUND.crates) {
    addBody({
      kind: 'crate', mesh: toyMesh('toy_crate', 0.9),
      pos: new THREE.Vector3(c.x, 0, c.z),
      r: 0.5, mass: 3.2, rest: 0.05, fric: 7
    });
  }

  /* ---- beach ball --------------------------------------------------------- */
  const ballBody = addBody({
    kind: 'ball', mesh: toyMesh('toy_beach_ball', 0.72),
    pos: new THREE.Vector3(PLAYGROUND.ball.x, 0, PLAYGROUND.ball.z),
    r: 0.36, mass: 0.5, rest: 0.62, fric: 0.55
  });
  // re-center the ball geometry so it rolls around its own middle
  ballBody.mesh.geometry.translate(0, -0.5, 0);  // model is 1.0 units tall
  ballBody.mesh.position.y = 0.36;
  ballBody.spin = new THREE.Quaternion();

  /* ---- integration ----------------------------------------------------- */
  const n2 = new THREE.Vector2();
  const rollAxis = new THREE.Vector3();
  const rollQ = new THREE.Quaternion();

  function knock(b, strength, px, pz) {
    if (hooks.onKnock) hooks.onKnock(b, strength);
    if (b.kind === 'pin' && b.state === 'up' && strength > 1.1) {
      b.state = 'down';
      b.fallT = 0;
      b.fallAxis.set(px, pz).normalize();
      b.resetAt = performance.now() / 1000 + 6.5 + b.i * 0.3;
      if (hooks.onPinDown) hooks.onPinDown(b);
    }
  }

  function update(dt, player, t) {
    // ---- player pushes bodies -----------------------------------------
    for (const b of bodies) {
      const dx = b.pos.x - player.pos.x, dz = b.pos.z - player.pos.z;
      const rr = b.r + player.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        n2.set(dx / d, dz / d);
        // positional separation (body yields)
        const pen = rr - d;
        b.pos.x += n2.x * pen; b.pos.z += n2.y * pen;
        // impulse from relative velocity
        const rel = (player.vel.x - b.vel.x) * n2.x + (player.vel.y - b.vel.y) * n2.y;
        if (rel > 0) {
          const k = b.kind === 'crate' ? 0.55 : b.kind === 'ball' ? 1.5 : 1.1;
          b.vel.x += n2.x * rel * k;
          b.vel.y += n2.y * rel * k;
          if (b.kind === 'ball' && rel > 2.2 && b.pos.y <= 0.01) b.vy = 1.6 + rel * 0.35;
          if (rel > 1.0) knock(b, rel, n2.x, n2.y);
        }
      }
    }

    // ---- body vs body ----------------------------------------------------
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const pen = (rr - d) / 2;
        const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
        a.pos.x -= nx * pen * 2 * wa; a.pos.z -= nz * pen * 2 * wa;
        b.pos.x += nx * pen * 2 * wb; b.pos.z += nz * pen * 2 * wb;
        const rel = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * nz;
        if (rel > 0) {
          const e = Math.max(a.rest, b.rest);
          const imp = rel * (1 + e);
          a.vel.x -= nx * imp * wa; a.vel.y -= nz * imp * wa;
          b.vel.x += nx * imp * wb; b.vel.y += nz * imp * wb;
          if (rel > 1.0) { knock(a, rel, -nx, -nz); knock(b, rel, nx, nz); }
        }
      }
    }

    // ---- integrate + world collision ---------------------------------------
    for (const b of bodies) {
      const speed = Math.hypot(b.vel.x, b.vel.y);
      if (speed > 0.001) {
        const drop = b.fric * dt;
        const ns = Math.max(0, speed - drop - speed * b.fric * 0.12 * dt);
        const k = speed > 0 ? ns / speed : 0;
        b.vel.x *= k; b.vel.y *= k;
        const hit = colliders.moveCircle(b.pos, b.vel.x * dt, b.vel.y * dt, b.r);
        if (hit) {
          if (b.kind === 'ball') {
            if (hit & 1) b.vel.x = -b.vel.x * b.rest;
            if (hit & 2) b.vel.y = -b.vel.y * b.rest;
            if (hit & 4) {                     // bounce off round props
              const n = colliders.lastNormal;
              const dot = b.vel.x * n.x + b.vel.y * n.z;
              if (dot < 0) {
                b.vel.x -= (1 + b.rest) * dot * n.x;
                b.vel.y -= (1 + b.rest) * dot * n.z;
              }
            }
            if (speed > 1.4 && hooks.onKnock) hooks.onKnock(b, speed * 0.6);
          } else {
            if (hit & 1) b.vel.x = 0;
            if (hit & 2) b.vel.y = 0;
          }
        }
      }
      // ball vertical bounce
      if (b.kind === 'ball') {
        if (b.pos.y > 0 || b.vy !== 0) {
          b.vy -= 20 * dt;
          b.pos.y += b.vy * dt;
          if (b.pos.y <= 0) {
            b.pos.y = 0;
            if (Math.abs(b.vy) > 1.2) {
              b.vy = -b.vy * b.rest;
              if (hooks.onBounce) hooks.onBounce(b);
            } else b.vy = 0;
          }
        }
        // roll
        if (!REDUCED && speed > 0.05) {
          rollAxis.set(b.vel.y, 0, -b.vel.x).normalize();
          rollQ.setFromAxisAngle(rollAxis, (speed * dt) / b.r);
          b.spin.premultiply(rollQ);
          b.mesh.quaternion.copy(b.spin);
        }
      }
      // pin fall / reset animation
      if (b.kind === 'pin') {
        if (b.state === 'down') {
          b.fallT = Math.min(1, b.fallT + dt * 2.6);
          const k = b.fallT;
          const ease = k < 0.8 ? (k / 0.8) : 1 - Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.06;
          const ang = ease * Math.PI * 0.48;
          rollAxis.set(-b.fallAxis.y, 0, b.fallAxis.x);
          b.mesh.quaternion.setFromAxisAngle(rollAxis, -ang);
          if (t >= b.resetAt) {
            b.state = 'up';
            b.pos.x = b.home.x; b.pos.z = b.home.z;
            b.vel.set(0, 0);
            b.mesh.quaternion.identity();
            if (hooks.onPinReset) hooks.onPinReset(b);
          }
        }
      }
      b.group.position.set(b.pos.x, b.kind === 'ball' ? b.pos.y : 0, b.pos.z);
    }
  }

  return { bodies, update };
}
