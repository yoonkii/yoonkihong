/* ============================================================================
   YOONKI WORLD 3D — world assembly
   Places every static thing on the island: buildings, tree ring, fences,
   nursery, fountain plaza, YOONKI letters, the Demo Lab yard, scattered
   props, instanced springy flora. Also owns the collision system used by
   the player, creatures and physics toys.
   ========================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildGeometry, getModel, voxelMaterial, VOXEL_SIZE, dedupe } from '../voxel/voxel.js';
import '../voxel/models/index.js';
import {
  MAP_W, MAP_H, tileAt, hash2, FONT3X5, REDUCED,
  HOME_SLOT, BUILDING_SLOTS, NPC_POS, SIGN_POS, FOUNTAIN, NURSERY_GAZEBO,
  EGG_SLOTS, LETTERS, DEMO_LAB, SECRET_POS
} from './const.js';
import { SEA_Y } from './ground.js';

/* ------------------------------------------------------------------ *
 *  SAFE MODEL ACCESS (missing model -> warn + magenta placeholder)     *
 * ------------------------------------------------------------------ */
const PLACEHOLDER = {
  palette: ['#FF5DA2', '#D34483'],
  voxels: (() => {
    const v = [];
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++)
      v.push([x, y, z, (x + y + z) % 2]);
    return v;
  })()
};
const geoCache = new Map();
export function safeGeometry(name, opts) {
  const key = name + (opts ? JSON.stringify(opts) : '');
  if (geoCache.has(key)) return geoCache.get(key);
  let model = getModel(name);
  if (!model) {
    console.warn('[yw3] missing model "' + name + '" — using placeholder');
    model = PLACEHOLDER;
  }
  const g = buildGeometry(model, opts || {});
  geoCache.set(key, g);
  return g;
}

/* ------------------------------------------------------------------ *
 *  COLLISION                                                           *
 * ------------------------------------------------------------------ */
export function createColliders(tiles) {
  const solid = (x, z) => {
    const t = tileAt(tiles, Math.floor(x), Math.floor(z));
    return t === 'W' || t === 'T' || t === 'X';
  };
  const aabbs = [];   // {x0, z0, x1, z1}
  const circles = []; // {x, z, r}

  function addAABB(x0, z0, x1, z1) { aabbs.push({ x0, z0, x1, z1 }); }
  function addCircle(x, z, r) { circles.push({ x, z, r }); }

  function blockedAt(px, pz, r) {
    // tiles
    for (let tx = Math.floor(px - r); tx <= Math.floor(px + r); tx++)
      for (let tz = Math.floor(pz - r); tz <= Math.floor(pz + r); tz++) {
        if (!solid(tx + 0.5, tz + 0.5)) continue;
        const cx = Math.max(tx, Math.min(px, tx + 1));
        const cz = Math.max(tz, Math.min(pz, tz + 1));
        if ((px - cx) * (px - cx) + (pz - cz) * (pz - cz) < r * r) return true;
      }
    for (const b of aabbs) {
      const cx = Math.max(b.x0, Math.min(px, b.x1));
      const cz = Math.max(b.z0, Math.min(pz, b.z1));
      if ((px - cx) * (px - cx) + (pz - cz) * (pz - cz) < r * r) return true;
    }
    for (const c of circles) {
      const rr = r + c.r;
      if ((px - c.x) * (px - c.x) + (pz - c.z) * (pz - c.z) < rr * rr) return true;
    }
    return false;
  }

  /**
   * Move a circle with proper wall sliding.
   * Boxes (tiles + prop AABBs): axis-separated clamps -> clean sliding.
   * Circles (round props): radial positional push-out -> the tangential
   * motion survives, so you glide around them instead of sticking.
   * Returns bitmask: 1 = hit on X, 2 = hit on Z, 4 = circle contact
   * (circle contact normal is left in colliders.lastNormal).
   */
  const lastNormal = { x: 0, z: 0 };
  function moveCircle(pos, dx, dz, r) {
    let hit = 0;
    // ---- X axis vs boxes ----
    if (dx !== 0) {
      let nx = pos.x + dx;
      const clampBox = (x0, z0, x1, z1) => {
        if (pos.z + r * 0.92 <= z0 || pos.z - r * 0.92 >= z1) return;
        if (dx > 0 && nx + r > x0 && pos.x + r <= x0 + 0.5) { nx = Math.min(nx, x0 - r); hit |= 1; }
        if (dx < 0 && nx - r < x1 && pos.x - r >= x1 - 0.5) { nx = Math.max(nx, x1 + r); hit |= 1; }
      };
      for (let tx = Math.floor(Math.min(pos.x, nx) - r); tx <= Math.floor(Math.max(pos.x, nx) + r); tx++)
        for (let tz = Math.floor(pos.z - r); tz <= Math.floor(pos.z + r); tz++)
          if (solid(tx + 0.5, tz + 0.5)) clampBox(tx, tz, tx + 1, tz + 1);
      for (const b of aabbs) clampBox(b.x0, b.z0, b.x1, b.z1);
      pos.x = nx;
    }
    // ---- Z axis vs boxes ----
    if (dz !== 0) {
      let nz = pos.z + dz;
      const clampBox = (x0, z0, x1, z1) => {
        if (pos.x + r * 0.92 <= x0 || pos.x - r * 0.92 >= x1) return;
        if (dz > 0 && nz + r > z0 && pos.z + r <= z0 + 0.5) { nz = Math.min(nz, z0 - r); hit |= 2; }
        if (dz < 0 && nz - r < z1 && pos.z - r >= z1 - 0.5) { nz = Math.max(nz, z1 + r); hit |= 2; }
      };
      for (let tx = Math.floor(pos.x - r); tx <= Math.floor(pos.x + r); tx++)
        for (let tz = Math.floor(Math.min(pos.z, nz) - r); tz <= Math.floor(Math.max(pos.z, nz) + r); tz++)
          if (solid(tx + 0.5, tz + 0.5)) clampBox(tx, tz, tx + 1, tz + 1);
      for (const b of aabbs) clampBox(b.x0, b.z0, b.x1, b.z1);
      pos.z = nz;
    }
    // ---- circles: radial push-out (natural tangential slide) ----
    for (const c of circles) {
      const rr = r + c.r;
      const ddx = pos.x - c.x, ddz = pos.z - c.z;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      lastNormal.x = ddx / d; lastNormal.z = ddz / d;
      pos.x = c.x + lastNormal.x * rr;
      pos.z = c.z + lastNormal.z * rr;
      hit |= 4;
    }
    return hit;
  }

  return { solid, aabbs, circles, addAABB, addCircle, moveCircle, blockedAt, lastNormal };
}

