/* ============================================================================
   YOONKI WORLD 3D — terrain + props model group
   Ground chunks (grass / path / water / shore), foliage, fences, rocks,
   signpost, pushable toys and the fountain centerpiece.

   Format: docs/VOXEL_FORMAT.md. Palette: docs/ART_BIBLE.md §2 (all albedo).
   Sun comes from the (-X,-Z) quadrant — sun-kiss voxels live on the
   low-x / low-z shoulders; the camera sees the +X/+Z faces.
   All scatter uses hash3 so layouts are stable across loads.
   ========================================================================== */

import { box, dedupe, hash3 } from '../voxel.js';

/* ------------------------------------------------------------------ *
 *  small local helpers                                                 *
 * ------------------------------------------------------------------ */

/** Push a filled horizontal disc at height y, center (cx,cz), radius r. */
function disc(cx, y, cz, r, pi, out) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
      if (dx * dx + dz * dz <= r * r) out.push([x, y, z, pi]);
    }
  return out;
}

/** Push a horizontal ring (r0 < d <= r1) at height y. */
function ring(cx, y, cz, r0, r1, pi, out) {
  for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++)
    for (let z = Math.floor(cz - r1); z <= Math.ceil(cz + r1); z++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 <= r1 * r1 && d2 > r0 * r0) out.push([x, y, z, pi]);
    }
  return out;
}

/** Push an ellipsoid; colorFn(x,y,z) -> palette index. */
function ellipsoid(cx, cy, cz, rx, ry, rz, colorFn, out) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry,
              dz = (z + 0.5 - cz) / rz;
        if (dx * dx + dy * dy + dz * dz <= 1)
          out.push([x, y, z, colorFn(x, y, z)]);
      }
  return out;
}

/* ================================================================== *
 *  GROUND CHUNKS (2x2 tiles = 16x16 voxels each)                       *
 * ================================================================== */

/* --- grass: per-tile A/B/C base, per-voxel tone scatter + dry gold,
       gentle 2x2 clump height bumps, dirt strata below ------------- */
function groundGrass() {
  const A = 0, DRY = 3, DIRT_HI = 4, DIRT_LO = 5;
  const v = [];
  const tileBase = [0, 1, 2, 0];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    v.push([x, 0, z, DIRT_LO], [x, 1, z, DIRT_HI]);
    let c = tileBase[(x >> 3) * 2 + (z >> 3)];
    const r = hash3(x, 101, z, 21);
    if (r < 0.05) c = DRY;                       // scorched dry-gold flecks
    else if (r < 0.15) c = (c + 1) % 3;          // tone scatter
    else if (r < 0.23) c = (c + 2) % 3;
    v.push([x, 2, z, c]);
    // soft height bumps in 2x2 clumps (skip chunk rim so chunks tile)
    if (x > 0 && x < 15 && z > 0 && z < 15 &&
        hash3(x >> 1, 909, z >> 1, 21) < 0.14) v.push([x, 3, z, c]);
  }
  return {
    size: [16, 4, 16],
    palette: ['#7FB069', '#74A65F', '#689A55', '#A5B05E', '#8A5A3C', '#7A4C32'],
    voxels: v, jitter: true, chamfer: 0.25, seed: 21
  };
}

/* --- path: cream avenue with 1-voxel inset border, 3% pebbles,
       grass shoulders on both sides ------------------------------- */
function groundPath() {
  const TOP = 0, BORDER = 1, PEBBLE = 2, GA = 3, GB = 4, DIRT_HI = 6, DIRT_LO = 7;
  const v = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    v.push([x, 0, z, DIRT_LO], [x, 1, z, DIRT_HI]);
    let c;
    if (x < 3 || x > 12) {                        // grass shoulders
      const r = hash3(x, 101, z, 22);
      c = r < 0.5 ? GA : r < 0.82 ? GB : 5;
    } else if (x === 3 || x === 12) {             // inset border course
      c = BORDER;
      if (hash3(x, 33, z, 22) < 0.12) c = PEBBLE; // worn border stones
    } else {
      c = TOP;
      if (hash3(x, 55, z, 22) < 0.035) c = PEBBLE;   // pebble sprinkle
    }
    v.push([x, 2, z, c]);
  }
  return {
    size: [16, 3, 16],
    palette: ['#E8C592', '#C69F6C', '#B98F63', '#7FB069', '#74A65F', '#689A55',
              '#8A5A3C', '#7A4C32'],
    voxels: v, jitter: false, chamfer: 0, seed: 22
  };
}

