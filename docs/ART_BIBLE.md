# YOONKI WORLD 3D — DEFINITIVE ART BIBLE
## "Ember Isle" — Golden Hour Voxel Diorama

**Base direction:** EMBER ISLE (winner — the 22° peach-sun / teal-fill complementary lighting split does more for perceived quality than any other single decision in any proposal, and its numbers were the most rigorously checked against the engine).
**Grafts:** MINT MORNING's shared spring animation vocabulary, chamfered voxel edges, emissive interaction highlight, and encounter relight; POP! ISLE's character contact shadows, bump lean, and egg pictogram particles.

**One-sentence mood:** Monument Valley's light discipline applied to a Pokémon town — a collectible floating diorama frozen 20 minutes before sunset, rendered in merged vertex-colored voxels.

**Engine ground truth (verified in `scripts/game.js` — do not deviate):** STEP_MS=170, CREATURE_STEP_MS=300, TURN_MS=90; typewriter 2 chars per 24ms tick; transition chain flash 420ms → iris add 440ms → swap at 900ms → iris-open clear at +520ms; transitionOut 260ms; BGM fades: start 500ms, into encounter 800ms, out of encounter 700ms, REDUCED=200ms; AudioMan.VOL=0.55; creature idle bob phase `sin(now/320 + home.x)`; wander: next move at now + 900 + rand·2600ms, 35% chance to idle, 2-tile leash from home; mute persisted in localStorage `yw_muted`.

---

## 1. SCALE, CAMERA, WORLD MAPPING

### 1.1 Units
- 1 map tile = 1.0 world unit. 1 voxel = 0.125 units (8 voxels per tile edge).
- Island: 40 × 30 units (X = map column, Z = map row, Y = up). World origin at map tile (0,0); island center at (20, 0, 15).
- Ground grass top surface at y = 0. Water surface at y = −0.15. Path top at y = +0.03 (path is inset-bordered, not raised).

