/* ============================================================================
   YOONKI WORLD 3D — characters, creatures & eggs
   Read docs/VOXEL_FORMAT.md FIRST. Palette values come from docs/ART_BIBLE.md
   §2.5 (characters) + §7.3 (build specs). Creature shapes match their 2D
   counterparts in images/game/creatures/*.png.

   Characters are chunky ~1.75-tile bigheads (head ≈ 45% of height).
   The player rig is exported SEGMENTED (player_head / player_torso /
   player_arm_l / player_arm_r / player_leg_l / player_leg_r / player_pack /
   player_scarf) so scripts/game3d/actors.js can run a real walk cycle —
   opposite arm/leg swing, torso lean, head bob, scarf-tail flutter.
   Camera looks in from +X/+Z, so all faces/details live on the high-z side.
   ========================================================================== */

import { box, dedupe } from '../voxel.js';

/** Remove voxels at the given (x,z) columns within [y0..y1] — model-level
 *  corner chamfer (art bible §5.3.3): knocking the vertical corner columns
 *  off a head mass turns the raw cube into the rounded-chunky Pokopia read.
 *  Applied AFTER dedupe-order assembly via filter, so details are safe. */
function cutColumns(v, cols, y0, y1) {
  const cut = new Set();
  for (const [cx, cz] of cols)
    for (let y = y0; y <= y1; y++) cut.add(cx + '|' + y + '|' + cz);
  return v.filter(vx => !cut.has(vx[0] + '|' + vx[1] + '|' + vx[2]));
}

/* ------------------------------------------------------------------ *
 *  HUMAN RIG — chunky voxel adventurer (2026-07 redesign).             *
 *  Grid: x 0..9, z 0..9, y 0..13. Face on +Z. Sun hits (-X,-Z).        *
 *  SEGMENTED for the walk cycle: every part lives on the ONE shared    *
 *  grid, so 'corner'-origin part meshes reassemble exactly in-game.    *
 *  Parts NEVER share a voxel cell — coincident faces between separate  *
 *  meshes z-fight. Pivot contract (actors.js PLAYER_PARTS): hips at    *
 *  y3, shoulders y6, neck y7, scarf-tail root y7/z0.5.                 *
 * ------------------------------------------------------------------ */
function humanLeg(C, x0) {
  const v = [];
  box(x0, 0, 4, x0 + 1, 0, 6, C.BOOT_DK, v);              // sole
  v.push([x0, 0, 7, C.BOOT], [x0 + 1, 0, 7, C.BOOT]);     // toe caps
  box(x0, 1, 4, x0 + 1, 1, 6, C.BOOT, v);                 // boot upper
  box(x0, 2, 4, x0 + 1, 2, 6, C.SKIN, v);                 // bare knee
  return v;
}

function humanArm(C, x) {
  const v = [];
  box(x, 5, 4, x, 5, 5, C.SHIRT, v);                      // short sleeve
  box(x, 3, 4, x, 4, 5, C.SKIN, v);                       // arm + hand
  return v;
}

function humanTorso(C, o) {
  const v = [];
  box(2, 3, 3, 7, 3, 6, C.SHORTS, v);                     // shorts (hip row)
  v.push([2, 3, 6, C.SHORTS_DK], [7, 3, 6, C.SHORTS_DK]); // front hem creases
  box(2, 4, 3, 7, 5, 6, C.SHIRT, v);                      // warm cream shirt
  v.push([4, 4, 6, C.SHIRT_SH], [5, 4, 6, C.SHIRT_SH]);   // untucked hem
  if (o.pack) {
    box(3, 4, 6, 3, 5, 6, C.PACK_DK, v);                  // backpack straps
    box(6, 4, 6, 6, 5, 6, C.PACK_DK, v);                  // down the chest
  }
  // chunky teal scarf: full wrap ring poking 1 voxel past the torso, plus
  // x1/x8 shoulder caps — the caps also hide the arm pivots mid-swing
  box(2, 6, 2, 7, 6, 7, C.SCARF, v);
  box(1, 6, 4, 1, 6, 5, C.SCARF, v);
  box(8, 6, 4, 8, 6, 5, C.SCARF, v);
  v.push([4, 5, 7, C.SCARF], [5, 5, 7, C.SCARF_HI]);      // knot on the chest
  v.push([2, 6, 7, C.SCARF_HI], [7, 6, 3, C.SCARF_HI]);   // fold highlights
  return v;
}