/* --- open water: deep -> shallow ramp across the chunk diagonal,
       hash wobble, sparse sun-lane sparkle ------------------------ */
function groundWater() {
  const v = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    v.push([x, 0, z, 0]);                          // deep under-layer
    const d = (x + z) / 30;                        // shore-distance proxy
    let c = d < 0.3 ? 0 : d < 0.55 ? 1 : d < 0.82 ? 2 : 3;
    const r = hash3(x, 77, z, 23);
    if (r < 0.10) c = Math.min(3, c + 1);          // wavelet wobble
    else if (r < 0.20) c = Math.max(0, c - 1);
    if (hash3(x, 88, z, 23) < 0.02) c = 4;         // sun-lane sparkle
    v.push([x, 1, z, c]);
  }
  return {
    size: [16, 2, 16],
    palette: ['#1E6B7A', '#2A8492', '#3FA8B5', '#5FBFC9', '#FFDCA8'],
    voxels: v, jitter: false, chamfer: 0, seed: 23
  };
}

/* --- shore: grass lip overhanging a stratified cliff, foam ring,
       shallow -> deep water. Water toward +Z (camera side). -------- */
function groundShore() {
  const GA = 0, ST0 = 3, ST1 = 4, ST2 = 5, ST3 = 6;
  const SHALLOW = 7, MID = 8, DEEP = 9, LIGHT = 10, FOAM = 11, SPARK = 12;
  const v = [];
  for (let x = 0; x < 16; x++) {
    const b = 7 + Math.floor(hash3(x >> 2, 5, 0, 24) * 2.99);   // cliff edge 7..9
    const lip = b + 1;                                          // 1-voxel overhang
    for (let z = 0; z < 16; z++) {
      if (z <= lip) {                                            // grass cap
        const r = hash3(x, 101, z, 24);
        const c = r < 0.06 ? 2 : r < 0.55 ? GA : r < 0.85 ? 1 : 2;
        v.push([x, 6, z, c]);
      }
      if (z === lip) v.push([x, 5, z, 2]);                       // grass skirt wraps lip
      if (z <= b)     { v.push([x, 5, z, ST0], [x, 4, z, ST1]); }  // cliff wall
      if (z <= b - 1) { v.push([x, 3, z, ST2], [x, 2, z, ST2]); }  // tapers in
      if (z <= b - 2) { v.push([x, 1, z, ST3], [x, 0, z, ST3]); }
      if (z > b) {                                               // water, surface y=3
        const d = z - b;
        let c;
        if (d === 1 || (d === 2 && hash3(x, 9, z, 24) < 0.55)) c = FOAM;
        else if (d <= 3) c = LIGHT;
        else if (d <= 5) c = SHALLOW;
        else if (d <= 7) c = MID;
        else c = DEEP;
        if (c !== FOAM && d > 3 && hash3(x, 88, z, 24) < 0.05) c = SPARK;
        v.push([x, 3, z, c]);
        v.push([x, 2, z, d <= 4 ? MID : DEEP]);                  // under-layer
      }
    }
  }
  return {
    size: [16, 7, 16],
    palette: ['#7FB069', '#74A65F', '#689A55',
              '#8A5A3C', '#7A4C32', '#6B4128', '#59341F',
              '#3FA8B5', '#2A8492', '#1E6B7A', '#5FBFC9', '#EAF7EF', '#FFDCA8'],
    voxels: dedupe(v), jitter: true, chamfer: 0.25, seed: 24
  };
}

/* ================================================================== *
 *  FOLIAGE                                                            *
 * ================================================================== */

/* --- tall-grass tuft: 8 blades, base->tip gradient, 2 seed heads,
       one wind-leaned tip ----------------------------------------- */
