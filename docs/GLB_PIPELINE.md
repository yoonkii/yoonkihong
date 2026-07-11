# GLB ASSET PIPELINE — the contract

Single source of truth for authored 3D (GLB) assets replacing the procedural
voxel models in Yoonki World 3D. Asset **generators** author to this spec;
the **integrator** loads through `scripts/game3d/glbassets.js` and never
hand-tunes per asset. If both sides follow this page, every swap is drop-in.

Loader: `scripts/game3d/glbassets.js` → `loadGLB(name)` resolves a normalized
`THREE.Group`, or **`null`** when the file is missing/unparseable (the game
then keeps the current voxel model — per-asset fallback, never all-or-nothing).

Verification harness: **`glbviewer.html?model=<name>`** — renders with the
exact in-game rig (sky, sun/hemi lights, ACES tonemapping @ 1.1 exposure,
ortho 45°/35° quarter camera) with the current voxel model beside it for
scale/palette comparison. Approve there before shipping.

---

## 1. Files and naming

All assets live flat at:

```
assets/3d/<name>.glb        (binary glTF 2.0, .glb only)
```

| category  | canonical names |
|-----------|-----------------|
| creatures | `macrodoc` `mathstreet` `mathwings` `funnify` `lasthand` `goldie` `gunball` |
| buildings | `bld_about_house` `bld_macrodoc` `bld_mathstreet` `bld_mathwings` `bld_funnify` `bld_lasthand` `bld_gunball` |
| characters| `player` `npc_yoonki` (rigged/skinned — clips `walk` + `idle`, see §7) |
| props     | `tree_a` `tree_b` `fountain` `egg` |

- Building files are prefixed `bld_` so `macrodoc` (creature) and
  `bld_macrodoc` (building) never collide.
- Lowercase snake_case, no version suffixes — redeploys overwrite in place.

## 2. Units, orientation, origin

- **1 world unit = 1 map tile** (the player is 1.625 wu tall). glTF meters
  map 1:1 to world units, **Y-up**.
- **Front faces +Z.** The game camera sits south-east (azimuth 45°) looking
  NW, and all actor code assumes "model front is +Z" (`yaw = atan2(dirX,
  dirZ)`). A creature's face / a building's door facade points down +Z.
- **Origin at ground center**: XZ bounding center at x=z=0, feet/base at
  y=0. (The loader re-derives this from the bounding box anyway — but author
  it correctly so authored pivots and any future animations behave.)
- No baked global rotations/scales beyond that; single scene, no cameras or
  lights in the file.

## 3. Target world heights (drop-in scale)

The loader **normalizes every GLB**: uniform-scales it so its bounding-box
height equals the contract height below, then recenters the origin. Absolute
authored size is therefore forgiving — *proportions* are what you author.
Heights were measured from the current voxel models' world bounds, so a
normalized GLB occupies exactly the old silhouette's space.

### Creatures (height in world units; footprint ≈ voxel footprint w×d)

> Integration note: the loader (`glbassets.js CREATURE_SCALE`) renders
> creatures at **1.25×** the contract height — smooth GLB heroes authored to
> the voxel silhouettes washed out at overworld zoom. Author to the table
> below; the boost is applied automatically at load.

| name | target height | footprint guide | replaces voxel model |
|------|--------------:|-----------------|----------------------|
| `macrodoc`   | **1.875** | 1.25 × 0.88 | `creature_macrodoc` |
| `mathstreet` | **1.25**  | 1.50 × 1.63 | `creature_mathstreet` |
| `mathwings`  | **1.5**   | 1.75 × 1.13 | `creature_mathwings` |
| `funnify`    | **1.625** | 1.25 × 1.25 | `creature_funnify` |
| `lasthand`   | **1.5**   | 1.05 × 0.35 | `creature_lasthand` (tall thin hand — footprint from the 1.31 × 0.41 × 1.90 raw bbox) |
| `goldie`     | **1.0**   | 0.63 × 0.75 | secret friend (actors.js `SECRET_MODEL`) |
| `gunball`    | **1.375** | 1.75 × 1.32 | new (GUNBALL) — no voxel fallback; shoulder-launcher pose is wide (raw 1.90 × 1.73 × 1.43), `FOOTPRINT_XZ` clamps to 1.75 |

