/* ============================================================================
   YOONKI WORLD 3D — skyline landmark models (procedural voxel)
   Format: docs/VOXEL_FORMAT.md. Palette: albedo only (ART_BIBLE §2).

   landmark_goldengate — full-span suspension bridge, International Orange.
     Authored as voxels instead of a Meshy GLB on purpose: thin trusses,
     catenary cables and suspenders are exactly what image-to-3D mangles
     (the 2026-07-10 GLB shipped with the deck truncated at both towers).
     Procedural = deterministic full span + anchors, and it matches the
     island's voxel look. Model runs along X; world yaw turns it.

   namsan_hill — the green mound N Seoul Tower stands on (its own islet in
     the north water band). The tower GLB itself is fine — it just read as
     floating on the sea without a mountain under it.
   ========================================================================== */

import { dedupe } from '../voxel.js';

/* inclusive box straight into a list (local: avoids importing box for clarity) */
function fill(v, x0, y0, z0, x1, y1, z1, pi) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) v.push([x, y, z, pi]);
}

/* ------------------------------------------------------------------ *
 *  GOLDEN GATE — length 100 vox (12.5 wu), depth 10 (1.25 wu),        *
 *  towers to y45 (5.6 wu). y0 = sea surface. Sized to SPAN the strait *
 *  between the island's west coast and the sf_islet below — the       *
 *  original 19 wu span paralleled the coast connecting nothing and    *
 *  read wrong (user report 2026-07-11).                               *
 * ------------------------------------------------------------------ */
function makeGoldenGate() {
  const OR = 0, DK = 1, ROAD = 2, STRIPE = 3;
  const v = [];
  const L = 99;                        // last x
  const DECK = 14;                     // deck underside y; road TOP = 16 vox
                                       // = 2.0 wu, so placed at y −2.0 the
                                       // road surface sits EXACTLY at y 0 —
                                       // the player walks it flush (2026-07-11
                                       // walkable-bridge rework)
  const towers = [26, 70];             // tower center-left x (legs 4 wide)

  /* anchor pylons at both ends — BELOW deck only, the road passes over
     them (the old above-deck caps walled off the walkway) */
  for (const x0 of [0, L - 5]) fill(v, x0, 0, 1, x0 + 5, DECK - 1, 12, DK);

  /* deck: full-length slab + 10-vox (1.25 wu) walkable road z2..11 */
  fill(v, 0, DECK, 2, L, DECK + 1, 11, OR);              // structure slab
  for (let x = 0; x <= L; x++) {
    for (let z = 2; z <= 11; z++) v.push([x, DECK + 1, z, ROAD]);
    if (x % 8 < 4) {                                     // dashed center line
      v.push([x, DECK + 1, 6, STRIPE]);
      v.push([x, DECK + 1, 7, STRIPE]);
    }
  }
  /* parapets z0-1 / z12-13: base flush with the road top, then a post
     rhythm and a floating top rail — knee-high, reads walkable */
  for (const [z0, z1] of [[0, 1], [12, 13]]) {
    fill(v, 0, DECK, z0, L, DECK + 2, z1, OR);           // base to road level
    fill(v, 0, DECK + 4, z0, L, DECK + 4, z1, OR);       // top rail beam
    for (let x = 0; x <= L; x += 6)
      fill(v, x, DECK + 3, z0, x, DECK + 3, z1, DK);     // posts
  }

  /* towers: slim legs OUTSIDE the road (z0-1 / z12-13), portal struts
     high above head height (lowest at 3.75 wu −2.0 = 1.75 wu clearance
     over the road — the 1.625 wu player walks under them clean) */
  for (const tx of towers) {
    for (const z0 of [0, 12]) fill(v, tx, 0, z0, tx + 3, 44, z0 + 1, OR);
    fill(v, tx, 30, 1, tx + 3, 33, 12, OR);              // lower portal strut
    fill(v, tx, 38, 1, tx + 3, 40, 12, OR);              // upper portal strut
    fill(v, tx - 1, 43, 0, tx + 4, 45, 13, DK);          // cap band
  }

  /* main cables (z 0 and 13): catenary mid-span, straight-ish side spans */
  const t0 = towers[0] + 1.5, t1 = towers[1] + 1.5;      // tower centerlines
  const TOP = 43, SAG = 21, ANCH = DECK + 5;
  const cableY = (x) => {
    if (x < t0) {                                        // left side span
      const t = (x - 2) / (t0 - 2);
      return ANCH + (TOP - ANCH) * t * t * 0.9 + (TOP - ANCH) * 0.1 * t;
    }
    if (x > t1) {                                        // right side span
      const t = (L - 2 - x) / (L - 2 - t1);
      return ANCH + (TOP - ANCH) * t * t * 0.9 + (TOP - ANCH) * 0.1 * t;
    }
    const m = (t0 + t1) / 2;                             // main span parabola
    const k = (x - m) / (t1 - m);
    return SAG + (TOP - SAG) * k * k;
  };
  for (let x = 2; x <= L - 2; x++) {
    const y = Math.round(cableY(x));
    for (const z of [0, 13]) {
      v.push([x, y, z, DK]);
      // keep the curve visually continuous on steep segments
      const yn = Math.round(cableY(x + 1));
      for (let yy = Math.min(y, yn) + 1; yy < Math.max(y, yn); yy++)
        v.push([x, yy, z, DK]);
    }
    // suspenders every 8 vox on the main span
    if (x > t0 + 4 && x < t1 - 4 && x % 8 === 0)
      for (const z of [0, 13])
        for (let yy = DECK + 5; yy < y; yy++) v.push([x, yy, z, DK]);
  }

  return v;
}

