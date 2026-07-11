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
 *  GOLDEN GATE — length 152 vox (19 wu), depth 10 (1.25 wu),          *
 *  towers to y45 (5.6 wu). y0 = sea surface.                          *
 * ------------------------------------------------------------------ */
function makeGoldenGate() {
  const OR = 0, DK = 1, ROAD = 2, STRIPE = 3;
  const v = [];
  const L = 151;                       // last x
  const DECK = 14;                     // deck underside y
  const towers = [44, 107];            // tower center-left x (legs 4 wide)

  /* anchor pylons at both ends (stepped, orange like the real approach) */
  for (const x0 of [0, L - 5]) {
    fill(v, x0, 0, 1, x0 + 5, DECK + 3, 8, DK);
    fill(v, x0, DECK + 4, 2, x0 + 5, DECK + 5, 7, OR);   // cap
  }

  /* deck: road slab + orange side girders with a lip above the road */
  fill(v, 2, DECK, 2, L - 2, DECK + 1, 7, OR);           // structure slab
  for (let x = 2; x <= L - 2; x++) {
    for (let z = 3; z <= 6; z++) v.push([x, DECK + 1, z, ROAD]);
    if (x % 8 < 4) {                                     // dashed center line
      v.push([x, DECK + 1, 4, STRIPE]);
    }
  }
  fill(v, 2, DECK, 1, L - 2, DECK + 3, 1, OR);           // south girder
  fill(v, 2, DECK, 8, L - 2, DECK + 3, 8, OR);           // north girder

  /* towers: two legs, portal struts above deck, cap. Legs run to the sea. */
  for (const tx of towers) {
    for (const z0 of [0, 6]) fill(v, tx, 0, z0, tx + 3, 44, z0 + 3, OR);
    fill(v, tx, 24, 1, tx + 3, 27, 8, OR);               // lower portal strut
    fill(v, tx, 35, 1, tx + 3, 38, 8, OR);               // upper portal strut
    fill(v, tx - 1, 43, 0, tx + 4, 45, 9, DK);           // cap band
    // subtle shade course on the camera-side leg faces
    fill(v, tx, 12, 6, tx + 3, 13, 9, DK);
  }

  /* main cables (z 1 and 8): catenary mid-span, straight-ish side spans */
  const t0 = towers[0] + 1.5, t1 = towers[1] + 1.5;      // tower centerlines
  const TOP = 43, SAG = 19, ANCH = DECK + 4;
  const cableY = (x) => {
    if (x < t0) {                                        // left side span
      const t = (x - 4) / (t0 - 4);
      return ANCH + (TOP - ANCH) * t * t * 0.9 + (TOP - ANCH) * 0.1 * t;
    }
    if (x > t1) {                                        // right side span
      const t = (L - 4 - x) / (L - 4 - t1);
      return ANCH + (TOP - ANCH) * t * t * 0.9 + (TOP - ANCH) * 0.1 * t;
    }
    const m = (t0 + t1) / 2;                             // main span parabola
    const k = (x - m) / (t1 - m);
    return SAG + (TOP - SAG) * k * k;
  };
  for (let x = 4; x <= L - 4; x++) {
    const y = Math.round(cableY(x));
    for (const z of [1, 8]) {
      v.push([x, y, z, DK]);
      // keep the curve visually continuous on steep segments
      const yn = Math.round(cableY(x + 1));
      for (let yy = Math.min(y, yn) + 1; yy < Math.max(y, yn); yy++)
        v.push([x, yy, z, DK]);
    }
    // suspenders every 8 vox on the main span
    if (x > t0 + 4 && x < t1 - 4 && x % 8 === 0)
      for (const z of [1, 8])
        for (let yy = DECK + 4; yy < y; yy++) v.push([x, yy, z, DK]);
  }

  return v;
}

/* ------------------------------------------------------------------ *
 *  NAMSAN HILL — round green mound islet, flat top for the tower GLB. *
 *  r 22 vox (2.75 wu), height 14 (1.75 wu). y0 = sea surface.         *
 * ------------------------------------------------------------------ */
function makeNamsanHill() {
  const GRASS = 0, GRASS_DK = 1, ROCK = 2, SAND = 3;
  const v = [];
  const CX = 22.5, CZ = 22.5, H = 14, R = 22;
  for (let y = 0; y <= H; y++) {
    // cosine shoulder: wide base, gentle dome, flat-ish top
    const t = y / H;
    const r = y === H ? 7 : R * Math.sqrt(1 - t * t * 0.92);
    for (let x = Math.floor(CX - r); x <= Math.ceil(CX + r); x++)
      for (let z = Math.floor(CZ - r); z <= Math.ceil(CZ + r); z++) {
        const dx = x + 0.5 - CX, dz = z + 0.5 - CZ;
        if (dx * dx + dz * dz > r * r) continue;
        const edge = dx * dx + dz * dz > (r - 1.6) * (r - 1.6);
        let pi = GRASS;
        if (y <= 1) pi = edge ? SAND : ROCK;             // waterline skirt
        else if (edge && ((x * 7 + z * 13 + y * 3) % 11) < 3) pi = GRASS_DK;
        v.push([x, y, z, pi]);
      }
  }
  return v;
}

export default {
  landmark_goldengate: {
    size: [152, 46, 10],
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
    palette: [
      '#5C9E63',   // 0 hill grass (a hair deeper than lawn — reads "forested")
      '#437B4C',   // 1 darker foliage patches
      '#7A4C32',   // 2 rock at the waterline
      '#D8B27F'    // 3 sand ring
    ],
    voxels: dedupe(makeNamsanHill()),
    jitter: true, chamfer: 0.3, sunRim: true, seed: 11
  }
};
