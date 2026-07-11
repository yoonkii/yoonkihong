/* ============================================================================
   YOONKI WORLD 3D — actors: player, NPC, creatures, eggs, secret friend
   Free analog movement with momentum, segmented walk-cycle player rig,
   wandering creatures with idle bob + emotes, wobbling eggs, blob shadows.
   ========================================================================== */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildMesh, getModel, voxelMaterial, VOXEL_SIZE } from '../voxel/voxel.js';

/** Per-actor material clone so the interaction highlight (150ms emissive
 *  lerp) can warm ONE actor without touching the shared voxel material. */
function actorMaterial() { return voxelMaterial().clone(); }
import {
  REDUCED, hash2, angleLerp, damp, PLAYER_MOVE,
  NPC_POS, CREATURE_SPOTS, EGG_SLOTS, PLAYER_START, SECRET_POS
} from './const.js';

/* ------------------------------------------------------------------ *
 *  BLOB SHADOW (Animal Crossing read)                                  *
 * ------------------------------------------------------------------ */
let blobTexture = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // stronger core (was .58/.38): GLB creatures scaled up 1.25x need a firmer
  // anchor to the ground or they float at overworld zoom
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(20,35,50,0.68)');
  grad.addColorStop(0.7, 'rgba(20,35,50,0.46)');
  grad.addColorStop(1, 'rgba(20,35,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}
export function makeBlobShadow(radius) {
  radius *= 1.15;                     // grounding beats subtlety (Pokopia read)
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getBlobTexture(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

/* ------------------------------------------------------------------ *
 *  ROUNDED HERO MESH (VISUAL_PLAYBOOK: RoundedBoxGeometry radius .06   *
 *  for hero characters). The player/NPC voxel models are rebuilt as    *
 *  greedy-merged per-color boxes -> RoundedBoxGeometry, so the         *
 *  silhouette gets the same soft chunky bevel as the Meshy creatures   *
 *  instead of hard Minecraft cubes clashing beside them in encounters. *
 * ------------------------------------------------------------------ */
const roundedGeoCache = new Map();
function roundedVoxelGeometry(name, origin) {
  const cacheKey = name + '|' + origin;
  if (roundedGeoCache.has(cacheKey)) return roundedGeoCache.get(cacheKey);
  const model = getModel(name);
  if (!model) return null;
  const vs = VOXEL_SIZE;
  const key = (x, y, z) => x + '|' + y + '|' + z;
  const map = new Map();
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxZ = -Infinity;
  for (const v of model.voxels) {
    map.set(key(v[0], v[1], v[2]), v[3]);          // last-wins like the builder
    if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1];
    if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
  }
  // greedy per-color box merge (x run -> z rect -> y slab): bevels appear
  // only on the outer silhouette, not on every interior voxel seam
  const used = new Set();
  const boxes = [];
  const sorted = Array.from(map.entries())
    .map(([k, ci]) => { const p = k.split('|').map(Number); return [p[0], p[1], p[2], ci]; })
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const takeable = (x, y, z, ci) => map.get(key(x, y, z)) === ci && !used.has(key(x, y, z));
  for (const [x, y, z, ci] of sorted) {
    if (used.has(key(x, y, z))) continue;
    let x1 = x, z1 = z, y1 = y;
    while (takeable(x1 + 1, y, z, ci)) x1++;
    zGrow: for (;;) {
      for (let xi = x; xi <= x1; xi++) if (!takeable(xi, y, z1 + 1, ci)) break zGrow;
      z1++;
    }
    yGrow: for (;;) {
      for (let xi = x; xi <= x1; xi++) for (let zi = z; zi <= z1; zi++)
        if (!takeable(xi, y1 + 1, zi, ci)) break yGrow;
      y1++;
    }
    for (let xi = x; xi <= x1; xi++) for (let yi = y; yi <= y1; yi++)
      for (let zi = z; zi <= z1; zi++) used.add(key(xi, yi, zi));
    boxes.push([x, y, z, x1, y1, z1, ci]);
  }
  const palette = model.palette.map(h => new THREE.Color(h));
  const geos = [];
  for (const [x0, y0, z0, x1, y1, z1, ci] of boxes) {
    const w = (x1 - x0 + 1) * vs, h = (y1 - y0 + 1) * vs, d = (z1 - z0 + 1) * vs;
    const r = Math.min(0.06, Math.min(w, h, d) * 0.36);
    const g = new RoundedBoxGeometry(w, h, d, 2, r);
    g.translate(x0 * vs + w / 2, y0 * vs + h / 2, z0 * vs + d / 2);
    const col = palette[ci] || palette[0];
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  if (origin !== 'corner') {
    const W = maxX - minX + 1, D = maxZ - minZ + 1;
    merged.translate(-(minX + W / 2) * vs, -minY * vs, -(minZ + D / 2) * vs);
  }
  merged.computeBoundingSphere();
  roundedGeoCache.set(cacheKey, merged);
  return merged;
}
/** Rounded hero mesh with its own (smooth-shaded) material so the
 *  interaction highlight can warm one actor. Null if model is missing. */
function roundedActorMesh(name, origin) {
  const geo = roundedVoxelGeometry(name, origin);
  if (!geo) return null;
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function safeActorMesh(name) {
  if (getModel(name)) {
    const m = buildMesh(name, { material: actorMaterial() });
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
  console.warn('[yw3] missing model "' + name + '" — placeholder actor');
  const g = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.8),
    new THREE.MeshLambertMaterial({ color: 0xFF5DA2 }));
  g.position.y = 0.6;
  const grp = new THREE.Group();
  grp.add(g);
  return grp;
}

/* ------------------------------------------------------------------ *
 *  PLAYER — segmented rig + real walk cycle                            *
 *  Replaces the old whole-body hop ("뒤뚱뒤뚱"): opposite arm/leg swing  *
 *  with frequency tied to actual speed, torso lean into the movement,  *
 *  subtle head bob, scarf-tail rotation spring. Squash-stretch remains *
 *  only as landing / stop / bump / about-face ACCENTS.                 *
 * ------------------------------------------------------------------ */
// [key, model, pivot] — pivots in model-local units (y0 = ground, XZ 0 =
// model center). Grid contract: characters.js human rig, 8 voxels = 1 wu.
const PLAYER_PARTS = [
  ['head',  'player_head',  [0, 0.875, 0]],            // neck (grid y7)
  ['torso', 'player_torso', [0, 0.375, 0]],            // hips (grid y3)
  ['pack',  'player_pack',  [0, 0.375, 0]],            // leans with torso
  ['scarf', 'player_scarf', [0.0625, 0.875, -0.5625]], // tail root (back)
  ['armL',  'player_arm_l', [-0.4375, 0.75, 0]],       // shoulders (grid y6)
  ['armR',  'player_arm_r', [0.4375, 0.75, 0]],
  ['legL',  'player_leg_l', [-0.25, 0.375, 0.0625]],   // hips
  ['legR',  'player_leg_r', [0.25, 0.375, 0.0625]]
];

function buildPlayerRig(inner) {
  if (!PLAYER_PARTS.every(([, m]) => getModel(m))) return null;
  const off = -10 / 2 * VOXEL_SIZE;         // 10-voxel grid -> XZ-centered
  const rig = {};
  for (const [key, model, [px, py, pz]] of PLAYER_PARTS) {
    const mesh = roundedActorMesh(model, 'corner');
    mesh.position.set(off - px, -py, off - pz);
    const pivot = new THREE.Group();
    pivot.position.set(px, py, pz);
    pivot.add(mesh);
    inner.add(pivot);
    rig[key] = pivot;
  }
  return rig;
}

// Walk tuning. Phase advances (rad/s) with actual speed; each PI = one
// step. At max speed (5.2): ~15 rad/s ≈ 4.8 steps/s, matching the stride.
const WALK = {
  freq: 3.2, freqPerSpeed: 2.3,
  armAmp: 0.8, legAmp: 0.85,
  bob: 0.05, headNod: 0.05, lean: 0.15
};

/* ---- rigged GLB characters (player / npc_yoonki) ---------------------
   The authored GLBs ship skinned with two clips: `walk` (1.0s loop) and
   `idle` (8.0s breathe/look-around). Both actions stay scheduled on one
   mixer and swap via 0.15s crossfades; walk timeScale is speed-synced so
   the stride never foot-slides. At timeScale 1 the walk loop covers two
   steps — REF_SPEED is tuned so max run (5.2 wu/s) lands ~4.8 steps/s,
   matching the old procedural stride. */
const XFADE = 0.15;
/* wu/s at walk timeScale 1. Re-checked 2026-07-10 for the fleece player
   re-rig: new walk clip stride is 0.575 wu p2p (old 0.38) at the same 1.0s
   / 2-step loop, so keeping 2.2 preserves the approved max-run cadence
   (~4.7 steps/s) while foot coverage per second IMPROVES (slide fraction
   1 - 2*stride/REF: 65% -> 48%). Raising the divisor would restore the old
   slide — don't. Re-measure stride (rigviewer foot-bone p2p) per re-export. */
const WALK_REF_SPEED = 2.2;
function createCharacterAnim(gm) {
  const clips = (gm.userData && gm.userData.animations) || [];
  const walkClip = clips.find((c) => c.name === 'walk');
  const idleClip = clips.find((c) => c.name === 'idle');
  if (!walkClip || !idleClip) return null;
  const mixer = new THREE.AnimationMixer(gm);
  const idle = mixer.clipAction(idleClip);
  const walk = mixer.clipAction(walkClip);
  idle.play();
  return {
    mixer, idle, walk, moving: false, stepPhase: 0,
    walkDur: walkClip.duration || 1,
    setMoving(m) {
      if (m === this.moving) return;
      this.moving = m;
      const to = m ? this.walk : this.idle;
      const from = m ? this.idle : this.walk;
      to.enabled = true;
      to.reset().setEffectiveWeight(1).play();
      from.crossFadeTo(to, XFADE, false);
    }
  };
}

export function createPlayer(scene, glb = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();            // yaw + squash/stretch pivot
  group.add(inner);

  // authored rigged GLB (walk/idle clips, cloned via SkeletonUtils in the
  // loader). Squash-stretch accents stay OFF for the skinned mesh — the
  // clips own the body language. Missing/clipless GLB -> voxel rig.
  let anim = null;
  let rig = null;
  if (glb.player) anim = createCharacterAnim(glb.player);
  if (anim) {
    inner.add(glb.player);
  } else {
    rig = buildPlayerRig(inner);
    if (!rig) inner.add(safeActorMesh('player'));
  }

  const shadow = makeBlobShadow(0.52);
  group.add(shadow);
  // spawn pose immediately: the title screen renders the world before the
  // first update tick, so the player must never sit at the world origin
  group.position.set(PLAYER_START.x, 0, PLAYER_START.z);

  const player = {
    group, inner, rig, shadow, glb: !!anim,
    // title screen: game logic is paused but the rigged character must keep
    // breathing (a frozen skinned mesh holds the bind pose)
    tickAnim: anim ? (dt) => anim.mixer.update(dt) : null,
    pos: new THREE.Vector3(PLAYER_START.x, 0, PLAYER_START.z),
    vel: new THREE.Vector2(0, 0),
    yaw: 0,                                    // model front is +Z: faces camera
    lastHit: 0,
    r: 0.3,
    speed: 0,
    maxSpeed: PLAYER_MOVE.maxSpeed,
    walkPhase: 0,
    bobY: 0,                                   // walk bob (was the 0.22 hop)
    lean: 0,                                   // torso lean into movement
    scarfRot: 0, scarfVel: 0,                  // scarf-tail rotation spring
    sy: 1, syVel: 0,                           // squash spring (stops/bumps)
    landK: 0,                                  // footfall-squash envelope
    turnCd: 0,                                 // about-face accent cooldown
    wasMoving: false,
    onStep: null                                // cb(pos, speed)
  };

  player.update = function (dt, move, colliders, t) {
    // ---- momentum -------------------------------------------------------
    const tx = move.x * player.maxSpeed, tz = move.z * player.maxSpeed;
    const accel = (move.x !== 0 || move.z !== 0)
      ? PLAYER_MOVE.accel : PLAYER_MOVE.decel;
    player.vel.x = damp(player.vel.x, tx, accel, dt);
    player.vel.y = damp(player.vel.y, tz, accel, dt);
    if (Math.abs(player.vel.x) < 0.01) player.vel.x = 0;
    if (Math.abs(player.vel.y) < 0.01) player.vel.y = 0;
    const prevSpeed = player.speed;
    player.speed = Math.hypot(player.vel.x, player.vel.y);

    // ---- collision + slide ------------------------------------------------
    player.lastHit = colliders.moveCircle(
      player.pos, player.vel.x * dt, player.vel.y * dt, player.r);

    // ---- facing (+ about-face squash accent) -------------------------------
    player.turnCd -= dt;
    if (player.speed > 0.25) {
      const target = Math.atan2(player.vel.x, player.vel.y);
      let dyaw = (target - player.yaw) % (Math.PI * 2);
      if (dyaw > Math.PI) dyaw -= Math.PI * 2;
      if (dyaw < -Math.PI) dyaw += Math.PI * 2;
      if (!REDUCED && Math.abs(dyaw) > 2.1 && player.speed > 1.5 &&
          player.turnCd <= 0) {
        player.syVel -= 1.8;                   // hard-turn plant accent
        player.turnCd = 0.45;
      }
      player.yaw = angleLerp(player.yaw, target, 1 - Math.exp(-14 * dt));
    }

    // ---- walk cycle --------------------------------------------------------
    const moving = player.speed > 0.35;
    const spdK = Math.min(1, player.speed / player.maxSpeed);
    if (anim) {
      // rigged GLB: crossfade idle<->walk, stride speed-synced. Runs under
      // prefers-reduced-motion too — an un-animated skinned mesh would
      // T-pose glide, which reads as breakage, not calm.
      anim.setMoving(moving);
      const ts = Math.max(0.5, Math.min(2.6, player.speed / WALK_REF_SPEED));
      anim.walk.setEffectiveTimeScale(ts);
      anim.mixer.update(dt);
      if (moving) {
        // footfalls: two per walk loop — same SFX/dust beat as the old rig
        const prev = anim.stepPhase;
        anim.stepPhase += dt * ts * (Math.PI * 2) / anim.walkDur;
        if (Math.floor(prev / Math.PI) !== Math.floor(anim.stepPhase / Math.PI)) {
          if (player.onStep) player.onStep(player.pos, player.speed);
        }
      }
    } else if (rig && !REDUCED) {
      if (moving) {
        const prev = player.walkPhase;
        player.walkPhase += dt * (WALK.freq + player.speed * WALK.freqPerSpeed);
        const k = Math.min(1, spdK + 0.25);
        const swing = Math.sin(player.walkPhase) * k;
        rig.armL.rotation.x = -swing * WALK.armAmp;   // opposite arm/leg
        rig.armR.rotation.x = swing * WALK.armAmp;
        rig.legL.rotation.x = swing * WALK.legAmp;
        rig.legR.rotation.x = -swing * WALK.legAmp;
        player.bobY = Math.abs(Math.sin(player.walkPhase)) * WALK.bob * k;
        rig.head.rotation.x = Math.sin(player.walkPhase * 2) * WALK.headNod * k;
        player.lean = damp(player.lean, WALK.lean * spdK, 8, dt);
        // footfall: every half cycle — step SFX/dust + a tiny weight dip
        if (Math.floor(prev / Math.PI) !== Math.floor(player.walkPhase / Math.PI)) {
          player.landK = 1;
          if (player.onStep) player.onStep(player.pos, player.speed);
        }
      } else {
        for (const kk of ['armL', 'armR', 'legL', 'legR'])
          rig[kk].rotation.x = damp(rig[kk].rotation.x, 0, 12, dt);
        rig.head.rotation.x = damp(rig.head.rotation.x, 0, 10, dt);
        player.lean = damp(player.lean, 0, 8, dt);
        player.bobY = damp(player.bobY, 0, 14, dt);
      }
      rig.torso.rotation.x = player.lean;       // lean into the movement
      rig.pack.rotation.x = player.lean;        // pack rides the torso
      // scarf tail: lagging rotation spring — lifts with speed, flutters
      // with the stride, settles softly on stop
      const scarfTarget = moving
        ? 0.25 + 0.75 * spdK + Math.sin(player.walkPhase) * 0.15
        : 0;
      player.scarfVel += (scarfTarget - player.scarfRot) * 60 * dt;
      player.scarfVel *= Math.pow(0.001, dt);
      player.scarfRot = Math.max(-0.5, Math.min(1.5,
        player.scarfRot + player.scarfVel * dt));
      rig.scarf.rotation.x = player.scarfRot;
      // idle: slow head sway (look-around) — cheap "alive" beat
      rig.head.rotation.y = damp(rig.head.rotation.y,
        moving ? 0 : Math.sin(t * 0.55) * 0.08, 2.5, dt);
    }

    // footfall dip envelope: shallow (~0.94) and over half recovered by 60ms
    player.landK *= Math.pow(1e-6, dt);
    if (player.landK < 0.02) player.landK = 0;
    // stop squash: the damped-spring skid settle (sy dips then overshoots)
    if (!REDUCED && player.wasMoving && player.speed < 0.5 && prevSpeed >= 0.5) {
      player.syVel -= 3.2;
    }
    player.wasMoving = moving;

    // squash spring (stop-skid settle + wall bumps + hard turns only)
    if (!REDUCED) {
      player.syVel += (1 - player.sy) * 120 * dt;
      player.syVel *= Math.pow(0.0005, dt);
      player.sy += player.syVel * dt;
      player.sy = Math.min(1.25, Math.max(0.7, player.sy));
    }

    // ---- write transform ---------------------------------------------------
    const breathe = REDUCED ? 0 : Math.sin(t * 3.9) * 0.012 * (moving ? 0 : 1);
    group.position.set(player.pos.x, 0, player.pos.z);
    inner.position.y = player.bobY;
    inner.rotation.y = player.yaw;
    if (!anim) {
      // procedural squash-stretch: voxel rig only — the skinned clips carry
      // their own weight/recoil, and non-uniform scale warps a skinned mesh
      const landSquash = REDUCED ? 1 : 1 - 0.06 * player.landK;
      const sy = Math.max(0.8, (player.sy + breathe) * landSquash);
      inner.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    }
    const sh = 1 - Math.min(0.3, player.bobY * 2.0);
    player.shadow.scale.set(sh, sh, sh);
    player.shadow.material.opacity = sh;
  };

  scene.add(group);
  return player;
}

/* ------------------------------------------------------------------ *
 *  NPC YOONKI                                                          *
 * ------------------------------------------------------------------ */
export function createNPC(scene, glb = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  // rigged GLB twin of the player (mint hoodie, no backpack): idle clip
  // only — the greeter never walks. Missing GLB -> rounded voxel model
  // (possibly hot-swapped later via setGLB — two-phase preload).
  let anim = glb.npc_yoonki ? createCharacterAnim(glb.npc_yoonki) : null;
  if (anim) inner.add(glb.npc_yoonki);
  else inner.add(roundedActorMesh('npc_yoonki') || safeActorMesh('npc_yoonki'));
  group.add(makeBlobShadow(0.52));
  group.position.set(NPC_POS.x, 0, NPC_POS.z);

  const npc = {
    group, inner, yaw: 0.15, glb: !!anim,
    tickAnim: (dt) => { if (anim) anim.mixer.update(dt); },
    pos: { x: NPC_POS.x, z: NPC_POS.z }, r: 0.35, speed: 0
  };
  npc.update = function (dt, playerPos, t) {
    const dx = playerPos.x - NPC_POS.x, dz = playerPos.z - NPC_POS.z;
    const near = dx * dx + dz * dz < 9;
    const target = near
      ? Math.atan2(dx, dz)
      : 0.15 + Math.sin(t * 0.25) * 0.7;            // slow look-around
    npc.yaw = angleLerp(npc.yaw, target, 1 - Math.exp(-6 * dt));
    inner.rotation.y = npc.yaw;
    if (anim) anim.mixer.update(dt);                // authored idle breathe
    else if (!REDUCED) inner.scale.y = 1 + Math.sin(t * 3.2) * 0.012;
  };
  /** Two-phase preload: swap the voxel stand-in for the rigged GLB. */
  npc.setGLB = function (gm) {
    if (anim || !gm) return;
    const a = createCharacterAnim(gm);
    if (!a) return;                          // clipless: keep the voxel body
    anim = a;
    inner.clear();
    inner.scale.y = 1;                       // drop the voxel breathe scale
    inner.add(gm);
    npc.glb = true;
  };
  scene.add(group);
  return npc;
}

/* ------------------------------------------------------------------ *
 *  CREATURES                                                           *
 * ------------------------------------------------------------------ */
// GLBs run 1.25x: wider blob-shadow anchor. mathwings runs slightly wide
// still — the 20260710 superhero re-export spans ~1.72 wu (cape + raised
// fist), so it gets a radius sized to the true silhouette (the old owl's
// 1.85 wu clamped wingspan wanted 0.82).
const GLB_BLOB_R = { mathwings: 0.74 };
const VOXEL_BLOB_R = 0.6;

export function createCreatures(scene, projects, glb = {}) {
  const products = projects.filter(p => p.kind !== 'egg' && (p.category || 'product') === 'product');
  const creatures = [];
  products.forEach((p, i) => {
    if (i >= CREATURE_SPOTS.length) return;
    const spot = CREATURE_SPOTS[i];
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    // authored GLB body if the asset shipped (already Lambert-harmonized,
    // normalized to contract height, origin ground-center, front +Z) —
    // the hop/bob/squash below animates `inner`, so the GLB rides the same
    // procedural animation as the voxel body. Missing GLB -> voxel model
    // (possibly hot-swapped later via setGLB: two-phase preload streams
    // creature GLBs in behind PRESS START).
    const gm = glb[p.id];
    if (gm) inner.add(gm);
    else if (getModel('creature_' + p.id)) inner.add(safeActorMesh('creature_' + p.id));
    // no authored voxel fallback (e.g. gunball): stay hidden until the
    // streamed GLB lands via setGLB — never show the magenta placeholder
    // box to a slow-network visitor
    else group.visible = false;
    const shadow = makeBlobShadow(gm ? (GLB_BLOB_R[p.id] || 0.68) : VOXEL_BLOB_R);
    group.add(shadow);

    const c = {
      id: p.id, project: p, group, inner, shadow, glb: !!gm,
      home: { x: spot.x + 0.5, z: spot.y + 0.5 },
      pos: new THREE.Vector3(spot.x + 0.5, 0, spot.y + 0.5),
      target: null, yaw: Math.PI / 4, r: 0.34, speed: 0,
      nextAt: 1 + hash2(i, 1, 5) * 2.5,
      emoteAt: 6 + hash2(i, 2, 5) * 5,
      spin: 0, hopPhase: hash2(i, 3, 5) * 6,
      hopY: 0, frozen: false,
      // "notice you" pose: after ~1.5s idle, drift toward the fixed SE
      // camera (yaw PI/4) ± a hashed 25° jitter — the faces, not the
      // monitor-backs/rumps, own the overworld screen time
      idleT: 0,
      camYaw: Math.PI / 4 + (hash2(i, 4, 5) - 0.5) * 0.87,
      // soft billboard clamp (± rad around the camera azimuth PI/4): the
      // lasthand model is a flat one-sided hand — edge-on or back-to-camera
      // it reads as a plain tan plank, so its palm never leaves ±60° of the
      // fixed camera. Rounder creatures keep free yaw (null).
      yawClampHalf: p.id === 'lasthand' ? Math.PI / 3 : null
    };
    group.position.set(c.pos.x, 0, c.pos.z);
    creatures.push(c);
    scene.add(group);
  });

  function update(dt, t, colliders, playerPos) {
    for (const c of creatures) {
      if (c.frozen) {                          // encounter: face camera + hop
        const face = c.faceYaw != null ? c.faceYaw : Math.PI / 4;
        c.yaw = angleLerp(c.yaw, face, 1 - Math.exp(-8 * dt));
        c.inner.rotation.y = c.yaw;
        c.hopY = damp(c.hopY, 0, 8, dt);
        c.inner.position.y = c.hopY;
        continue;
      }
      c.speed = 0;
      if (c.target) {
        c.idleT = 0;
        const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          c.target = null;
          c.nextAt = t + 0.9 + hash2(Math.floor(t * 7), c.home.x, 6) * 2.6;
        } else {
          const sp = 1.25;
          c.speed = sp;
          const hit = colliders.moveCircle(c.pos, dx / d * sp * dt, dz / d * sp * dt, c.r);
          if (hit) { c.target = null; c.nextAt = t + 0.6; }
          c.yaw = angleLerp(c.yaw, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
        }
      } else if (t >= c.nextAt) {
        c.nextAt = t + 0.9 + hash2(Math.floor(t * 13), c.home.z, 7) * 2.6;
        if (hash2(Math.floor(t * 31), c.home.x, 8) > 0.35) {
          const a = hash2(Math.floor(t * 17), c.home.x + c.home.z, 9) * Math.PI * 2;
          const r = 0.6 + hash2(Math.floor(t * 23), c.home.x, 10) * 1.6;
          const tx = c.home.x + Math.cos(a) * r, tz = c.home.z + Math.sin(a) * r;
          const ddx = playerPos.x - tx, ddz = playerPos.z - tz;
          if (ddx * ddx + ddz * ddz > 1 && !colliders.blockedAt(tx, tz, c.r)) {
            c.target = { x: tx, z: tz };
          }
        }
      }
      // emotes: double hop or a full spin (yaw-clamped creatures always
      // hop — a full spin would fight the billboard clamp below)
      if (!REDUCED && t >= c.emoteAt) {
        c.emoteAt = t + 6 + hash2(Math.floor(t * 11), c.home.x, 11) * 5;
        if (c.yawClampHalf == null &&
            hash2(Math.floor(t * 37), c.home.z, 12) < 0.5) c.spin = Math.PI * 2;
        else c.hopBoost = 2;
      }
      if (c.spin > 0) {
        const step = dt * 14;
        c.spin -= step;
        c.yaw += step;
        if (c.spin < 0) c.spin = 0;
      }
      // idle: after 1.5s standing, softly turn to face the camera (free yaw
      // while walking, then "notice you" — the Animal Crossing beat)
      if (c.speed < 0.1 && c.spin === 0) {
        c.idleT += dt;
        if (c.idleT > 1.5) {
          c.yaw = angleLerp(c.yaw, c.camYaw, 1 - Math.exp(-2.5 * dt));
        }
      }

      // hop while walking, gentle bob while idle. Rotation stays yaw-only
      // (never pitch/roll — a tipping body breaks the silhouette); the hop
      // reads through the shared squash-stretch curve instead.
      if (!REDUCED) {
        if (c.speed > 0.1 || c.hopBoost) {
          c.hopPhase += dt * (7 + c.speed * 2);
          c.hopY = Math.abs(Math.sin(c.hopPhase)) * (c.hopBoost ? 0.16 : 0.08);
          if (c.hopBoost && Math.abs(Math.sin(c.hopPhase)) < 0.08) c.hopBoost--;
        } else {
          c.hopY = damp(c.hopY, 0, 10, dt);
        }
        const sy = 1 + Math.sin(t * 3.9 + c.home.x) * 0.018 + c.hopY * 1.3;
        const sxz = 1 / Math.sqrt(sy);
        c.inner.scale.set(sxz, sy, sxz);
      }
      // soft billboard: keep flat one-sided models facing camera-ish
      if (c.yawClampHalf != null) {
        let dy = (c.yaw - Math.PI / 4) % (Math.PI * 2);
        if (dy > Math.PI) dy -= Math.PI * 2;
        if (dy < -Math.PI) dy += Math.PI * 2;
        c.yaw = Math.PI / 4 + Math.max(-c.yawClampHalf, Math.min(c.yawClampHalf, dy));
      }
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.inner.position.y = c.hopY;
      c.inner.rotation.y = c.yaw;
    }
  }

  /** Two-phase preload: swap the voxel stand-in body for a late-arriving
   *  authored GLB (same contract — normalized height, ground-center origin,
   *  front +Z — so it rides the same `inner` hop/bob/squash pivot).
   *  Idempotent: no-op once the creature is already on a GLB body. */
  function setGLB(c, gm) {
    if (c.glb || !gm) return;
    c.inner.clear();
    c.inner.add(gm);
    c.glb = true;
    c.group.visible = true;                    // fallback-less creatures hid
    // widen the blob shadow to the GLB anchor radius (creature shadows are
    // never scale-animated, so a uniform scale is safe here)
    c.shadow.scale.setScalar((GLB_BLOB_R[c.id] || 0.68) / VOXEL_BLOB_R);
  }

  return { creatures, update, setGLB };
}

/* ------------------------------------------------------------------ *
 *  EGGS                                                                *
 * ------------------------------------------------------------------ */
// Pastel shells + darker same-hue polka dots (Pokopia read): the eggs must
// never share white+gray with the voxel rocks or they read as rock piles.
const EGG_STYLES = {
  suno: ['#D6C4F0', '#A98FD6'],      // lavender
  substack: ['#F5C9A8', '#E09A62'],  // apricot
  x: ['#BFEAD8', '#8FCDB2']          // mint
};
const EGG_STYLE_CYCLE = [
  ['#BFEAD8', '#8FCDB2'], ['#F5A8C0', '#E07A9E'], ['#D6C4F0', '#A98FD6']
];

export function createEggs(scene, projects, glb = {}) {
  const eggProjects = projects.filter(p => p.kind === 'egg');
  const eggs = [];
  /** One egg body: authored GLB (tinted per project) if a source group is
   *  available, else the voxel egg. Shared by build time and the two-phase
   *  late swap (setGLB). Every nursery egg clones the one source group —
   *  clone(true) shares BufferGeometry, so N eggs cost N draw calls but
   *  near-zero extra GPU memory. */
  function buildEggBody(p, i, eggSource) {
    // authored GLB egg (already Lambert-harmonized + normalized to the
    // as-placed contract height). Missing GLB -> voxel egg.
    const eggGlb = eggSource ? eggSource.clone(true) : null;
    // egg: 1.5x hero scale, project-colored spots, seated in a straw nest
    const baseModel = getModel('egg_spotted');
    if (eggGlb) {
      eggGlb.position.y = 0.1;                        // settled into the straw
      // per-project pastel tint: the single baked texture would make all six
      // nursery eggs identical clones (asset-shop repeat — against the
      // playbook's variety-in-clusters). Lambert `color` multiplies the baked
      // map, so cloning the material once per egg and tinting it with the
      // project's voxel-path spot color pulled ~78% toward white gives six
      // pastel variants for free (one extra material per egg, zero texture
      // memory — the map stays shared).
      const [, spotHex] = EGG_STYLES[p.id] || EGG_STYLE_CYCLE[i % EGG_STYLE_CYCLE.length];
      const tint = new THREE.Color(spotHex).lerp(new THREE.Color(0xFFFFFF), 0.78);
      const tinted = new Map();                       // shared mat -> tinted clone
      eggGlb.traverse((o) => {
        if (!o.isMesh) return;
        const retint = (m) => {
          if (!tinted.has(m)) {
            const c = m.clone();
            c.color.multiply(tint);
            tinted.set(m, c);
          }
          return tinted.get(m);
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(retint) : retint(o.material);
      });
      return eggGlb;
    }
    if (baseModel) {
      const [shell, spot] = EGG_STYLES[p.id] || EGG_STYLE_CYCLE[i % EGG_STYLE_CYCLE.length];
      const mesh = buildMesh(
        { ...baseModel, palette: [shell, spot] },
        { material: actorMaterial() });
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.scale.setScalar(1.5);
      mesh.position.y = 0.1;                          // settled into the straw
      return mesh;
    }
    return safeActorMesh('egg_spotted');
  }
  eggProjects.forEach((p, i) => {
    if (i >= EGG_SLOTS.length) return;
    const s = EGG_SLOTS[i];
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    // the wobble animates `inner`, so the GLB rides the same wobble as the
    // voxel egg (which may be hot-swapped later — two-phase preload)
    inner.add(buildEggBody(p, i, glb.egg));
    if (getModel('egg_nest')) {
      const nest = buildMesh('egg_nest');
      nest.castShadow = false;
      nest.receiveShadow = true;
      nest.scale.set(1.9, 1.3, 1.9);
      group.add(nest);
    }
    group.add(makeBlobShadow(0.52));
    group.position.set(s.x, 0, s.z);
    group.rotation.y = hash2(i, 5, 13) * Math.PI * 2;
    const egg = {
      id: p.id, project: p, group, inner, i, glbBody: !!glb.egg,
      pos: { x: s.x, z: s.z }, r: 0.28,
      wobbleAt: 2 + i * 1.6 + hash2(i, 6, 13) * 3, wobbleT: -1
    };
    eggs.push(egg);
    scene.add(group);
  });

  function update(dt, t) {
    if (REDUCED) return;
    for (const e of eggs) {
      if (e.wobbleT < 0 && t >= e.wobbleAt) { e.wobbleT = 0; }
      if (e.wobbleT >= 0) {
        e.wobbleT += dt;
        const k = e.wobbleT / 0.55;
        if (k >= 1) {
          e.wobbleT = -1;
          e.inner.rotation.z = 0;
          e.wobbleAt = t + 3 + hash2(Math.floor(t * 5), e.pos.x, 14) * 3;
        } else {
          e.inner.rotation.z = Math.sin(k * Math.PI * 3) * 0.1 * (1 - k);
        }
      }
    }
  }
  /** Two-phase preload: rebuild every still-voxel egg on the authored GLB. */
  function setGLB(gm) {
    if (!gm) return;
    for (const e of eggs) {
      if (e.glbBody) continue;
      e.inner.clear();
      e.inner.add(buildEggBody(e.project, e.i, gm));
      e.glbBody = true;
    }
  }
  return { eggs, update, setGLB };
}

/* ------------------------------------------------------------------ *
 *  SECRET FRIEND (hidden in the tree-ring gap)                         *
 * ------------------------------------------------------------------ */
const SECRET_MODEL = {
  palette: ['#FFD166', '#E8B13F', '#FFF3D6', '#2B2B33', '#FF8E72'],
  voxels: (() => {
    const v = [];
    // round golden blob
    for (let x = 0; x < 7; x++) for (let y = 0; y < 6; y++) for (let z = 0; z < 7; z++) {
      const dx = x - 3, dy = y - 2.4, dz = z - 3;
      if (dx * dx * 0.9 + dy * dy * 1.3 + dz * dz * 0.9 <= 8.3)
        v.push([x, y, z, y < 1 ? 1 : 0]);
    }
    // cream belly + face
    for (let x = 2; x <= 4; x++) for (let y = 1; y <= 3; y++) v.push([x, y, 6, 2]);
    v.push([2, 3, 6, 3], [4, 3, 6, 3]);        // eyes
    v.push([3, 2, 6, 4]);                      // tiny coral beak
    v.push([3, 6, 3, 0], [3, 7, 3, 4]);        // antenna sprout
    v.push([1, 5, 2, 2], [2, 5, 2, 2]);        // head glints
    return v;
  })(),
  chamfer: 0.35
};

export function createSecret(scene, glb = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  if (glb.goldie) {
    inner.add(glb.goldie);         // authored GLB (contract height 1.0)
  } else {
    const mesh = buildMesh(SECRET_MODEL, { material: actorMaterial() });
    mesh.castShadow = false; mesh.receiveShadow = false;
    inner.add(mesh);
  }
  group.add(makeBlobShadow(0.42));
  group.position.set(SECRET_POS.x, 0, SECRET_POS.z);
  scene.add(group);
  const s = { group, inner, glb: !!glb.goldie, pos: { x: SECRET_POS.x, z: SECRET_POS.z }, r: 0.3 };
  s.update = function (dt, t) {
    if (REDUCED) return;
    inner.position.y = Math.abs(Math.sin(t * 2.2)) * 0.06;
    inner.rotation.y = Math.sin(t * 0.7) * 0.5;
  };
  /** Two-phase preload: swap the voxel blob for the authored GLB. */
  s.setGLB = function (gm) {
    if (s.glb || !gm) return;
    inner.clear();
    inner.add(gm);
    s.glb = true;
  };
  return s;
}