### Characters (rigged — NO creature boost)

| name | target height | notes |
|------|--------------:|-------|
| `player`     | **1.625** | skinned 26-node skeleton, clips `walk` (1.0s loop) + `idle` (8.0s). The 1-wu-tile yardstick — never boosted. |
| `npc_yoonki` | **1.625** | same skeleton/clip names; mint hoodie, no backpack. |

Meshy's rigging retarget does not honor the +Z front contract — the loader's
`YAW_OFFSET` table (own wrapper group) restores it, so actor yaw math is
unchanged. The offset is **per-retarget**: every re-rigged export ships its
own front (measured 2026-07-10: player 0.2 rad, npc_yoonki 0.35 rad), so it
MUST be re-measured **in-game** after each character re-export — walk
screen-down in a headed browser and step the offset until the face points at
the camera dead-on (walk screen-up to confirm the backpack centers). Do not
derive it from rigviewer front angles; they have disagreed with the in-game
measurement. A re-rigged export that genuinely faces +Z must remove its
`YAW_OFFSET` entry.

### Buildings

| name | target height | footprint (w × d) — **match within ±10%** | replaces |
|------|--------------:|--------------------------------------------|----------|
| `bld_about_house` | **3.625** | 2.50 × 2.00 | `about_house` |
| `bld_macrodoc`    | **3.625** | 2.50 × 1.88 | `macrodoc` |
| `bld_mathstreet`  | **3.875** | 2.25 × 2.25 | `mathstreet` |
| `bld_mathwings`   | **2.5**   | 2.75 × 1.75 | `mathwings` |
| `bld_funnify`     | **3.75**  | 2.50 × 1.75 | `funnify` |
| `bld_lasthand`    | **2.875** | 2.50 × 2.50 | `lasthand` (nearly cubic raw bbox → 2.49 × 2.52 at contract height) |
| `bld_gunball`     | **2.75**  | 2.42 × 2.24 | new (GUNBALL) — compact neon arena kiosk, no voxel fallback (raw 1.67 × 1.90 × 1.54); integrator sizes collider from this footprint |

Building footprints are load-bearing: collision AABBs, interaction radii and
the emissive glow-quad positions (`world.js GLOWS`) are derived from the
voxel footprints. Keep walls near the guide box; keep the front facade (door,
signage) on the +Z face.

### Props

| name | target height | notes |
|------|--------------:|-------|
| `tree_a`   | **1.625** | oak: round canopy ~1.25 wide. Game re-scatters at 0.9–1.18 random scale. |
| `tree_b`   | **1.5**   | pine: conical, ~1.0 wide. Same scatter scaling. |
| `fountain` | **1.44**  | **width-driven**: the footprint is the contract (~1.75 dia, collider r = 1.02 + plaza ring are sized from it). The shipped GLB is squat (bbox aspect 1.22 w/h) so 1.44 = 1.75 × (1.569/1.912); at the old height-1.0 value it rendered ~1.22 dia — 40% undersized inside its own collider. A re-authored fountain with a different aspect must re-derive this: `height = 1.75 × rawH / max(rawW, rawD)`. Radially symmetric. |
| `egg`      | **1.18**  | 0.9 × the old 1.3125 as-placed size (voxel `egg_spotted` × its in-game 1.5 scale): the GLB egg is nearly spherical (1.746w × 1.911h) and at 1.3125 the closest `EGG_SLOTS` pairs (1.2 wu apart) visually touched. Sits in a straw nest at y += 0.1; keep the base slightly rounded, not flared. |

The loader also enforces per-asset **XZ footprint clamps** (`glbassets.js
FOOTPRINT_XZ`) where a wide model would blow its contract footprint after
height normalization — currently `mathwings` (raw 1.87 × 1.79 × 1.91 lands
~2.0 wu deep at contract height × the 1.25 creature boost vs its 1.75 × 1.13
guide) clamps to 1.85 wu so wings stop clipping fences at `CREATURE_SPOTS`.

