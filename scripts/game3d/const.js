/* ============================================================================
   YOONKI WORLD 3D — shared constants: map, layout, palette, helpers
   The 40x30 tile map is ported verbatim from the 2D game, then lightly
   edited for the 3D diorama (fountain plaza, demo lab corner, secret gap).
   1 tile = 1 world unit. Tile (x, y) spans world X [x, x+1], Z [y, y+1].
   ========================================================================== */

import * as THREE from 'three';

export const REDUCED = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
})();

/* Cache-busting token for static game assets (GLBs, BGM, SFX). Keep in sync
   with the styles/main.css ?v= token in index.html — bump BOTH whenever any
   asset is re-exported, so returning visitors never get a mixed old/new set
   (GitHub Pages caches assets for ~10 min, browsers heuristically longer). */
export const ASSET_V = '20260710d';

/* ---- player locomotion -------------------------------------------------
   2026-07: top speed +30% (4.0 -> 5.2 wu/s); accel/decel damp rates x1.3
   so time-to-speed keeps pace and stops stay tight at the higher speed.
   Collision safety: max step = 5.2 wu/s * 0.05 s (game-loop dt clamp)
   = 0.26 wu — below the player radius (0.3) and inside moveCircle's
   0.5 wu clamp window, so no tunneling through 1-tile fences. */
export const PLAYER_MOVE = { maxSpeed: 5.2, accel: 11.7, decel: 15.6 };

/* Legend: W water  G grass  P path  T tree  L tall grass  F flower  X fence */
const RAW_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGFGGGGGGGGFGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGFGGGGGGFGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
  'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
  'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
  'WWTGGGGGGGGGGFGGGGGPPGGGGGFGGGGGGGGGGTWW',
  'WWTGFGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGFGTWW',
  'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
  'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
  'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
  'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGFGGGGGPPGGGGGFGGGGGGGGGGTWW',
  'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
  'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
  'WWTGGGGGFGGGGGGXXXXPPXXXXXGGGGGFGGGGGTWW',
  'WWTGGGGGGGGGGGGXGGGPPGGGGXGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGXFGGGGGGGFXGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGXGGGGGGGGGXGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGXXXXXXXXXXXGGGGGGGGGGGTWW',
  'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'
];

export const MAP_W = 40;
export const MAP_H = 30;

/* ---- 3D map edits ----------------------------------------------------- */
// Fountain plaza: widen the north crossing into a ring around the fountain.
const PLAZA_TILES = [
  [18, 8], [21, 8], [18, 11], [21, 11]
];
// Secret alcove: two trees missing from the north ring, NE side.
export const SECRET_GAP = [[30, 2], [31, 2]];
export const SECRET_POS = { x: 30.5, z: 2.55 };
// Demo lab yard: SE corner, fenced with a gate on the avenue side.
export const DEMO_LAB = {
  x0: 31, y0: 22, x1: 36, y1: 26,          // inclusive tile rect (fence ring)
  gate: [[33, 22], [34, 22]],              // fence gap on the north run
  sign: { x: 34.3, z: 25.85 },             // DEMO LAB board inside, facing camera
  wip: { x: 32.2, z: 25.5 },               // under-construction signpost
  slots: [                                  // pre-authored demo stall spots
    { x: 32.4, z: 23.5 }, { x: 33.9, z: 23.4 }, { x: 35.4, z: 23.5 },
    { x: 32.9, z: 25.0 }, { x: 34.9, z: 24.9 }
  ]
};

