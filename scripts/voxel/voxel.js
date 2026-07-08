/* ============================================================================
   YOONKI WORLD 3D — voxel engine core
   Model registry + buildMesh()/buildGeometry() with hidden-face culling,
   vertex colors, deterministic per-voxel jitter, baked vertex AO and
   optional top-edge chamfer. Authoring helpers: box / mirrorX / translate /
   dedupe. Format spec: docs/VOXEL_FORMAT.md (single source of truth).

   Plain ES module. No build step. Import three via the page importmap.
   ========================================================================== */

import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  UNITS (art bible §1.1)                                              *
 * ------------------------------------------------------------------ */
export const VOXELS_PER_TILE = 8;
export const VOXEL_SIZE = 1 / VOXELS_PER_TILE;   // 0.125 world units

/* ------------------------------------------------------------------ *
 *  MODEL REGISTRY                                                      *
 * ------------------------------------------------------------------ */
const REGISTRY = new Map();

/** Register an object of named models: registerModels({tree_oak: {...}}). */
export function registerModels(group) {
  for (const name of Object.keys(group)) {
    const m = group[name];
    if (!m || !Array.isArray(m.voxels) || !Array.isArray(m.palette)) {
      console.warn('[voxel] skipping invalid model "' + name + '"');
      continue;
    }
    if (Array.isArray(m.size) && m.size.length === 3) {
      for (const v of m.voxels) {
        if (v[0] < 0 || v[0] >= m.size[0] ||
            v[1] < 0 || v[1] >= m.size[1] ||
            v[2] < 0 || v[2] >= m.size[2]) {
          console.warn('[voxel] model "' + name + '": voxel [' + v[0] + ',' +
            v[1] + ',' + v[2] + '] outside declared size [' + m.size + ']');
          break;   // one warning per model is enough
        }
      }
    }
    REGISTRY.set(name, m);
  }
}

export function getModel(name) { return REGISTRY.get(name) || null; }
export function listModels() { return Array.from(REGISTRY.keys()).sort(); }

/* ------------------------------------------------------------------ *
 *  SHARED MATERIAL (art bible §5.1 — the one material)                 *
 * ------------------------------------------------------------------ */
let _sharedMaterial = null;
export function voxelMaterial() {
  if (!_sharedMaterial) {
    _sharedMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true
    });
  }
  return _sharedMaterial;
}

/* ------------------------------------------------------------------ *
 *  AUTHORING HELPERS                                                   *
 * ------------------------------------------------------------------ */

/**
 * Push a filled box of voxels [x0..x1] x [y0..y1] x [z0..z1] (inclusive)
 * with palette index pi into `out` (created if omitted). Returns out.
 * opts.hollow: only emit the shell (walls 1 voxel thick).
 */
export function box(x0, y0, z0, x1, y1, z1, pi, out, opts) {
  out = out || [];
  const hollow = !!(opts && opts.hollow);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        if (hollow &&
            x !== x0 && x !== x1 &&
            y !== y0 && y !== y1 &&
            z !== z0 && z !== z1) continue;
        out.push([x, y, z, pi]);
      }
  return out;
}

/** Return voxels mirrored across X for a model of width w (x -> w-1-x). */
export function mirrorX(voxels, w) {
  return voxels.map(v => [w - 1 - v[0], v[1], v[2], v[3]]);
}

/** Return voxels translated by (dx, dy, dz). */
export function translate(voxels, dx, dy, dz) {
  return voxels.map(v => [v[0] + dx, v[1] + dy, v[2] + dz, v[3]]);
}

/**
 * Last-wins de-duplication: later entries at the same (x,y,z) replace
 * earlier ones. Lets authors paint a base shape then overwrite details.
 */
export function dedupe(voxels) {
  const seen = new Map();
  for (const v of voxels) seen.set(v[0] + '|' + v[1] + '|' + v[2], v);
  return Array.from(seen.values());
}

/* ------------------------------------------------------------------ *
 *  DETERMINISTIC HASH (jitter is stable across loads — art bible §2.1) *
 *  Exported: model authors use it for stable scatter (flowers, tile    *
 *  variation, pebbles) so layouts never change between page loads.     *
 * ------------------------------------------------------------------ */
export function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 974634571) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;   // [0, 1)
}