Any name outside the tables normalizes to a 1.5 wu default (`bld_*` → 3.6) —
fine for test assets, wrong for shipping ones: add new names here first.

## 4. Materials & textures

- **One baked color texture** (base color / albedo) is the whole look.
  ≤ 1024×1024, power of two. Bake lighting-neutral albedo — the game adds
  its own warm sun + hemisphere fill + ACES; pre-baked strong shadows or
  highlights will double up.
- **Bake quality** (the encounter camera zooms to halfH 3.1 — texels get
  big): (a) dilate/pad UV island colors ≥ 8 px into the background so seams
  never bleed black or pick up black in the mip chain; (b) encode JPEG
  quality ≥ 92 (4:4:4) or PNG — budgets have plenty of headroom and low-q
  JPEG rings/blocks on flat candy fields; (c) avoid pole-cap UV layouts
  where possible (radial pinwheel artifacts on tree canopies / fountain
  rings ship visibly). The shipped set has been post-processed offline
  (UV-coverage-masked background dilation + black-rim despill + palette
  regrade, then repacked in place) — new bakes should not need that rescue
  pass if (a)–(c) are followed.
- **PBR channels are discarded.** The loader converts every material to
  `MeshLambertMaterial` keeping only `map`, `color`, `alphaTest/opacity`,
  and LDR-clamped `emissive`. Metalness, roughness, normal/AO maps,
  clearcoat, transmission: dropped. Don't spend budget on them.
- Emissive is clamped ≤ 1.0 so assets can never trip the bloom threshold
  (1.05) — in-game glow is added separately by the integrator via glow quads.
- Palette: stay inside the island palette (see `docs/ART_BIBLE.md` §2) —
  warm, saturated-but-soft; the harness's side-by-side voxel reference is the
  color acceptance test.
- **Author plain glTF 2.0 binary** — no Draco, no KTX2/Basis (no texture
  transcoder is wired into the loader). Meshopt compression is applied as a
  mandatory post-export step (§4.1); the loader wires `MeshoptDecoder`, so
  `EXT_meshopt_compression` + `KHR_mesh_quantization` (+
  `KHR_texture_transform` for the quantized UVs) are the only extensions a
  shipping file may use.

### 4.1 Compression (mandatory before shipping)

Raw exports are ~600 KB each (float32 geometry at ~30-40 bytes/triangle);
10 assets gated PRESS START behind ~6 MB. Every asset MUST go through
[gltfpack](https://github.com/zeux/meshoptimizer) before landing in
`assets/3d/`:

```
npx -y gltfpack -i <name>.raw.glb -o assets/3d/<name>.glb -cc
```

- `-cc` = KHR_mesh_quantization + EXT_meshopt_compression (high ratio);
  cuts the shipped set ~60% (6.05 MB → 2.4 MB) with untouched textures.
- Do **not** use `-tc` (KTX2/BasisU): the loader has no KTX2 transcoder and
  the palette-grade pass (`glbassets.js gradeMap`) needs a canvas-drawable
  image, which compressed GPU textures are not.
- The decoder side is already wired (`glbassets.js` →
  `loader().setMeshoptDecoder(MeshoptDecoder)`); no per-asset work needed.
- After any re-export, bump `ASSET_V` in `scripts/game3d/const.js` AND the
  matching `?v=` token on every mutable URL in **both** `index.html` and
  `classic.html` (`styles/main.css?v=`, `scripts/game3d.js?v=`,
  `data/projects.js?v=`) so returning visitors can't be served a mixed
  old/new asset set from cache. classic.html is easy to forget — an
  unversioned stylesheet there served recruiters stale styles for up to
  the GitHub Pages max-age (600 s) after a deploy.

## 5. Budgets

| category  | triangles | texture | file size |
|-----------|----------:|--------:|----------:|
| creatures | ≤ 15 k    | ≤ 1024² | ≤ 2 MB |
| props     | ≤ 10 k    | ≤ 1024² | ≤ 1.5 MB |
| buildings | ≤ 30 k    | ≤ 1024² | ≤ 3 MB |

The island renders whole in one ortho shot on mobile SwiftShader-class GPUs;
budgets are per-asset ceilings, not targets.

## 6. Shadows / grounding

- Actors ground via **blob shadows** (`actors.js makeBlobShadow`), not
  shadow maps: the loader sets `castShadow = false`, `receiveShadow = false`
  on every mesh. Buildings may opt back in at integration time
  (`loadGLB(name, { castShadow: true })`).
- Keep the mesh's lowest vertices genuinely at the base (no floating skirts,
  no below-ground geometry): minY becomes y=0 at normalization and the blob
  shadow plane sits at y≈0.02.

