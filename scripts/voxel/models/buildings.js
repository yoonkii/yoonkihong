/* ============================================================================
   YOONKI WORLD 3D — buildings (art bible §2.4 / §7.1, scaled to viewer props)
   Read docs/VOXEL_FORMAT.md FIRST. All palettes are albedo from ART_BIBLE.md.

   Six models: about_house, macrodoc, mathstreet, mathwings, funnify,
   egg_nursery. Each has a one-glance silhouette hook:
     about_house — cozy gable + fat chimney + flower boxes
     macrodoc    — writing lab: arched reading window, rooftop antenna,
                   a stack of oversized books by the door
     mathstreet  — three-tier trading tower, ticker band with ▲▼ ticks, spire
     mathwings   — sky arcade: swept cream-and-gold wings, star gable, awning
     funnify     — quiz theater: tall confetti marquee fascia, barrel roof,
                   golden "?" finial
     egg_nursery — open straw-roof incubator gazebo, picket back, 3 nests

   Buildings never jitter (format §2) — hand-placed shingle/plaster variation
   via hash3 does the "not programmer art" job instead, deterministically.
   ========================================================================== */

import { box, dedupe, hash3 } from '../voxel.js';

/* shared weathering: re-tint ~`chance` of the voxels currently painted
   `fromPi` to `toPi` (last-wins overwrite). Never touches empty air, never
   touches other materials — deterministic via hash3. */
function sprinkle(v, fromPi, toPi, chance, seed) {
  const cur = new Map();                       // last-wins current palette
  for (const q of v) cur.set(q[0] + '|' + q[1] + '|' + q[2], q[3]);
  for (const [key, pi] of cur) {
    if (pi !== fromPi) continue;
    const [x, y, z] = key.split('|').map(Number);
    if (hash3(x, y, z, seed) < chance) v.push([x, y, z, toPi]);
  }
}

/* ------------------------------------------------------------------ *
 *  ABOUT HOUSE — cozy cottage, mint stair-step roof, terracotta        *
 *  chimney, flower boxes. Door faces +Z (camera / path side).          *
 * ------------------------------------------------------------------ */
function makeAboutHouse() {
  const P = 0, PS = 1, ROOF = 2, ROOF_D = 3, RIDGE = 4, DOOR = 5,
        GLASS = 6, TRIM = 7, BRICK = 8, BRICK_L = 9, KNOB = 10,
        PLANT = 11, FLW_P = 12, STEP = 13, SOOT = 14;
  const v = [];

  // body 16 x 16 x 12 — landmark height (solid, interior fully culled)
  box(2, 0, 2, 17, 15, 13, P, v);
  box(2, 0, 2, 17, 1, 13, PS, v);                    // shadow course

  // front door (+Z), off-center charm comes from the window rhythm instead
  box(7, 0, 13, 12, 8, 13, TRIM, v);                 // frame
  box(8, 0, 13, 11, 7, 13, DOOR, v);
  v.push([10, 4, 14, KNOB]);                         // brass knob, proud 1 voxel
  box(7, 0, 14, 12, 0, 15, STEP, v);                 // sandstone stoop

  // front windows + mint shutters + flower boxes (raised with the walls)
  function frontWindow(x0) {
    box(x0, 7, 13, x0 + 2, 10, 13, GLASS, v);
    box(x0 - 1, 7, 13, x0 - 1, 10, 13, ROOF_D, v);   // shutters
    box(x0 + 3, 7, 13, x0 + 3, 10, 13, ROOF_D, v);
    box(x0, 6, 14, x0 + 2, 6, 14, PLANT, v);         // planter
  }
  frontWindow(3);
  frontWindow(14);
  // flowers: left box fuller than right (small asymmetry)
  v.push([3, 7, 14, FLW_P], [4, 7, 14, TRIM], [5, 7, 14, FLW_P]);
  v.push([14, 7, 14, TRIM], [16, 7, 14, FLW_P]);

  // side + back windows so the turntable never shows a blank face
  box(17, 7, 6, 17, 10, 8, GLASS, v);                // +X
  box(2, 7, 5, 2, 10, 6, GLASS, v);                  // -X, smaller (asymmetry)
  box(6, 7, 2, 8, 10, 2, GLASS, v);                  // -Z back
  box(12, 7, 2, 13, 10, 2, GLASS, v);
  // small round-ish attic window over the door
  box(9, 12, 13, 10, 13, 13, GLASS, v);

  // mint gable roof: solid stepped slabs (full-width, shrinking in Z) —
  // chunky, no see-through notches, chamfer turns each step into a
  // shingle course. 2-voxel overhang on every side at the eave.
  for (let i = 0; i <= 7; i++) {
    const y = 16 + i;
    box(0, y, i, 19, y, 15 - i, ROOF, v);
    box(0, y, i, 0, y, 15 - i, RIDGE, v);                  // west rake board
    box(19, y, i, 19, y, 15 - i, RIDGE, v);                // east rake board
  }
  box(0, 24, 7, 19, 24, 8, RIDGE, v);                      // ridge cap

  // fat terracotta chimney, west of the ridge (asymmetric), smokes in-game
  box(4, 18, 5, 6, 27, 7, BRICK, v);
  box(3, 28, 4, 7, 28, 8, BRICK_L, v);               // flared crown
  v.push([5, 28, 6, SOOT]);                          // flue hole

  // weathering (existing voxels only — never air)
  sprinkle(v, P, PS, 0.07, 11);                      // plaster flecks
  sprinkle(v, ROOF, ROOF_D, 0.18, 21);               // shingle variation

  return v;
}