function humanPack(C) {
  const v = [];
  box(3, 4, 1, 6, 5, 2, C.PACK, v);                       // main bag
  box(3, 6, 1, 6, 6, 1, C.PACK_DK, v);                    // rolled top flap
  v.push([4, 4, 0, C.PACK_DK]);                           // buckle
  return v;
}

// Short scarf tail hanging down the back (z0, behind the pack) — its own
// segment so actors.js can flutter it on a rotation spring.
function humanScarfTail(C) {
  return [[5, 6, 0, C.SCARF], [5, 5, 0, C.SCARF],
          [5, 4, 0, C.SCARF], [5, 3, 0, C.SCARF_HI]];
}

function humanHead(C, o) {
  const v = [];
  box(1, 7, 2, 8, 10, 7, C.SKIN, v);       // big head core (8 wide, face z7)
  box(1, 11, 2, 8, 12, 7, C.HAIR, v);      // hair mass (filter rounds it)
  box(1, 7, 2, 8, 10, 2, C.HAIR, v);       // hair down the back
  box(1, 8, 2, 1, 10, 4, C.HAIR, v);       // hair over the ears, both sides
  box(8, 8, 2, 8, 10, 4, C.HAIR, v);
  for (const x of o.fringe) v.push([x, 10, 7, C.HAIR]);   // uneven bangs

  // chunky 2x2 glasses (identity): dark rimless lenses doubling as the
  // eyes, pale glint in the top-outer corners, temple arms into the hair
  v.push(
    [2, 9, 7, C.LENS], [3, 9, 7, C.FRAME], [2, 8, 7, C.FRAME], [3, 8, 7, C.FRAME],
    [6, 9, 7, C.FRAME], [7, 9, 7, C.LENS], [6, 8, 7, C.FRAME], [7, 8, 7, C.FRAME],
    [1, 9, 7, C.FRAME], [8, 9, 7, C.FRAME]
  );
  v.push([o.mouthX, 7, 7, C.MOUTH]);                       // tiny mouth
  v.push([1, 8, 7, C.BLUSH], [8, 8, 7, C.BLUSH]);          // cheeks
  // messy blocky tufts: crown (y13) + sides (y11, poking past the mass)
  for (const [tx, ty, tz] of o.tufts) v.push([tx, ty, tz, C.HAIR]);

  // sheen bands: a lighter stripe across the crown plateau + one across the
  // upper back of the hair, so the rear silhouette has form (the camera
  // co-stars the player's back in every encounter — never a flat void)
  for (let x = 3; x <= 6; x++) v.push([x, 12, 4, C.SHEEN]);
  for (let x = 2; x <= 7; x++) v.push([x, 9, 2, C.SHEEN]);

  // rounded-chunky silhouette (art bible §5.3.3, model-level): full octagon
  // at y10/y11 (corner columns knocked off), 1-voxel-inset rounded plateau
  // at y12, tufts free at y13. Back head corners taper from y9.
  return v.filter(([x, y, z]) => {
    if (y === 13) return true;                             // crown tufts
    if (y === 12)
      return x >= 2 && x <= 7 && z >= 3 && z <= 6 &&
             !((x === 2 || x === 7) && (z === 3 || z === 6));
    if (y === 11 || y === 10)
      return x === 0 || x === 9 ||                         // side tufts
             !((x === 1 || x === 8) && (z === 2 || z === 7));
    if (y === 9) return !((x === 1 || x === 8) && z === 2);
    return true;
  });
}

// Shared palette-index map (player + NPC use the same builder).
const HUMAN_C = {
  SHIRT: 0, SHIRT_SH: 1, SHORTS: 2, SHORTS_DK: 3, BOOT: 4, BOOT_DK: 5,
  SKIN: 6, HAIR: 7, SHEEN: 8, SCARF: 9, SCARF_HI: 10,
  LENS: 11, FRAME: 12, MOUTH: 13, BLUSH: 14, PACK: 15, PACK_DK: 16
};