function tallGrass() {
  const BASE = 0, TIP = 1, SEED = 2;
  const v = [];
  // chunky 2x2 tufts with light-green tips: at world zoom the patches read
  // as soft mounded clumps (Pokopia), never scattered dark pixels — thin
  // 1-voxel blades sampled down to noise on the candy lawn
  // [x, z, h, seedHead?]
  const tufts = [
    [1, 1, 4], [4, 2, 5, true], [1, 4, 5], [4, 5, 3], [3, 0, 3]
  ];
  for (const [x, z, h, seed] of tufts) {
    for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) {
      // corners a step shorter -> rounded tuft silhouette
      const hh = h - ((dx + dz + x + z) % 2);
      for (let y = 0; y < hh; y++)
        v.push([x + dx, y, z + dz, y < hh - 2 ? BASE : TIP]);
    }
    if (seed) v.push([x, h, z, SEED]);
  }
  return {
    size: [8, 6, 8],
    palette: ['#63A854', '#8CCB60', '#D9C27E'],
    voxels: dedupe(v), jitter: true, chamfer: 0.35, seed: 31
  };
}

/* Spring-green canopy ramp (VISUAL_PLAYBOOK): #5FAE49 base -> #84C862 top,
   kiss = top +8% lightness on the top-west (sun) shoulder. AO inside the
   dense canopy mass is capped (aoCap 0.9) so it never reads near-black. */
const CANOPY = ['#559F44', '#5FAE49', '#84C862', '#96D377'];

/* --- oaks: fat trunk, HUGE soft blob canopy (the Pokopia signature
       silhouette: canopy ~1.6x the trunk mass, 2-3 overlapping chamfered
       blobs, two greens). Three authored variants so the coastal ring
       stops reading as a fence of clones. --------------------------- */
function oakParts(lobes, trunkH) {
  const TRUNK = 0, TRSH = 1, SKIRT = 2, BASE = 3, TOP = 4, KISS = 5;
  const v = [];
  for (let y = 0; y <= trunkH; y++) {
    v.push([5, y, 5, TRUNK], [6, y, 5, TRSH], [5, y, 6, TRSH], [6, y, 6, TRSH]);
  }
  v.push([4, 0, 5, TRUNK], [6, 0, 7, TRSH], [7, 0, 6, TRSH]);  // root flare
  // two-green ramp: #5FAE49-family base, #84C862-family crown + sun kiss
  const topY = lobes[0][1] + 2;
  const tone = (x, y, z) =>
    y >= topY && (x + z) <= 10 ? KISS : y >= topY ? TOP : y >= topY - 3 ? BASE : SKIRT;
  for (const [cx, cy, cz, rx, ry, rz] of lobes)
    ellipsoid(cx, cy, cz, rx, ry, rz, tone, v);
  return v;
}
function oakModel(lobes, trunkH, size, seed) {
  return {
    size,
    palette: ['#7A5238', '#5F3E2A', ...CANOPY],
    voxels: dedupe(oakParts(lobes, trunkH)),
    jitter: true, chamfer: 0.32, aoCap: 0.9, seed
  };
}
const treeOak = () => oakModel([
  [6, 9.4, 6, 6.0, 4.3, 6.0],                 // main dome, ~12 wide
  [8.8, 12.2, 7.6, 3.3, 2.7, 3.3],            // east-south lobe
  [3.4, 12.8, 3.8, 3.0, 2.5, 3.0]             // top-west sun lobe
], 5, [13, 16, 13], 32);
const treeOakB = () => oakModel([
  [6, 8.8, 6, 6.2, 4.0, 5.6],                 // squat wide dome
  [3.2, 11.6, 7.4, 3.2, 2.6, 3.2],            // west-south lobe
  [8.6, 11.9, 4.2, 2.9, 2.4, 2.9]             // east-north sun lobe
], 4, [13, 15, 13], 36);
const treeOakC = () => oakModel([
  [6, 10.2, 6, 5.4, 4.6, 5.4],                // taller narrow dome
  [7.9, 13.3, 6.9, 3.1, 2.5, 3.1],
  [4.0, 13.7, 4.4, 2.7, 2.3, 2.7]
], 6, [13, 17, 13], 47);

/* --- pine: fat rounded tiers built from overlapping squashed blobs —
       reads as a soft cone of foliage, not a stack of hard plates ---- */