/* ------------------------------------------------------------------ *
 *  MACRODOC — tiny writing lab / library. Teal roof, big arched        *
 *  reading window, rooftop antenna, book stack by the door.            *
 * ------------------------------------------------------------------ */
function makeMacrodoc() {
  const P = 0, PS = 1, ROOF = 2, ROOF_D = 3, TRIM = 4, GLASS = 5,
        DOOR = 6, SIGN = 7, MAST = 8, TIP = 9,
        BK_A = 10, BK_B = 11, BK_C = 12, PAGE = 13;
  const v = [];

  // body 16 x 15 x 10 — landmark height, facade not swallowed by eaves
  box(2, 0, 2, 17, 14, 11, P, v);
  box(2, 0, 2, 17, 1, 11, PS, v);
  box(2, 14, 2, 17, 14, 11, TRIM, v);                // dark teal fascia course

  // big arched reading window (+Z) — cream frame, teal mullions, two floors
  box(3, 1, 11, 9, 12, 11, SIGN, v);                 // cream surround
  box(4, 2, 11, 8, 6, 11, GLASS, v);
  box(6, 2, 11, 6, 6, 11, SIGN, v);                  // cream mullion
  box(4, 4, 11, 8, 4, 11, SIGN, v);                  // cream transom bar
  box(4, 8, 11, 8, 10, 11, GLASS, v);                // upper reading window
  box(5, 11, 11, 7, 11, 11, GLASS, v);               // arch top
  box(6, 8, 11, 6, 11, 11, SIGN, v);                 // upper mullion

  // door, off to the right (+Z)
  box(11, 0, 11, 15, 6, 11, TRIM, v);
  box(12, 0, 11, 14, 5, 11, DOOR, v);
  v.push([13, 3, 12, TIP]);                          // warm knob
  // hanging "doc" sign board over the door, proud of the wall
  box(11, 8, 12, 15, 9, 12, SIGN, v);
  box(12, 8, 12, 12, 9, 12, ROOF_D, v);              // painted glyph strokes
  v.push([14, 9, 12, ROOF_D], [13, 8, 12, ROOF_D]);

  // side/back windows, two courses
  box(17, 3, 4, 17, 5, 5, GLASS, v);
  box(17, 3, 8, 17, 5, 9, GLASS, v);
  box(17, 9, 5, 17, 11, 6, GLASS, v);
  box(2, 3, 5, 2, 5, 7, GLASS, v);
  box(2, 9, 6, 2, 11, 8, GLASS, v);
  box(5, 3, 2, 7, 5, 2, GLASS, v);
  box(12, 3, 2, 14, 5, 2, GLASS, v);
  box(8, 9, 2, 11, 11, 2, GLASS, v);

  // teal gable roof: solid stepped slabs, full 2-voxel overhang in both axes
  for (let i = 0; i <= 5; i++) {
    const y = 15 + i;
    box(0, y, i, 19, y, 13 - i, ROOF, v);
    box(0, y, i, 0, y, 13 - i, ROOF_D, v);           // west rake board
    box(19, y, i, 19, y, 13 - i, ROOF_D, v);         // east rake board
  }
  box(0, 21, 6, 19, 21, 7, ROOF_D, v);               // ridge cap

  // rooftop landmark: broadcast antenna (ART_BIBLE signature prop)
  box(4, 22, 6, 5, 22, 7, BK_B, v);                  // brick-red base block
  box(4, 23, 6, 4, 27, 6, MAST, v);                  // mast
  v.push([3, 25, 6, MAST], [5, 25, 6, MAST]);        // cross prongs
  v.push([4, 28, 6, TIP]);                           // warm beacon
  v.push([4, 26, 5, PAGE]);                          // little flag voxel

  // stack of oversized books at the corner (each nudged — nothing squared up)
  box(16, 0, 12, 19, 1, 14, BK_A, v);                // navy tome
  box(16, 0, 14, 19, 0, 14, PAGE, v);                // page edge peeking
  box(16, 2, 12, 18, 3, 13, BK_B, v);                // brick-red, set back
  box(17, 4, 13, 19, 4, 14, BK_C, v);                // straw-gold, slid right
  v.push([19, 2, 12, PAGE]);                         // loose bookmark voxel

  // weathering
  sprinkle(v, P, PS, 0.07, 31);
  sprinkle(v, ROOF, ROOF_D, 0.18, 41);

  return v;
}