// PLAYER — cream shirt, teal scarf, brown backpack, khaki shorts, brown
// boots, glasses + near-black navy hair (identity: still reads as Yoonki;
// never pure black — the back of this head fills every encounter shot).
const PLAYER_PAL = [
  '#F2E3C2',   // 0 shirt — warm cream
  '#E3CFA3',   // 1 shirt shade (hem)
  '#9BA05E',   // 2 shorts — khaki olive
  '#7F8449',   // 3 shorts hem crease
  '#7A5238',   // 4 boots — warm brown
  '#5F3E2A',   // 5 boot soles
  '#FFD9B3',   // 6 skin
  '#262E44',   // 7 hair — near-black navy
  '#3E4C6E',   // 8 hair sheen band
  '#3A9EC9',   // 9 scarf — teal blue
  '#5BC8DC',   // 10 scarf folds / tail tip
  '#AEE6FF',   // 11 glasses lens glint
  '#1A1A22',   // 12 glasses frame / eyes
  '#E8A87A',   // 13 mouth
  '#FFB88A',   // 14 blush
  '#B07A4E',   // 15 backpack
  '#8A5A3C'    // 16 pack flap / straps / buckle
];
const playerParts = {
  head: humanHead(HUMAN_C, {
    fringe: [2, 3, 5, 7], mouthX: 4,
    tufts: [[2, 13, 4], [4, 13, 3], [6, 13, 5], [7, 13, 4],
            [0, 11, 4], [9, 11, 3]]
  }),
  torso: humanTorso(HUMAN_C, { pack: true }),
  arm_l: humanArm(HUMAN_C, 1),
  arm_r: humanArm(HUMAN_C, 8),
  leg_l: humanLeg(HUMAN_C, 2),
  leg_r: humanLeg(HUMAN_C, 6),
  pack: humanPack(HUMAN_C),
  scarf: humanScarfTail(HUMAN_C)
};

// NPC YOONKI — same rig, mustard shirt, coral scarf, warm brown hair, NO
// backpack: the host must read as a DIFFERENT person at a glance.
const NPC_PAL = [
  '#D9A23E',   // 0 shirt — mustard
  '#C08A2E',   // 1 shirt shade
  '#9BA05E',   // 2 shorts — khaki olive
  '#7F8449',   // 3 shorts hem crease
  '#7A5238',   // 4 boots
  '#5F3E2A',   // 5 boot soles
  '#FFD9B3',   // 6 skin
  '#6B4A2F',   // 7 hair — warm brown
  '#8A6647',   // 8 hair sheen band
  '#E05A4E',   // 9 scarf — coral red
  '#F08A7E',   // 10 scarf folds / tail tip
  '#AEE6FF',   // 11 lens glint
  '#1A1A22',   // 12 frame / eyes
  '#E8A87A',   // 13 mouth
  '#FFB88A',   // 14 blush
  '#B07A4E',   // 15 (unused — no pack)
  '#8A5A3C'    // 16 (unused)
];
const npcV = [].concat(
  humanHead(HUMAN_C, {
    fringe: [3, 4, 6], mouthX: 5,
    tufts: [[3, 13, 5], [5, 13, 3], [7, 13, 5], [0, 11, 3], [9, 11, 4]]
  }),
  humanTorso(HUMAN_C, { pack: false }),
  humanArm(HUMAN_C, 1), humanArm(HUMAN_C, 8),
  humanLeg(HUMAN_C, 2), humanLeg(HUMAN_C, 6),
  humanScarfTail(HUMAN_C));

/* ------------------------------------------------------------------ *
 *  MACRODOC — robot-doc spirit: cream body, CRT-monitor head with a    *
 *  mint smiley screen, antenna, teal tie, one arm waving.              *
 * ------------------------------------------------------------------ */
