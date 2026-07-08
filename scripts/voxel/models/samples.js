/* ============================================================================
   YOONKI WORLD 3D — sample models (pipeline proof + authoring reference)
   Read docs/VOXEL_FORMAT.md FIRST. Palette values come from docs/ART_BIBLE.md.

   These three models exercise every engine feature: box fills, last-wins
   detail painting, organic jitter, chamfered silhouettes, baked AO, and the
   canopy/trunk/ground palette conventions.
   ========================================================================== */

import { box } from '../voxel.js';

/* ------------------------------------------------------------------ *
 *  TEST TREE (art bible §7.2)                                          *
 *  Fat 2x2x6 trunk, 3-step canopy ramp, sun-kiss voxels on the         *
 *  top-west (low-x/low-z) shoulder — that's where the sun comes from.  *
 * ------------------------------------------------------------------ */
function makeTree() {
  const TRUNK = 0, TRUNK_SHADOW = 1, SKIRT = 2, MID = 3, TOP = 4, KISS = 5;
  const v = [];

  // trunk 2x2 x 6 tall; camera-facing (+X/+Z) columns take the shadow tone
  for (let y = 0; y <= 5; y++) {
    v.push([4, y, 4, TRUNK]);
    v.push([5, y, 4, TRUNK_SHADOW]);
    v.push([4, y, 5, TRUNK_SHADOW]);
    v.push([5, y, 5, TRUNK_SHADOW]);
  }

  // chamfered canopy blob — square layers with the corners knocked off
  function layer(y, lo, hi, pi, keepCorners) {
    for (let x = lo; x <= hi; x++) for (let z = lo; z <= hi; z++) {
      const cx = (x === lo || x === hi), cz = (z === lo || z === hi);
      if (!keepCorners && cx && cz) continue;
      v.push([x, y, z, pi]);
    }
  }
  layer(6, 2, 7, SKIRT, false);
  layer(7, 1, 8, MID, false);
  layer(8, 1, 8, MID, false);
  layer(9, 2, 7, MID, true);
  layer(10, 2, 7, TOP, false);
  layer(11, 3, 6, TOP, true);
  layer(12, 4, 5, TOP, true);

  // sun-kiss voxels (last-wins overwrite) on the top-west shoulder
  v.push([3, 10, 2, KISS], [2, 10, 3, KISS], [3, 11, 3, KISS]);

  return v;
}

/* ------------------------------------------------------------------ *
 *  GRASS CLUSTER (2x2 tiles of ground + tall-grass tufts + flowers)    *
 * ------------------------------------------------------------------ */
function makeGrassCluster() {
  const A = 0, B = 1, C = 2, DIRT_HI = 3, DIRT_LO = 4;
  const BLADE = 5, TIP = 6, SEED = 7, STEM = 8, PEACH = 9, CREAM = 10;
  const v = [];

  // 2x2 tiles (8 voxels each), grass A/B/C variation, dirt strata below
  const tileColor = [A, B, C, A];
  for (let tx = 0; tx < 2; tx++) for (let tz = 0; tz < 2; tz++) {
    box(tx * 8, 2, tz * 8, tx * 8 + 7, 2, tz * 8 + 7, tileColor[tx * 2 + tz], v);
  }
  box(0, 1, 0, 15, 1, 15, DIRT_HI, v);
  box(0, 0, 0, 15, 0, 15, DIRT_LO, v);

  // tall-grass blades: base -> tip gradient, two get seed heads
  const blades = [[3, 3], [5, 4], [11, 3], [12, 6], [4, 11], [10, 12], [12, 11], [6, 13]];
  blades.forEach(function (b, i) {
    v.push([b[0], 3, b[1], BLADE], [b[0], 4, b[1], BLADE], [b[0], 5, b[1], TIP]);
    if (i % 4 === 1) v.push([b[0], 6, b[1], SEED]);
  });

  // two flowers: stem + petal cross + center dot
  function flower(x, z, headPi, centerPi) {
    v.push([x, 3, z, STEM], [x, 4, z, STEM]);
    v.push([x, 5, z, headPi], [x - 1, 5, z, headPi], [x + 1, 5, z, headPi],
           [x, 5, z - 1, headPi], [x, 5, z + 1, headPi]);
    v.push([x, 6, z, centerPi]);
  }
  flower(8, 8, PEACH, CREAM);
  flower(13, 13, CREAM, PEACH);

  return v;
}

/* ------------------------------------------------------------------ *
 *  TEST SIGNPOST (art bible §7.5)                                      *
 *  2-voxel post, routed groove lines. The 4 deg camera-friendly yaw    *
 *  is applied at placement time (mesh.rotation.y), not baked here.     *
 * ------------------------------------------------------------------ */
function makeSignpost() {
  const BOARD = 0, GROOVE = 1, POST = 2;
  const v = [];
  box(5, 0, 1, 6, 4, 1, POST, v);       // post, 2 voxels wide
  box(1, 4, 1, 10, 8, 1, BOARD, v);     // board (overwrites post top — wins)
  box(3, 7, 1, 8, 7, 1, GROOVE, v);     // routed text line 1
  box(3, 5, 1, 7, 5, 1, GROOVE, v);     // routed text line 2
  return v;
}

/* ------------------------------------------------------------------ */
export default {
  test_tree: {
    size: [10, 13, 10],
    palette: [
      '#7A5238',   // 0 trunk
      '#5F3E2A',   // 1 trunk shadow side
      '#2F7550',   // 2 canopy skirt
      '#3F8F5F',   // 3 canopy mid
      '#57A873',   // 4 canopy top
      '#92AB72'    // 5 sun-kiss (canopy-top mixed toward #FFB070)
    ],
    voxels: makeTree(),
    jitter: true,
    chamfer: 0.35,
    seed: 1
  },

  grass_cluster: {
    size: [16, 8, 16],
    palette: [
      '#7FB069',   // 0 grass A
      '#74A65F',   // 1 grass B
      '#689A55',   // 2 grass C
      '#8A5A3C',   // 3 dirt (upper stratum)
      '#7A4C32',   // 4 dirt (lower stratum)
      '#4E8546',   // 5 tall-grass blade base
      '#6BA35C',   // 6 tall-grass blade tip
      '#D9C27E',   // 7 seed head
      '#5F9450',   // 8 flower stem
      '#FFB88A',   // 9 flower peach
      '#FFF3D6'    // 10 flower cream
    ],
    voxels: makeGrassCluster(),
    jitter: true,
    chamfer: 0.3,
    seed: 3
  },

  test_signpost: {
    size: [12, 9, 3],
    palette: [
      '#C1905E',   // 0 board
      '#6E4A2C',   // 1 routed grooves
      '#96683F'    // 2 post
    ],
    voxels: makeSignpost(),
    jitter: false,
    chamfer: 0.2
  }
};