/* ------------------------------------------------------------------ *
 *  MATHSTREET — city-trading tower. Three plaster tiers, slate roofs,  *
 *  ticker band with ▲▼ ticks, brass double door, spire.                *
 * ------------------------------------------------------------------ */
function makeMathstreet() {
  const P = 0, PS = 1, SL = 2, SLD = 3, GLASS = 4, BR = 5,
        UP = 6, DN = 7, TICK = 8;
  const v = [];

  // --- tier 1 ---------------------------------------------------------
  box(1, 0, 1, 16, 9, 16, P, v);
  box(1, 0, 1, 16, 1, 16, PS, v);
  // ticker band wraps the whole tier at y8
  box(1, 8, 1, 16, 8, 16, SLD, v);
  // teal dashes so the band reads as a live feed all the way round…
  for (let x = 2; x <= 15; x++) {
    if (hash3(x, 8, 16, 55) < 0.3) v.push([x, 8, 16, TICK]);
    if (hash3(x, 8, 1, 56) < 0.25) v.push([x, 8, 1, TICK]);
  }
  for (let z = 2; z <= 15; z++) {
    if (hash3(16, 8, z, 57) < 0.3) v.push([16, 8, z, TICK]);
    if (hash3(1, 8, z, 58) < 0.25) v.push([1, 8, z, TICK]);
  }
  // …with ▲ green / ▼ red ticks punched in on every face (painted last, win)
  [[3, UP], [7, DN], [11, UP], [14, DN]]
    .forEach(([x, pi]) => v.push([x, 8, 16, pi]));
  [[3, DN], [8, UP], [13, UP]]
    .forEach(([z, pi]) => v.push([16, 8, z, pi]));
  [[4, UP], [10, DN], [13, UP]].forEach(([x, pi]) => v.push([x, 8, 1, pi]));
  [[4, DN], [8, DN], [12, UP]].forEach(([z, pi]) => v.push([1, 8, z, pi]));
  box(0, 10, 0, 17, 10, 17, SL, v);                  // tier-1 roof ledge

  // brass double door (+Z) with slate surround + canopy
  box(6, 0, 16, 11, 5, 16, SLD, v);
  box(7, 0, 16, 10, 4, 16, BR, v);
  v.push([8, 2, 17, SLD], [9, 2, 17, SLD]);          // handles
  box(5, 5, 17, 12, 5, 17, SLD, v);                  // entry canopy

  // tier-1 windows (tall office pairs)
  box(2, 3, 16, 3, 6, 16, GLASS, v);  box(13, 3, 16, 14, 6, 16, GLASS, v);
  box(16, 3, 3, 16, 6, 4, GLASS, v);  box(16, 3, 7, 16, 6, 8, GLASS, v);
  box(16, 3, 11, 16, 6, 12, GLASS, v);
  box(1, 3, 4, 1, 6, 5, GLASS, v);    box(1, 3, 9, 1, 6, 10, GLASS, v);
  box(3, 3, 1, 4, 6, 1, GLASS, v);    box(8, 3, 1, 9, 6, 1, GLASS, v);
  box(13, 3, 1, 14, 6, 1, GLASS, v);

  // --- tier 2 ---------------------------------------------------------
  box(3, 11, 3, 14, 17, 14, P, v);
  box(3, 17, 3, 14, 17, 14, SLD, v);                 // dark cornice course
  box(2, 18, 2, 15, 18, 15, SL, v);                  // tier-2 roof ledge
  box(5, 13, 14, 6, 15, 14, GLASS, v);  box(9, 13, 14, 10, 15, 14, GLASS, v);
  box(12, 13, 14, 13, 15, 14, GLASS, v);
  box(14, 13, 5, 14, 15, 6, GLASS, v);  box(14, 13, 9, 14, 15, 10, GLASS, v);
  box(3, 13, 6, 3, 15, 7, GLASS, v);    box(3, 13, 10, 3, 15, 11, GLASS, v);
  box(6, 13, 3, 7, 15, 3, GLASS, v);    box(10, 13, 3, 11, 15, 3, GLASS, v);

  // --- tier 3 + spire --------------------------------------------------
  box(5, 19, 5, 12, 23, 12, P, v);
  box(5, 23, 5, 12, 23, 12, SLD, v);
  box(4, 24, 4, 13, 24, 13, SLD, v);                 // crown ledge
  box(7, 21, 12, 8, 22, 12, GLASS, v);
  box(12, 21, 7, 12, 22, 8, GLASS, v);
  box(5, 21, 8, 5, 22, 9, GLASS, v);
  box(9, 21, 5, 10, 22, 5, GLASS, v);
  box(8, 25, 8, 9, 26, 9, SLD, v);                   // spire base
  box(8, 27, 8, 8, 29, 8, SLD, v);                   // mast (off-center, 1 wide)
  v.push([8, 30, 8, BR]);                            // brass tip

  // weathering
  sprinkle(v, P, PS, 0.06, 51);
  sprinkle(v, SL, SLD, 0.2, 52);

  return v;
}