### 1.2 Camera
- `THREE.PerspectiveCamera`, **fov 30°** (near-isometric compression with just enough parallax to sell depth).
- Quarter view: **elevation 35°, azimuth 45°** (camera in the map's south-east quadrant looking north-west).
- Distance from look-target: **42 units desktop, 36 units mobile** (viewport width < 520px, mirroring the 2D zoom breakpoint). Near 1, far 200.
- Follow: critically-damped smoothing, per-frame factor `t = 1 − exp(−6·dt)` (dt in seconds), plus **0.6-unit look-ahead** in the player's facing direction eased over 600ms.
- Camera target clamped so the frustum never shows past the island edge + 4 units of water — same clamping spirit as the 2D `camX/camY` clamp.
- Idle drift: when player stationary > 4s, target drifts ±0.15 units on an 8s figure-eight. Killed by prefers-reduced-motion.
- The camera follows the player's **ground position only** — never the hop arc (no seasickness).

### 1.3 Map conversion (from the `MAP` array — preserve exactly)
- `W` water border rows 0–1, 28–29 and cols 0–1, 38–39 → open water plane extending 12 units past the island cliff on all sides, then fog-melted.
- `T` tree ring (rows 2 & 27, cols 2 & 37) → voxel trees on grass.
- `G` grass, `P` path (two avenues rows 9–10 and 20–21 + vertical spine cols 19–20), `L` tall grass (two 6×3 patches rows 13–15), `F` flowers (exact tile positions from map).
- **Pond** at tiles (33–35, 13–15) → same water shader, shallow tones.
- `X` nursery fence, rows 22–26 cols 15–26 with the gate gap at the path — white-picket style, see §7.4.
- Buildings 4×4 tiles: About house at (18,4); macrodoc (5,5); mathstreet (31,5); mathwings (5,16); funnify (31,16). Spare slots (14,16), (22,16) stay empty grass until new projects ship.
- Creatures home at (10,11) macrodoc, (29,11) mathstreet, (10,22) mathwings, (29,22) funnify.
- Eggs at (17,24) suno, (20,25) substack, (23,24) x. NPC at (17,8), signpost at (22,8), player start (19,12).
- **The island is a floating slab:** below the shoreline, a stratified dirt cliff drops 6 voxel-layers (0.75 units of visible strata) then tapers 30° inward to a rough keel at y = −2.5. Grass lip overhangs the cliff by **0.25 units** (Mint graft) so the silhouette reads hand-carved.

---

## 2. PALETTE (ALL VALUES ARE ALBEDO — pre-lighting; the sun pushes them peach, the fills push shadows teal)

### 2.1 Terrain
| Element | Hex |
|---|---|
| Grass tile A / B / C (random per tile) | `#7FB069` / `#74A65F` / `#689A55` |
| Dry-gold scorched tiles (6% of grass tiles) | `#A5B05E` |
| Per-voxel jitter (all organic surfaces) | ±4% HSL value, ±2° hue, seeded by world position (deterministic) |
| Tall grass blade base → tip (vertex gradient) | `#4E8546` → `#6BA35C` |
| Tall grass seed heads | `#D9C27E` |
| Path top / sides / 1-voxel inset border | `#E8C592` / `#D8B27F` / `#C69F6C` |
| Path pebbles (3% sprinkle) | `#B98F63` |
| Cliff strata, top → bottom (6 layers ≈ 4 bands) | `#8A5A3C` / `#7A4C32` / `#6B4128` / `#59341F` |
| Flowers: cream / peach heads, stems | `#FFF3D6` / `#FFB88A`, `#5F9450` |

### 2.2 Water
| Element | Hex |
|---|---|
| Deep → shallow (lerp by shore distance over 3 units) | `#1E6B7A` → `#3FA8B5` |
| Shoreline foam ring | `#EAF7EF` |
| Sun-lane specular sparkle | `#FFDCA8` |
| Baked tree-shadow band on water (static vertex tint, 1 unit from land, 30% mix) | `#1A5560` |
| Pond uses shallow ramp only | `#3FA8B5` → `#5FBFC9` |

### 2.3 Foliage & wood
| Element | Hex |
|---|---|
| Canopy 3-step ramp (skirt / mid / top) | `#2F7550` / `#3F8F5F` / `#57A873` |
| Sun-kissed canopy voxels (top-west faces, 15% tint mix) | `#FFB070` |
| Trunk / trunk shadow side | `#7A5238` / `#5F3E2A` |
| Fence rails / posts / end-grain | `#B9855C` / `#96683F` / `#D9A874` |
| Signpost board / carved text grooves / post | `#C1905E` / `#6E4A2C` / `#96683F` |

### 2.4 Buildings (shared cream plaster `#F3E3C6`, shadow-course `#E3CFA9`)
| Building | Roof / ridge | Accents |
|---|---|---|
| ABOUT HOUSE | terracotta `#D96A4B` / `#B54F35` | door `#7A5238`; windows **emissive `#FFD9A0`** — the ONLY lit windows on the island (it's home); chimney |
| MACRODOC | muted teal `#5FA8A0` / `#47867F` | trim `#3E5C58`; "doc" sign emissive `#FFC08A` |
| MATHSTREET | slate-blue `#3E5C7A` / `#2E4660` | gold ticker stripe emissive `#7FE9C3`; brass door `#C9A25A`; tiny ▲ `#35A97F` / ▼ `#E05A4E` ticker voxels on the stripe (Mint graft) |
| MATHWINGS | midnight indigo `#35407A` / `#283060` | star trim `#FFD166`; cape-yellow awning `#F2B33D` |
| FUNNIFY | coral `#FF8E72` / `#E06B52` | confetti dots `#FFD166` / `#7FD4D9` on the fascia |

### 2.5 Characters
| Entity | Colors |
|---|---|
| Player | hoodie `#40B0A0` (kept from 2D fallback), pants `#2E5AAC`, shoes `#FFFFFF`, skin `#FFD9B3`, hair `#2B2B33` |
| NPC Yoonki | identical build, hoodie `#3AA080` + cream cardigan `#FFF1DC` layer (Mint graft — instantly distinguishes the twins) |
| macrodoc creature | paper-gray `#D8D3C8`, teal tie `#47867F` |
| mathstreet creature | suit-navy `#2E4660`, tie `#E05A4E`, gold visor `#FFC048` |
| mathwings creature | sky-blue `#6FB8E8`, cape `#F2B33D` |
| funnify creature | magenta-coral `#E86A8A`, cream belly `#FFF3D6` |
| Eggs | shell `#F5EAD2`; spots: suno lavender `#C9A2E8`, substack ink-orange `#F2A65A`, x gray-blue `#9AB8C7`; nest straw `#D9B872` |

Bodies stay saturated so they pop off the warm ground. Every creature gets 2 crisp `#FFF3D6` highlight voxels on the head (POP graft, warmed to match palette).

### 2.6 UI & atmosphere
- Dialog/encounter panels keep the existing GBA-style DOM chrome, recolored: panel `#2B3440`, text `#FFF3D6`, selection caret `#FFB88A`, panel border `#F3E3C6`.
- Fog `#F5C6A0`. Pollen motes `#FFE3B3`. Chimney smoke `#F5DFC8`.
- Target rendered read (post-lighting sanity check): lit grass ≈ `#C8B565`, shadowed grass ≈ `#4A7A6E`. Warm gold vs teal green — **never gray**.

---

## 3. LIGHTING RIG (the 70%-of-quality section)

Renderer: `ACESFilmicToneMapping`, `toneMappingExposure = 1.15`, `outputColorSpace = SRGBColorSpace`, `shadowMap.type = PCFSoftShadowMap`.

### 3.1 Sun (key)
- `DirectionalLight`, color `#FFB070`, intensity **2.3**.
- **Elevation 22°, azimuth 235°** (from the WSW). Direction vector ≈ `(-0.53, 0.37, -0.76)` normalized; position island-center + direction · 60.
- Shadows stretch ≈ 2.5× object height toward the NE — a 3-unit tree throws a 7.4-unit shadow striping the paths. This is intentional and load-bearing.
- Shadow camera: orthographic, left/right ∓26, top/bottom ±22, near 10, far 120, fitted tight to the island. `mapSize` 2048×2048, `radius = 5` (soft penumbra), `bias = -0.0004`, `normalBias = 0.025`.

### 3.2 Fills
- `HemisphereLight`: sky `#7FD4D9` (teal), ground `#B96A45` (terracotta bounce), intensity **0.55**. This is what turns shadow sides teal instead of black.
- Rim kicker: second `DirectionalLight` from azimuth 55°, elevation 30°, color `#4FA8B8`, intensity **0.28**, `castShadow = false`. Separates east faces from the fog.
- **NO AmbientLight anywhere.** The hemisphere does that job with color.

### 3.3 Fog
- `THREE.Fog(0xF5C6A0, 55, 130)`. Camera sits ~42 units out: near island crystal clear, far water edge melts 20–40% into peach, nothing fully vanishes.

### 3.4 Encounter relight (Mint graft, adapted)
On encounter start, over **800ms** (synced exactly to the `AudioMan.fadeTo('enc', 800)` crossfade), lerp:
- Sun → `#FF8E72`, intensity 1.9, elevation 16° (deeper into sunset).
- Hemisphere → sky `#6C7BD9` / ground `#C97A5A`, intensity 0.65.
- `fog.near` 55 → 30 (creams the background out behind the creature).
On RUN, reverse over **700ms** (synced to `fadeTo('over', 700)`). REDUCED: snap in 200ms. The mood shift IS the transition — zero post-processing.

---

## 4. SKY & ATMOSPHERE

- 200-unit inverted sphere (`BackSide`), simple gradient shader, 4 stops by world-Y direction: zenith `#3E7C8F` → 35° `#6FB4BC` → 12° `#FFD9A8` → horizon `#FF9E6B`. Below horizon fades to `#E8A87A` so fog reads as seamless continuation.
- **Sun disc baked into the shader** at azimuth 235° / elevation 22°: 3° core `#FFF3D6` inside an 8° glow `#FFB070`, smoothstep falloff. No lens flare.
- **Clouds:** 5–7 flat voxel-cloud slabs (2×1×5 to 4×1×9 units), albedo `#FFEFD9` tops / `#E8A87A` undersides, MeshLambert, drifting east at 0.12 units/s, wrapping at ±60 units, y = 16–20. They do NOT use the shadow map; instead each carries a 40%-opacity radial-gradient sprite shadow blob that drifts with it across the island — soft cloud shadows sweeping the grass for free.
- **Under-island (Mint graft):** 2 mini drifting rock islets (same cliff strata palette, one carrying a single tree) bobbing at y = −7 and −10, 30% fog-faded, ±0.3-unit sine bob over 9s/11s. Sells the floating-diorama shot without cluttering the play view.

---

## 5. MATERIALS & MESH PIPELINE

### 5.1 The one material
`MeshLambertMaterial { vertexColors: true, flatShading: true }` for EVERYTHING opaque. No textures anywhere. Metalness/roughness don't exist in Lambert — correct for the matte, painted look (deliberately rejecting POP's plastic GGX sheen; golden-hour light on matte surfaces reads more premium).

### 5.2 Draw-call budget
≤ 6 static merged `BufferGeometry` chunks: (1) terrain+cliff slab, (2) trees, (3) buildings, (4) fences+signpost+props, (5) tall grass (own chunk — it has the wind shader `onBeforeCompile`), (6) flowers. Plus one small merged mesh per dynamic entity: player, NPC, 4 creatures, 3 eggs (each 150–400 voxels, transformed as a unit). Plus water plane, sky sphere, clouds, particles. Target ≈ 20 draw calls total.

### 5.3 Baked vertex tricks (in priority order)
1. **Baked vertex AO** — at build time darken vertex colors 14% where a voxel face meets an occupied neighbor edge (inner corners), 22% in double-corners; darken the bottom 2 voxel rows of every object 10%. Grounds everything with zero runtime cost.
2. **Painted sun rim** — top-face voxels on west/south exposed edges get +8% lightness and 6% hue shift toward `#FFB070`, baked. Reads as hand-painted edge light.
3. **Chamfered silhouettes (Mint graft)** — replace every exposed convex corner voxel column on roofs, canopies, and creature heads with a 45° bevel strip. At diorama scale everything reads soft-rounded, not "programmer voxels."
4. **Contact blobs** — stamp a 0.35-unit-radius, −14% darkening blob into ground vertex colors under every building, tree, and fence run.
5. **Deterministic jitter** — ±4% value / ±2° hue per voxel on organic materials only (grass, canopy, cliff, tall grass); buildings and characters stay clean.

### 5.4 Emissives
Lit windows/signs are tiny separate `MeshBasicMaterial` meshes (`#FFD9A0`, `#FFC08A`, `#7FE9C3`) + a 1.3×-scaled transparent copy at 25% opacity as a cheap glow halo.

### 5.5 Water shader (the one real custom shader)
- 64×46-unit plane at y = −0.15 (covers moat + margin), 2 verts/unit; pond reuses the material.
- Vertex: Y displaced by two crossed sines — amplitudes 0.06, wavelengths 3.1 and 4.7 units, speeds 0.35 and 0.22 units/s, directions 30° and 115°.
- Fragment: lerp `#1E6B7A` → `#3FA8B5` by per-vertex shore-distance attribute (0 at shore → 1 at 3 units out).
- **Sun-lane:** `pow(max(dot(reflect(sunDir, N), viewDir), 0.0), 120.0) · #FFDCA8 · 1.6` — a glittering streak running from the western horizon toward camera. Animates every idle frame; this is the X-post money shot.
- **Foam:** 0.4-unit band `#EAF7EF` at shore, modulated by `sin(time·1.3 + shoreDist·8.0)` so it laps.
- Water `receiveShadow = OFF` (keeps the glow); the tree ring's reflection-shadow is the baked `#1A5560` vertex band from §2.2.

### 5.6 Shadow flags
Every opaque mesh `castShadow = receiveShadow = true`. Characters additionally get a 0.5-unit circular dark quad, opacity 0.25, locked to their ground position (POP graft) — keeps them grounded mid-hop where the shadow map lags.

---

## 6. MOTION (all timings inherit the 2D engine — game feel is identical)

### 6.1 Shared spring vocabulary (Mint graft — the whole cast is molded from the same clay)
One squash-stretch curve, scaled per entity: takeoff `scale(1.05, 0.92, 1.05)` for 40ms → apex `scale(0.95, 1.10, 0.95)` → landing `scale(1.08, 0.86, 1.08)` held 60ms → damped spring back to 1.0 (≈14Hz feel, settle ~120ms). Player uses 100% amplitude, creatures 80%, NPC 60% (on its rare turn-in-place), eggs express it as wobble.

### 6.2 Player
- Step: **170ms/tile**, XZ linear (grid-faithful), hop arc `Y = 0.28·sin(π·t)`.
- Landing: 4-particle dust puff `#E8C592`, sizes 0.08–0.14, 300ms lifetime, rise 0.3 units — on path and grass tiles.
- Tap-to-turn: keeps the **90ms grace**; mesh yaw slerps to new facing in 80ms.
- Bump (blocked step): 60ms 0.1-unit lean into the wall (POP graft), paired with the existing 160Hz triangle-wave SFX.
- Idle: breathing scaleY 1.00 ↔ 1.015 on a 1.6s sine.

### 6.3 Creatures
- Step: **300ms/tile**, hop height 0.22, wander cadence untouched (next move 900–3500ms, 35% idle, 2-tile leash).
- Idle breathing: scaleY 1.00 → 1.035, period 1.6s, **phase-offset per creature by `home.x`** (direct port of `sin(now/320 + home.x)`).
- Every 6–10s, one random emote: double hop (2× 180ms, height 0.35) or 360° yaw spin over 450ms.

### 6.4 NPC Yoonki
Faces the player when within 3 tiles (yaw slerp 200ms); otherwise a slow 8s look-around cycle.

### 6.5 Eggs
- Wobble ±5° roll, 500ms, 3 oscillations ease-out, at random 3–6s intervals; **never simultaneous** (min 1.2s stagger).
- On wobble, one floating pictogram particle rises 0.8 units over 900ms (POP graft): ♪ `#C9A2E8` (suno), ✎ `#F2A65A` (substack), chirp-dot `#9AB8C7` (x). Built from 3–5 voxels, no textures.

### 6.6 Ambient world
- **Tall grass wind:** 2-line vertex shader on the tall-grass chunk — `lean = 0.05·sin(time·1.4 + worldX·0.8 + worldZ·0.5)` applied above y = 0.3. Rustle burst when the player lands in an `L` tile: 6 leaf quads `#6BA35C`, 400ms radial burst, tuft bends 12° away from travel for 250ms.
- Flowers sway ±4° on a 2s sine, phase-offset by (x+z).
- **Pollen motes:** 110 additive point sprites `#FFE3B3`, sizes 0.05–0.12, rising 0.12 units/s with sine wander, opacity twinkling 0.4–1.0; density ×2 inside flower clusters and the nursery.
- Chimney smoke (About house): one 0.25-unit puff every 900ms, rises 0.5 units/s, scales 1 → 2.2, opacity 0 → 0.35 → 0 over 3.5s, tint `#F5DFC8`.
- Interaction hint (replaces the 2D "!"): the facing target's mesh lerps `emissive` to its accent color × 0.35 over 150ms (Mint graft), plus a 3-voxel `#FFF3D6` "!" bobbing `sin(now/200)·0.08` units above it — same 200ms bob period as the 2D build.

### 6.7 Encounter sequence
Keep the existing DOM overlay timing chain **exactly**: white flash 420ms → iris class at 440ms → world swap at 900ms → iris-open clears at +520ms; RUN reverses via 260ms fade. Underneath the overlay: camera dollies 42 → 22 units toward the creature with cubic-in-out over 900ms, the §3.4 relight and fog.near lerp run over 800ms, and the creature turns to face camera and does one hop on reveal. On VISIT activation, a restrained 16-piece ember-mote burst (POP graft, recolored): `#FFD166 / #FFB070 / #EAF7EF` quads, 0.1 units, 60° up-cone at 3–4 units/s, gravity −9.8, 1.0s lifetime. The encounter text panel, typewriter (2 chars/24ms), VISIT-as-real-anchor, RUN, and egg INCUBATING variant are byte-identical behavior to today.

### 6.8 Reduced motion (`prefers-reduced-motion`)
Hops become flat slides; kill squash-stretch, dust, motes, wind, sways, spins, emotes, camera drift, islet bob, smoke, and the mote burst; camera follow factor becomes a fast 0.25 lerp; transitions use the existing 80ms black cut; audio fades at 200ms. Mirrors the engine's `REDUCED` flag exactly.

---

## 7. BUILD SPECS FOR MODELERS

1. **Buildings:** 4×4×~5 units (32×32×40 voxels), oversized roofs overhanging walls by 2 voxels, chamfered ridges. Door centered on the path-facing side. 2–3 windows per facade (glass `#AEE6FF` unlit except About house). Each building's personality lives in its roof color + one prop: macrodoc rooftop antenna, mathstreet ticker stripe with ▲▼ voxels, mathwings star finial + awning, funnify balloon-dot fascia, About house chimney.
2. **Trees:** fat trunk 2×2 voxels wide × 6 tall, canopy an 8–10-voxel chamfered blob using the 3-step ramp, 2–3 `#FFB070`-tinted sun-kiss voxels on the top-west shoulder.
3. **Characters:** 2-tile-tall bighead proportion — total height 12 voxels (1.5 units), head 6 of those. Player/NPC identical rig; NPC adds the cardigan layer. Creatures 10–14 voxels tall, each silhouette-distinct (macrodoc: rectangular page-body + tie; mathstreet: visor + briefcase voxel; mathwings: cape trailing 2 voxels; funnify: round + ear tufts).
4. **Nursery fence:** white-picket restyle of the `X` tiles — posts `#F3E3C6` (matches plaster), caps `#D9A874`, rails `#B9855C`; reads warm, not toy-pink. Eggs sit in straw nests (`#D9B872`, 5×5×2-voxel ring).
5. **Signpost:** 2 voxel-wide post `#96683F`, board `#C1905E` with routed groove lines `#6E4A2C`, slight 4° camera-friendly yaw.

---

## 8. PERFORMANCE BUDGET
- ≤ 20 draw calls, ≤ 500k triangles total (merged), one 2048² shadow map, one custom shader (water) + one gradient shader (sky) + one 2-line wind injection (tall grass).
- No post-processing passes at all. No SSAO (baked), no bloom (scaled-copy halos), no DOF.
- Target 60fps on a 2020 phone; the mobile camera distance of 36 units keeps overdraw bounded.

## 9. THE THREE SIGNATURE SHOTS (verify these before shipping)
1. **The long-shadow street:** player on the vertical path spine at dusk-gold, 2.5×-height tree shadows striping the cream path, teal shadow sides. If shadows read gray, the hemisphere intensity is wrong.
2. **The sun-lane:** camera idle near the west shore — glittering `#FFDCA8` streak on the moat, foam lapping, far edge melting into peach fog.
3. **The floating diorama:** zoomed out — stratified slab silhouette against the 4-stop gradient sky, sun disc glowing at 235°/22°, two faded islets below, cloud shadow sweeping the grass.
