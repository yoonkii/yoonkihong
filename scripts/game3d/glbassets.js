/* ============================================================================
   YOONKI WORLD 3D — GLB asset loader
   Loads authored GLB assets from assets/3d/<name>.glb and normalizes them to
   the game's world scale so they are drop-in replacements for the current
   voxel models. Contract: docs/GLB_PIPELINE.md (single source of truth for
   names, orientation and target heights).

   Wired into the game: game3d.js preloads the shipped names during the
   title screen (GLB_PRELOAD) and hands the result map to world.js
   (buildings, fountain, trees) and actors.js (creatures, secret). Swaps
   happen per-asset: a null (missing/broken file — loadGLB never throws)
   keeps the voxel model, so the game boots fine with an empty assets/3d/.

   Material policy (harmonization pass): every imported material is converted
   to MeshLambertMaterial keeping the baked color texture. The whole game
   renders with Lambert + the legacy-scaled light rig (const.js LIGHT_SCALE)
   under ACES tonemapping; MeshStandardMaterial would add PBR specular that
   reads shiny/plastic against the matte voxel world. Lambert kills that for
   free and matches ART_BIBLE §5.1 ("the one material").
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSET_V } from './const.js';

/* ------------------------------------------------------------------ *
 *  CONTRACT (docs/GLB_PIPELINE.md — keep in sync)                      *
 *  Target world heights measured from the current voxel models so a    *
 *  normalized GLB lands at scale 1 exactly where the voxel mesh was.   *
 * ------------------------------------------------------------------ */
export const GLB_BASE = 'assets/3d/';

export const TARGET_HEIGHTS = {
  // creatures (blob-shadow actors, origin ground-center, +Z facing camera)
  macrodoc: 1.875,
  mathstreet: 1.25,
  mathwings: 1.5,
  funnify: 1.625,
  goldie: 1.0,
  // buildings (front facade toward +Z; footprint must match the voxel
  // footprint within ~10% — colliders are sized from it, see pipeline doc)
  bld_about_house: 3.625,
  bld_macrodoc: 3.625,
  bld_mathstreet: 3.875,
  bld_mathwings: 2.5,
  bld_funnify: 3.75,
  // props
  tree_a: 1.625,          // oak silhouette (game scatters at 0.9–1.18 scale)
  tree_b: 1.5,            // pine silhouette
  // fountain is WIDTH-driven: the shipped GLB is squat (bbox 1.912w × 1.569h,
  // aspect 1.22 w/h), so height-normalizing to the old 1.0 contract landed a
  // ~1.22 wu footprint inside the r=1.02 collider ring — the plaza centerpiece
  // shrank ~40% behind invisible collision. 1.44 = 1.75 × (1.569/1.912) puts
  // the footprint at exactly the 1.75 dia contract (see GLB_PIPELINE.md).
  fountain: 1.44,
  // egg: 0.9 × the old 1.3125 as-placed height — the GLB egg is nearly
  // spherical (1.746w × 1.911h), and at 1.3125 adjacent EGG_SLOTS pairs
  // (1.2 wu apart) visually touched. 1.18 lands a ~1.08 wu diameter.
  egg: 1.18
};

/** Fallback height for names outside the contract table (test assets). */
export const DEFAULT_HEIGHT = 1.5;

/* Creatures render ~25% above contract height: the smooth GLB heroes were
   authored to the voxel silhouettes, but at overworld zoom (~40px tall) they
   washed out against the buildings. The bump keeps them key-readable wide
   while the encounter camera (halfH 3.1) still frames them comfortably. */
const CREATURES = new Set(['macrodoc', 'mathstreet', 'mathwings', 'funnify', 'goldie']);
const CREATURE_SCALE = 1.25;

/* Per-asset max XZ footprint (largest of width/depth, wu). Height
   normalization alone lets a wide model blow its contract footprint:
   mathwings (raw 1.87w × 1.79h × 1.91d) lands ~2.0 wu deep at contract
   height × the 1.25 creature boost — 77% over its 1.75 × 1.13 pipeline
   guide, clipping fences/props at CREATURE_SPOTS. The clamp shrinks the
   whole model uniformly (height gives a little, footprint obeys). */