/* ------------------------------------------------------------------ *
 *  MATHWINGS — sky arcade. Indigo roof with a gold star gable,         *
 *  swept cream/gold wings on both flanks, cape-yellow striped awning.  *
 * ------------------------------------------------------------------ */
function makeMathwings() {
  const P = 0, PS = 1, IN = 2, IND = 3, GOLD = 4, AWN = 5,
        GLASS = 6, DOOR = 7, CREAM = 8;
  const v = [];

  // body 12 x 9 x 10, centered between the wings
  box(5, 0, 2, 16, 8, 11, P, v);
  box(5, 0, 2, 16, 1, 11, PS, v);

  // door + striped cape-yellow awning (+Z)
  box(8, 0, 11, 13, 5, 11, IND, v);
  box(9, 0, 11, 12, 4, 11, DOOR, v);
  v.push([10, 2, 12, GOLD]);
  for (let x = 7; x <= 14; x++)
    box(x, 6, 12, x, 6, 13, (x % 2 === 0) ? AWN : CREAM, v);
  for (let x = 7; x <= 14; x += 2) v.push([x, 5, 13, AWN]);   // scallop drops

  // front windows + scattered star-trim voxels
  box(6, 3, 11, 7, 4, 11, GLASS, v);
  box(14, 3, 11, 15, 4, 11, GLASS, v);
  v.push([6, 7, 11, GOLD], [15, 6, 11, GOLD], [7, 6, 11, GOLD]);
  // side/back windows
  box(16, 3, 4, 16, 5, 5, GLASS, v);
  box(5, 3, 7, 5, 5, 8, GLASS, v);
  box(7, 3, 2, 8, 5, 2, GLASS, v);
  box(13, 3, 2, 14, 5, 2, GLASS, v);

  // indigo hip roof: classic 45° stepped pyramid (shrink 1 per level on
  // every side) — reads as one solid soft mass from any angle
  for (let i = 0; i <= 6; i++) {
    box(4 + i, 9 + i, i, 17 - i, 9 + i, 13 - i, IN, v);
  }
  box(10, 15, 6, 11, 15, 7, IND, v);                          // dark cap
  // gold studs marching up the front hip (arcade marquee rhythm)
  v.push([8, 10, 12, GOLD], [13, 10, 12, GOLD],
         [9, 12, 10, GOLD], [12, 12, 10, GOLD],
         [10, 14, 8, GOLD], [11, 14, 8, GOLD]);

  // big gold star finial rising from the cap
  box(10, 16, 6, 10, 17, 6, IND, v);
  v.push([10, 18, 6, GOLD], [9, 18, 6, GOLD], [11, 18, 6, GOLD],
         [10, 19, 6, GOLD], [10, 17, 7, GOLD], [10, 17, 5, GOLD]);

  // WINGS — two chunky solid steps a side, deeply overlapped so each wing
  // reads as one swept shape; gold flight-feather top rows; east wing
  // lands one voxel lower (asymmetry)
  function wing(steps, mirror) {
    for (const [x0, x1, y0, y1, z0, z1] of steps) {
      const a = mirror ? 21 - x1 : x0, b = mirror ? 21 - x0 : x1;
      box(a, y0, z0, b, y1, z1, CREAM, v);
      box(a, y1, z0, b, y1, z1, GOLD, v);                     // gold top row
    }
  }
  wing([[2, 4, 4, 9, 4, 9], [1, 2, 7, 12, 4, 9], [0, 0, 10, 14, 4, 9]], false);
  wing([[2, 4, 3, 8, 4, 9], [1, 2, 6, 11, 4, 9], [0, 0, 9, 13, 4, 9]], true);

  // weathering
  sprinkle(v, P, PS, 0.07, 61);
  sprinkle(v, IN, IND, 0.18, 62);

  return v;
}