function makeMacrodoc() {
  const BODY = 0, CASE = 1, SCREEN = 2, FACE = 3, TIE = 4, PANTS = 5, CREAM = 6;
  const v = [];
  // feet + baggy pants
  box(3, 0, 4, 4, 1, 6, PANTS, v);
  box(7, 0, 4, 8, 1, 6, PANTS, v);
  box(3, 2, 3, 8, 2, 7, PANTS, v);
  // chubby paper-cream body (corner-cut union)
  box(3, 3, 2, 8, 5, 8, BODY, v);
  box(2, 3, 3, 9, 5, 7, BODY, v);
  box(3, 6, 3, 8, 6, 7, BODY, v);            // shoulders
  // teal tie hanging on the chest (front z8), tip flicked to one side
  box(5, 4, 8, 6, 5, 8, TIE, v);
  v.push([5, 3, 8, TIE], [6, 3, 8, TIE], [6, 2, 8, TIE]);
  // right arm hangs; left arm raised waving beside the monitor
  box(1, 3, 4, 1, 5, 5, BODY, v);
  box(10, 4, 4, 10, 6, 5, BODY, v);
  v.push([10, 7, 4, BODY], [10, 7, 5, BODY]);
  // CRT monitor head (slightly lighter casing than the body)
  box(2, 7, 2, 9, 12, 8, CASE, v);
  // mint screen with dark smiley
  box(3, 8, 8, 8, 11, 8, SCREEN, v);
  v.push([4, 10, 8, FACE], [7, 10, 8, FACE]);                 // eyes
  v.push([4, 9, 8, FACE], [5, 8, 8, FACE], [6, 8, 8, FACE], [7, 9, 8, FACE]); // smile
  v.push([3, 11, 8, CREAM], [4, 11, 8, CREAM]);   // screen glint = head highlights
  // antenna: stalk + warm cream bobble
  v.push([5, 13, 5, PANTS], [5, 14, 5, CREAM]);
  // rounded-chunky monitor: corner columns knocked off the casing
  // (screen at x3..8 z8 is untouched), top row inset to a rounded
  // plateau so the crown reads as a clean 2-step dome
  const out = cutColumns(v, [[2, 2], [9, 2], [2, 8], [9, 8]], 8, 11);
  return out.filter(([x, y, z]) => {
    if (y !== 12) return true;
    return x >= 3 && x <= 8 && z >= 3 && z <= 7 &&
           !((x === 3 || x === 8) && (z === 3 || z === 7));
  });
}

/* ------------------------------------------------------------------ *
 *  MATHSTREET — bull-market bull: deep green quadruped, gold muzzle,   *
 *  cream horns, navy hooves, tail ending in a gold up-arrow.           *
 * ------------------------------------------------------------------ */
function makeMathstreet() {
  const GRN = 0, HI = 1, DK = 2, GOLD = 3, HORN = 4, DARK = 5, HOOF = 6, CREAM = 7;
  const v = [];
  // four legs: navy hoof + dark green shank (front pair under the chin)
  for (const [lx, lz] of [[2, 3], [8, 3], [2, 9], [8, 9]]) {
    box(lx, 0, lz, lx + 1, 0, lz + 1, HOOF, v);
    box(lx, 1, lz, lx + 1, 1, lz + 1, DK, v);
  }
  // barrel body (corner-cut union), lighter along the spine
  box(2, 2, 3, 9, 2, 8, GRN, v);
  box(3, 2, 9, 8, 2, 10, GRN, v);            // chest shelf tying head to legs
  box(3, 3, 2, 8, 5, 9, GRN, v);
  box(2, 3, 3, 9, 5, 8, GRN, v);
  box(3, 6, 3, 8, 6, 8, HI, v);
  box(3, 7, 6, 8, 7, 8, HI, v);              // shoulder hump under the head
  // sparse dark "plaid" flecks on the flanks (asymmetric)
  v.push([2, 4, 4, DK], [2, 3, 6, DK], [9, 4, 7, DK],
         [9, 3, 4, DK], [3, 6, 4, DK], [7, 6, 7, DK]);
  // big head hanging over the chest, face at z13
  box(3, 3, 10, 8, 8, 13, GRN, v);
  box(2, 4, 10, 9, 7, 13, GRN, v);           // wide cheeks
  box(3, 8, 10, 8, 8, 12, HI, v);            // crown
  // gold muzzle + nostrils
  box(3, 3, 13, 8, 4, 13, GOLD, v);
  v.push([4, 4, 13, DARK], [7, 4, 13, DARK]);
  // tall dark eyes
  v.push([3, 5, 13, DARK], [3, 6, 13, DARK], [8, 5, 13, DARK], [8, 6, 13, DARK]);
  // forelock tuft (off-center)
  v.push([4, 8, 13, DK], [5, 8, 13, DK]);
  // horns curving out then up — right one a step taller (asymmetry)
  v.push([1, 7, 11, HORN], [1, 8, 11, HORN], [0, 8, 11, HORN]);
  v.push([10, 7, 11, HORN], [10, 8, 11, HORN], [11, 8, 11, HORN], [11, 9, 11, HORN]);
  // ears under the horns
  v.push([1, 6, 12, DK], [10, 6, 12, DK]);
  // tail rising behind, tipped with a gold up-arrow
  v.push([6, 4, 1, DK], [6, 5, 1, DK], [6, 6, 1, DK], [6, 7, 1, DK]);
  v.push([5, 8, 1, GOLD], [6, 8, 1, GOLD], [7, 8, 1, GOLD], [6, 9, 1, GOLD]);
  // the two crisp cream head highlights (art bible §2.5)
  v.push([5, 8, 10, CREAM], [6, 8, 10, CREAM]);
  // rounded head: knock the wide-cheek corner columns + crown corners off
  let out = cutColumns(v, [[2, 10], [9, 10], [2, 13], [9, 13]], 4, 7);
  out = cutColumns(out, [[3, 10], [8, 10], [3, 12], [8, 12]], 8, 8);
  return out;
}

