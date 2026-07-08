# YOONKI WORLD 3D — VOXEL MODEL FORMAT (single source of truth)

Read this before authoring any model. The renderer look (lighting, tone, fog,
camera) is defined in `docs/ART_BIBLE.md` and implemented once in
`scripts/voxel/rig.js` — model authors only supply **shape + albedo palette**.
No textures, ever. All color comes from the palette + baked vertex tricks.

---

## 1. Coordinate system & units

- **Y is up.** `x` = map column direction (east), `z` = map row direction
  (south). Integer voxel coordinates; each voxel is a 1×1×1 cell.
- **8 voxels = 1 map tile = 1.0 world unit**, so one voxel is **0.125 world
  units** (`VOXEL_SIZE` in `scripts/voxel/voxel.js`).
- A model's world footprint = `size[0]/8` × `size[2]/8` tiles. A 4×4-tile
  building is 32 voxels wide; a character is ~12 voxels (1.5 tiles) tall.
- Keep models compact: **mostly ≤ 20 voxels per side** (buildings are the
  exception at 32×~40×32).
- The sun comes from the **(−X, −Z) quadrant** (art bible azimuth 235°), the
  camera looks in from the **(+X, +Z) quadrant** (azimuth 45°). So the
  `x = 0, z = 0` corner of your model is the sun-kissed back shoulder, and the
  high-x/high-z faces are what the player sees, lit by the teal fill.

## 2. Model object

```js
{
  size: [w, h, d],          // declared voxel bounds (w=x, h=y, d=z) — for
                            // readers + validation; geometry uses actual
                            // voxel bounds
  palette: ['#7FB069', …],  // albedo hex strings; index into this from voxels
  voxels: [                 // one entry per voxel
    [x, y, z, paletteIndex],
    …
  ],

  // Optional per-model build defaults (overridable via buildMesh opts):
  origin:  'center-bottom', // default: XZ-centered on voxel bounds, base at
                            // y = 0 (so the model "stands on" the ground
                            // plane). 'corner' puts voxel (0,0,0) at origin.
  jitter:  true,            // deterministic ±4% value / ±2° hue per-voxel
                            // wobble. ORGANIC SURFACES ONLY (grass, canopy,
                            // cliff, tall grass). Buildings/characters: false.
  chamfer: 0.3,             // 0..0.5 — 45° bevel on exposed top edges, in
                            // voxel fractions. Use ~0.3 on roofs, canopies,
                            // and creature heads (art bible §5.3.3); 0 for
                            // crisp props.
  ao:      true,            // baked vertex AO + bottom-2-row darkening
                            // (default true — leave it on)
  sunRim:  true,            // painted sun rim (art bible §5.3.2): top faces
                            // on sun-side (-X/-Z) exposed edges get +8%
                            // lightness + a shift toward #FFB070, baked
                            // (default true)
  seed:    0                // mixed into the jitter hash
}
```

Rules:
- Palette values are **albedo** (pre-lighting). Pick them from the art bible
  §2 tables — the peach sun and teal fills do the rest. Never bake lighting
  into the palette beyond the listed "shadow side" swatches.
- Duplicate voxel coordinates: **last one wins** at build time (occupancy grid
  overwrite), same as the `dedupe()` helper. Paint base shapes first, details
  after.
- Voxel coordinates may be negative; `size` is advisory. `registerModels`
  warns if voxels fall outside the declared `size` box.

## 3. Authoring a model group

Models live in `scripts/voxel/models/<group>.js` — plain ES module, default
export is an object of named models:

```js
// scripts/voxel/models/trees.js
import { box, dedupe, mirrorX, translate } from '../voxel.js';

const voxels = [];
box(3, 0, 3, 4, 5, 4, 0, voxels);           // trunk: x 3..4, y 0..5, z 3..4
box(1, 6, 1, 6, 8, 6, 1, voxels);           // canopy slab
// … overwrite details on top, they win:
voxels.push([1, 9, 1, 2]);                  // sun-kiss voxel

export default {
  tree_oak: {
    size: [8, 12, 8],
    palette: ['#7A5238', '#3F8F5F', '#9BB06E'],
    voxels: dedupe(voxels),
    jitter: true,
    chamfer: 0.35
  }
};
```