/* ------------------------------------------------------------------ *
 *  FUNNIFY — playful quiz theater. Tall confetti marquee fascia,       *
 *  coral barrel roof behind, striped awning, golden "?" finial.        *
 * ------------------------------------------------------------------ */
function makeFunnify() {
  const P = 0, PS = 1, CO = 2, COD = 3, GOLD = 4, TEAL = 5,
        PANEL = 6, CREAM = 7, GLASS = 8, DOOR = 9;
  const v = [];

  // auditorium body behind the fascia — landmark height
  box(2, 0, 2, 17, 13, 9, P, v);
  box(2, 0, 2, 17, 1, 9, PS, v);
  box(16, 4, 4, 17, 7, 5, GLASS, v);                 // stage-door windows
  box(2, 4, 6, 3, 7, 7, GLASS, v);
  box(7, 4, 2, 9, 7, 2, GLASS, v);
  box(11, 9, 2, 13, 11, 2, GLASS, v);                // upper back window

  // coral barrel roof (smooth arch along X, running back in Z)
  box(1, 14, 0, 18, 14, 9, CO, v);
  box(2, 15, 0, 17, 15, 9, CO, v);
  box(3, 16, 0, 16, 16, 9, CO, v);
  box(5, 17, 0, 14, 17, 9, CO, v);
  box(8, 18, 0, 11, 18, 9, COD, v);                  // crown band darker

  // marquee fascia — the tall flat theater front (2 voxels thick)
  box(1, 0, 10, 18, 20, 11, P, v);
  box(1, 0, 10, 18, 1, 11, PS, v);
  // confetti dots on the front face only
  for (let x = 1; x <= 18; x++)
    for (let y = 2; y <= 19; y++) {
      const r = hash3(x, y, 0, 73);
      if (r < 0.05) v.push([x, y, 11, GOLD]);
      else if (r < 0.10) v.push([x, y, 11, TEAL]);
    }
  // marquee board with coral frame
  box(3, 12, 11, 16, 17, 11, CO, v);
  box(4, 13, 11, 15, 16, 11, PANEL, v);
  // "quiz lights": gold/teal dashes on the panel
  [[5, 14, GOLD], [7, 14, TEAL], [9, 14, GOLD], [11, 14, TEAL], [13, 14, GOLD],
   [6, 15, TEAL], [8, 15, GOLD], [10, 15, TEAL], [12, 15, GOLD]]
    .forEach(([x, y, pi]) => v.push([x, y, 11, pi]));
  // crenellated coral cap — bunting rhythm
  box(0, 20, 10, 19, 20, 11, COD, v);
  for (let x = 1; x <= 18; x += 2) box(x, 21, 10, x, 21, 11, CO, v);

  // entrance: dark double door, gold handles, ticket window, striped awning
  box(7, 0, 11, 12, 6, 11, COD, v);
  box(8, 0, 11, 11, 5, 11, DOOR, v);
  v.push([9, 3, 12, GOLD], [10, 3, 12, GOLD]);
  box(3, 1, 11, 4, 4, 11, GLASS, v);                 // ticket booth window
  box(2, 1, 11, 2, 4, 11, CO, v);                    // its coral frame
  box(5, 1, 11, 5, 4, 11, CO, v);
  box(2, 5, 11, 5, 5, 11, CO, v);
  for (let x = 6; x <= 13; x++)
    box(x, 8, 12, x, 8, 13, (x % 2 === 0) ? CO : CREAM, v);
  for (let x = 6; x <= 13; x += 2) v.push([x, 7, 13, CO]);

  // golden "?" finial rising off the fascia cap — 2 voxels thick so it
  // reads as a solid sign from every angle
  const q = [
    [9, 29], [10, 29], [11, 29],       // top arc
    [8, 29], [8, 28], [12, 29],        // wide shoulders
    [12, 28], [12, 27],                // right side
    [11, 26], [10, 25],                // curl in
    [10, 24]                           // stem tip… then the gap…
  ];
  for (const [x, y] of q) { v.push([x, y, 10, GOLD], [x, y, 11, GOLD]); }
  v.push([10, 22, 10, GOLD], [10, 22, 11, GOLD]);    // the dot

  // weathering
  sprinkle(v, P, PS, 0.07, 71);
  sprinkle(v, CO, COD, 0.16, 72);

  return v;
}