const FOOTPRINT_XZ = { mathwings: 1.85 };

export function targetHeightFor(name) {
  if (TARGET_HEIGHTS[name] != null) {
    return TARGET_HEIGHTS[name] * (CREATURES.has(name) ? CREATURE_SCALE : 1);
  }
  if (name.startsWith('bld_')) return 3.6;
  if (name.startsWith('tree')) return 1.6;
  return DEFAULT_HEIGHT;
}

/* ------------------------------------------------------------------ *
 *  TEXTURE GRADE (palette coherence pass)                              *
 *  Meshy shipped several assets with near-black navy bodies that read  *
 *  as ink blobs against the candy-bright grass. The grade hue-shifts   *
 *  dark navy toward periwinkle and lifts it with a value floor, while  *
 *  bright accents (gold wings, cream) and neutral darks (eyes) pass    *
 *  through — saturated-but-SOFT, per the playbook.                     *
 *                                                                      *
 *  As of ASSET_V 20260709a every SHIPPED texture is pre-graded OFFLINE *
 *  (this exact algorithm, ported pixel-for-pixel, applied to the       *
 *  baked baseColor and repacked — mathstreet / mathwings / funnify /   *
 *  macrodoc / bld_mathstreet / bld_mathwings), so GRADE_PROFILES is    *
 *  empty and no main-thread canvas regrade runs at load. The machinery *
 *  stays: any future raw Meshy drop with an ink-navy body can ship     *
 *  behind `<name>: {}` (navy grade) / `{ softenRed: true }` (also pull *
 *  fire-engine reds to coral) while its source texture awaits the      *
 *  offline pass.                                                       *
 * ------------------------------------------------------------------ */
const GRADE_PROFILES = {};
const PERI = { r: 0x5B / 255, g: 0x7B / 255, b: 0xD6 / 255 };   // #5B7BD6
const CORAL = { r: 0xE0 / 255, g: 0x55 / 255, b: 0x48 / 255 };  // #E05548
/* Blue-dominant pixels grade up to L 0.42 (not 0.3): mathstreet's flat navy
   body #3C5395 sits at L≈0.325 and slipped past the old cutoff untouched —
   the exact "merges with the player's navy hair" failure the grade exists
   for. The neutral-darks branch keeps the 0.3 cutoff so eyes/outlines stay
   dark. The wider ramp (÷0.30) keeps w continuous at the threshold. */
const NAVY_L = 0.42;