function treePine() {
  const TRUNK = 0, TRSH = 1, SKIRT = 2, BASE = 3, TOP = 4, KISS = 5;
  const v = [];
  for (let y = 0; y <= 2; y++) {
    v.push([5, y, 5, TRUNK], [6, y, 5, TRSH], [5, y, 6, TRSH], [6, y, 6, TRSH]);
  }
  v.push([4, 0, 6, TRUNK]);                        // root flare
  const tone = (x, y, z) =>
    y >= 11 && (x + z) <= 10 ? KISS : y >= 11 ? TOP : y >= 7 ? BASE : SKIRT;
  ellipsoid(6, 4.6, 6, 5.6, 2.6, 5.6, tone, v);    // fat base tier
  ellipsoid(6, 8.0, 6, 4.4, 2.5, 4.4, tone, v);    // mid tier
  ellipsoid(6, 11.2, 6, 3.2, 2.4, 3.2, tone, v);   // upper tier
  ellipsoid(6, 13.6, 6, 1.9, 1.7, 1.9, tone, v);   // rounded tip
  return {
    size: [13, 16, 13],
    palette: ['#7A5238', '#5F3E2A', ...CANOPY],
    voxels: dedupe(v), jitter: true, chamfer: 0.32, aoCap: 0.9, seed: 33
  };
}

/* --- sapling: chunky 2x2 trunk, one big round lollipop blob -------- */
function treeSapling() {
  const TRUNK = 0, TRSH = 1, SKIRT = 2, BASE = 3, TOP = 4, KISS = 5;
  const v = [];
  for (let y = 0; y <= 2; y++) {
    v.push([4, y, 4, TRUNK], [5, y, 4, TRSH], [4, y, 5, TRSH], [5, y, 5, TRSH]);
  }
  v.push([3, 0, 4, TRUNK]);                        // base flare
  const tone = (x, y, z) =>
    y >= 8 && (x + z) <= 8 ? KISS : y >= 8 ? TOP : y >= 6 ? BASE : SKIRT;
  ellipsoid(4.5, 7.0, 4.5, 3.9, 3.3, 3.9, tone, v);   // single fat blob
  ellipsoid(3.0, 9.0, 3.2, 2.1, 1.8, 2.1, tone, v);   // small top-west lobe
  return {
    size: [10, 12, 10],
    palette: ['#7A5238', '#5F3E2A', ...CANOPY],
    voxels: dedupe(v), jitter: true, chamfer: 0.32, aoCap: 0.9, seed: 34
  };
}

/* --- bush: low two-lobed blob, peach berries, kiss voxels --------- */
function bush() {
  const SKIRT = 0, MID = 1, TOP = 2, KISS = 3, BERRY = 4;
  const v = [];
  const tone = (x, y, z) => (y <= 1 ? SKIRT : y === 2 ? MID : TOP);
  ellipsoid(3.5, 1.4, 3.5, 3.6, 2.6, 3.2, tone, v);   // main dome
  ellipsoid(5.8, 1.0, 5.0, 1.6, 1.4, 1.5, tone, v);   // small east bump
  v.push([2, 3, 2, KISS], [3, 3, 2, KISS]);           // sun-kiss shoulder
  v.push([5, 2, 5, BERRY]);                           // one berry, camera side
  return {
    size: [8, 5, 8],
    palette: [CANOPY[0], CANOPY[1], CANOPY[2], CANOPY[3], '#FFB88A'],
    voxels: dedupe(v), jitter: true, chamfer: 0.3, aoCap: 0.9, seed: 35
  };
}

/* --- flower clusters: 3 blooms + 1 bud, staggered heights --------- */
function flowerCluster(headPi, centerPi, seed) {
  const STEM = 0;
  const v = [];
  const blooms = [[2, 2, 4], [5, 3, 3], [3, 6, 2]];
  for (const [x, z, h] of blooms) {
    for (let y = 0; y < h; y++) v.push([x, y, z, STEM]);
    v.push([x - 1, h, z, headPi], [x + 1, h, z, headPi],
           [x, h, z - 1, headPi], [x, h, z + 1, headPi]);
    v.push([x, h, z, centerPi]);                       // center in the cross
  }
  v.push([6, 0, 6, STEM], [6, 1, 6, headPi]);         // tiny bud
  return v;
}
function flowersPeach() {
  return {
    size: [8, 7, 8],
    palette: ['#5F9450', '#FFB88A', '#FFF3D6'],
    voxels: flowerCluster(1, 2, 36),
    jitter: true, chamfer: 0.25, seed: 36
  };
}
function flowersCream() {
  return {
    size: [8, 7, 8],
    palette: ['#5F9450', '#FFF3D6', '#FFB88A'],
    voxels: flowerCluster(1, 2, 37),
    jitter: true, chamfer: 0.25, seed: 37
  };
}