/* ------------------------------------------------------------------ *
 *  EGG NURSERY — open incubator gazebo: cream posts, picket back,      *
 *  straw hip roof with an egg finial, three straw nests with eggs.     *
 * ------------------------------------------------------------------ */
function makeEggNursery() {
  const POST = 0, CAP = 1, RAIL = 2, STRAW = 3, STRAW_D = 4,
        SHELL = 5, LAV = 6, ORG = 7, GB = 8, STEM = 9, FLW = 10;
  const v = [];

  // picket half-walls on the two sun-side (back) runs; front stays open
  function pickets(alongX) {
    for (let i = 2; i <= 15; i++) {
      const x = alongX ? i : 2, z = alongX ? 2 : i;
      if (i % 2 === 0) {                              // picket + pointed cap
        box(x, 0, z, x + (alongX ? 0 : 1), 3, z + (alongX ? 1 : 0), POST, v);
        v.push([x, 4, z, CAP]);
        if (alongX) v.push([x, 4, z + 1, CAP]); else v.push([x + 1, 4, z, CAP]);
      }
      // rails run continuously
      box(x, 2, z, x + (alongX ? 0 : 1), 2, z + (alongX ? 1 : 0), RAIL, v);
    }
  }
  pickets(true);    // -Z run
  pickets(false);   // -X run
  box(2, 0, 2, 3, 4, 3, POST, v);                    // corner post anchors both
  box(2, 5, 2, 3, 5, 3, CAP, v);

  // small central incubator gazebo — four posts, low straw hip, egg finial;
  // most of the garden stays in open sun so the nests read
  for (const [px, pz] of [[5, 5], [11, 5], [5, 11], [11, 11]]) {
    box(px, 0, pz, px + 1, 6, pz + 1, POST, v);
    box(px, 7, pz, px + 1, 7, pz + 1, CAP, v);
  }
  box(3, 8, 3, 14, 8, 14, STRAW, v);
  box(3, 8, 3, 3, 8, 14, STRAW_D, v);                // eave board (west)
  box(14, 8, 3, 14, 8, 14, STRAW_D, v);              // eave board (east)
  box(5, 9, 5, 12, 9, 12, STRAW, v);
  box(7, 10, 7, 10, 10, 10, STRAW_D, v);
  box(8, 11, 8, 9, 12, 9, SHELL, v);                 // egg finial
  v.push([8, 12, 8, LAV], [9, 11, 9, ORG]);          // painted spots

  // three nests + spotted eggs (suno lavender, substack orange, x gray-blue)
  function nest(cx, cz, spot) {
    for (let x = cx - 2; x <= cx + 2; x++)
      for (let z = cz - 2; z <= cz + 2; z++) {
        const edge = (x === cx - 2 || x === cx + 2 || z === cz - 2 || z === cz + 2);
        const corner = (Math.abs(x - cx) === 2 && Math.abs(z - cz) === 2);
        if (edge && !corner) v.push([x, 0, z, STRAW_D]);
      }
    // egg: plus-footprint, 4 tall with a rounded crown
    for (const [x, z] of [[cx, cz], [cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]])
      v.push([x, 0, z, SHELL], [x, 1, z, SHELL]);
    v.push([cx, 2, cz, SHELL], [cx, 3, cz, SHELL]);
    v.push([cx + 1, 2, cz, spot], [cx - 1, 1, cz, spot], [cx, 2, cz + 1, spot]);
    v.push([cx + 1, 1, cz + 1, spot]);
  }
  nest(8, 8, LAV);      // suno — brooding inside the gazebo
  nest(15, 7, ORG);     // substack — out in the sun
  nest(8, 15, GB);      // x — by the open corner

  // flowers dotted around the open corner
  for (const [fx, fz] of [[13, 13], [16, 12], [16, 16]]) {
    v.push([fx, 0, fz, STEM], [fx, 1, fz, FLW]);
  }

  // weathering
  sprinkle(v, STRAW, STRAW_D, 0.18, 81);

  return v;
}

