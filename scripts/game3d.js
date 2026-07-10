/* ============================================================================
   YOONKI WORLD 3D — boot + game orchestration
   A quarter-view voxel diorama portfolio. Everything visual follows
   docs/VISUAL_PLAYBOOK.md; interactions are full parity with the old 2D
   engine (dialog, encounters, eggs, BGM crossfade, mute, help, hints),
   rebuilt around free analog movement.
   ========================================================================== */

import * as THREE from 'three';
import { buildGeometry } from './voxel/voxel.js';
import {
  REDUCED, buildMap, tileAt, clamp, CAM,
  NPC_POS, SECRET_POS, FOUNTAIN, MAP_W, MAP_H, SUN, HEMI
} from './game3d/const.js';
import { createSkyDome, createLights, createClouds } from './game3d/sky.js';
import { buildGround, buildWater } from './game3d/ground.js';
import { buildWorld, createColliders } from './game3d/world.js';
import {
  createPlayer, createNPC, createCreatures, createEggs, createSecret
} from './game3d/actors.js';
import { createToys } from './game3d/physics.js';
import { createParticles } from './game3d/particles.js';
import { createAudio } from './game3d/audio.js';
import { createCameraRig, screenToGround } from './game3d/camera.js';
import { createUI } from './game3d/ui.js';
import { createPost } from './game3d/post.js';
import { loadGLB } from './game3d/glbassets.js';
import { createHouseInterior } from './game3d/interior.js';

window.__ywBooted = true;
if (window.__ywBootTimer) clearTimeout(window.__ywBootTimer);

const audio = createAudio();
const ui = createUI(audio);

/* ---- WebGL availability ------------------------------------------------ */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