/* ================================================================== *
 *  BUILT PROPS                                                        *
 * ================================================================== */

/* --- white-picket fence segment (1 tile, tiles seamlessly in x) ---- */
function fenceSegment() {
  const PICKET = 0, CAP = 1, RAIL = 2;
  const v = [];
  box(0, 1, 1, 7, 1, 1, RAIL, v);                    // lower rail (behind)
  box(0, 3, 1, 7, 3, 1, RAIL, v);                    // upper rail
  for (const x of [0, 2, 4, 6]) {                    // pickets (front)
    box(x, 0, 0, x, 4, 0, PICKET, v);
    v.push([x, 5, 0, CAP]);                          // pointed cap
  }
  return {
    size: [8, 6, 2],
    palette: ['#F3E3C6', '#D9A874', '#B9855C'],
    voxels: v, jitter: false, chamfer: 0.3, seed: 38
  };
}

/* --- fence post: chunky 2x2 with cap course --------------------- */
function fencePost() {
  const POST = 0, CAP = 1, RAILTONE = 2;
  const v = [];
  box(0, 0, 0, 1, 6, 1, POST, v);
  box(0, 7, 0, 1, 7, 1, CAP, v);                     // cap course
  v.push([0, 1, 0, RAILTONE]);                       // weathered base voxel
  return {
    size: [2, 8, 2],
    palette: ['#F3E3C6', '#D9A874', '#B9855C'],
    voxels: dedupe(v), jitter: false, chamfer: 0.3, seed: 39
  };
}

/* --- demo-lab fence: same build, plain wood palette so the nursery's
       white pickets stay a unique landmark ------------------------ */
const FENCE_WOOD_PAL = ['#B9855C', '#D9A874', '#96683F'];
function fenceSegmentWood() {
  return { ...fenceSegment(), palette: FENCE_WOOD_PAL };
}
function fencePostWood() {
  return { ...fencePost(), palette: FENCE_WOOD_PAL };
}

/* --- straw nest ring: 5x5 footprint, 2 tall, seats a nursery egg --- */
function eggNest() {
  const STRAW = 0, STRAW_D = 1;
  const v = [];
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
    const edge = x === 0 || x === 4 || z === 0 || z === 4;
    const corner = (x === 0 || x === 4) && (z === 0 || z === 4);
    if (corner) continue;
    if (edge) {
      v.push([x, 0, z, STRAW_D], [x, 1, z, hash3(x, 1, z, 46) < 0.3 ? STRAW_D : STRAW]);
    } else {
      v.push([x, 0, z, STRAW]);                        // bowl floor
    }
  }
  // a few loose straws poking past the rim
  v.push([2, 1, 0, STRAW], [4, 0, 2, STRAW], [0, 0, 3, STRAW_D]);
  return {
    size: [5, 2, 5],
    palette: ['#D9B872', '#C9A25A'],
    voxels: dedupe(v), jitter: true, chamfer: 0.25, seed: 46
  };
}

/* --- small rocks: one boulder + satellite + pebbles, moss patch --- */
function rocksSmall() {
  const LITE = 0, MIDT = 1, DARK = 2, MOSS = 3;
  const v = [];
  const tone = (x, y, z) => (y >= 2 ? LITE : y === 1 ? MIDT : DARK);
  ellipsoid(3.6, 1.1, 3.8, 3.0, 2.1, 2.6, tone, v);   // one solid boulder
  ellipsoid(8.2, 0.7, 6.8, 1.4, 1.3, 1.3, tone, v);   // companion, set apart
  v.push([1, 0, 7, MIDT]);                             // single pebble
  // moss patch draped on the sun shoulder (last-wins overwrite)
  v.push([2, 2, 3, MOSS], [3, 2, 3, MOSS], [2, 2, 4, MOSS], [3, 2, 4, MOSS]);
  return {
    size: [10, 4, 10],
    palette: ['#A3968A', '#948B7E', '#7C7268', '#74A65F'],
    voxels: dedupe(v), jitter: true, chamfer: 0.3, seed: 40
  };
}