/* ------------------------------------------------------------------ *
 *  FACE TABLES                                                         *
 *  Y is up. Each face: normal + 4 corners (CCW seen from outside).     *
 *  Corner coords are voxel-local in {0,1}.                             *
 * ------------------------------------------------------------------ */
const FACES = [
  { // +X (east)
    n: [1, 0, 0],
    c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]
  },
  { // -X (west)
    n: [-1, 0, 0],
    c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]
  },
  { // +Y (top)
    n: [0, 1, 0],
    c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]
  },
  { // -Y (bottom)
    n: [0, -1, 0],
    c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
  },
  { // +Z (south)
    n: [0, 0, 1],
    c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
  },
  { // -Z (north)
    n: [0, 0, -1],
    c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
  }
];

// For per-vertex AO: for each face, for each corner, the two edge-neighbor
// offsets and one corner-neighbor offset in the plane one step along the
// face normal. Derived at runtime from the corner coords (cheap, once).
function aoNeighbors(face) {
  const n = face.n;
  return face.c.map(corner => {
    // signs: corner coord 0 -> -1, 1 -> +1 for the two tangent axes
    const s = [corner[0] ? 1 : -1, corner[1] ? 1 : -1, corner[2] ? 1 : -1];
    const t = []; // tangent axes (not the normal axis)
    for (let a = 0; a < 3; a++) if (n[a] === 0) t.push(a);
    const e1 = [n[0], n[1], n[2]]; e1[t[0]] += s[t[0]];
    const e2 = [n[0], n[1], n[2]]; e2[t[1]] += s[t[1]];
    const co = [n[0], n[1], n[2]]; co[t[0]] += s[t[0]]; co[t[1]] += s[t[1]];
    return [e1, e2, co];
  });
}
const FACE_AO = FACES.map(aoNeighbors);

/* ------------------------------------------------------------------ *
 *  buildGeometry(model, opts) -> THREE.BufferGeometry                  *
 * ------------------------------------------------------------------ */
/**
 * Options (all optional; model-level fields of the same name are defaults):
 *   voxelSize  world units per voxel                    (default VOXEL_SIZE)
 *   origin     'center-bottom' (default) | 'corner'
 *              center-bottom: XZ-centered on the voxel bounds, base at y=0
 *              corner: voxel (0,0,0) at world (0,0,0)
 *   jitter     false | true | {value: 0.04, hue: 2/360}
 *              deterministic per-voxel HSL wobble (organic surfaces only)
 *   ao         true (default) | false — baked vertex AO + bottom-row dip
 *   chamfer    0 (default) | 0..0.5 — 45° bevel on exposed top edges,
 *              in voxel fractions (0.3 reads well on roofs/canopies/heads)
 *   sunRim     true (default) | false — painted sun rim (art bible §5.3.2):
 *              top faces on sun-side (-X / -Z) exposed edges get +8%
 *              lightness and a small hue shift toward #FFB070, baked
 *   aoCap      0..1 (default 0) — floor for the baked AO multiplier.
 *              0.9 keeps dense organic masses (tree canopies) from reading
 *              near-black inside while still grounding the silhouette.
 *   seed       integer mixed into the jitter hash        (default 0)
 */