function gradeMap(tex, profile) {
  const img = tex.image;
  if (!img || !img.width || !img.height) return tex;
  let c, g, data;
  try {
    c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    data = g.getImageData(0, 0, c.width, c.height);
  } catch (e) {
    console.warn('[glb] texture grade skipped:', e);
    return tex;
  }
  const px = data.data;
  const softenRed = !!(profile && profile.softenRed);
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    // hot-red accents (mathwings wings): hue within ±15° of pure red at
    // sat > 0.85 lerps halfway to coral — final sat lands ~0.75-0.80,
    // saturated-but-soft instead of firetruck. Checked before the luminance
    // gate: #C22012 (L≈0.26) would otherwise fall into the neutral-darks lift.
    if (softenRed && r >= gg && r >= b) {
      const d = r - Math.min(gg, b);
      if (d > 0.001 && d / r > 0.85 && Math.abs(gg - b) < 0.25 * d) {
        const k = 0.5;
        r += (CORAL.r - r) * k; gg += (CORAL.g - gg) * k; b += (CORAL.b - b) * k;
        px[i] = Math.min(255, Math.round(r * 255));
        px[i + 1] = Math.min(255, Math.round(gg * 255));
        px[i + 2] = Math.min(255, Math.round(b * 255));
        continue;
      }
    }
    const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const navy = b > r * 1.06 && b > gg * 1.06;
    if (navy && L < NAVY_L) {
      // navy: pull toward periwinkle, lift, floor the value so the body can
      // never crush to black under the blue shadow fill. w -> 0 at NAVY_L,
      // so no banding at the cutoff; #3C5395 gets a ~0.3-weight pull.
      const w = Math.min(1, (NAVY_L - L) / 0.30);
      const k = 0.75 * w;
      r += (PERI.r - r) * k; gg += (PERI.g - gg) * k; b += (PERI.b - b) * k;
      const lift = 1 + 0.55 * w;
      r *= lift; gg *= lift; b *= lift;
      const L2 = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      const floor = 0.34 * w;
      if (L2 < floor && L2 > 1e-4) {
        const fk = floor / L2;
        r *= fk; gg *= fk; b *= fk;
      }
    } else if (L < 0.3) {
      // neutral/warm darks (eyes, outlines): gentle lift only, keep them
      // dark enough to stay adorable
      const w = Math.min(1, (0.3 - L) / 0.22);
      const lift = 1 + 0.22 * w;
      r *= lift; gg *= lift; b *= lift;
    } else {
      continue;                                   // bright accents untouched
    }
    px[i] = Math.min(255, Math.round(r * 255));
    px[i + 1] = Math.min(255, Math.round(gg * 255));
    px[i + 2] = Math.min(255, Math.round(b * 255));
  }
  g.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(c);
  out.flipY = tex.flipY;
  out.colorSpace = tex.colorSpace;
  out.wrapS = tex.wrapS; out.wrapT = tex.wrapT;
  out.minFilter = tex.minFilter; out.magFilter = tex.magFilter;
  out.generateMipmaps = tex.generateMipmaps;
  // keep the UV transform: gltfpack-quantized UVs arrive via
  // KHR_texture_transform (offset/repeat on the texture) — dropping it
  // would remap the graded texture to the wrong part of the atlas
  out.offset.copy(tex.offset);
  out.repeat.copy(tex.repeat);
  out.rotation = tex.rotation;
  out.center.copy(tex.center);
  if (tex.channel != null) out.channel = tex.channel;
  out.needsUpdate = true;
  return out;
}

/* ------------------------------------------------------------------ *
 *  MATERIAL HARMONIZATION                                              *
 * ------------------------------------------------------------------ */
const matCache = new WeakMap();   // source material -> converted Lambert

function toLambert(src, grade) {
  if (src && src.isMeshLambertMaterial) return src;
  if (matCache.has(src)) return matCache.get(src);
  const out = new THREE.MeshLambertMaterial({
    map: src.map ? (grade ? gradeMap(src.map, grade) : src.map) : null,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    vertexColors: !!src.vertexColors,
    transparent: !!src.transparent,
    opacity: src.opacity != null ? src.opacity : 1,
    alphaTest: src.alphaTest || 0,
    side: src.side != null ? src.side : THREE.FrontSide,
    // smooth shading: Meshy-style organic meshes read faceted when flat
    flatShading: false
  });
  // keep authored emissive, clamped to LDR so it can never cross the game's
  // bloom threshold (post.js: 1.05) — glow quads stay the only HDR surfaces
  if (src.emissive && (src.emissive.r || src.emissive.g || src.emissive.b)) {
    const k = Math.min(1, src.emissiveIntensity != null ? src.emissiveIntensity : 1);
    out.emissive.copy(src.emissive).multiplyScalar(k);
    if (src.emissiveMap) out.emissiveMap = src.emissiveMap;
  }
  out.name = (src.name || 'mat') + '_lambert';
  matCache.set(src, out);
  return out;
}

function harmonize(root, castShadow, grade) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material)
      ? o.material.map((m) => toLambert(m, grade))
      : toLambert(o.material, grade);
    // blob-shadow world: actors ground themselves with the radial blob
    // (actors.js makeBlobShadow) — shadow-map casting stays off by default
    o.castShadow = !!castShadow;
    o.receiveShadow = false;
  });
}

/* ------------------------------------------------------------------ *
 *  LOADER + CACHE                                                      *
 * ------------------------------------------------------------------ */