/* ------------------------------------------------------------------ *
 *  MATHWINGS — round navy owl: huge cream eyes, gold beak & talons,    *
 *  gold wings, red cape trailing behind, "7" on the belly.             *
 * ------------------------------------------------------------------ */
function makeMathwings() {
  const NAVY = 0, DK = 1, CREAM = 2, PUPIL = 3, GOLD = 4, WING = 5, CAPE = 6, BELLY = 7;
  const v = [];
  // talons (toes forward) + short legs
  box(4, 0, 5, 5, 0, 8, GOLD, v);
  box(8, 0, 5, 9, 0, 8, GOLD, v);
  box(4, 1, 5, 5, 1, 6, GOLD, v);
  box(8, 1, 5, 9, 1, 6, GOLD, v);
  // egg-round body (head merged, owl style)
  box(4, 2, 4, 9, 2, 7, NAVY, v);
  box(4, 3, 3, 9, 8, 8, NAVY, v);
  box(3, 3, 4, 10, 8, 7, NAVY, v);
  box(3, 6, 8, 10, 8, 8, NAVY, v);           // flat facial disc
  box(4, 9, 4, 9, 9, 7, NAVY, v);
  box(5, 10, 4, 8, 10, 7, NAVY, v);
  // huge cream eyes with inward pupils
  box(3, 6, 8, 5, 8, 8, CREAM, v);
  box(8, 6, 8, 10, 8, 8, CREAM, v);
  v.push([4, 7, 8, PUPIL], [9, 7, 8, PUPIL]);
  // gold beak between the eyes, tip poking out one voxel
  v.push([6, 6, 8, GOLD], [7, 6, 8, GOLD], [6, 7, 8, GOLD], [7, 7, 8, GOLD]);
  v.push([6, 6, 9, GOLD]);
  // pale belly patch carrying a dark "7"
  box(4, 3, 8, 9, 5, 8, BELLY, v);
  v.push([5, 5, 8, PUPIL], [6, 5, 8, PUPIL], [7, 5, 8, PUPIL],
         [7, 4, 8, PUPIL], [6, 3, 8, PUPIL]);
  // gold wings stepping up and out, right one flared higher (asymmetry)
  box(2, 4, 4, 2, 6, 6, WING, v);
  box(1, 6, 4, 1, 8, 5, WING, v);
  v.push([0, 8, 4, WING]);
  box(11, 4, 4, 11, 6, 6, WING, v);
  box(12, 6, 4, 12, 8, 5, WING, v);
  v.push([13, 8, 4, WING], [13, 9, 4, WING]);
  // red cape: shoulder collar + back slab (bottom corner clipped) +
  // trailing 2 voxels (§7.3)
  box(4, 4, 2, 9, 9, 2, CAPE, v);
  box(5, 3, 2, 9, 3, 2, CAPE, v);
  box(4, 9, 3, 9, 9, 3, CAPE, v);
  v.push([8, 3, 1, CAPE], [9, 3, 1, CAPE], [10, 3, 2, CAPE]);
  // stubby ear tufts at the crown corners — right one taller
  v.push([4, 10, 4, DK], [4, 10, 5, DK], [4, 11, 4, DK]);
  v.push([9, 10, 4, DK], [9, 10, 5, DK], [9, 11, 4, DK], [9, 11, 5, DK]);
  // two crisp cream head highlights
  v.push([6, 10, 4, CREAM], [7, 10, 4, CREAM]);
  return v;
}