export function buildGeometry(model, opts = {}) {
  const voxels = model.voxels;
  const vs = opts.voxelSize ?? model.voxelSize ?? VOXEL_SIZE;
  const origin = opts.origin ?? model.origin ?? 'center-bottom';
  const jitterOpt = opts.jitter ?? model.jitter ?? false;
  const aoOn = opts.ao ?? model.ao ?? true;
  const chamferOpt = opts.chamfer ?? model.chamfer ?? 0;
  const cf = chamferOpt === true ? 0.3 : Math.min(0.5, Math.max(0, +chamferOpt || 0));
  const sunRimOn = opts.sunRim ?? model.sunRim ?? true;
  const aoCap = Math.min(1, Math.max(0, +(opts.aoCap ?? model.aoCap ?? 0) || 0));
  const seed = (opts.seed ?? model.seed ?? 0) | 0;

  const jit = jitterOpt
    ? {
        value: (jitterOpt.value ?? 0.04),
        hue: (jitterOpt.hue ?? 2) / 360
      }
    : null;

  // --- bounds + occupancy -------------------------------------------------
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const v of voxels) {
    if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
    if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
  }
  if (!voxels.length) return new THREE.BufferGeometry();

  const W = maxX - minX + 1, H = maxY - minY + 1, D = maxZ - minZ + 1;
  const occ = new Int16Array(W * H * D).fill(-1);   // palette index or -1
  const idx = (x, y, z) => ((x - minX) * H + (y - minY)) * D + (z - minZ);
  for (const v of voxels) occ[idx(v[0], v[1], v[2])] = v[3];
  const solid = (x, y, z) =>
    x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ &&
    occ[idx(x, y, z)] >= 0;

  // --- palette (THREE.Color handles sRGB -> working-space conversion) -----
  const palette = model.palette.map(hex => new THREE.Color(hex));

  // --- origin offset -------------------------------------------------------
  let ox = 0, oy = 0, oz = 0;
  if (origin === 'center-bottom') {
    ox = -(minX + (W / 2));
    oy = -minY;
    oz = -(minZ + (D / 2));
  }

  // --- emit ----------------------------------------------------------------
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const tmp = new THREE.Color();
  const SUN_TINT = new THREE.Color('#FFB070');   // painted sun rim (§5.3.2)

  const AO_MUL = [1.0, 0.86, 0.78, 0.78];   // occlusion 0..3 (art bible §5.3)

  function pushQuad(p, n, cols, flip) {
    const base = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(p[i][0], p[i][1], p[i][2]);
      normals.push(n[0], n[1], n[2]);
      colors.push(cols[i].r, cols[i].g, cols[i].b);
    }
    if (flip) indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  for (const v of voxels) {
    const [x, y, z, pi] = v;
    const baseColor = palette[pi] || palette[0];

    // per-voxel jitter (deterministic)
    tmp.copy(baseColor);
    if (jit) {
      const r1 = hash3(x, y, z, seed);
      const r2 = hash3(x, y, z, seed ^ 0x9e3779b9);
      tmp.offsetHSL((r1 * 2 - 1) * jit.hue, 0, (r2 * 2 - 1) * jit.value);
    }
    // bottom-2-rows dip (relative to the model's own base)
    let rowMul = 1;
    if (aoOn && (y - minY) < 2) rowMul = 0.9;

    const topExposed = !solid(x, y + 1, z);

    // painted sun rim: top faces on sun-side (-X / -Z) exposed edges
    let rimCol = null;
    if (sunRimOn && topExposed && (!solid(x - 1, y, z) || !solid(x, y, z - 1))) {
      rimCol = tmp.clone().lerp(SUN_TINT, 0.12).multiplyScalar(1.08);
    }

    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const n = face.n;
      if (solid(x + n[0], y + n[1], z + n[2])) continue;   // hidden-face cull

      // per-corner AO
      const cornAO = [0, 0, 0, 0];
      if (aoOn) {
        const nb = FACE_AO[f];
        for (let i = 0; i < 4; i++) {
          const [e1, e2, co] = nb[i];
          const s1 = solid(x + e1[0], y + e1[1], z + e1[2]) ? 1 : 0;
          const s2 = solid(x + e2[0], y + e2[1], z + e2[2]) ? 1 : 0;
          const sc = solid(x + co[0], y + co[1], z + co[2]) ? 1 : 0;
          cornAO[i] = (s1 && s2) ? 3 : s1 + s2 + sc;
        }
      }
      const faceBase = (f === 2 && rimCol) ? rimCol : tmp;
      const cols = cornAO.map(a => {
        const c = faceBase.clone();
        c.multiplyScalar(Math.max(aoCap, AO_MUL[a]) * rowMul);
        return c;
      });
      // flip quad diagonal for AO anisotropy
      const flip = (cornAO[0] + cornAO[2]) > (cornAO[1] + cornAO[3]);

      // chamfer bookkeeping: which horizontal edges of this voxel bevel?
      // Edge (dx,dz) bevels when the side and the up-diagonal are both open
      // and the top of this voxel is exposed.
      let bevE = null;
      if (cf > 0 && topExposed) {
        bevE = {
          px: !solid(x + 1, y, z) && !solid(x + 1, y + 1, z),
          nx: !solid(x - 1, y, z) && !solid(x - 1, y + 1, z),
          pz: !solid(x, y, z + 1) && !solid(x, y + 1, z + 1),
          nz: !solid(x, y, z - 1) && !solid(x, y + 1, z - 1)
        };
      }

      // corner world positions
      const p = face.c.map(c => [
        (x + c[0] + ox) * vs,
        (y + c[1] + oy) * vs,
        (z + c[2] + oz) * vs
      ]);

      if (bevE) {
        if (f === 2) {
          // TOP face: inset beveled edges by cf
          for (let i = 0; i < 4; i++) {
            const c = face.c[i];
            if (c[0] === 1 && bevE.px) p[i][0] -= cf * vs;
            if (c[0] === 0 && bevE.nx) p[i][0] += cf * vs;
            if (c[2] === 1 && bevE.pz) p[i][2] -= cf * vs;
            if (c[2] === 0 && bevE.nz) p[i][2] += cf * vs;
          }
        } else if (f !== 3) {
          // SIDE face: lower the top edge by cf where beveled
          const bev =
            (f === 0 && bevE.px) || (f === 1 && bevE.nx) ||
            (f === 4 && bevE.pz) || (f === 5 && bevE.nz);
          if (bev) {
            for (let i = 0; i < 4; i++) {
              if (face.c[i][1] === 1) p[i][1] -= cf * vs;
            }
          }
        }
      }

      pushQuad(p, n, cols, flip);
    }

    // emit bevel strips (once per voxel, tied to the top face)
    if (cf > 0 && topExposed) {
      const bev = {
        px: !solid(x + 1, y, z) && !solid(x + 1, y + 1, z),
        nx: !solid(x - 1, y, z) && !solid(x - 1, y + 1, z),
        pz: !solid(x, y, z + 1) && !solid(x, y + 1, z + 1),
        nz: !solid(x, y, z - 1) && !solid(x, y + 1, z - 1)
      };
      const yT = (y + 1 + oy) * vs;            // top plane
      const yB = yT - cf * vs;                  // lowered side-edge plane
      const X0 = (x + ox) * vs, X1 = (x + 1 + ox) * vs;
      const Z0 = (z + oz) * vs, Z1 = (z + 1 + oz) * vs;
      // inset extents of the top face along each axis
      const iX0 = X0 + (bev.nx ? cf * vs : 0);
      const iX1 = X1 - (bev.px ? cf * vs : 0);
      const iZ0 = Z0 + (bev.nz ? cf * vs : 0);
      const iZ1 = Z1 - (bev.pz ? cf * vs : 0);
      const col = tmp.clone().multiplyScalar(rowMul);
      const cols4 = [col, col, col, col];
      // sun-side (-X / -Z) bevel strips carry the painted rim tint
      const colR = (rimCol || tmp).clone().multiplyScalar(rowMul);
      const cols4R = [colR, colR, colR, colR];
      const inv = Math.SQRT1_2;
      if (bev.px) pushQuad(
        [[iX1, yT, iZ0], [iX1, yT, iZ1], [X1, yB, Z1], [X1, yB, Z0]],
        [inv, inv, 0], cols4, false);
      if (bev.nx) pushQuad(
        [[iX0, yT, iZ1], [iX0, yT, iZ0], [X0, yB, Z0], [X0, yB, Z1]],
        [-inv, inv, 0], cols4R, false);
      if (bev.pz) pushQuad(
        [[iX1, yT, iZ1], [iX0, yT, iZ1], [X0, yB, Z1], [X1, yB, Z1]],
        [0, inv, inv], cols4, false);
      if (bev.nz) pushQuad(
        [[iX0, yT, iZ0], [iX1, yT, iZ0], [X1, yB, Z0], [X0, yB, Z0]],
        [0, inv, -inv], cols4R, false);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------ *
 *  buildMesh(model | name, opts) -> THREE.Mesh                         *
 * ------------------------------------------------------------------ */
export function buildMesh(model, opts = {}) {
  if (typeof model === 'string') {
    const m = getModel(model);
    if (!m) throw new Error('[voxel] unknown model "' + model + '"');
    model = m;
  }
  const mesh = new THREE.Mesh(
    buildGeometry(model, opts),
    opts.material || voxelMaterial()
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