let _loader = null;
function loader() {
  if (!_loader) {
    _loader = new GLTFLoader();
    // shipped GLBs are gltfpack'd (-cc): EXT_meshopt_compression +
    // KHR_mesh_quantization (see docs/GLB_PIPELINE.md compression step)
    _loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return _loader;
}

const gltfCache = new Map();    // name -> Promise<gltf|null>

function fetchGLTF(name, onProgress) {
  if (gltfCache.has(name)) return gltfCache.get(name);
  const url = GLB_BASE + name + '.glb?v=' + ASSET_V;
  const p = new Promise((resolve) => {
    loader().load(
      url,
      (gltf) => {
        // convert materials ONCE on the source scene; instance clones share
        // the converted Lamberts (navy assets get the palette grade here)
        harmonize(gltf.scene, false, GRADE_PROFILES[name] || null);
        resolve(gltf);
      },
      (xhr) => {
        if (onProgress && xhr && xhr.total > 0) {
          onProgress(Math.min(1, xhr.loaded / xhr.total));
        }
      },
      (err) => {
        console.warn('[glb] "' + name + '" unavailable (' +
          (err && err.message ? err.message : 'load/parse failed') +
          ') — caller keeps the voxel model');
        resolve(null);
      }
    );
  });
  gltfCache.set(name, p);
  return p;
}

/**
 * Load assets/3d/<name>.glb, normalized to the game contract:
 *   - uniform scale so bounding height === targetHeightFor(name)
 *   - origin recentered to ground center (XZ bounds center, minY -> 0)
 *   - all materials converted to MeshLambertMaterial (baked map kept,
 *     PBR shininess killed), castShadow=false (blob-shadow actors)
 *
 * opts:
 *   onProgress(k)   0..1 download progress (only when Content-Length known)
 *   height          override the contract target height (viewer/testing)
 *   castShadow      true to let the mesh cast shadow-map shadows (buildings)
 *
 * Resolves a THREE.Group (fresh instance per call — safe to add to the
 * scene multiple times), or NULL if the file is missing or fails to parse.
 * Never rejects. group.userData = { glbName, targetHeight, rawHeight,
 * animations } (animations pass through for future use).
 */
export async function loadGLB(name, opts = {}) {
  const gltf = await fetchGLTF(name, opts.onProgress);
  if (!gltf) return null;
  try {
    // NOTE: plain clone — fine for static meshes. Skinned/rigged GLBs would
    // need SkeletonUtils.clone; none are in the current contract.
    const inst = gltf.scene.clone(true);
    if (opts.castShadow) harmonize(inst, true);

    // measure in a neutral wrapper so any transforms baked on gltf.scene
    // are included
    const norm = new THREE.Group();
    norm.name = 'glb_norm';
    norm.add(inst);
    norm.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(norm);
    const h = box.max.y - box.min.y;
    if (!(h > 1e-6) || !isFinite(h)) {
      console.warn('[glb] "' + name + '" has a degenerate bounding box — skipped');
      return null;
    }
    const target = opts.height != null ? opts.height : targetHeightFor(name);
    let s = target / h;
    const maxXZ = FOOTPRINT_XZ[name];
    if (maxXZ) {
      const fp = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s;
      if (fp > maxXZ) s *= maxXZ / fp;
    }
    norm.scale.setScalar(s);
    norm.position.set(
      -((box.min.x + box.max.x) / 2) * s,
      -box.min.y * s,
      -((box.min.z + box.max.z) / 2) * s
    );

    const group = new THREE.Group();
    group.name = 'glb_' + name;
    group.add(norm);
    group.userData = {
      glbName: name,
      targetHeight: target,
      rawHeight: h,
      animations: gltf.animations || []
    };
    if (opts.onProgress) opts.onProgress(1);
    return group;
  } catch (e) {
    console.warn('[glb] "' + name + '" normalization failed:', e);
    return null;
  }
}

/**
 * Load several assets in parallel. onProgress(done, total) fires per settled
 * asset. Resolves { name: Group|null } — nulls mean "keep the voxel model".
 */
export async function loadGLBs(names, onProgress) {
  const out = {};
  let done = 0;
  await Promise.all(names.map(async (n) => {
    out[n] = await loadGLB(n);
    done++;
    if (onProgress) onProgress(done, names.length);
  }));
  return out;
}