/* ------------------------------------------------------------------ *
 *  MOUND ISLETS — green mounds with a sand/rock waterline skirt.      *
 *  y0 = sea surface.                                                  *
 *  namsan_hill: dome, r 22 vox (2.75 wu), h 14 — carries the tower.   *
 *  sf_islet: WALKABLE plateau (2026-07-11 Demo Lab island): height 16 *
 *  vox = 2.0 wu, so placed at y −2.0 its flat top sits EXACTLY at     *
 *  y 0 — the player steps off the Golden Gate onto it flush.          *
 * ------------------------------------------------------------------ */
function makeMound(R, H, topR, plateau) {
  const GRASS = 0, GRASS_DK = 1, ROCK = 2, SAND = 3;
  const v = [];
  const C = R + 0.5;
  for (let y = 0; y <= H; y++) {
    const t = y / H;
    // dome: cosine shoulder; plateau: gentle frustum taper to a WIDE top
    const r = plateau
      ? (R - (R - topR) * Math.pow(t, 1.3))
      : (y === H ? topR : R * Math.sqrt(1 - t * t * 0.92));
    for (let x = Math.floor(C - r); x <= Math.ceil(C + r); x++)
      for (let z = Math.floor(C - r); z <= Math.ceil(C + r); z++) {
        const dx = x + 0.5 - C, dz = z + 0.5 - C;
        if (dx * dx + dz * dz > r * r) continue;
        const edge = dx * dx + dz * dz > (r - 1.6) * (r - 1.6);
        let pi = GRASS;
        if (y <= 1) pi = edge ? SAND : ROCK;             // waterline skirt
        else if (plateau && y < H && edge) pi = ROCK;    // carved cliff side
        else if (edge && ((x * 7 + z * 13 + y * 3) % 11) < 3) pi = GRASS_DK;
        v.push([x, y, z, pi]);
      }
  }
  return v;
}

const MOUND_PALETTE = [
  '#5C9E63',   // 0 hill grass (a hair deeper than lawn — reads "forested")
  '#437B4C',   // 1 darker foliage patches
  '#7A4C32',   // 2 rock at the waterline
  '#D8B27F'    // 3 sand ring
];

export default {
  landmark_goldengate: {
    size: [100, 46, 14],
    palette: [
      '#E85A33',   // 0 international orange (albedo — sun keeps it vivid)
      '#C2401F',   // 1 orange shade / cables / anchor
      '#4E4E58',   // 2 road slab
      '#E8D27A'    // 3 lane stripe
    ],
    voxels: dedupe(makeGoldenGate()),
    jitter: false, chamfer: 0, sunRim: true, seed: 7
  },

  namsan_hill: {
    size: [46, 15, 46],
    palette: MOUND_PALETTE,
    voxels: dedupe(makeMound(22, 14, 7)),
    jitter: true, chamfer: 0.3, sunRim: true, seed: 11
  },

  sf_islet: {
    size: [66, 17, 66],
    palette: MOUND_PALETTE,
    voxels: dedupe(makeMound(32, 16, 24, true)),
    jitter: true, chamfer: 0.3, sunRim: true, seed: 17
  }
};