/* ------------------------------------------------------------------ *
 *  WIND MATERIAL (shared by tree chunk + instanced flora)              *
 * ------------------------------------------------------------------ */
export function windMaterial(uTime) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wref = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
          #else
            vec3 wref = (modelMatrix * vec4(position, 1.0)).xyz;
          #endif
          float hm = smoothstep(0.12, 1.35, position.y);
          hm = hm * hm;
          float sway = sin(uTime * 1.8 + wref.x * 0.5 + wref.z * 0.7) * 0.055
                     + sin(uTime * 3.7 + wref.x * 1.3) * 0.016;
          transformed.x += sway * hm;
          transformed.z += sway * hm * 0.6;
        }`);
  };
  return mat;
}

/* ------------------------------------------------------------------ *
 *  VOXEL LETTER GENERATOR                                              *
 * ------------------------------------------------------------------ */
function letterModel(ch, hex, hexShade) {
  const rows = FONT3X5[ch];
  if (!rows) return null;
  const v = [];
  const S = 2, DEPTH = 3;
  for (let ry = 0; ry < rows.length; ry++)
    for (let rx = 0; rx < rows[ry].length; rx++) {
      if (rows[ry][rx] !== '1') continue;
      for (let sx = 0; sx < S; sx++) for (let sy = 0; sy < S; sy++)
        for (let z = 0; z < DEPTH; z++) {
          const y = (rows.length - 1 - ry) * S + sy;
          v.push([rx * S + sx, y, z, z === DEPTH - 1 ? 0 : 1]);
        }
    }
  return { palette: [hex, hexShade], voxels: v, chamfer: 0.2 };
}

/* ------------------------------------------------------------------ *
 *  DEMO-LAB SIGN (board with pixel lettering)                          *
 * ------------------------------------------------------------------ */
function labSignModel() {
  const BOARD = 0, TEXT = 1, POST = 2, TRIM = 3;
  const v = [];
  const W = 21, H0 = 6, H1 = 19;
  // posts
  for (let y = 0; y < H0 + 2; y++) { v.push([2, y, 1, POST], [3, y, 1, POST], [W - 3, y, 1, POST], [W - 4, y, 1, POST]); }
  // board (2 deep)
  for (let x = 0; x < W; x++) for (let y = H0; y <= H1; y++) for (let z = 0; z <= 1; z++) {
    const edge = x === 0 || x === W - 1 || y === H0 || y === H1;
    v.push([x, y, z, edge ? TRIM : BOARD]);
  }
  // text: "DEMO" over "LAB", 3x5 glyphs, painted on the +Z face
  const paint = (word, x0, y0) => {
    let cx = x0;
    for (const ch of word) {
      const rows = FONT3X5[ch];
      for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 3; rx++)
        if (rows[ry][rx] === '1') v.push([cx + rx, y0 + (4 - ry), 1, TEXT]);
      cx += 4;
    }
  };
  paint('DEMO', 3, H0 + 7);
  paint('LAB', 5, H0 + 1);
  return {
    palette: ['#57AD82', '#FFF6E3', '#96683F', '#448F69'],
    voxels: v, chamfer: 0.15
  };
}

/* ------------------------------------------------------------------ *
 *  DEMO STALL (small striped market pedestal)                          *
 * ------------------------------------------------------------------ */
function stallModel(i) {
  const accents = [['#FF8E72', '#FFF3D6'], ['#7FD4D9', '#FFF3D6'], ['#F7D75E', '#FFF3D6'],
                   ['#F5A8C0', '#FFF3D6'], ['#8FD05C', '#FFF3D6']];
  const [acc, cream] = accents[i % accents.length];
  const A = 0, C = 1, WOOD = 2, TOP = 3;
  const v = [];
  // striped base 8x3x8
  for (let x = 0; x < 8; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 8; z++)
    v.push([x, y, z, ((x + z) >> 1) % 2 ? C : A]);
  // counter top
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) v.push([x, 3, z, TOP]);
  // 4 posts + striped mini awning
  for (const [px, pz] of [[0, 0], [7, 0], [0, 7], [7, 7]])
    for (let y = 4; y < 9; y++) v.push([px, y, pz, WOOD]);
  for (let x = -1; x < 9; x++) for (let z = -1; z < 9; z++)
    v.push([x, 9, z, ((x + 9) >> 1) % 2 ? C : A]);
  return { palette: [acc, cream, '#96683F', '#E8D5A8'], voxels: v, chamfer: 0.2 };
}

/* ------------------------------------------------------------------ *
 *  SOUTH-SHORE DRESSING (pier + buoy — the demo-lab/nursery frames     *
 *  put open water in the lower half; give it content)                  *
 * ------------------------------------------------------------------ */
function pierModel() {
  const DECK = 0, DECK2 = 1, POST = 2;
  const v = [];
  // 2-wide post pairs at three bents, driven below the waterline
  for (const pz of [1, 9, 17]) for (const px of [0, 5])
    for (let y = 0; y < 18; y++) v.push([px, y, pz, POST]);
  // plank deck with darker every-4th course
  for (let x = 0; x < 6; x++) for (let z = 0; z < 19; z++)
    v.push([x, 18, z, (z % 4 === 3) ? DECK2 : DECK]);
  // stubby mooring bollards at the sea end
  v.push([0, 19, 17, POST], [5, 19, 17, POST]);
  return {
    size: [6, 21, 19],
    palette: ['#C9A26E', '#B08654', '#8A6844'],
    voxels: dedupe(v), jitter: { value: 0.03, hue: 2 }, chamfer: 0.2, seed: 83
  };
}
function buoyModel() {
  const RED = 0, CREAM = 1, DARK = 2;
  const v = [];
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
    if ((x === 0 || x === 3) && (z === 0 || z === 3)) continue;
    v.push([x, 0, z, RED], [x, 1, z, CREAM], [x, 2, z, RED]);
  }
  v.push([1, 3, 1, DARK], [2, 3, 1, DARK], [1, 3, 2, DARK], [2, 3, 2, DARK]);
  v.push([1, 4, 1, CREAM], [2, 4, 2, CREAM]);
  return {
    size: [4, 5, 4],
    palette: ['#E05A4E', '#FFF3D6', '#2B3440'],
    voxels: dedupe(v), jitter: false, chamfer: 0.3
  };
}

/* ------------------------------------------------------------------ *
 *  WORLD BUILD                                                         *
 * ------------------------------------------------------------------ */
export function buildWorld(scene, tiles, projects, colliders, uTime, glb = {}) {
  const interactables = [];
  const staticGeos = [];
  const treeGeos = [];
  const glbUsed = [];      // names of authored GLBs that replaced voxels here
  const t4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  function place(list, geo, x, y, z, yaw = 0, scale = 1) {
    const g = geo.clone();
    q.setFromAxisAngle(UP, yaw);
    t4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
    g.applyMatrix4(t4);
    list.push(g);
  }

  /* ---- emissive glow quads (the ONLY HDR surfaces — bloom threshold
          1.05 catches exactly these: About-house windows, the macrodoc
          "doc" sign, the mathstreet ticker stripe). Offsets are voxel
          planes of the models converted to world units. ----------------- */
  const glowPos = [], glowCol = [], glowIdx = [];
  function glowQuad(x, y, z, w, h, facing, c) {
    const b = glowPos.length / 3;
    const hw = w / 2, hh = h / 2;
    if (facing === 'x') {
      glowPos.push(x, y - hh, z + hw, x, y - hh, z - hw,
                   x, y + hh, z - hw, x, y + hh, z + hw);
    } else {
      glowPos.push(x - hw, y - hh, z, x + hw, y - hh, z,
                   x + hw, y + hh, z, x - hw, y + hh, z);
    }
    for (let i = 0; i < 4; i++) glowCol.push(c[0], c[1], c[2]);
    glowIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // per-model glow specs, in model-local units relative to the placement
  // center (x right, y up, z toward camera); f = face normal axis
  const GLOWS = {
    about_house: [                                     // lit home windows #FFD9A0
      { f: 'z', x: -0.6875, y: 1.125, z: 0.762, w: 0.36, h: 0.48, c: [1.7, 1.42, 1.02] },
      { f: 'z', x: 0.6875, y: 1.125, z: 0.762, w: 0.36, h: 0.48, c: [1.7, 1.42, 1.02] },
      { f: 'z', x: 0, y: 1.625, z: 0.762, w: 0.24, h: 0.24, c: [1.7, 1.42, 1.02] }
    ],
    macrodoc: [                                        // "doc" sign #FFC08A
      { f: 'z', x: 0.4375, y: 1.125, z: 0.7, w: 0.61, h: 0.24, c: [2.3, 1.75, 1.25] }
    ],
    mathstreet: [                                      // ticker stripe #7FE9C3
      { f: 'z', x: 0, y: 1.0625, z: 1.012, w: 1.96, h: 0.11, c: [1.1, 2.1, 1.7] },
      { f: 'x', x: 1.012, y: 1.0625, z: 0, w: 1.96, h: 0.11, c: [1.1, 2.1, 1.7] }
    ]
  };

  const projById = {};
  for (const p of projects) projById[p.id] = p;
  const productProjects = projects.filter(p => p.kind !== 'egg' && (p.category || 'product') === 'product');
  const buildingDefs = [{ id: 'about', model: 'about_house', slot: HOME_SLOT }];
  productProjects.forEach((p, i) => {
    if (i < BUILDING_SLOTS.length)
      buildingDefs.push({ id: p.id, model: p.id, project: p, slot: BUILDING_SLOTS[i] });
  });
  // GLB-only buildings (no voxel fallback model): footprints from
  // docs/GLB_PIPELINE.md §3 — colliders/markers/zoom are sized from these
  // exactly like the voxel footprints size everything else.
  const GLB_FOOTPRINT = { gunball: { w: 2.42, h: 2.75, d: 2.24 } };
  for (const b of buildingDefs) {
    const model = getModel(b.model) || PLACEHOLDER;
    const fp = GLB_FOOTPRINT[b.model];
    const w = fp ? fp.w : (model.size ? model.size[0] : 16) * VOXEL_SIZE;
    const d = fp ? fp.d : (model.size ? model.size[2] : 16) * VOXEL_SIZE;
    const h = fp ? fp.h : (model.size ? model.size[1] : 16) * VOXEL_SIZE;
    const cx = b.slot.x + 2, cz = b.slot.y + 2;
    const gm = glb['bld_' + b.model];
    if (gm) {
      // authored GLB building: already Lambert-harmonized + normalized to
      // the contract height with origin at ground center. Skip the glow
      // quads — their offsets index voxel facade planes; the GLB's signage
      // is baked into its texture (LDR, never trips the bloom threshold).
      // Colliders/markers keep the voxel footprint (contract: within ±10%).
      gm.position.set(cx, 0, cz);
      scene.add(gm);
      glbUsed.push('bld_' + b.model);
    } else {
      place(staticGeos, safeGeometry(b.model), cx, 0, cz);
      for (const g of GLOWS[b.model] || [])
        glowQuad(cx + g.x, g.y, cz + g.z, g.w, g.h, g.f, g.c);
    }
    colliders.addAABB(cx - w / 2 + 0.08, cz - d / 2 + 0.08, cx + w / 2 - 0.08, cz + d / 2 - 0.08);
    interactables.push({
      id: 'bld_' + b.id,
      kind: b.id === 'about' ? 'house' : 'building',
      project: b.project || null,
      pos: { x: cx, z: cz },
      focus: { x: cx, y: h * 0.42, z: cz },
      // marker capped at eave level (ART_BIBLE 6.6) and pushed to the front
      // facade (camera side) — it reads against the building's own wall,
      // never silhouetting against sky/water, never buried in the roof
      markerY: Math.min(h * 0.55, 2.1), markerX: cx, markerZ: cz + d / 2 + 0.35,
      r: Math.max(w, d) / 2 + 1.2
    });
  }

  /* ---- tree ring ---------------------------------------------------- */
  // three oak variants + per-instance yaw/scale/jitter: the coastal ring
  // must read as a forest edge, never a fence of copy-pasted clones
  const oakGeos = [
    safeGeometry('tree_oak'), safeGeometry('tree_oak_b'), safeGeometry('tree_oak_c')
  ];
  const pineGeo = safeGeometry('tree_pine');
  const sapGeo = safeGeometry('tree_sapling');
  // Authored GLB trees can't ride the wind-sway vertex shader (their
  // vertices aren't authored for the height-mask displacement), so each
  // one gets a subtle whole-tree rotation-spring idle instead (updateFlora).
  const glbTrees = [];
  function placeGLBTree(src, x, z, yaw, s) {
    const g = src.clone(true);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    g.scale.setScalar(s);
    scene.add(g);
    glbTrees.push({ g, phase: hash2(Math.round(x * 13), Math.round(z * 17), 91) * Math.PI * 2 });
  }
  if (glb.tree_a) glbUsed.push('tree_a');
  if (glb.tree_b) glbUsed.push('tree_b');
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (tiles[ty][tx] !== 'T') continue;
    const r = hash2(tx, ty, 51);
    const kind = r < 0.62 ? 'oak' : r < 0.9 ? 'pine' : 'sap';
    const jx = (hash2(tx, ty, 52) - 0.5) * 0.6;      // ±0.3 tile jitter
    const jz = (hash2(tx, ty, 53) - 0.5) * 0.6;
    const yaw = Math.floor(hash2(tx, ty, 54) * 4) * Math.PI / 2;
    const s = 0.88 + hash2(tx, ty, 55) * 0.26;       // ±12% scale
    const gx = tx + 0.5 + jx, gz = ty + 0.5 + jz;
    if (kind === 'oak' && glb.tree_a) placeGLBTree(glb.tree_a, gx, gz, yaw, s);
    else if (kind === 'pine' && glb.tree_b) placeGLBTree(glb.tree_b, gx, gz, yaw, s);
    else place(treeGeos,
      kind === 'oak' ? oakGeos[Math.floor(hash2(tx, ty, 56) * 3)]
        : kind === 'pine' ? pineGeo : sapGeo,
      gx, 0, gz, yaw, s);
  }

  /* ---- fences: nursery keeps the white pickets (its landmark), the
          demo-lab ring is plain wood so the two yards read differently --- */
  const fenceGeo = safeGeometry('fence_segment');
  const postGeo = safeGeometry('fence_post');
  const fenceWoodGeo = safeGeometry('fence_segment_wood');
  const postWoodGeo = safeGeometry('fence_post_wood');
  const fenceScale = 0.95;
  const inDemoLab = (tx, ty) =>
    tx >= DEMO_LAB.x0 && tx <= DEMO_LAB.x1 && ty >= DEMO_LAB.y0 && ty <= DEMO_LAB.y1;
  function fenceAt(tx, ty) {
    const cx = tx + 0.5, cz = ty + 0.5;
    const seg = inDemoLab(tx, ty) ? fenceWoodGeo : fenceGeo;
    const pst = inDemoLab(tx, ty) ? postWoodGeo : postGeo;
    const link = (dx, dy) => tileAt(tiles, tx + dx, ty + dy) === 'X';
    const h = link(1, 0) || link(-1, 0);
    const v = link(0, 1) || link(0, -1);
    if (h) place(staticGeos, seg, cx, 0, cz, 0, fenceScale);
    if (v) place(staticGeos, seg, cx, 0, cz, Math.PI / 2, fenceScale);
    if (h && v) place(staticGeos, pst, cx, 0, cz, 0, fenceScale);
    if (!h && !v) place(staticGeos, pst, cx, 0, cz, 0, fenceScale);
  }
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++)
    if (tiles[ty][tx] === 'X') fenceAt(tx, ty);

  /* ---- signpost by the plaza ---------------------------------------- */
  const signGeo = safeGeometry('signpost');
  place(staticGeos, signGeo, SIGN_POS.x, 0, SIGN_POS.z, -0.07);
  colliders.addCircle(SIGN_POS.x, SIGN_POS.z, 0.3);
  interactables.push({
    id: 'sign', kind: 'sign',
    pos: { x: SIGN_POS.x, z: SIGN_POS.z + 0.35 },
    markerX: SIGN_POS.x, markerY: 1.5, markerZ: SIGN_POS.z, r: 1.3
  });

  /* ---- fountain plaza ------------------------------------------------ */
  if (glb.fountain) {
    glb.fountain.position.set(FOUNTAIN.x, 0, FOUNTAIN.z);
    scene.add(glb.fountain);
    glbUsed.push('fountain');
    // Living water: the GLB bakes its water as a static decal (regraded to
    // the pastel #5BC8DC ramp offline), but the sea and pond bob — a frozen
    // plaza focal point reads dead next to them. Float a slim flat-shaded
    // disc over each basin surface; the sine bob tilts the facets so the
    // Lambert shading shimmers like the pond. Heights/radii were measured
    // from the GLB's cyan upward-facing triangles (y-fractions 0.35 / 0.95
    // of the 1.44 wu contract height), lifted 0.02 with bob amp 0.012 so
    // the disc never dips into the baked decal (no z-fighting).
    const fwMat = new THREE.MeshLambertMaterial({
      color: 0x5BC8DC, flatShading: true
    });
    fwMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.y += (sin(uTime * 1.6 + position.x * 9.0)
                          + sin(uTime * 1.1 + position.z * 7.0)) * 0.012;`);
    };
    [{ r: 0.64, y: 0.52 }, { r: 0.30, y: 1.39 }].forEach((w) => {
      const g = new THREE.RingGeometry(0.02, w.r, 28, 3);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, fwMat);
      m.position.set(FOUNTAIN.x, w.y, FOUNTAIN.z);
      m.receiveShadow = true;
      m.castShadow = false;
      scene.add(m);
    });
  } else {
    place(staticGeos, safeGeometry('fountain'), FOUNTAIN.x, 0, FOUNTAIN.z);
  }
  colliders.addCircle(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r);
  interactables.push({
    id: 'fountain', kind: 'fountain',
    pos: { x: FOUNTAIN.x, z: FOUNTAIN.z },
    markerX: FOUNTAIN.x, markerY: 1.55, markerZ: FOUNTAIN.z, r: FOUNTAIN.r + 1.15
  });

  /* ---- egg nursery gazebo -------------------------------------------- */
  place(staticGeos, safeGeometry('egg_nursery'), NURSERY_GAZEBO.x, 0, NURSERY_GAZEBO.z);
  colliders.addCircle(NURSERY_GAZEBO.x, NURSERY_GAZEBO.z, NURSERY_GAZEBO.r);

  /* ---- YOONKI letters -------------------------------------------------- */
  const LETTER_COLORS = [
    ['#F7D75E', '#D9B33F'], ['#FF8E72', '#E06B52'], ['#7FD4D9', '#5FB4BC'],
    ['#F5A8C0', '#D988A2'], ['#8FD05C', '#6FB04A'], ['#B8A7F0', '#9787D0']
  ];
  'YOONKI'.split('').forEach((ch, i) => {
    const [a, b] = LETTER_COLORS[i % LETTER_COLORS.length];
    const m = letterModel(ch, a, b);
    if (!m) return;
    const geo = buildGeometry(m, {});
    const x = LETTERS.x + i * LETTERS.step, z = LETTERS.z;
    const yaw = (hash2(i, 3, 61) - 0.5) * 0.16;
    place(staticGeos, geo, x, 0, z, yaw);
    colliders.addAABB(x - 0.38, z - 0.2, x + 0.38, z + 0.2);
  });

  /* ---- DEMO LAB yard --------------------------------------------------- */
  const demoProjects = projects.filter(p => (p.category || '') === 'demo');
  // big sign
  const labGeo = buildGeometry(labSignModel(), {});
  // ~15deg toward the SE camera so the board reads instead of edge-hiding
  place(staticGeos, labGeo, DEMO_LAB.sign.x, 0, DEMO_LAB.sign.z, 0.3);
  colliders.addCircle(DEMO_LAB.sign.x, DEMO_LAB.sign.z, 0.45);
  interactables.push({
    id: 'lab_sign', kind: 'labsign',
    pos: { x: DEMO_LAB.sign.x, z: DEMO_LAB.sign.z - 0.4 },
    markerX: DEMO_LAB.sign.x, markerY: 2.15, markerZ: DEMO_LAB.sign.z, r: 1.5
  });
  // stalls for live demos
  demoProjects.forEach((p, i) => {
    if (i >= DEMO_LAB.slots.length) return;
    const s = DEMO_LAB.slots[i];
    const geo = buildGeometry(stallModel(i), {});
    place(staticGeos, geo, s.x, 0, s.z, (hash2(i, 9, 62) - 0.5) * 0.1);
    colliders.addAABB(s.x - 0.5, s.z - 0.5, s.x + 0.5, s.z + 0.5);
    interactables.push({
      id: 'demo_' + p.id, kind: 'demo', project: p,
      pos: { x: s.x, z: s.z + 0.8 },
      focus: { x: s.x, y: 0.7, z: s.z },
      markerX: s.x, markerY: 1.65, markerZ: s.z, r: 1.4
    });
  });
  // under-construction sign while the lab is empty — plus a few dressed
  // placeholder stalls so the yard reads as a fair being set up, not an
  // empty paddock (they become live demo stalls as projects ship)
  if (demoProjects.length === 0) {
    [0, 2, 4].forEach((si, i) => {
      const s = DEMO_LAB.slots[si];
      const geo = buildGeometry(stallModel(si), {});
      place(staticGeos, geo, s.x, 0, s.z, (hash2(si, 11, 63) - 0.5) * 0.16);
      colliders.addAABB(s.x - 0.5, s.z - 0.5, s.x + 0.5, s.z + 0.5);
    });
    place(staticGeos, signGeo, DEMO_LAB.wip.x, 0, DEMO_LAB.wip.z, 0.1, 0.85);
    colliders.addCircle(DEMO_LAB.wip.x, DEMO_LAB.wip.z, 0.28);
    interactables.push({
      id: 'wip', kind: 'wip',
      pos: { x: DEMO_LAB.wip.x, z: DEMO_LAB.wip.z + 0.35 },
      markerX: DEMO_LAB.wip.x, markerY: 1.3, markerZ: DEMO_LAB.wip.z, r: 1.3
    });
  }
  // yard dressing: crate stack in the NE inside corner (clear of the gate
  // aisle and every stall approach), one mossy rock outside the SW corner
  const crateGeo = safeGeometry('toy_crate');
  place(staticGeos, crateGeo, 34.8, 0, 21.35, 0.12);
  place(staticGeos, crateGeo, 34.87, 0.875, 21.42, -0.35, 0.82);
  place(staticGeos, crateGeo, 33.9, 0, 21.5, 0.5, 0.9);
  colliders.addAABB(34.35, 20.9, 35.35, 21.8);
  const rocksGeo = safeGeometry('rocks_small');

  /* ---- scattered props (each anchors a zone edge, never mid-nowhere) --- */
  for (const [x, z, s, yaw] of [
    [33.5, 17.2, 1, 0.3],              // pond south bank
    [5.4, 11.9, 0.9, 1.8],             // west meadow edge
    [13.6, 25.6, 0.8, 0.9],            // south shore, west of nursery
    [29.4, 24.4, 0.8, 2.1]             // demo-lab SW outside corner
  ])
    { place(staticGeos, rocksGeo, x, 0, z, yaw, s); colliders.addCircle(x, z, 0.4 * s); }

  /* ---- south-shore dressing: pier + buoys + sea rocks with foam rings —
          fills the dead water band in the demo-lab / nursery frames ------ */
  place(staticGeos, buildGeometry(pierModel(), {}), 33.9, SEA_Y - 1.3, 29.3, 0, 1.35);
  const buoyGeo = buildGeometry(buoyModel(), {});
  const seaProps = [];                                  // [x, z, foamR]
  for (const [x, z, yaw] of [[31.2, 29.7, 0.4], [36.9, 30.5, 1.2], [26.4, 30.2, 2.3]]) {
    place(staticGeos, buoyGeo, x, SEA_Y - 0.14, z, yaw);
    seaProps.push([x, z, 0.45]);
  }
  for (const [x, z, s, yaw] of [[32.3, 30.6, 1.1, 0.7], [35.7, 29.6, 0.75, 2.4]]) {
    place(staticGeos, rocksGeo, x, SEA_Y - 0.2, z, yaw, s);
    seaProps.push([x, z, 0.75 * s]);
  }
  seaProps.push([33.9, 30.15, 0.75]);                   // pier-end posts
  {
    // soft white foam rings where the props break the water surface
    const foamGeos = [];
    for (const [x, z, r] of seaProps) {
      const rg = new THREE.RingGeometry(r * 0.72, r, 20);
      rg.rotateX(-Math.PI / 2);
      rg.translate(x, 0, z);
      foamGeos.push(rg);
    }
    const foam = new THREE.Mesh(mergeGeometries(foamGeos),
      new THREE.MeshBasicMaterial({
        color: 0xF4FBF8, transparent: true, opacity: 0.38, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
    foam.position.y = SEA_Y + 0.1;
    foam.renderOrder = 1;
    scene.add(foam);
  }
  const sapScatter = [[10.5, 3.5, 0], [28.5, 3.6, 2.1], [4.5, 17.5, 1.2], [35.5, 19.2, 0.7]];
  for (const [x, z, yaw] of sapScatter) place(treeGeos, sapGeo, x, 0, z, yaw, 0.95);

  /* ---- spoke-elbow + shore clusters (playbook: props cluster in 3s —
          tree + rock + flowers — one at each path bend, so every curve
          has a reason and no prop floats mid-nowhere) --------------------- */
  const CLUSTERS = [
    { t: [10.6, 11.4], r: [11.3, 11.9], f: [9.9, 12.1], kind: 'peach' },   // NW spoke elbow
    { t: [28.6, 11.6], r: [29.3, 12.0], f: [27.9, 12.4], kind: 'cream' },  // NE spoke elbow
    { t: [16.6, 17.6], r: [17.3, 18.1], f: [16.0, 18.4], kind: 'cream' },  // south axis / SW fork wedge
    { t: [27.6, 15.3], r: [28.3, 15.8], f: [26.9, 14.8], kind: 'peach' },  // SE staircase bend
    { t: [32.3, 12.3], r: [33.0, 11.9], f: [31.7, 12.8], kind: 'peach' },  // pond north bank
    { t: [4.7, 24.3], r: [5.4, 23.9], f: [4.1, 24.9], kind: 'peach' },     // SW shore corner
    { t: [27.6, 24.6], r: [28.3, 25.0], f: [26.9, 25.3], kind: 'cream' }   // south shore, nursery-lab gap
  ];
  CLUSTERS.forEach((cl, i) => {
    place(treeGeos, sapGeo, cl.t[0], 0, cl.t[1],
      Math.floor(hash2(i, 5, 64) * 4) * Math.PI / 2, 0.88 + hash2(i, 7, 65) * 0.2);
    place(staticGeos, rocksGeo, cl.r[0], 0, cl.r[1], hash2(i, 9, 66) * Math.PI, 0.62);
    colliders.addCircle(cl.r[0], cl.r[1], 0.28);
  });

  /* ---- static + tree chunks ------------------------------------------- */
  const staticMesh = new THREE.Mesh(mergeGeometries(staticGeos), voxelMaterial());
  staticMesh.castShadow = true;
  staticMesh.receiveShadow = true;
  scene.add(staticMesh);

  /* ---- emissive glow mesh (feeds the bloom pass) ----------------------- */
  if (glowPos.length) {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
    gg.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
    gg.setIndex(glowIdx);
    gg.computeBoundingSphere();
    const glowMesh = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide
    }));
    glowMesh.castShadow = false;
    glowMesh.receiveShadow = false;
    scene.add(glowMesh);
  }

  let treeMesh = null;
  if (treeGeos.length) {
    treeMesh = new THREE.Mesh(mergeGeometries(treeGeos), windMaterial(uTime));
    treeMesh.castShadow = true;
    treeMesh.receiveShadow = true;
    scene.add(treeMesh);
  }

  /* ---- instanced springy flora ---------------------------------------- */
  const flora = [];
  function floraType(name, positions, opts) {
    if (!positions.length) return;
    const geo = safeGeometry(name, opts && opts.geoOpts);
    const im = new THREE.InstancedMesh(geo, windMaterial(uTime), positions.length);
    im.castShadow = true;
    im.receiveShadow = true;
    const items = [];
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      const yaw = Math.floor(hash2(i, p.x * 7, 71) * 4) * Math.PI / 2;
      const s = (opts && opts.scale || 1) * (0.9 + hash2(i, p.z * 7, 72) * 0.22);
      const item = {
        x: p.x, z: p.z, yaw, s, i,
        ax: 0, az: 0, vx: 0, vz: 0,          // rotation spring state
        pop: opts && opts.pop || '#F5A8C0'
      };
      items.push(item);
      m.compose(new THREE.Vector3(p.x, 0, p.z),
        q.setFromAxisAngle(UP, yaw), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    flora.push({ im, items, r: (opts && opts.r) || 0.55 });
  }

  const tallPos = [], peachPos = [], creamPos = [], bushPos = [];
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = tiles[ty][tx];
    if (t === 'L') tallPos.push({ x: tx + 0.5, z: ty + 0.5 });
    if (t === 'F') (hash2(tx, ty, 73) < 0.5 ? peachPos : creamPos).push({ x: tx + 0.5, z: ty + 0.5 });
  }
  // extra flower drifts by the About house door and the YOONKI letters
  peachPos.push({ x: 17.5, z: 5.2 }, { x: 16.4, z: 10.4 });
  creamPos.push({ x: 22.6, z: 5.3 }, { x: 13.6, z: 9.0 });
  // flowers completing the elbow/corner clusters-of-3
  for (const cl of CLUSTERS)
    (cl.kind === 'peach' ? peachPos : creamPos).push({ x: cl.f[0], z: cl.f[1] });
  for (const [x, z] of [[4.6, 10.6], [35.4, 11.4], [15.6, 22.6], [25.5, 19.0], [5.5, 23.0], [33.6, 10.6]])
    bushPos.push({ x, z });

  floraType('tall_grass', tallPos, { r: 0.6, pop: '#6BA35C' });
  floraType('flowers_peach', peachPos, { r: 0.5, pop: '#FFB88A' });
  floraType('flowers_cream', creamPos, { r: 0.5, pop: '#FFF3D6' });
  floraType('bush', bushPos, { r: 0.55, pop: '#57A873' });

  /* ---- flora spring update -------------------------------------------- */
  const tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const tiltQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  let glbTreeT = 0;
  function updateFlora(dt, actors, onPop) {
    // GLB trees: gentle whole-tree rotation idle (their stand-in for the
    // voxel wind-sway shader). Tiny angles, base-pivoted — toy-like breathing.
    if (glbTrees.length && !REDUCED) {
      glbTreeT += dt;
      for (const tr of glbTrees) {
        tr.g.rotation.z = Math.sin(glbTreeT * 0.9 + tr.phase) * 0.014;
        tr.g.rotation.x = Math.cos(glbTreeT * 0.7 + tr.phase * 1.3) * 0.01;
      }
    }
    for (const type of flora) {
      let dirty = false;
      for (const it of type.items) {
        // bump detection vs any mover (player + creatures)
        for (const a of actors) {
          if (a.speed < 0.6) continue;
          const dx = it.x - a.pos.x, dz = it.z - a.pos.z;
          const rr = type.r + a.r;
          if (dx * dx + dz * dz < rr * rr) {
            const mag = Math.hypot(it.vx, it.vz);
            if (mag < 1.5) {
              const d = Math.max(0.2, Math.hypot(dx, dz));
              it.vx += (dz / d) * 5.5;         // tilt away from travel
              it.vz += (-dx / d) * 5.5;
              if (onPop && mag < 0.4) onPop(it.x, it.z, it.pop);
            }
          }
        }
        if (it.ax !== 0 || it.az !== 0 || it.vx !== 0 || it.vz !== 0) {
          it.vx += -it.ax * 80 * dt; it.vz += -it.az * 80 * dt;
          const damp = Math.pow(0.0001, dt);   // heavy damping
          it.vx *= damp; it.vz *= damp;
          it.ax += it.vx * dt; it.az += it.vz * dt;
          if (Math.abs(it.ax) < 0.002 && Math.abs(it.az) < 0.002 &&
              Math.abs(it.vx) < 0.02 && Math.abs(it.vz) < 0.02) {
            it.ax = it.az = it.vx = it.vz = 0;
          }
          const ang = Math.hypot(it.ax, it.az);
          axis.set(it.az, 0, -it.ax).normalize();
          tiltQ.setFromAxisAngle(axis, Math.min(0.5, ang));
          yawQ.setFromAxisAngle(UP, it.yaw);
          tiltQ.multiply(yawQ);
          tmpV.set(it.x, 0, it.z); tmpS.set(it.s, it.s, it.s);
          t4.compose(tmpV, tiltQ, tmpS);
          type.im.setMatrixAt(it.i, t4);
          dirty = true;
        }
      }
      if (dirty) type.im.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    interactables,
    staticMesh,
    treeMesh,
    updateFlora,
    glbUsed,
    hasDemos: demoProjects.length > 0
  };
}