/* ------------------------------------------------------------------ */
export default {
  about_house: {
    size: [20, 29, 16],
    palette: [
      '#F3E3C6',  // 0  plaster
      '#E3CFA9',  // 1  plaster shadow-course
      '#57AD82',  // 2  mint roof (mid value — sun lifts it to true mint)
      '#448F69',  // 3  mint roof dark / shutters
      '#37795A',  // 4  ridge cap / rake boards
      '#7A5238',  // 5  door
      '#AEE6FF',  // 6  glass
      '#FFF3D6',  // 7  trim / cream flowers
      '#B54F35',  // 8  chimney brick
      '#D96A4B',  // 9  chimney crown
      '#C9A25A',  // 10 brass knob
      '#96683F',  // 11 planter box
      '#FFB88A',  // 12 peach flowers
      '#E8C592',  // 13 stoop stone
      '#4A3328'   // 14 flue soot
    ],
    voxels: dedupe(makeAboutHouse()),
    jitter: false,
    chamfer: 0.3,
    seed: 7
  },

  macrodoc: {
    size: [20, 29, 15],
    palette: [
      '#F3E3C6',  // 0  plaster
      '#E3CFA9',  // 1  shadow-course
      '#5FA8A0',  // 2  teal roof
      '#47867F',  // 3  teal roof dark
      '#3E5C58',  // 4  trim
      '#AEE6FF',  // 5  glass
      '#7A5238',  // 6  door
      '#FFF3D6',  // 7  sign board
      '#3E5C58',  // 8  antenna mast
      '#FFC08A',  // 9  beacon / knob (albedo of the doc-sign warmth)
      '#2E4660',  // 10 book navy
      '#B54F35',  // 11 book brick-red
      '#D9B872',  // 12 book straw-gold
      '#FFF3D6'   // 13 page edges
    ],
    voxels: dedupe(makeMacrodoc()),
    jitter: false,
    chamfer: 0.3,
    seed: 13
  },

  mathstreet: {
    size: [18, 31, 18],
    palette: [
      '#F3E3C6',  // 0 plaster
      '#E3CFA9',  // 1 shadow-course
      '#3E5C7A',  // 2 slate roof
      '#2E4660',  // 3 slate dark / cornice / ticker band
      '#AEE6FF',  // 4 glass
      '#C9A25A',  // 5 brass
      '#35A97F',  // 6 ▲ tick
      '#E05A4E',  // 7 ▼ tick
      '#7FE9C3'   // 8 ticker dash (albedo under the emissive stripe)
    ],
    voxels: dedupe(makeMathstreet()),
    jitter: false,
    chamfer: 0.2,
    seed: 17
  },

  mathwings: {
    size: [22, 20, 14],
    palette: [
      '#F3E3C6',  // 0 plaster
      '#E3CFA9',  // 1 shadow-course
      '#35407A',  // 2 indigo roof
      '#283060',  // 3 indigo dark / ridge
      '#FFD166',  // 4 star gold
      '#F2B33D',  // 5 cape-yellow awning
      '#AEE6FF',  // 6 glass
      '#7A5238',  // 7 door
      '#FFF3D6'   // 8 wing cream
    ],
    voxels: dedupe(makeMathwings()),
    jitter: false,
    chamfer: 0.15,
    seed: 19
  },

  funnify: {
    size: [20, 30, 14],
    palette: [
      '#F3E3C6',  // 0 plaster
      '#E3CFA9',  // 1 shadow-course
      '#FF8E72',  // 2 coral
      '#E06B52',  // 3 coral dark
      '#FFD166',  // 4 confetti gold / "?" finial
      '#7FD4D9',  // 5 confetti teal
      '#2B3440',  // 6 marquee panel
      '#FFF3D6',  // 7 cream stripe
      '#AEE6FF',  // 8 glass
      '#4A3328'   // 9 door
    ],
    voxels: dedupe(makeFunnify()),
    jitter: false,
    chamfer: 0.3,
    seed: 23
  },

  egg_nursery: {
    size: [18, 13, 18],
    palette: [
      '#F3E3C6',  // 0  posts / pickets
      '#D9A874',  // 1  post caps
      '#B9855C',  // 2  rails
      '#D9B872',  // 3  straw roof
      '#C9A25A',  // 4  straw dark / nests
      '#F5EAD2',  // 5  eggshell
      '#C9A2E8',  // 6  suno lavender spots
      '#F2A65A',  // 7  substack ink-orange spots
      '#9AB8C7',  // 8  x gray-blue spots
      '#5F9450',  // 9  flower stems
      '#FFB88A'   // 10 peach flower heads
    ],
    voxels: dedupe(makeEggNursery()),
    jitter: false,
    chamfer: 0.35,
    seed: 29
  }
};