async function boot() {
  if (!webglOK()) { ui.showFallback('WebGL unavailable'); return; }
  const yieldFrame = () => new Promise(r => setTimeout(r, 16));

  /* ---- authored GLB assets: preload during the title screen -------------
     Every VERIFIED asset from docs/GLB_PIPELINE.md is fetched in parallel
     while the engine/terrain phases run. loadGLB resolves null on any
     missing/broken file (per-asset fallback -> the voxel model stays), so
     the game boots fine even with an empty assets/3d/. */
  const GLB_PRELOAD = [
    'macrodoc', 'mathstreet', 'mathwings', 'funnify', 'lasthand', 'goldie',
    'bld_about_house', 'bld_macrodoc', 'bld_mathstreet', 'bld_mathwings',
    'bld_funnify', 'bld_lasthand',
    'tree_a', 'tree_b', 'fountain', 'egg'
  ];
  // monotonic progress: GLB downloads race the engine phases, so the bar
  // only ever moves forward no matter which callback lands first
  let loadPct = 0;
  function bumpLoad(pct, label) {
    if (pct <= loadPct) return;
    loadPct = pct;
    ui.setLoad(pct, label);
  }
  const glbAssets = {};
  let glbDone = 0;
  // byte-level progress: the model phase (14 -> 62) is the longest stretch on
  // real networks — aggregate per-file download fractions so the bar moves
  // continuously instead of freezing between per-asset jumps
  const glbProgress = new Array(GLB_PRELOAD.length).fill(0);
  function bumpModelLoad() {
    const sum = glbProgress.reduce((a, b) => a + b, 0);
    bumpLoad(14 + Math.round(48 * sum / GLB_PRELOAD.length),
      'LOADING... MODELS ' + glbDone + '/' + GLB_PRELOAD.length);
  }
  const glbReady = Promise.all(GLB_PRELOAD.map((n, i) =>
    loadGLB(n, {
      // buildings + static props cast real shadow-map shadows: the sun never
      // moves and shadowMap.autoUpdate is false, so this is one static bake.
      // Trees matter most — const.js SUN elevation (34°) is calibrated so the
      // coastal ring visibly stripes the cream paths (the voxel treeMesh had
      // castShadow=true; the GLB swap must not lose that grounding cue). The
      // ±0.014 rad idle sway is far below shadow-map texel size, so the baked
      // shadow never visibly desyncs. Creatures/eggs stay on blob shadows.
      castShadow: n.startsWith('bld_') ||
        n === 'tree_a' || n === 'tree_b' || n === 'fountain',
      onProgress: (k) => { glbProgress[i] = Math.max(glbProgress[i], k); bumpModelLoad(); }
    }).then((g) => {
      glbAssets[n] = g;
      glbDone++;
      glbProgress[i] = 1;                      // missing files count as done
      bumpModelLoad();
    })
  )).then(() => glbAssets);

  bumpLoad(6, 'LOADING... ENGINE');
  await yieldFrame();

  /* ---- house interior state (declared before resize() can run) --------- */
  let house = null;                // built lazily on first door interact —
  let inHouse = false;             // the 260ms door fade covers the build
  function getHouse() {
    if (!house) house = createHouseInterior();
    return house;
  }

  /* ---- renderer ------------------------------------------------------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: ui.els.canvas, antialias: true });
  } catch (e) {
    ui.showFallback(e);
    return;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const uTime = { value: 0 };

  /* ---- sky + lights ------------------------------------------------------ */
  const sky = createSkyDome();
  scene.add(sky);
  const lights = createLights(new THREE.Vector3(20, 0, 15));
  scene.add(lights.sun, lights.sun.target, lights.hemi);
  const clouds = createClouds(10);
  scene.add(clouds.mesh, clouds.shadowMesh);

  /* ---- encounter relight (ART_BIBLE 3.4): gentle golden-hour hint -------
     The old full sunset grade (coral sun / indigo sky / rust bounce) turned
     paths salmon, grass olive and the nursery eggs purple — it read as a
     rendering error, not a mood. Encounter colors now sit barely warmer
     than the base daylight, the blend is clamped to half strength, and the
     encounter is sold with FOCUS instead of hue: a deeper vignette plus a
     soft warm point light hovering over the creature. ---------------------- */
  const relight = {
    t: 0, dir: 0,                              // 0 = world light, 1 = encounter
    baseSun: new THREE.Color(SUN.color),
    baseSunI: lights.sun.intensity,
    baseHemiSky: new THREE.Color(HEMI.sky),
    baseHemiGround: new THREE.Color(HEMI.ground),
    encSun: new THREE.Color(0xFFD9A8),
    encHemiSky: new THREE.Color(0xA8C4EC),
    encHemiGround: new THREE.Color(0xE8C9A0)
  };
  // warm key over the encounter subject (positioned in startEncounter)
  const encLight = new THREE.PointLight(0xFFE8C0, 0, 6);
  encLight.castShadow = false;
  scene.add(encLight);
  const CLOUD_SHADOW_BASE = clouds.shadowMesh.material.opacity;
  function updateRelight(dt) {
    if (relight.dir === 0) return;
    // 800ms in / 700ms out, synced to the bgm fadeTo durations
    const dur = REDUCED ? 0.2 : (relight.dir > 0 ? 0.8 : 0.7);
    relight.t += (relight.dir / dur) * dt;
    if (relight.t <= 0) { relight.t = 0; relight.dir = 0; }
    if (relight.t >= 1) { relight.t = 1; relight.dir = 0; }
    const k = relight.t * relight.t * (3 - 2 * relight.t);   // smoothstep
    lights.sun.color.copy(relight.baseSun).lerp(relight.encSun, k * 0.5);
    lights.sun.intensity = relight.baseSunI * (1 - k * 0.08);
    lights.hemi.color.copy(relight.baseHemiSky).lerp(relight.encHemiSky, k * 0.5);
    lights.hemi.groundColor.copy(relight.baseHemiGround).lerp(relight.encHemiGround, k * 0.5);
    // focus: vignette deepens ~0.55 -> 0.8 (≈25% -> 36% corner falloff)
    post.setVignette(0.55 + k * 0.25);
    // warm halo on the subject (Lambert lights are physical: scale by π);
    // 0.78 = +30% rim-pop so the subject separates from the backdrop
    encLight.intensity = k * 0.78 * Math.PI;
    // drifting cloud shadows read as glitches under the graded close-up —
    // fade them to a whisper while the encounter holds
    clouds.shadowMesh.material.opacity =
      CLOUD_SHADOW_BASE + (0.08 - CLOUD_SHADOW_BASE) * k;
  }

  bumpLoad(12, 'LOADING... ISLAND');
  await yieldFrame();

  /* ---- terrain ------------------------------------------------------------ */
  const tiles = buildMap();
  const ground = buildGround(tiles);
  scene.add(ground);
  const water = buildWater(tiles);
  scene.add(water.mesh);

  /* ---- authored models (bar 14 -> 62 via the per-asset callback) ---------- */
  const glb = await glbReady;

  bumpLoad(66, 'LOADING... TOWN');
  await yieldFrame();

  /* ---- world + colliders --------------------------------------------------- */
  const projects = window.PROJECTS || [];
  const colliders = createColliders(tiles);
  const world = buildWorld(scene, tiles, projects, colliders, uTime, glb);

  bumpLoad(76, 'LOADING... FRIENDS');
  await yieldFrame();

  /* ---- actors ---------------------------------------------------------------- */
  const player = createPlayer(scene);
  const npc = createNPC(scene);
  colliders.addCircle(NPC_POS.x, NPC_POS.z, 0.32);
  const creatureSys = createCreatures(scene, projects, glb);
  const eggSys = createEggs(scene, projects, glb);
  for (const e of eggSys.eggs) colliders.addCircle(e.pos.x, e.pos.z, 0.2);
  const secret = createSecret(scene, glb);
  colliders.addCircle(SECRET_POS.x, SECRET_POS.z, 0.28);

  const particles = createParticles(scene);
  const toys = createToys(scene, colliders, {
    onKnock: (b, s) => audio.sfx.knock(Math.min(2.4, s * 0.8)),
    onPinDown: (b) => { particles.dust(b.pos.x, b.pos.z, 5); },
    onPinReset: (b) => { particles.sparkle(b.pos.x, 0.5, b.pos.z); audio.sfx.sparkle(); },
    onBounce: (b) => { audio.sfx.bounce(); particles.dust(b.pos.x, b.pos.z, 2); }
  });

  bumpLoad(88, 'LOADING... SUNSHINE');
  await yieldFrame();

  /* ---- camera + post ----------------------------------------------------------- */
  const cam = createCameraRig(window.innerWidth / window.innerHeight);
  const post = createPost(renderer, scene, cam.camera);
  // boot the renderer behind the title overlay: the wide diorama with slow
  // drift + clouds is the game's best asset — never hide it behind flat navy
  cam.showTitle();

  /* ---- quality tiers -------------------------------------------------------------- */
  const coarse = matchMedia('(pointer: coarse)').matches;
  let tier = coarse ? 'mid' : 'high';
  function applyTier(t2) {
    tier = t2;
    const dpr = window.devicePixelRatio || 1;
    if (t2 === 'high') {
      renderer.setPixelRatio(Math.min(dpr, 2));
      lights.sun.castShadow = true;
      setShadowSize(2048);
      // every shadow caster is static (terrain/buildings/trees; actors use
      // blob shadows) and the sun never moves — render the map once and
      // freeze it. Saves ~400K tris/frame for pixel-identical output.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      ui.els.vignette.hidden = true;
    } else if (t2 === 'mid') {
      renderer.setPixelRatio(Math.min(dpr, 1.5));
      lights.sun.castShadow = true;
      setShadowSize(1024);
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      ui.els.vignette.hidden = true;
    } else {
      renderer.setPixelRatio(1);
      lights.sun.castShadow = false;
      renderer.shadowMap.autoUpdate = false;
      ui.els.vignette.hidden = false;
    }
    post.setTier(t2);
    resize();
  }
  function setShadowSize(px) {
    if (lights.sun.shadow.mapSize.x !== px) {
      lights.sun.shadow.mapSize.set(px, px);
      if (lights.sun.shadow.map) {
        lights.sun.shadow.map.dispose();
        lights.sun.shadow.map = null;
      }
      // the map was just disposed — with autoUpdate frozen it must be
      // re-rendered once or shadows vanish until the next tier change
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.setAspect(w / h);
    post.setSize(w, h);
    if (house) house.setAspect(w / h);
  }
  window.addEventListener('resize', resize);
  applyTier(tier);

  bumpLoad(96, 'LOADING... DONE');
  await yieldFrame();

  /* =====================================================================
   *  GAME STATE
   * =================================================================== */
  let state = 'title';        // title | intro | world | interior | dialog | transition | encounter
  let encounterCtx = null;    // { project, creature, isEgg }

  /* ---- visited tracking + celebration ----------------------------------- */
  const liveProducts = projects.filter(p => p.url && p.kind !== 'egg' && (p.category || 'product') === 'product');
  // celebration flag is versioned by roster size: a visitor who celebrated
  // at 4/4 gets one more show when the roster grows to 5 (the plain
  // 'yw3_celebrated' key from the 4-product era is intentionally ignored)
  const CELEB_KEY = 'yw3_celebrated_' + liveProducts.length;
  let visited = {};
  let celebrated = false;
  try {
    visited = JSON.parse(localStorage.getItem('yw3_visited') || '{}');
    celebrated = localStorage.getItem(CELEB_KEY) === '1';
  } catch (e) { /* noop */ }
  let pendingCelebration = false;
  function visitedCount() {
    return liveProducts.filter(p => visited[p.id]).length;
  }
  function paintProgress() {
    if (liveProducts.length) ui.setProgress(visitedCount(), liveProducts.length);
  }
  paintProgress();
  function celebrate() {
    if (document.hidden) { pendingCelebration = true; return; }
    pendingCelebration = false;
    // over the player's patch of island, so the ortho camera frames it
    const cx = Math.min(Math.max(player.pos.x, 8), MAP_W - 8);
    const cz = Math.min(Math.max(player.pos.z + 1, 6), MAP_H - 6);
    particles.fireworksShow(cx, cz);
    for (let i = 0; i < 7; i++) setTimeout(() => audio.sfx.firework(), 400 + i * 700);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingCelebration) celebrate();
  });
  function markVisited(p) {
    if (!visited[p.id]) {
      visited[p.id] = true;
      try { localStorage.setItem('yw3_visited', JSON.stringify(visited)); } catch (e) { /* noop */ }
      paintProgress();
      if (encounterCtx && encounterCtx.focus) {
        particles.emberBurst(encounterCtx.focus.x, (encounterCtx.focus.y || 0.6) + 0.3, encounterCtx.focus.z);
      }
      if (visitedCount() >= liveProducts.length && liveProducts.length > 0 && !celebrated) {
        celebrated = true;
        try { localStorage.setItem(CELEB_KEY, '1'); } catch (e) { /* noop */ }
        setTimeout(celebrate, 900);
      }
    }
  }

  /* ---- interactables ------------------------------------------------------ */
  const interactables = [...world.interactables];
  interactables.push({
    id: 'npc', kind: 'npc', pos: { x: NPC_POS.x, z: NPC_POS.z }, mesh: npc.inner,
    markerX: NPC_POS.x, markerY: 1.95, markerZ: NPC_POS.z, r: 1.5
  });
  interactables.push({
    id: 'secret', kind: 'secret', pos: SECRET_POS, mesh: secret.inner,
    markerX: SECRET_POS.x, markerY: 1.35, markerZ: SECRET_POS.z, r: 1.4
  });
  for (const e of eggSys.eggs) {
    interactables.push({
      id: 'egg_' + e.id, kind: 'egg', project: e.project, pos: e.pos,
      mesh: e.inner,
      focus: { x: e.pos.x, y: 0.42, z: e.pos.z },
      markerX: e.pos.x, markerY: 1.15, markerZ: e.pos.z, r: 1.3
    });
  }
  for (const c of creatureSys.creatures) {
    interactables.push({
      id: 'creature_' + c.id, kind: 'creature', project: c.project,
      pos: c.pos, creature: c, dynamic: true, mesh: c.inner,
      markerY: 1.7, r: 1.5
    });
  }

  function nearestInteractable() {
    let best = null, bestD = 1e9;
    const list = inHouse ? house.interactables : interactables;
    for (const it of list) {
      const dx = player.pos.x - it.pos.x, dz = player.pos.z - it.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < (it.r || 1.5) && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  /* ---- "!" marker (ART_BIBLE 6.6): compact 3-voxel glyph — cream shell,
          warm gold core dot — with a soft 25% halo copy, bobbing above the
          target. Small on purpose: never a scaffolding pole at rooflines. --- */
  const markerGeo = buildGeometry({
    palette: ['#FFF3D6', '#F7D75E'],
    // warm gold column + cream dot: reads on cream plaster AND on grass
    voxels: [[0, 0, 0, 0], [0, 2, 0, 1], [0, 3, 0, 1]],
    ao: false, sunRim: false, chamfer: 0.3
  }, { voxelSize: 0.19 });
  const marker = new THREE.Group();
  const markerCore = new THREE.Mesh(markerGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true }));
  const markerHalo = new THREE.Mesh(markerGeo,
    new THREE.MeshBasicMaterial({
      color: 0xF7D75E, transparent: true, opacity: 0.25, depthWrite: false
    }));
  markerHalo.scale.setScalar(1.32);
  markerHalo.position.y = -0.1;                       // keep the halo centered
  marker.add(markerHalo, markerCore);
  marker.rotation.y = Math.PI / 4;
  marker.visible = false;
  scene.add(marker);

  /* ---- facing-target emissive lerp (150ms): the nearest interactable's
          mesh warms up softly while the "!" hovers over it ----------------- */
  const HL_COLOR = new THREE.Color(0xFFC97A);
  const hl = { obj: null, k: 0 };
  function paintHl(obj, k) {
    obj.traverse((m) => {
      if (m.isMesh && m.material && m.material.emissive) {
        // gentle: additive emissive doubles very dark albedos fast, so this
        // stays a warm acknowledge-pulse, never a hair-color change
        m.material.emissive.copy(HL_COLOR).multiplyScalar(0.025 * k);
      }
    });
  }
  function updateHighlight(obj, dt) {
    if (obj !== hl.obj) {
      if (hl.obj) paintHl(hl.obj, 0);
      hl.obj = obj;
      hl.k = 0;
    }
    if (!hl.obj) return;
    hl.k = Math.min(1, hl.k + dt / 0.15);
    paintHl(hl.obj, hl.k);
  }

  /* ---- dialogs ------------------------------------------------------------------ */
  const NPC_PAGES = [
    'Oh! A visitor! I\'m YOONKI. Hold on... you look strangely familiar.',
    'By day I lead go-to-market at GOOGLE in San Francisco. Launches, strategy, a heroic amount of spreadsheets.',
    'By night, I build. Every creature roaming this island is a real thing I shipped — AI apps, arcade games, even music.',
    'Career log: LINE, Seoul (2014-2018), growth PM. GOOGLE KOREA (2018-2021), product marketing. GOOGLE SF (2021-now), GTM.',
    'Off duty you\'ll find me deep in tech & AI, making songs, or losing gracefully at video games.',
    'Go say hi to the creatures — walk up and press the action button. Check the eggs in the nursery, and peek at the DEMO LAB if you like experiments.'
  ];
  const SECRET_PAGES = [
    '...!',
    'You found GOLDIE, the island\'s secret resident. It has been hiding behind the tree ring since launch day.',
    'GOLDIE whispers: "The builder ships fast and hides easter eggs. You have excellent taste in shortcuts. Tell no one."'
  ];
  const FOUNTAIN_PAGES = [
    'You toss a coin into the fountain. Plink!',
    'The plaque reads: "YOONKI WORLD FOUNTAIN — wishes are processed within 3-5 business days."'
  ];
  function labPages() {
    return world.hasDemos
      ? ['Welcome to the DEMO LAB — the fenced yard where Yoonki\'s experiments live before they grow into real products.',
         'Step up to any stall and interact to try a demo.']
      : ['Welcome to the DEMO LAB — the fenced yard where Yoonki\'s experiments will live before they grow into real products.',
         'The stalls are empty right now... but the crates keep arriving. Experiments are brewing — check back soon!'];
  }
  const WIP_PAGES = [
    'UNDER CONSTRUCTION.',
    'New demos are being assembled in here. The pedestals are ready and waiting. Come back soon!'
  ];

  function openDialog(name, pages, links) {
    const back = inHouse ? 'interior' : 'world';   // plaque dialogs return inside
    state = 'dialog';
    ui.openDialog(name, pages, links, () => { state = back; });
  }
  function signPages() {
    const c = creatureSys.creatures.length, e = eggSys.eggs.length;
    return [
      '« YOONKI WORLD »  Population: 1 human, ' + c +
      ' creature' + (c === 1 ? '' : 's') + ', ' + e +
      ' egg' + (e === 1 ? '' : 's') + ', 1 secret. Links below, traveler.'
    ];
  }

  /* ---- encounters (Pokemon battle framing) --------------------------------
     The camera NEVER rotates for an encounter: it keeps the world's 45°
     azimuth and does one short pan+zoom to a composed two-shot — the old
     swing-to-the-approach-bearing cut spun the island up to ~200° (the
     azimuth tween had no shortest-path wrap) and left the player wherever
     they happened to stand, regularly overlapping the creature. Ortho
     projection makes overlap unfixable by framing alone, so we do what
     Pokemon does: cut to a stage. During the iris blackout the player is
     snapped into a "trainer slot" in the lower-left foreground (screen-space
     computed, collision-checked, with mirrored/shallow fallbacks for tight
     yards like the fenced nursery) and restored under the exit fade. -------- */

  // stage-slot candidates as (screen-right, screen-up) offsets in wu from
  // the subject; first unblocked wins. Order: classic lower-left, then
  // nearer/shallower, then the mirrored lower-right family.
  const STAGE_OFFSETS = [
    [-1.85, -0.95], [-1.35, -0.75], [-2.10, -0.45],
    [1.85, -0.95], [1.35, -0.75], [2.10, -0.45],
    [-0.95, -0.90], [0.95, -0.90]                       // tight-yard rescues
  ];
  const _shotBox = new THREE.Box3();
  function measureSubjectH(obj, fallback) {
    if (!obj) return fallback;
    try {
      _shotBox.setFromObject(obj);
      const h = _shotBox.max.y - Math.min(0, _shotBox.min.y);
      if (h > 0.3 && h < 6) return h;
    } catch (e) { /* noop */ }
    return fallback;
  }
  /** Encounter-zoom height for a creature. GLB bodies carry their contract
   *  height from the loader (userData.targetHeight, 1.25 creature boost
   *  included) — measuring the live group instead would bake the idle-bob/
   *  hop Y offset of whatever instant the first encounter starts into the
   *  permanent cache (~15% wide on a mid-hop lasthand). Voxel fallbacks are
   *  measured, minus the animated inner offset. */
  function creatureSubjectH(c) {
    if (c.glb) {
      for (const ch of c.inner.children) {
        const h = ch.userData && ch.userData.targetHeight;
        if (h > 0.3 && h < 6) return h;
      }
    }
    return Math.max(0.5, measureSubjectH(c.inner, 1.6) - (c.inner.position.y || 0));
  }
  /** March the tile map from the subject toward the camera: a tree/fence
   *  whose top would rise above the subject's base slices the shot. Try the
   *  base 35° first, then raise the camera until the foreground clears
   *  (the south nursery eggs sit 0.2 wu off the picket fence — at 35° the
   *  pickets cover the egg's lower third; 48° drops them out of frame). */
  function pickShotElevation(focus) {
    const azr = THREE.MathUtils.degToRad(CAM.azimuth);
    const dirX = Math.cos(azr), dirZ = Math.sin(azr);    // subject -> camera
    const rX = Math.sin(azr), rZ = -Math.cos(azr);       // screen right
    // occluders as height bands: fences are ground-up pickets; trees only
    // block with their canopy (a thin trunk in front is fine — treating the
    // whole tile as a 2.3 wu box forced 60° everywhere near the tree ring)
    const OCC_BAND = { T: [0.85, 2.2], X: [0, 0.72] };
    const Y0 = 0.25;                                     // protect near-base
    for (const el of [CAM.elevation, 48, 58]) {
      const tanEl = Math.tan(THREE.MathUtils.degToRad(el));
      let blocked = false;
      for (const off of [0, -0.8, 0.8]) {                // center ± lateral
        for (let s = 0.6; s <= 5.6; s += 0.35) {
          const x = focus.x + rX * off + dirX * s;
          const z = focus.z + rZ * off + dirZ * s;
          const t2 = tileAt(tiles, Math.floor(x), Math.floor(z));
          // lateral rays only veto fences: their hard picket line slices a
          // frame anywhere, while off-center canopy reads as foreground
          // foliage (and mostly sits behind the dialog panel)
          if (off !== 0 && t2 !== 'X') continue;
          const band = OCC_BAND[t2];
          if (!band) continue;
          const ray = Y0 + s * tanEl;                    // sight-line height
          if (ray > band[0] + 0.08 && ray < band[1] - 0.08) { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (!blocked) return el;
    }
    return 58;
  }

  function startEncounter(it) {
    if (state === 'transition' || state === 'encounter') return;
    const project = it.project;
    const creature = it.creature || null;
    const focus = creature
      ? { x: creature.pos.x, y: 0.75, z: creature.pos.z }
      : it.focus;
    state = 'transition';
    audio.sfx.sting();
    audio.bgm.fadeTo('enc', REDUCED ? 200 : 800);
    relight.dir = 1;                           // sunset mood over 800ms
    const isEgg = project.kind === 'egg' || !project.url;
    const isBld = it.kind === 'building';

    // subject height drives the zoom: hero-sized for a 2.3 wu macrodoc and
    // for a 0.7 wu egg alike; buildings get the wide hero frame
    const subjH = isBld
      ? focus.y / 0.42                          // world.js: focus.y = h * 0.42
      : creature
        ? (creature.subjH != null ? creature.subjH
          : (creature.subjH = creatureSubjectH(creature)))
        : measureSubjectH(it.mesh, 1.3);
    const halfH = clamp(0.9 + subjH * 0.82, 2.2, 4.1);
    const elevation = pickShotElevation(focus);

    // trainer slot: first collision-free stage candidate (never for
    // buildings — the building is the whole hero, player may drop off-frame)
    let stage = null;
    if (!isBld) {
      const halfW = halfH * (cam.aspect || 1.6);
      const k = clamp(halfW / 2.2, 0.55, 1);   // pull slots in on narrow frames
      for (const [sx, sy] of STAGE_OFFSETS) {
        const o = screenToGround(elevation, sx * k, sy * (k < 1 ? 1.15 : 1));
        const px = focus.x + o.dx, pz = focus.z + o.dz;
        // 0.28: the player only STANDS here (no movement), so a whisker less
        // clearance than the walk radius — rescues the nursery slots wedged
        // between the gazebo circle and the picket fence
        if (!colliders.blockedAt(px, pz, 0.28)) { stage = { x: px, z: pz, sx }; break; }
      }
    }
    // subject sits opposite the player: staged left -> hero center-right
    const halfW = halfH * (cam.aspect || 1.6);
    const azr = THREE.MathUtils.degToRad(CAM.azimuth);
    const playerLeft = stage
      ? stage.sx < 0
      : ((player.pos.x - focus.x) * Math.sin(azr)
        - (player.pos.z - focus.z) * Math.cos(azr)) <= 0;   // screen-x sign
    const heroMag = isBld
      ? Math.min(clamp(0.12 * halfW, 0.3, 0.8), Math.max(0.1, halfW - 1.6))
      : Math.min(clamp(0.18 * halfW, 0.45, 1.0), Math.max(0.2, halfW - 1.05));
    const heroX = playerLeft ? heroMag : -heroMag;

    encounterCtx = {
      project, creature, isEgg, focus, stage,
      playerFrom: stage ? player.pos.clone() : null
    };
    encLight.position.set(focus.x, (focus.y || 0.6) + 1.6, focus.z);
    // portrait phones: the encounter panel covers the bottom ~half of the
    // viewport, so the two-shot must live in the top half of the frame
    const lift = halfH * ((cam.aspect || 1.6) < 0.8 ? 0.30 : 0.04);
    cam.startEncounter({ x: focus.x, z: focus.z, subjectH: subjH, halfH, elevation, heroX, lift });
    if (creature) {
      creature.frozen = true;
      // 3/4 front: face the camera (front +Z, camera at yaw PI/4), turned
      // ~22° toward the player's side of the frame — flat mugshots read
      // stiff, and the glance ties the two-shot together
      creature.faceYaw = Math.PI / 4 + (playerLeft ? -0.38 : 0.38);
    }
    // player squares up to the subject immediately (visible pre-blackout)
    player.yaw = Math.atan2(focus.x - player.pos.x, focus.z - player.pos.z);
    ui.transitionIn(() => {
      if (stage) {
        // screen is covered: cut the player to the trainer slot, back 3/4
        // to camera, facing the subject — the Pokemon over-the-shoulder
        player.pos.set(stage.x, 0, stage.z);
        player.vel.set(0, 0);
        player.yaw = Math.atan2(focus.x - stage.x, focus.z - stage.z);
      }
      // isolate the battle stage: a wandering neighbor creature mid-frame
      // photobombs the hero (mathwings loves to walk through lasthand's
      // close-up). Hidden under the blackout, restored under the exit fade.
      if (encounterCtx) {
        // cover the whole composed frame: horizontally ~halfH*aspect, but
        // vertically the ground plane spans halfH/sin(el) ≈ 1.75*halfH up-
        // frame — 2.6*halfH covers the far corner (over-hiding is harmless,
        // everyone is restored under the exit fade). GOLDIE hides too: the
        // bld_mathstreet close-up otherwise reveals it over the tree ring.
        const hideR = Math.max(5, halfH * 2.6);
        encounterCtx.hidden = [...creatureSys.creatures, secret].filter((c) =>
          c !== creature &&
          Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z) < hideR);
        for (const c of encounterCtx.hidden) c.group.visible = false;
      }
      // pass the kind-based flag only: ui.js derives the URL-less
      // "COMING SOON" presentation itself from project.url
      ui.showEncounter(project, project.kind === 'egg', (p) => markVisited(p));
      state = 'encounter';
    });
  }
  function endEncounter() {
    if (state !== 'encounter') return;
    state = 'transition';
    audio.bgm.fadeTo('over', REDUCED ? 200 : 700);
    relight.dir = -1;                          // back to daylight over 700ms
    ui.transitionOut(() => {
      ui.encHide();
      if (encounterCtx) {
        if (encounterCtx.creature) encounterCtx.creature.frozen = false;
        if (encounterCtx.hidden) {
          for (const c of encounterCtx.hidden) c.group.visible = true;
        }
        if (encounterCtx.playerFrom) {
          // undo the battle staging under the exit fade
          player.pos.copy(encounterCtx.playerFrom);
          player.vel.set(0, 0);
          player.yaw = Math.atan2(
            encounterCtx.focus.x - player.pos.x, encounterCtx.focus.z - player.pos.z);
        }
      }
      encounterCtx = null;
      cam.endEncounter(player.pos);
      state = 'world';
    });
  }

  /* ---- house interior: door fade in / out ------------------------------------------ */
  function enterHouse() {
    if (state !== 'world') return;
    state = 'transition';
    audio.sfx.blip();
    ui.transitionOut(() => {              // quick fade through black (door beat);
      const h = getHouse();               // instant under prefers-reduced-motion
      h.setAspect(window.innerWidth / window.innerHeight);
      h.enter(player, marker);
      inHouse = true;
      state = 'interior';
    });
  }
  function exitHouse() {
    if (state !== 'interior') return;
    state = 'transition';
    audio.sfx.blip();
    ui.transitionOut(() => {
      house.exit(player, marker, scene);
      inHouse = false;
      state = 'world';
    });
  }

  /* ---- interaction routing ------------------------------------------------------------ */
  function interact() {
    const it = nearestInteractable();
    if (!it) return;
    switch (it.kind) {
      case 'npc': audio.sfx.blip(); return openDialog('YOONKI', NPC_PAGES, false);
      case 'house': return enterHouse();
      case 'plaque': audio.sfx.blip(); return openDialog(it.name, it.pages, false);
      case 'housedoor': return exitHouse();
      case 'sign': audio.sfx.blip(); return openDialog('SIGNPOST', signPages(), true);
      case 'secret':
        audio.sfx.sparkle();
        particles.sparkle(SECRET_POS.x, 0.9, SECRET_POS.z);
        return openDialog('???', SECRET_PAGES, false);
      case 'fountain':
        audio.sfx.splash();
        particles.splash(FOUNTAIN.x, 1.0, FOUNTAIN.z);
        particles.sparkle(FOUNTAIN.x, 1.1, FOUNTAIN.z, '#BFEAF2');
        return openDialog('FOUNTAIN', FOUNTAIN_PAGES, false);
      case 'labsign': audio.sfx.blip(); return openDialog('DEMO LAB', labPages(), false);
      case 'wip': audio.sfx.blip(); return openDialog('DEMO LAB', WIP_PAGES, false);
      case 'egg':
      case 'creature':
      case 'building':
      case 'demo':
        return startEncounter(it);
    }
  }

  /* ---- input routing --------------------------------------------------------------------- */
  ui.handlers.start = () => {
    audio.bgm.start();
    audio.sfx.unlock();
    state = 'intro';
    const played = cam.startIntro(player.pos, () => { if (state === 'intro') state = 'world'; });
    if (!played) state = 'world';
  };
  ui.handlers.any = () => {
    if (state === 'intro') cam.skipIntro();
  };
  ui.handlers.action = () => {
    if (state === 'world' || state === 'interior') interact();
    else if (state === 'dialog') ui.advanceDialog();
    else if (state === 'encounter') {
      const r = ui.encConfirm();
      if (r === 'run') endEncounter();
    }
  };
  ui.handlers.cancel = () => {
    if (state === 'dialog') { audio.sfx.back(); ui.closeDialog(); }
    else if (state === 'encounter') { audio.sfx.back(); endEncounter(); }
  };
  ui.handlers.dir = (d) => {
    if (state === 'encounter') ui.encMove(d);
  };

  /* ---- step / bump feedback -------------------------------------------------------------- */
  player.onStep = (pos, speed) => {
    if (speed < 1.2) return;
    audio.sfx.step();
    particles.dust(pos.x, pos.z, 4);
  };
  let bumpCooldown = 0;

  /* ---- ready ------------------------------------------------------------------------------- */
  ui.enableStart();

  /* ---- main loop ------------------------------------------------------------------------------ */
  const S2 = Math.SQRT1_2;
  const focusV = new THREE.Vector3();
  const movers = [player, ...creatureSys.creatures];
  let last = performance.now();
  let frameCount = 0, frameAccum = 0, measured = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    // prefers-reduced-motion: freeze ambient shader motion (wind, water bob)
    uTime.value = REDUCED ? 0 : t;
    water.update(REDUCED ? 0 : t);
    clouds.update(dt);
    updateRelight(dt);
    sky.position.copy(cam.camera.position);

    const inWorld = state === 'world';
    const inRoom = state === 'interior';
    const move = { x: 0, z: 0 };
    if (inWorld || inRoom) {
      // screen space -> world space (the interior camera shares the world's
      // 45° azimuth, so the same mapping drives both scenes)
      const m = ui.getMove();
      move.x = S2 * (m.x + m.z);
      move.z = S2 * (m.z - m.x);
    }

    if (state !== 'title') {
      player.update(dt, move, inHouse ? house.colliders : colliders, t);
      // bump feedback
      bumpCooldown -= dt;
      if (player.lastHit && player.speed > 2.2 && bumpCooldown <= 0) {
        bumpCooldown = 0.35;
        audio.sfx.bump();
        if (!REDUCED) player.syVel -= 2.0;
      }
      if (inHouse) {
        house.update(dt, t, player.pos);
      } else {
        npc.update(dt, player.pos, t);
        creatureSys.update(dt, t, colliders, player.pos);
        eggSys.update(dt, t);
        secret.update(dt, t);
        world.updateFlora(dt, movers, (x, z, color) => {
          particles.pop(x, z, color);
          audio.sfx.pop();
        });
        toys.update(dt, player, t);
      }
    }

    // "!" marker above the nearest interactable + emissive lerp on its mesh
    if (inWorld || inRoom) {
      const it = nearestInteractable();
      if (it) {
        marker.visible = true;
        const mx = it.dynamic ? it.pos.x : it.markerX;
        const mz = it.dynamic ? it.pos.z : it.markerZ;
        const bounce = REDUCED ? 0 : Math.sin(t * 5) * 0.08;   // sin(now/200)
        marker.position.set(mx, it.markerY + bounce, mz);
      } else marker.visible = false;
      updateHighlight(it ? it.mesh || null : null, dt);
    } else {
      marker.visible = false;
      updateHighlight(null, dt);
    }

    if (!inHouse) {
      cam.update(dt, player.pos, player.yaw, player.speed, t);
      // tilt-shift focus band follows the player on screen (playbook: the
      // band sits ON the player, even while look-ahead pushes them off-center)
      focusV.set(player.pos.x, 0.7, player.pos.z).project(cam.camera);
      post.setFocus(
        (state === 'encounter' || state === 'transition') ? 0
          : Math.max(-0.9, Math.min(0.9, focusV.y)), dt);
    }
    particles.update(dt, t, cam.halfH, renderer.domElement.clientHeight || window.innerHeight);

    // the interior is its own mini-scene with a fixed warm rig — direct
    // render (no composer): tilt-shift/bloom are overworld signatures and
    // the room reads better without a miniature blur band across it
    if (inHouse) renderer.render(house.scene, house.camera);
    else post.render();

    // adaptive quality: measure the first ~120 frames after start
    if (state !== 'title' && measured < 2) {
      frameCount++;
      frameAccum += dt;
      if (frameCount >= 120) {
        const avg = frameAccum / frameCount * 1000;
        frameCount = 0; frameAccum = 0; measured++;
        if (avg > 26 && tier !== 'low') {
          applyTier(tier === 'high' ? 'mid' : 'low');
        } else measured = 2;
      }
    }
  }
  requestAnimationFrame(loop);

  /* ---- debug hooks (headless verification) -------------------------------------------------- */
  window.__yw3 = {
    THREE, scene, renderer, cam, post, applyTier, lights, clouds, particles,
    player, creatures: creatureSys.creatures,
    eggs: eggSys.eggs, toys, state: () => state, tier: () => tier,
    interact, nearestInteractable, audio, ui, colliders,
    interactables, encounterCtx: () => encounterCtx, endEncounter,
    glb,
    house: () => house, inHouse: () => inHouse, enterHouse, exitHouse,
    glbReport: () => ({
      world: world.glbUsed,
      creatures: creatureSys.creatures.map(c => c.id + ':' + (c.glb ? 'glb' : 'voxel')),
      secret: secret.glb ? 'glb' : 'voxel'
    }),
    setState: (s) => { state = s; },
    sample() {
      post.render();
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const buf = new Uint8Array(4);
      let nonBlank = 0;
      const samples = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        gl.readPixels(Math.floor(w * (i + 0.5) / 5), Math.floor(h * (j + 0.5) / 5),
          1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        samples.push([buf[0], buf[1], buf[2]]);
        if (buf[0] + buf[1] + buf[2] > 24) nonBlank++;
      }
      return { nonBlank, samples };
    }
  };
}

boot().catch((e) => {
  console.error('[yw3] boot failed:', e);
  ui.showFallback(e);
});