/* ------------------------------------------------------------------ *
 *  FUNNIFY — chubby golden hamster: cream face & belly, big round      *
 *  ears, coral nose, a held flash-card, lightning-bolt tail.           *
 * ------------------------------------------------------------------ */
function makeFunnify() {
  const GOLD = 0, PAW = 1, CREAM = 2, BROWN = 3, EYE = 4, CORAL = 5, BOLT = 6;
  const v = [];
  // pear body (fat at the bottom, corner-cut unions)
  box(4, 0, 3, 9, 0, 8, GOLD, v);
  box(4, 1, 2, 9, 4, 9, GOLD, v);
  box(3, 1, 3, 10, 4, 8, GOLD, v);
  box(4, 5, 3, 9, 6, 8, GOLD, v);
  box(3, 5, 4, 10, 6, 7, GOLD, v);
  box(4, 7, 4, 9, 7, 7, GOLD, v);
  box(4, 8, 4, 9, 8, 7, GOLD, v);
  box(5, 9, 4, 8, 9, 7, GOLD, v);
  // cream belly (gold frame kept around it) + cream face band
  box(5, 1, 9, 8, 3, 9, CREAM, v);
  box(4, 5, 8, 9, 6, 8, CREAM, v);
  // dark eyes, little brown nose + coral blush under the outer eye corners
  v.push([5, 6, 8, EYE], [8, 6, 8, EYE]);
  v.push([6, 5, 8, BROWN]);
  v.push([4, 5, 8, CORAL], [9, 5, 8, CORAL]);
  // big round ears, brown inner, right ear a step taller (asymmetry)
  box(2, 9, 5, 4, 11, 6, GOLD, v);
  v.push([3, 10, 6, BROWN]);
  box(9, 9, 5, 11, 12, 6, GOLD, v);
  v.push([10, 10, 6, BROWN], [10, 11, 6, BROWN]);
  // toes peeking out the front
  v.push([4, 0, 9, PAW], [5, 0, 9, PAW], [8, 0, 9, PAW], [9, 0, 9, PAW]);
  // right paw resting on the belly; left arm up holding a small flash-card
  v.push([9, 2, 10, PAW]);
  v.push([4, 3, 10, PAW], [3, 4, 10, PAW]);
  box(2, 4, 9, 2, 6, 10, CREAM, v);                     // the card
  v.push([2, 5, 9, CORAL], [2, 4, 10, CORAL]);          // scribbles on it
  // lightning-bolt tail zigzagging up behind
  v.push([8, 3, 1, BOLT], [8, 4, 1, BOLT], [9, 4, 1, BOLT],
         [9, 5, 1, BOLT], [9, 6, 1, BOLT], [8, 6, 1, BOLT], [8, 7, 1, BOLT]);
  // two crisp cream head highlights
  v.push([5, 9, 4, CREAM], [6, 9, 4, CREAM]);
  return v;
}

/* ------------------------------------------------------------------ *
 *  LASTHAND — golden hand creature: open "paper" palm, chunky boxy    *
 *  fingers, a face on the palm, little feet on the wrist base.        *
 *  (Voxel fallback for the authored lasthand.glb — same silhouette.)  *
 * ------------------------------------------------------------------ */
