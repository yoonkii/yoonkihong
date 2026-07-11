/* ============================================================================
   YOONKI WORLD 3D — house interior models (Link's-house career room)
   Read docs/VOXEL_FORMAT.md FIRST. Used only by scripts/game3d/interior.js
   (the scene behind the About-house door). Everything here is voxels —
   including the three company-logo plaques (NO text textures, per spec).

   Camera looks in from +X/+Z (same 45°/35° quarter rig as the overworld),
   so the room keeps its north (-Z) and west (-X) walls tall and drops the
   camera-side walls to knee height — a cutaway diorama. The door gap sits
   in the south knee wall (the About-house door faces +Z outside too).

   Grid: 1 voxel = 0.125 wu. Room shell is 72 x 52 voxels = 9 x 6.5 wu.
   ========================================================================== */

import { box, dedupe, hash3 } from '../voxel.js';

/* ------------------------------------------------------------------ *
 *  ROOM SHELL — plank floor, wainscot + plaster walls, timber beams,   *
 *  knee walls with a framed door gap, woven rug.                       *
 * ------------------------------------------------------------------ */
const RW = 72, RD = 52;                     // room grid (9 x 6.5 wu)
const DOOR_X0 = 32, DOOR_X1 = 41;           // door gap in the south knee wall

function makeRoom() {
  const FLOOR_A = 0, FLOOR_B = 1, SEAM = 2, WAIN = 3, PLASTER = 4,
        TIMBER = 5, RUG = 6, RUG_B = 7;
  const v = [];

  // plank floor: boards run along X in 4-voxel courses, butt joints
  // staggered per course, occasional worn plank
  for (let z = 0; z < RD; z++) {
    const course = z >> 2;
    for (let x = 0; x < RW; x++) {
      let pi = course % 2 ? FLOOR_B : FLOOR_A;
      if (z % 4 === 3) pi = SEAM;                          // course seam
      else if ((x + course * 7) % 16 === 15) pi = SEAM;    // butt joint
      else if (hash3(x, 0, z, 17) < 0.05) pi = FLOOR_B;    // worn board
      v.push([x, 0, z, pi]);
    }
  }

  // tall walls: north (-Z) + west (-X). Wood wainscot below, warm plaster
  // above, timber baseboard / chair rail / top plate.
  box(0, 1, 0, RW - 1, 26, 1, WAIN, v);
  box(0, 11, 0, RW - 1, 26, 1, PLASTER, v);
  box(0, 1, 0, RW - 1, 1, 1, TIMBER, v);
  box(0, 10, 0, RW - 1, 10, 1, TIMBER, v);
  box(0, 26, 0, RW - 1, 26, 1, TIMBER, v);
  box(0, 1, 0, 1, 26, RD - 1, WAIN, v);
  box(0, 11, 0, 1, 26, RD - 1, PLASTER, v);
  box(0, 1, 0, 1, 1, RD - 1, TIMBER, v);
  box(0, 10, 0, 1, 10, RD - 1, TIMBER, v);
  box(0, 26, 0, 1, 26, RD - 1, TIMBER, v);
  // proud timber studs on the inner faces (clear of the plaque mounts)
  for (const x of [8, 26, 44, 62]) box(x, 1, 2, x + 1, 26, 2, TIMBER, v);
  for (const z of [14, 30, 44]) box(2, 1, z, 2, 26, z + 1, TIMBER, v);

  // knee walls on the camera sides (+Z / +X), timber-capped
  box(0, 1, RD - 2, DOOR_X0 - 3, 4, RD - 1, WAIN, v);
  box(DOOR_X1 + 3, 1, RD - 2, RW - 1, 4, RD - 1, WAIN, v);
  box(0, 5, RD - 2, DOOR_X0 - 3, 5, RD - 1, TIMBER, v);
  box(DOOR_X1 + 3, 5, RD - 2, RW - 1, 5, RD - 1, TIMBER, v);
  box(RW - 2, 1, 0, RW - 1, 4, RD - 1, WAIN, v);
  box(RW - 2, 5, 0, RW - 1, 5, RD - 1, TIMBER, v);
  // tall SE corner post frames the cutaway
  box(RW - 2, 1, RD - 2, RW - 1, 26, RD - 1, TIMBER, v);

  // door frame: posts + lintel around the gap (tall enough for the player)
  box(DOOR_X0 - 2, 1, RD - 2, DOOR_X0 - 1, 13, RD - 1, TIMBER, v);
  box(DOOR_X1 + 1, 1, RD - 2, DOOR_X1 + 2, 13, RD - 1, TIMBER, v);
  box(DOOR_X0 - 2, 13, RD - 2, DOOR_X1 + 2, 14, RD - 1, TIMBER, v);

  // ceiling beam spanning X (open top — the camera looks straight in).
  // There used to be a second beam at z 12-13 (1.5-1.75 wu): from the fixed
  // quarter camera it projected EXACTLY across the plaque logos (band
  // y 1.86-2.11 on the z 0.6 wall plane — measured 2026-07-10 after a user
  // report of hidden logos). Nothing hangs from it since the lanterns moved
  // to this mid-room beam, so it is gone rather than dodged.
  box(0, 24, 32, RW - 1, 25, 33, TIMBER, v);

  // woven rug mid-room (1 voxel proud of the floor, corners knocked off)
  for (let x = 26; x <= 45; x++)
    for (let z = 24; z <= 37; z++) {
      const ex = x === 26 || x === 45, ez = z === 24 || z === 37;
      if (ex && ez) continue;
      v.push([x, 1, z, (ex || ez) ? RUG_B : RUG]);
    }

  return v;
}