/* --- signpost: 2x2 post, routed board, end-grain nails ------------ */
function signpost() {
  const BOARD = 0, GROOVE = 1, POST = 2, NAIL = 3;
  const v = [];
  box(5, 0, 1, 6, 4, 2, POST, v);                    // 2x2 post
  box(1, 4, 1, 11, 8, 2, BOARD, v);                  // board, 2 deep (wins)
  box(3, 7, 2, 9, 7, 2, GROOVE, v);                  // routed line 1 (+Z face)
  box(3, 5, 2, 8, 5, 2, GROOVE, v);                  // routed line 2 (shorter)
  v.push([2, 8, 2, NAIL], [10, 4, 2, NAIL]);         // nails, asymmetric
  return {
    size: [13, 9, 3],
    palette: ['#C1905E', '#6E4A2C', '#96683F', '#D9A874'],
    voxels: dedupe(v), jitter: false, chamfer: 0.2, seed: 41
  };
}

/* ================================================================== *
 *  PUSHABLE TOYS                                                      *
 * ================================================================== */

/* --- bowling pin: cream body, single red neck stripe -------------- */
function toyBowlingPin() {
  const CREAM = 0, RED = 1;
  const v = [];
  // stacked squares (not lathed discs) — clean silhouette at this scale
  // [y, x0, x1, pi, cutCorners]
  const sq = [
    [0, 2, 4, CREAM, false],                         // base
    [1, 1, 5, CREAM, true],                          // belly (rounded octagon)
    [2, 1, 5, CREAM, true],
    [3, 1, 5, CREAM, true],
    [5, 2, 4, CREAM, false],                         // waist
    [6, 2, 4, RED, false],                           // neck stripe
    [7, 2, 4, CREAM, false],
    [8, 2, 4, CREAM, false],                         // head
    [9, 2, 4, CREAM, false]
  ];
  for (const [y, x0, x1, pi, cut] of sq)
    for (let x = x0; x <= x1; x++) for (let z = x0; z <= x1; z++) {
      if (cut && (x === x0 || x === x1) && (z === x0 || z === x1)) continue;
      v.push([x, y, z, pi]);
    }
  // plus-shaped transition course softens the belly-to-waist ledge
  box(2, 4, 2, 4, 4, 4, CREAM, v);
  v.push([1, 4, 3, CREAM], [5, 4, 3, CREAM], [3, 4, 1, CREAM], [3, 4, 5, CREAM]);
  v.push([3, 10, 3, CREAM]);                         // crown nub
  return {
    size: [7, 11, 7],
    palette: ['#FFF3D6', '#E05A4E'],
    voxels: v, jitter: false, chamfer: 0.25, seed: 42
  };
}

/* --- wooden crate: framed edges, X-braced sides, planked lid ------ */
function toyCrate() {
  const PANEL = 0, FRAME = 1, GRAIN = 2;
  const v = [];
  box(0, 0, 0, 7, 6, 7, PANEL, v);                   // solid body
  // frame: 12 edges (last-wins overwrite)
  for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]])
    box(x, 0, z, x, 6, z, FRAME, v);                 // vertical edges
  for (const y of [0, 6]) {
    box(0, y, 0, 7, y, 0, FRAME, v); box(0, y, 7, 7, y, 7, FRAME, v);
    box(0, y, 0, 0, y, 7, FRAME, v); box(7, y, 0, 7, y, 7, FRAME, v);
  }
  // vertical plank seams on the side faces (matches the planked lid);
  // seam position differs between the Z and X pairs for asymmetry
  for (let y = 1; y <= 5; y++) {
    v.push([3, y, 7, FRAME], [3, y, 0, FRAME]);               // Z faces
    v.push([7, y, 4, FRAME], [0, y, 4, FRAME]);               // X faces
  }
  // lid plank seams + one lighter replaced slat (asymmetry)
  box(1, 6, 3, 6, 6, 3, FRAME, v);
  box(1, 6, 5, 6, 6, 5, GRAIN, v);
  v.push([5, 2, 7, GRAIN]);                          // chipped corner voxel
  return {
    size: [8, 7, 8],
    palette: ['#B9855C', '#96683F', '#D9A874'],
    voxels: dedupe(v), jitter: false, chamfer: 0.15, seed: 43
  };
}

