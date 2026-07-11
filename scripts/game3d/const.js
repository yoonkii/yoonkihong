/* ============================================================================
   YOONKI WORLD 3D — shared constants: map, layout, palette, helpers
   The 40x30 tile map is a hub-and-spokes village: one central fountain
   plaza (spawn + YOONKI letters + signpost) with gently curved 2-wide
   paths radiating to every zone — About house on the formal north axis,
   three 2-building districts (NW: macrodoc+lasthand, NE: math games
   mathstreet+mathwings, SW: gunball+funnify), the fenced egg
   nursery on the south axis, and the Demo Lab yard off the SE staircase.
   District pairing is dark-facade balanced: bld_gunball and bld_lasthand
   are the island's two near-black buildings, and side by side they read
   as one dark hole at title/overworld zoom (VISUAL_PLAYBOOK: never pure
   black) — so each court gets at most one dark building.
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
export const ASSET_V = '20260710k';

/* ---- player locomotion -------------------------------------------------
   2026-07: top speed +30% (4.0 -> 5.2 wu/s); accel/decel damp rates x1.3
   so time-to-speed keeps pace and stops stay tight at the higher speed.
   Collision safety: max step = 5.2 wu/s * 0.05 s (game-loop dt clamp)
   = 0.26 wu — below the player radius (0.3) and inside moveCircle's
   0.5 wu clamp window, so no tunneling through 1-tile fences. */
export const PLAYER_MOVE = { maxSpeed: 5.2, accel: 11.7, decel: 15.6 };

/* Legend: W water  G grass  P path  T tree  L tall grass  F flower  X fence
   Authored directly (no runtime jogs): central plaza rows 11-16, spokes =
   2x2 stair blocks (the tile-grid version of a gentle curve), courts are
   the 2-wide "district streets" fronting each building pair. The nursery
   picket ring is baked here; the Demo Lab wood ring + gate is drawn by
   buildMap() from DEMO_LAB so the yard stays data-driven. */
const RAW_MAP = [
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGLLGGGGGGGGGGGGTWW',
  'WWTGLLGGGGGGGGGGGGGGGGGLLGGGGGGGGGGGGTWW',
  'WWTGLLGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTGGGGFGGFGGGGGGGFPPFGGGGGGFGGGGGGGGTWW',
  'WWTGGGFPPPPPPFGGGGGPPGGGGGFPPPPPPFGGGTWW',
  'WWTGGGFPPPPPPGGGGGFPPFGGGGGPPPPPPFGGGTWW',
  'WWTGGGGGGGGGPPPGGGGPPGGGGPPPGGGGGGGGGTWW',
  'WWTGGGGGGGGGGPPPPFPPPPFPPPPGGGGGGGGGGTWW',
  'WWTGLLLLLGGGGGGPPPPPPPPPPGGGGGGGGGGGGTWW',
  'WWTGLLLLLGGGGGGGGPPPPPPGGGGGGGGGGWWWGTWW',
  'WWTGLLLLLGGGGGPPPPPPPPPPPGGGGGGGFWWWGTWW',
  'WWTGGGGGGGGGGGPPPPPPPPPPPPPGGGGGGWWWGTWW',
  'WWTGGGGGGGGGGGPPGFPPPPFGGPPPPGGGGGGGGTWW',
  'WWTGGGGGGGGGGGPPGGGPPGGGGGGPPPPGGGGGGTWW',
  'WWTGGGGGGGGGGGPPGGGPPGGGGGGGGPPPPPPPGTWW',
  'WWTGGGGFGGFPPPPGGGFPPFGGGGGGGGFPPFGGGTWW',
  'WWTGGGFPPPPPPGGGXXXPPXXXXGGGGGGPPGGGGTWW',
  'WWTGGGFPPPPPPGGFXGGGGGGGXFGLLLGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGXGGGGGGGXGGLLLGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGXGGGGGGGXGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGXGGGGGGGXGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGXXXXXXXXXGGGGGGGGGGGGTWW',
  'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
  'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'
];

export const MAP_W = 40;
export const MAP_H = 30;

/* ---- 3D map edits ----------------------------------------------------- */
// Secret alcove: two trees missing from the north ring, NE side (tucked
// behind the NE district's rooflines from the SE camera — extra secret).
export const SECRET_GAP = [[30, 2], [31, 2]];
export const SECRET_POS = { x: 30.5, z: 2.55 };
// Demo lab yard: SE corner off the plaza's SE staircase, wood-fenced with
// a gate on the north run that the staircase lands on.
export const DEMO_LAB = {
  x0: 30, y0: 20, x1: 35, y1: 25,          // inclusive tile rect (fence ring)
  gate: [[31, 20], [32, 20]],              // fence gap on the north run
  sign: { x: 34.5, z: 24.5 },              // DEMO LAB board inside, facing camera
  wip: { x: 31.8, z: 24.3 },               // under-construction signpost
  slots: [                                  // pre-authored demo stall spots
    { x: 31.7, z: 22.4 }, { x: 33.2, z: 22.3 }, { x: 34.5, z: 22.4 },
    { x: 32.3, z: 24.0 }, { x: 34.2, z: 23.9 }
  ]
};