/* ------------------------------------------------------------------ *
 *  CAREER PLAQUES — dark vertical display boards (Zelda weapon-mount   *
 *  style), each carrying a voxel-built logo. Boards are 12 x 16 x 3    *
 *  voxels (1.5 x 2.0 x 0.375 wu), logo proud of the board face (+Z).   *
 * ------------------------------------------------------------------ */
function plaqueBoard(v, BOARD, TRIM) {
  box(0, 0, 0, 11, 15, 0, BOARD, v);                 // backboard
  box(0, 0, 1, 11, 0, 1, TRIM, v);                   // trim frame, proud
  box(0, 15, 1, 11, 15, 1, TRIM, v);
  box(0, 1, 1, 0, 14, 1, TRIM, v);
  box(11, 1, 1, 11, 14, 1, TRIM, v);
}

// NAVER — green plate, blocky white N
function makeNaver() {
  const BOARD = 0, TRIM = 1, GRN = 2, WHT = 3;
  const v = [];
  plaqueBoard(v, BOARD, TRIM);
  box(1, 1, 1, 10, 14, 1, GRN, v);                   // green plate fills the frame
                                                     // (app-icon look, matches the
                                                     // hi-res LINE plaque)
  // blocky N: two 2-wide columns + a thick stepped diagonal, proud of the plate
  box(3, 5, 2, 4, 11, 2, WHT, v);
  box(7, 5, 2, 8, 11, 2, WHT, v);
  box(5, 8, 2, 5, 10, 2, WHT, v);
  box(6, 5, 2, 6, 7, 2, WHT, v);
  return v;
}

// LINE — green plate, white speech bubble + the actual "LINE" wordmark.
// Authored at DOUBLE resolution (24x32x6, voxelSize 0.0625 — same 1.5x2.0 wu
// board): at the shared 12x16 grid the wordmark physically can't fit
// (4 letters x 3 cols + gaps = 15 > 8 plate cols) and the bare bubble read
// as a generic chat icon, not LINE (user report 2026-07-10).
function makeLine() {
  const BOARD = 0, TRIM = 1, GRN = 2, WHT = 3;
  const v = [];
  // hi-res board: backboard z0-1, trim + plate z2-3, artwork proud z4-5
  box(0, 0, 0, 23, 31, 1, BOARD, v);                 // backboard
  box(0, 0, 2, 23, 1, 3, TRIM, v);                   // trim frame, proud
  box(0, 30, 2, 23, 31, 3, TRIM, v);
  box(0, 2, 2, 1, 29, 3, TRIM, v);
  box(22, 2, 2, 23, 29, 3, TRIM, v);
  box(2, 2, 2, 21, 29, 3, GRN, v);                   // brand-green plate fills the
                                                     // whole inner frame (app-icon
                                                     // look; dark margins read as
                                                     // gaps at hi-res)
  // speech bubble, top half (rounded cross union + tail toward bottom-left)
  box(9, 18, 4, 14, 24, 5, WHT, v);
  box(8, 19, 4, 15, 23, 5, WHT, v);
  v.push([9, 17, 4, WHT], [8, 16, 4, WHT]);
  // "LINE" wordmark, bottom half — 2-wide strokes, 7 tall (y8-14)
  box(3, 8, 4, 4, 14, 5, WHT, v);                    // L spine
  box(5, 8, 4, 6, 9, 5, WHT, v);                     // L foot
  box(8, 8, 4, 9, 14, 5, WHT, v);                    // I
  box(11, 8, 4, 12, 14, 5, WHT, v);                  // N left
  box(14, 8, 4, 15, 14, 5, WHT, v);                  // N right
  box(13, 10, 4, 13, 12, 5, WHT, v);                 // N diagonal
  box(17, 8, 4, 18, 14, 5, WHT, v);                  // E spine
  box(19, 13, 4, 20, 14, 5, WHT, v);                 // E top arm
  v.push([19, 11, 4, WHT], [19, 10, 4, WHT]);        // E mid arm
  box(19, 8, 4, 20, 9, 5, WHT, v);                   // E bottom arm
  return v;
}

// GOOGLE — white plate, blocky multicolor G (red / yellow / green / blue)
function makeGoogle() {
  const BOARD = 0, TRIM = 1, WHT = 2, R = 3, Y = 4, G = 5, B = 6;
  const v = [];
  plaqueBoard(v, BOARD, TRIM);
  box(1, 1, 1, 10, 14, 1, WHT, v);                   // white plate fills the frame
  // G ring, colored by segment, opening at the top-right, blue crossbar
  box(4, 11, 2, 7, 11, 2, R, v);                     // top arc
  v.push([3, 10, 2, R], [8, 10, 2, R]);
  box(3, 5, 2, 3, 9, 2, Y, v);                       // left side
  box(4, 4, 2, 7, 4, 2, G, v);                       // bottom arc
  box(6, 7, 2, 8, 7, 2, B, v);                       // crossbar
  v.push([8, 6, 2, B], [8, 5, 2, B]);                // right side (below bar)
  return v;
}