function makeLasthand() {
  const GOLD = 0, DK = 1, CREAM = 2, INK = 3, CORAL = 4, FOOT = 5;
  const v = [];
  // wrist base (darker cuff) with little feet peeking out the front
  box(4, 0, 1, 8, 2, 3, DK, v);
  v.push([4, 0, 4, FOOT], [5, 0, 4, FOOT], [7, 0, 4, FOOT], [8, 0, 4, FOOT]);
  // open palm slab — 9 wide, 3 deep, face side at +Z
  box(2, 3, 1, 10, 9, 3, GOLD, v);
  // thumb sweeping out on the left, one step lower than the fingers
  box(0, 5, 1, 1, 7, 3, GOLD, v);
  v.push([0, 8, 2, GOLD], [1, 8, 2, GOLD]);
  // three chunky fingers, staggered heights (middle tallest — "paper")
  box(2, 10, 1, 3, 11, 3, GOLD, v);              // index
  box(5, 10, 1, 6, 13, 3, GOLD, v);              // middle
  box(8, 10, 1, 9, 11, 3, GOLD, v);              // pinky (shortest)
  v.push([8, 12, 2, GOLD], [9, 12, 2, GOLD]);
  // cream palm patch = the face plate
  box(3, 4, 3, 9, 8, 3, CREAM, v);
  // face painted proud of the palm: big happy eyes + smile + blush
  v.push([4, 7, 4, INK], [8, 7, 4, INK]);
  v.push([4, 5, 4, CORAL], [8, 5, 4, CORAL]);    // cheeks
  v.push([5, 4, 4, INK], [6, 4, 4, INK], [7, 4, 4, INK]);   // smile
  v.push([6, 5, 4, INK]);                        // open-smile center
  // two crisp cream highlights on the middle fingertip
  v.push([5, 13, 3, CREAM], [6, 13, 3, CREAM]);
  // round the palm: knock the corner columns off
  let out = cutColumns(v, [[2, 1], [10, 1], [2, 3], [10, 3]], 3, 4);
  out = cutColumns(out, [[2, 1], [10, 1]], 8, 9);
  return out;
}

/* ------------------------------------------------------------------ *
 *  SPOTTED EGG — nursery egg, sage-green spots like the 2D sprite.     *
 * ------------------------------------------------------------------ */
function makeEgg() {
  const SHELL = 0, SPOT = 1;
  const v = [];
  // even-grid egg (6 voxels wide at the belt) — every step is at least
  // 2 voxels long, so the silhouette reads round instead of knobbly
  const ring = (y0, y1, lo, hi) => {   // square with the corners knocked off
    box(lo, y0, lo + 1, hi, y1, hi - 1, SHELL, v);
    box(lo + 1, y0, lo, hi - 1, y1, hi, SHELL, v);
  };
  ring(0, 0, 1, 4);                    // 4x4- base
  ring(1, 3, 0, 5);                    // 6x6- belt, three rows
  box(1, 4, 1, 4, 4, 4, SHELL, v);     // 4x4 shoulder
  ring(5, 5, 1, 4);                    // 4x4- neck
  box(2, 6, 2, 3, 6, 3, SHELL, v);     // 2x2 tip
  // asymmetric sage spots painted onto surface cells
  v.push([0, 2, 3, SPOT], [0, 3, 3, SPOT],      // west pair
         [4, 3, 5, SPOT], [4, 2, 5, SPOT],      // front-right pair
         [5, 2, 2, SPOT],                       // east
         [1, 4, 1, SPOT],                       // on the shoulder
         [4, 1, 0, SPOT]);                      // low back
  return v;
}

/* ------------------------------------------------------------------ */
// sunRim off for the humans: the painted warm rim turns near-black hair
// tops into clay-brown patches (worst on the rounded corner cuts). Their
// charm comes from AO + chamfer + face details instead.
function humanSeg(palette, voxels) {
  return {
    size: [10, 14, 10],
    palette,
    voxels: dedupe(voxels),
    jitter: false,
    chamfer: 0.25,
    sunRim: false
  };
}