## 7. Loader API (integration side)

```js
import { loadGLB, loadGLBs } from './game3d/glbassets.js';

const m = await loadGLB('funnify', { onProgress: k => {} });
if (m) inner.add(m);          // normalized: scale 1, origin ground-center
else  inner.add(voxelMesh);   // fallback: current voxel model, unchanged

// batch: { name: Group|null }
const map = await loadGLBs(['macrodoc', 'tree_a'], (done, total) => {});
```

- Resolves **null** (never throws) on 404/parse failure; a warning is logged.
- Each call returns a fresh instance (clone); parsed GLTF + converted
  materials are cached per name.
- `group.userData = { glbName, targetHeight, rawHeight, animations }` —
  animation clips pass through untouched.
- **Skinned/rigged assets are supported** (shipped: `player`, `npc_yoonki`):
  the loader detects `SkinnedMesh` and clones via `SkeletonUtils.clone`
  (a plain `clone(true)` leaves the copy bound to the original skeleton),
  and sets `frustumCulled = false` on every mesh — bind-pose bounds don't
  follow the animated pose and the Meshy armature root carries a 0.01 scale,
  so stale bounds would cull the character mid-frame. Per-name `YAW_OFFSET`
  corrections live in their own wrapper group (`glb_yawfix`) between the
  caller-owned outer group and the normalize wrapper, so caller rotations
  can't clobber them. Clip playback is the integrator's job:
  `actors.js` drives a `THREE.AnimationMixer` per character (idle↔walk
  0.15s crossfades, walk timeScale speed-synced at 2.2 wu/s per 1.0×).
- Rigged verification harness: **`rigviewer.html?model=<name>&clip=walk|idle`**
  — glbviewer goes through the game loader's *static* preview path and can't
  pose skinned meshes for authoring review; rigviewer loads directly with
  GLTFLoader + MeshoptDecoder under the identical lighting rig.

## 8. Acceptance checklist (per asset)

1. `assets/3d/<name>.glb` — exact canonical name, **gltfpack'd** (§4.1:
   `extensionsRequired` must list `EXT_meshopt_compression`) and `ASSET_V`
   bumped.
2. **Palette gate (required, automated):**

   ```
   node scripts/check_glb_palette.mjs assets/3d/<name>.glb   # or no args = all
   ```

   Must print `ok` / exit 0. It decodes the embedded textures and rejects
   (a) any dominant hue family at sat > 0.75 **and** val > 0.85 (neon —
   the failure mode the human viewer check let through on the first tree
   export), (b) `tree_*` canopy greens averaging outside hue 85–120°
   (the playbook's warm yellow-green band; catches teal/emerald drift),
   and (c) `tree_*` canopy greens averaging value < 0.70 **or** carrying
   less than 8% of their green mass at value ≥ 0.80 — the playbook canopy
   is two greens (#5FAE49 body + #84C862 top highlight); this catches the
   dark-flat-cutout pine regression.
   Needs `python3` + Pillow (`pip install Pillow`) for pixel decode.
   Fix the texture (regrade + re-export per §4.1), never the thresholds.
3. Open `glbviewer.html?model=<name>` (localhost): HUD says `loaded`,
   tri count within budget, silhouette/colors read next to the voxel
   reference, front faces the camera at spin start (+Z).
3. Full turntable: no inverted normals, no PBR shine (everything is
   Lambert-matte), no floating base gap at the height gauge line.
4. Console: no errors. (A missing file logs one browser 404 line + a
   `[glb]` warning — that's the fallback path working, but a *shipping*
   asset must load clean.)