/* ------------------------------------------------------------------ *
 *  FURNITURE                                                           *
 * ------------------------------------------------------------------ */
// wooden table with a tiny flower vase
function makeTable() {
  const TOP = 0, LEG = 1, VASE = 2, STEM = 3, PETAL = 4, HEART = 5;
  const v = [];
  for (const [lx, lz] of [[0, 0], [12, 0], [0, 7], [12, 7]])
    box(lx, 0, lz, lx + 1, 4, lz + 1, LEG, v);
  box(0, 5, 0, 13, 6, 8, TOP, v);
  // vase + one cheerful flower
  box(6, 7, 3, 7, 9, 4, VASE, v);
  v.push([6, 10, 4, STEM]);
  v.push([5, 11, 4, PETAL], [7, 11, 4, PETAL],
         [6, 12, 4, PETAL], [6, 11, 3, PETAL], [6, 11, 5, PETAL]);
  v.push([6, 11, 4, HEART]);
  return v;
}

// hanging lantern (chain at the top — game code pivots it at the beam)
function makeLantern() {
  const DARK = 0, GLASS = 1, GOLD = 2;
  const v = [];
  box(2, 5, 2, 3, 5, 3, DARK, v);                    // chain link
  box(1, 4, 1, 4, 4, 4, DARK, v);                    // cap
  box(1, 2, 1, 4, 3, 4, GLASS, v);                   // amber glass body
  box(1, 1, 1, 4, 1, 4, DARK, v);                    // base
  v.push([2, 0, 2, GOLD], [3, 0, 3, GOLD]);          // finial drops
  return v;
}

// woven door mat
function makeMat() {
  const MAT = 0, BORDER = 1;
  const v = [];
  for (let x = 0; x <= 11; x++)
    for (let z = 0; z <= 7; z++) {
      const edge = x === 0 || x === 11 || z === 0 || z === 7;
      v.push([x, 0, z, edge ? BORDER : MAT]);
    }
  return v;
}

/* ------------------------------------------------------------------ */
const PLAQUE_WOOD = ['#4A3328', '#6B4A33'];          // walnut board + trim

export default {
  house_room: {
    size: [RW, 27, RD],
    palette: [
      '#B08654',  // 0 plank A
      '#9C744A',  // 1 plank B
      '#82603C',  // 2 plank seam
      '#A67C4E',  // 3 wainscot wood
      '#F0DFC0',  // 4 warm plaster
      '#6B4A33',  // 5 timber frame / beams
      '#C96F4A',  // 6 rug terracotta
      '#A85538'   // 7 rug border
    ],
    voxels: dedupe(makeRoom()),
    jitter: false,
    chamfer: 0.15,
    sunRim: false,
    seed: 43
  },

  house_plaque_naver: {
    size: [12, 16, 3],
    palette: [...PLAQUE_WOOD, '#2FBF6B', '#FFF6E8'],
    voxels: dedupe(makeNaver()),
    jitter: false, chamfer: 0.15, sunRim: false
  },

  house_plaque_line: {
    size: [24, 32, 6],
    voxelSize: 0.0625,                     // hi-res: wordmark needs the columns
    palette: [...PLAQUE_WOOD, '#1FC160', '#FFF6E8'],
    voxels: dedupe(makeLine()),
    jitter: false, chamfer: 0.15, sunRim: false
  },

  house_plaque_google: {
    size: [12, 16, 3],
    palette: [...PLAQUE_WOOD, '#F5EFE0',
      '#EA4335', '#FBBC05', '#34A853', '#4285F4'],
    voxels: dedupe(makeGoogle()),
    jitter: false, chamfer: 0.15, sunRim: false
  },

  house_table: {
    size: [14, 13, 9],
    palette: [
      '#B08654',  // 0 top
      '#82603C',  // 1 legs
      '#B8A7F0',  // 2 lavender vase
      '#5F9450',  // 3 stem
      '#FFB88A',  // 4 peach petals
      '#F7D75E'   // 5 gold heart
    ],
    voxels: dedupe(makeTable()),
    jitter: false, chamfer: 0.2, sunRim: false
  },

  house_lantern: {
    size: [6, 6, 6],
    palette: [
      '#2B2B33',  // 0 iron
      '#FFC97A',  // 1 amber glass
      '#C9A25A'   // 2 gold finial
    ],
    voxels: dedupe(makeLantern()),
    jitter: false, chamfer: 0.2, sunRim: false
  },

  house_mat: {
    size: [12, 1, 8],
    palette: ['#C9A25A', '#A9854E'],
    voxels: dedupe(makeMat()),
    jitter: false, chamfer: 0.3, sunRim: false
  }
};