export default {
  // full assembly (viewer + safe fallback if any segment goes missing)
  player: humanSeg(PLAYER_PAL, Object.values(playerParts).flat()),
  // segments — one per animated group in the actors.js walk-cycle rig
  player_head: humanSeg(PLAYER_PAL, playerParts.head),
  player_torso: humanSeg(PLAYER_PAL, playerParts.torso),
  player_arm_l: humanSeg(PLAYER_PAL, playerParts.arm_l),
  player_arm_r: humanSeg(PLAYER_PAL, playerParts.arm_r),
  player_leg_l: humanSeg(PLAYER_PAL, playerParts.leg_l),
  player_leg_r: humanSeg(PLAYER_PAL, playerParts.leg_r),
  player_pack: humanSeg(PLAYER_PAL, playerParts.pack),
  player_scarf: humanSeg(PLAYER_PAL, playerParts.scarf),
  npc_yoonki: humanSeg(NPC_PAL, npcV),

  creature_macrodoc: {
    size: [12, 15, 9],
    palette: [
      '#D8D3C8',   // 0 paper-gray body
      '#E9E3D3',   // 1 monitor casing (a shade lighter)
      '#BFE3C9',   // 2 mint screen
      '#2B3440',   // 3 screen face (panel ink)
      '#47867F',   // 4 teal tie
      '#3E5C58',   // 5 pants / antenna stalk (macrodoc trim)
      '#FFF3D6'    // 6 cream glints + antenna bobble
    ],
    voxels: dedupe(makeMacrodoc()),
    jitter: false,
    chamfer: 0.2
  },

  creature_mathstreet: {
    size: [12, 10, 14],
    palette: [
      '#2F7550',   // 0 bull green
      '#3F8F5F',   // 1 spine/crown highlight
      '#235C40',   // 2 dark green (shanks, tail, flecks)
      '#FFC048',   // 3 gold muzzle + arrow tail (mathstreet gold)
      '#F5EAD2',   // 4 horns
      '#2B2B33',   // 5 eyes / nostrils
      '#2E4660',   // 6 navy hooves (mathstreet suit-navy)
      '#FFF3D6'    // 7 head highlights
    ],
    voxels: dedupe(makeMathstreet()),
    jitter: false,
    chamfer: 0.3
  },

  creature_mathwings: {
    size: [14, 12, 10],
    palette: [
      '#35407A',   // 0 midnight-indigo body (mathwings house color)
      '#283060',   // 1 dark indigo brow tufts
      '#FFF3D6',   // 2 cream eyes + highlights
      '#2B2B33',   // 3 pupils / the "7"
      '#F2B33D',   // 4 beak + talons (cape-yellow)
      '#FFC048',   // 5 wings
      '#E05A4E',   // 6 red cape
      '#6FB8E8'    // 7 sky-blue belly patch
    ],
    voxels: dedupe(makeMathwings()),
    jitter: false,
    chamfer: 0.3
  },

  creature_funnify: {
    size: [14, 13, 11],
    palette: [
      '#F2B33D',   // 0 golden fur
      '#E8935C',   // 1 paws / toes
      '#FFF3D6',   // 2 cream belly, face, card
      '#7A5238',   // 3 inner ear
      '#2B2B33',   // 4 eyes
      '#FF8E72',   // 5 coral nose, blush, card scribbles (funnify coral)
      '#FFC048'    // 6 lightning-bolt tail
    ],
    voxels: dedupe(makeFunnify()),
    jitter: false,
    chamfer: 0.3
  },

  creature_lasthand: {
    size: [12, 14, 5],
    palette: [
      '#FFC048',   // 0 buttercup-gold palm (lasthand gold)
      '#D9A32E',   // 1 dark gold wrist cuff
      '#FFF3D6',   // 2 cream face plate + highlights
      '#2B2B33',   // 3 eyes / smile
      '#FF8E72',   // 4 coral cheeks
      '#7A5238'    // 5 little feet
    ],
    voxels: dedupe(makeLasthand()),
    jitter: false,
    chamfer: 0.3
  },

  egg_spotted: {
    size: [6, 7, 6],
    palette: [
      '#F5EAD2',   // 0 shell
      '#AFC68B'    // 1 sage spots (matches the 2D sprite)
    ],
    voxels: dedupe(makeEgg()),
    jitter: { value: 0.03, hue: 3 },   // gentle shell speckle
    chamfer: 0.12,
    seed: 7
  }
};