**Register it** by adding one import line to `scripts/voxel/models/index.js`:

```js
import trees from './trees.js';
registerModels(trees);
```

That's it — the model is now in the shared registry, and the viewer can render
it at `viewer.html?model=tree_oak`.

## 4. Helpers (from `scripts/voxel/voxel.js`)

| Helper | What it does |
|---|---|
| `box(x0,y0,z0, x1,y1,z1, pi, out?, {hollow})` | fill (or shell) an inclusive box with palette index `pi`, appending to `out` |
| `mirrorX(voxels, w)` | mirror across X for a model of width `w` (`x → w-1-x`) |
| `translate(voxels, dx, dy, dz)` | shift a voxel list |
| `dedupe(voxels)` | explicit last-wins dedupe (build-time occupancy does this anyway) |
| `hash3(x, y, z, seed)` | deterministic [0,1) random per position — use for scatter (flowers, pebbles, tile variation) so layouts are stable across loads |

## 5. Building meshes

```js
import { buildMesh, buildGeometry, voxelMaterial } from './scripts/voxel/voxel.js';

const mesh = buildMesh('tree_oak');                 // by registered name
const mesh2 = buildMesh(modelObj, { chamfer: 0 });  // opts override model fields
```

- `buildMesh` returns a `THREE.Mesh` with **merged BufferGeometry**
  (hidden-face culled, indexed quads), **vertex colors**, and the shared
  `MeshLambertMaterial { vertexColors: true, flatShading: true }` — the one
  material for everything opaque (art bible §5.1). `castShadow` and
  `receiveShadow` are pre-set to `true`.
- Baked in per art bible §5.3: per-vertex AO (edge 14%, double-corner 22%),
  bottom-2-row 10% dip, painted sun rim on sun-side top edges, optional
  chamfer strips, optional deterministic jitter. The AO also flips each
  quad's diagonal to avoid interpolation artifacts.
- `buildGeometry(model, opts)` is available when you need the raw geometry
  (e.g. merging many placements into one world chunk).

## 6. Palette conventions (quick sheet — full tables in ART_BIBLE.md §2)

- Grass tops: `#7FB069 / #74A65F / #689A55`, dry-gold accent `#A5B05E`
- Dirt/cliff strata top→bottom: `#8A5A3C / #7A4C32 / #6B4128 / #59341F`
- Canopy ramp skirt/mid/top: `#2F7550 / #3F8F5F / #57A873`, sun-kiss mix
  toward `#FFB070` on the top-west (low-x/low-z) shoulder
- Trunk / shadow side: `#7A5238 / #5F3E2A`
- Path top/sides/border: `#E8C592 / #D8B27F / #C69F6C`
- Plaster / shadow-course: `#F3E3C6 / #E3CFA9`; glass (unlit) `#AEE6FF`
- Fence rails/posts/end-grain: `#B9855C / #96683F / #D9A874`
- Character/creature colors: art bible §2.5 — bodies stay saturated; every
  creature gets 2 crisp `#FFF3D6` highlight voxels on the head
- Emissive windows/signs are **separate tiny MeshBasicMaterial meshes** added
  by the world builder, not palette entries — don't try to fake glow in
  albedo.

## 7. Verify your model (mandatory before handoff)

1. Serve the repo (`python3 -m http.server 8899`) and open
   `viewer.html?model=<name>` — the model spins on a slow turntable over the
   standard grass plate, under the STANDARD rig (peach sun az 235°/el 22°,
   teal hemisphere, rim, fog, gradient sky). What you see is exactly how it
   will light in-game.
2. Screenshot and check against the art bible: warm peach light from the
   back-left top, **teal (never gray/black) shadow sides**, long soft shadow
   on the ground toward camera, soft chamfered silhouette where specified.
3. `viewer.html` with no `?model=` lists everything registered — confirm your
   model appears.
4. Zero console errors.