export function buildMap() {
  const tiles = RAW_MAP.map(r => r.split(''));
  for (const [x, y] of SECRET_GAP) tiles[y][x] = 'G';
  // Demo lab: wood ring drawn from the const (gate tiles stay path)
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
// Building slot (x, y) -> world center (x+2, y+2). Order matches the
// product order in data/projects.js:
//   [macrodoc, mathstreet, mathwings, funnify, lasthand, gunball]
// Districts of two: NW court (macrodoc + lasthand), NE "math games" court
// (mathstreet + mathwings), SW court (gunball + funnify). funnify and
// lasthand swapped courts on purpose: bld_lasthand + bld_gunball are both
// near-black facades, and pairing them made the SW corner one large dark
// mass — each district now holds at most one dark building.
export const HOME_SLOT = { x: 18, y: 4 };            // About house, top-center axis
export const BUILDING_SLOTS = [
  { x: 6, y: 4 },                     // macrodoc   -> (8, 6)   NW court, west
  { x: 25, y: 4 },                    // mathstreet -> (27, 6)  NE court, west
  { x: 29, y: 4 },                    // mathwings  -> (31, 6)  NE court, east
  { x: 10, y: 16 },                   // funnify    -> (12, 18) SW court, east
  { x: 10, y: 4 },                    // lasthand   -> (12, 6)  NW court, east
  { x: 6, y: 16 },                    // gunball    -> (8, 18)  SW court, west
  { x: 33, y: 15 }                    // gomokulike -> (35, 17) east pond-side:
                                      // the Go parlor overlooks the pond
                                      // (rows 13-15), fronted by the extended
                                      // SE-spoke street on row 18
];
// Creature homes flank their own building ~3 tiles off the district
// street, so wander circles (r <= 2.2) barely graze the path network.
export const CREATURE_SPOTS = [
  { x: 5, y: 7 },                     // macrodoc
  { x: 24, y: 7 },                    // mathstreet
  { x: 34, y: 7 },                    // mathwings (east strip — keeps GOLDIE's
                                      // tree-gap alcove clear of bystanders)
  { x: 15, y: 20 },                   // funnify (SW court — greets the gate)
  { x: 14, y: 4 },                    // lasthand (NW court, beside its building)
  { x: 5, y: 19 },                    // gunball
  { x: 34, y: 19 }                    // gomokulike (below its parlor, between
                                      // the row-18 street and the Demo Lab
                                      // fence — wander graze is by design)
];
// Nursery interior slots ring the gazebo; first three (live eggs) spread
// NW / NE / S so the garden reads full from the SE camera.
export const EGG_SLOTS = [
  { x: 17.8, z: 21.9 }, { x: 23.2, z: 21.9 }, { x: 19.3, z: 24.4 },
  { x: 21.7, z: 24.4 }, { x: 17.7, z: 23.9 }, { x: 23.3, z: 23.9 }
];
export const NPC_POS = { x: 18.2, z: 17.3 };         // greeter beside the south axis
export const SIGN_POS = { x: 22.6, z: 15.6 };        // plaza SE corner, by the SE fork
export const PLAYER_START = { x: 20.5, z: 15.9 };    // plaza south rim, fountain behind
export const FOUNTAIN = { x: 20, z: 14, r: 1.02 };   // plaza centerpiece = map center
export const NURSERY_GAZEBO = { x: 20.5, z: 23.4, r: 1.05 };

// Skyline landmarks (Seoul + SF, user request 2026-07-10) — decorative GLBs
// standing in the far water band (north + west = the background from the SE
// camera), outside the tree ring and unreachable: no colliders, no markers.
// Placed by world.addLandmark when the streamed GLB lands (game3d lateGLB).
// y anchors them to the sea surface (SEA_Y -1.9), slightly submerged.
export const LANDMARKS = [
  { name: 'landmark_namsan', x: 27.5, z: 0.95, y: -1.95, yaw: 0 },
  { name: 'landmark_goldengate', x: 0.95, z: 11.5, y: -1.95, yaw: Math.PI / 2 }
];

// YOONKI voxel letters on the lawn wedge NW of the plaza, read over the
// fountain from the SE camera.
export const LETTERS = { x: 13.9, z: 9.6, step: 0.92 };

// Physics playground on the plaza's NE shoulder — in the spawn frame,
// between the NE and SE spokes, never on a path.
export const PLAYGROUND = {
  pins: { x: 27.6, z: 13.3 },
  crates: [{ x: 25.9, z: 14.1 }, { x: 29.0, z: 13.6 }],
  ball: { x: 26.1, z: 12.7 }
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