/* --- beach ball: 6 vertical wedges around a cream pole cap -------- */
function toyBeachBall() {
  const CREAM = 0, CORAL = 1, TEAL = 2, GOLD = 3;
  const SEG = [CORAL, CREAM, TEAL, GOLD];              // 4 fat quadrants
  const v = [];
  const cx = 4, cy = 3.85, cz = 4, r = 3.9;
  for (let x = 0; x <= 7; x++) for (let y = 0; y <= 7; y++)
    for (let z = 0; z <= 7; z++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const axial = Math.sqrt(dx * dx + dz * dz);
      let pi;
      if (axial < 1.1) pi = CREAM;                   // pole caps
      else {
        // seams rotated 45 deg so the camera always sees two colors
        const a = (Math.atan2(dz, dx) + Math.PI / 4) / (Math.PI * 2) + 0.5;
        pi = SEG[Math.floor(a * 4) % 4];
      }
      v.push([x, y, z, pi]);
    }
  return {
    size: [8, 8, 8],
    palette: ['#FFF3D6', '#FF8E72', '#7FD4D9', '#FFD166'],
    voxels: v, jitter: false, chamfer: 0, seed: 44
  };
}

/* ================================================================== *
 *  FOUNTAIN CENTERPIECE                                                *
 * ================================================================== */
function fountain() {
  const PLASTER = 0, COURSE = 1, WATER = 2, WLIGHT = 3, FOAM = 4, SPARK = 5;
  const C = 7;                                       // center (14 wide)
  const v = [];
  disc(C, 0, C, 6.9, COURSE, v);                     // base course
  ring(C, 1, C, 5.4, 6.9, PLASTER, v);               // basin wall
  ring(C, 2, C, 5.4, 6.9, PLASTER, v);               // basin rim
  disc(C, 1, C, 5.4, WATER, v);                      // lower water
  disc(C, 1, C, 3.6, WLIGHT, v);                     // lighter toward center
  // foam ring around the pedestal (hash-broken so it laps)
  ring(C, 1, C, 1.7, 2.7, FOAM, v);
  // pedestal + upper bowl (kept squat so it doesn't read as a statue)
  disc(C, 1, C, 1.7, COURSE, v);
  disc(C, 2, C, 1.7, COURSE, v);
  disc(C, 3, C, 1.7, PLASTER, v);
  disc(C, 4, C, 3.2, PLASTER, v);                    // wider upper bowl
  ring(C, 5, C, 2.1, 3.2, PLASTER, v);               // upper rim
  disc(C, 5, C, 2.1, WLIGHT, v);                     // upper water
  // low jet: one sparkle course + two foam caps (asymmetric)
  box(6, 6, 6, 7, 6, 7, SPARK, v);
  v.push([6, 7, 6, FOAM], [7, 7, 7, FOAM]);
  // sparkles on the lower water (deterministic scatter)
  const out = v.filter(vx => {
    if (vx[3] !== FOAM || vx[1] !== 1) return true;
    return hash3(vx[0], 1, vx[2], 45) < 0.65;        // break the foam ring
  });
  for (const [x, z] of [[3, 4], [10, 5], [5, 10], [9, 9]])
    out.push([x, 1, z, SPARK]);
  return {
    size: [14, 8, 14],
    palette: ['#F3E3C6', '#E3CFA9', '#3FA8B5', '#5FBFC9', '#EAF7EF', '#FFDCA8'],
    voxels: dedupe(out), jitter: false, chamfer: 0.2, seed: 45
  };
}

/* ================================================================== */
export default {
  ground_grass: groundGrass(),
  ground_path: groundPath(),
  ground_water: groundWater(),
  ground_shore: groundShore(),
  tall_grass: tallGrass(),
  tree_oak: treeOak(),
  tree_oak_b: treeOakB(),
  tree_oak_c: treeOakC(),
  tree_pine: treePine(),
  tree_sapling: treeSapling(),
  bush: bush(),
  flowers_peach: flowersPeach(),
  flowers_cream: flowersCream(),
  fence_segment: fenceSegment(),
  fence_post: fencePost(),
  fence_segment_wood: fenceSegmentWood(),
  fence_post_wood: fencePostWood(),
  egg_nest: eggNest(),
  rocks_small: rocksSmall(),
  signpost: signpost(),
  toy_bowling_pin: toyBowlingPin(),
  toy_crate: toyCrate(),
  toy_beach_ball: toyBeachBall(),
  fountain: fountain()
};