export function buildMap() {
  const tiles = RAW_MAP.map(r => r.split(''));
  for (const [x, y] of PLAZA_TILES) tiles[y][x] = 'P';
  for (const [x, y] of SECRET_GAP) tiles[y][x] = 'G';
  // Path jogs (VISUAL_PLAYBOOK: paths curve, never straight >6 tiles).
  // Each avenue jogs a full 2 rows over 5-7 tiles with 1-row transition
  // elbows, so the offset survives the 45-degree camera (a 1-row jog
  // flattened back into a straight boulevard at wide zoom). P/G/F swaps
  // only — both walkable, collision unchanged.
  const setAvenue = (y0, y1, topRow) => {
    for (let x = 5; x <= 34; x++) {
      if (x >= 18 && x <= 21) continue;           // plaza / crossings untouched
      const top = topRow(x);
      for (let y = y0; y <= y1; y++) {
        const cur = tiles[y][x];
        if (y === top || y === top + 1) {
          if (cur === 'G' || cur === 'F' || cur === 'P') tiles[y][x] = 'P';
        } else if (cur === 'P') tiles[y][x] = 'G';
      }
    }
  };
  // north avenue: base rows 9-10; jogs up 2 rows in the west, down 2 east
  setAvenue(7, 12, (x) =>
    (x >= 10 && x <= 15) ? 7 :
    (x === 9 || x === 16) ? 8 :
    (x >= 28 && x <= 33) ? 11 :
    (x === 27 || x === 34) ? 10 : 9);
  // south avenue: base rows 20-21; both jogs rise 2 rows, threading the
  // gaps between the south-row buildings so the path fronts their doors
  setAvenue(18, 21, (x) =>
    (x >= 9 && x <= 13) ? 18 :
    (x === 8 || x === 14) ? 19 :
    (x >= 26 && x <= 30) ? 18 :
    (x === 25 || x === 31) ? 19 : 20);
  tiles[19][18] = 'P'; tiles[19][21] = 'P';   // round the south crossing
  tiles[22][31] = 'G';                       // flower moved out of lab fence
  // Demo lab: white-picket ring (reuses the nursery fence logic/collision)
  const L = DEMO_LAB;
  const gate = new Set(L.gate.map(([x, y]) => x + ',' + y));
  for (let x = L.x0; x <= L.x1; x++) {
    if (!gate.has(x + ',' + L.y0)) tiles[L.y0][x] = 'X';
    if (!gate.has(x + ',' + L.y1)) tiles[L.y1][x] = 'X';
  }
  for (let y = L.y0; y <= L.y1; y++) {
    if (!gate.has(L.x0 + ',' + y)) tiles[y][L.x0] = 'X';
    if (!gate.has(L.x1 + ',' + y)) tiles[y][L.x1] = 'X';
  }
  return tiles;
}

export function tileAt(tiles, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'W';
  return tiles[y][x];
}

/* ---- world layout (tile coords; world pos = +0.5 at centers) ---------- */
export const HOME_SLOT = { x: 18, y: 4 };
export const BUILDING_SLOTS = [
  { x: 5, y: 5 }, { x: 31, y: 5 }, { x: 5, y: 16 }, { x: 31, y: 16 },
  { x: 14, y: 16 }, { x: 22, y: 16 }
];
export const CREATURE_SPOTS = [
  { x: 10, y: 11 }, { x: 29, y: 11 }, { x: 10, y: 22 }, { x: 29, y: 22 },
  { x: 13, y: 22 }, { x: 27, y: 22 }
];
export const EGG_SLOTS = [
  { x: 17.5, z: 24.6 }, { x: 20.5, z: 25.8 }, { x: 23.5, z: 24.6 },
  { x: 18.5, z: 25.8 }, { x: 22.5, z: 25.8 }, { x: 17.5, z: 23.4 }
];
export const NPC_POS = { x: 17.5, z: 8.6 };
export const SIGN_POS = { x: 22.6, z: 8.5 };
export const PLAYER_START = { x: 19.5, z: 12.6 };
export const FOUNTAIN = { x: 20, z: 10, r: 1.02 };
export const NURSERY_GAZEBO = { x: 20.5, z: 23.95, r: 1.05 };

// YOONKI voxel letters, west of the spawn plaza.
export const LETTERS = { x: 13.7, z: 11.15, step: 0.92 };

// Physics playground, east of spawn.
export const PLAYGROUND = {
  pins: { x: 24.4, z: 11.6 },
  crates: [{ x: 22.4, z: 12.7 }, { x: 26.1, z: 12.5 }],
  ball: { x: 22.9, z: 11.0 }
};

/* ---- camera / lighting constants (VISUAL_PLAYBOOK values) ------------- */
export const CAM = {
  azimuth: 45, elevation: 35,
  dist: 60,                                 // ortho: distance only sets depth range
  halfH: 6.6,                               // ortho half-height (zoom)
  halfHMobile: 5.6,
  encounterHalfH: 3.1,
  introHalfH: 21
};

// Elevation 34: shadows run ~1.5x object height so trees visibly stripe the
// paths (at 50 they hid as slivers behind the objects from the SE camera).
export const SUN = { color: 0xFFF2D9, azimuth: 225, elevation: 34, intensity: 1.35 };
// 0.52 calibrated on-screen: shadowed grass reads ~73% of lit grass (never gray)
export const HEMI = { sky: 0xBFD9F2, ground: 0xE8C9A0, intensity: 0.52 };
export const LIGHT_SCALE = Math.PI;         // Lambert is physical since r155

export const SKY = { zenith: 0x4FA8E8, horizon: 0xBDE3F5 };

export function dirFromAngles(azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
}

/* ---- misc helpers ------------------------------------------------------ */
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function damp(cur, target, lambda, dt) {
  return THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));
}
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/* Deterministic hash (mirrors voxel.js hash3). */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 974634571) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/* Tiny 3x5 pixel font for voxel lettering (1 = filled). */
export const FONT3X5 = {
  A: ['111', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '111', '100', '111'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  Y: ['101', '101', '111', '010', '010'],
  '!': ['010', '010', '010', '000', '010']
};
