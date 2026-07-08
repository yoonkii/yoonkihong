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
  REDUCED, buildMap,
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
import { createCameraRig } from './game3d/camera.js';
import { createUI } from './game3d/ui.js';
import { createPost } from './game3d/post.js';
import { loadGLB } from './game3d/glbassets.js';

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
    'macrodoc', 'mathstreet', 'mathwings', 'funnify', 'goldie',
    'bld_about_house', 'bld_macrodoc', 'bld_mathstreet', 'bld_mathwings',
    'bld_funnify',
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
  }
  window.addEventListener('resize', resize);
  applyTier(tier);

  bumpLoad(96, 'LOADING... DONE');
  await yieldFrame();

  /* =====================================================================
   *  GAME STATE
   * =================================================================== */
  let state = 'title';        // title | intro | world | dialog | transition | encounter
  let encounterCtx = null;    // { project, creature, isEgg }

  /* ---- visited tracking + celebration ----------------------------------- */
  const liveProducts = projects.filter(p => p.url && p.kind !== 'egg' && (p.category || 'product') === 'product');
  let visited = {};
  let celebrated = false;
  try {
    visited = JSON.parse(localStorage.getItem('yw3_visited') || '{}');
    celebrated = localStorage.getItem('yw3_celebrated') === '1';
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
        try { localStorage.setItem('yw3_celebrated', '1'); } catch (e) { /* noop */ }
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
    for (const it of interactables) {
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
  const HOUSE_PAGES = [
    'It\'s YOONKI\'s house. Smells like coffee and synthesizers. The trainer himself is standing right outside.'
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
    state = 'dialog';
    ui.openDialog(name, pages, links, () => { state = 'world'; });
  }
  function signPages() {
    const c = creatureSys.creatures.length, e = eggSys.eggs.length;
    return [
      '« YOONKI WORLD »  Population: 1 human, ' + c +
      ' creature' + (c === 1 ? '' : 's') + ', ' + e +
      ' egg' + (e === 1 ? '' : 's') + ', 1 secret. Links below, traveler.'
    ];
  }

  /* ---- encounters ------------------------------------------------------------------ */
  function startEncounter(project, focus, creature) {
    if (state === 'transition' || state === 'encounter') return;
    state = 'transition';
    audio.sfx.sting();
    audio.bgm.fadeTo('enc', REDUCED ? 200 : 800);
    relight.dir = 1;                           // sunset mood over 800ms
    const isEgg = project.kind === 'egg' || !project.url;
    encounterCtx = { project, creature: creature || null, isEgg, focus };
    // player turns to the subject; camera swings 90 deg off the player-
    // subject line (camera.js) so the player never occludes the creature
    let fdx = focus.x - player.pos.x, fdz = focus.z - player.pos.z;
    const fd = Math.hypot(fdx, fdz) || 1;
    fdx /= fd; fdz /= fd;
    // 3/4 profile: turned past the subject so the camera keeps an eye and a
    // cheek in frame — never the featureless flat of the player's back
    player.yaw = Math.atan2(fdx, fdz) + 0.6;
    encLight.position.set(focus.x, (focus.y || 0.6) + 1.6, focus.z);
    const az = cam.startEncounter(
      { x: focus.x, y: (focus.y || 0.6) + 0.05, z: focus.z }, player.pos);
    if (creature) {
      creature.frozen = true;
      // face the encounter camera (model front is +Z; yaw = atan2(dirX, dirZ))
      const azRad = az * Math.PI / 180;
      creature.faceYaw = Math.atan2(Math.cos(azRad), Math.sin(azRad));
    }
    ui.transitionIn(() => {
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
      if (encounterCtx && encounterCtx.creature) encounterCtx.creature.frozen = false;
      encounterCtx = null;
      cam.endEncounter(player.pos);
      state = 'world';
    });
  }

  /* ---- interaction routing ------------------------------------------------------------ */
  function interact() {
    const it = nearestInteractable();
    if (!it) return;
    switch (it.kind) {
      case 'npc': audio.sfx.blip(); return openDialog('YOONKI', NPC_PAGES, false);
      case 'house': audio.sfx.blip(); return openDialog('YOONKI\'S HOUSE', HOUSE_PAGES, false);
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
        return startEncounter(it.project, it.focus, null);
      case 'creature':
        return startEncounter(it.project,
          { x: it.creature.pos.x, y: 0.75, z: it.creature.pos.z }, it.creature);
      case 'building':
      case 'demo':
        return startEncounter(it.project, it.focus, null);
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
    if (state === 'world') interact();
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
    const move = { x: 0, z: 0 };
    if (inWorld) {
      const m = ui.getMove();                  // screen space -> world space
      move.x = S2 * (m.x + m.z);
      move.z = S2 * (m.z - m.x);
    }

    if (state !== 'title') {
      player.update(dt, move, colliders, t);
      // bump feedback
      bumpCooldown -= dt;
      if (player.lastHit && player.speed > 2.2 && bumpCooldown <= 0) {
        bumpCooldown = 0.35;
        audio.sfx.bump();
        if (!REDUCED) player.syVel -= 2.0;
      }
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

    // "!" marker above the nearest interactable + emissive lerp on its mesh
    if (inWorld) {
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

    cam.update(dt, player.pos, player.yaw, player.speed, t);
    // tilt-shift focus band follows the player on screen (playbook: the
    // band sits ON the player, even while look-ahead pushes them off-center)
    focusV.set(player.pos.x, 0.7, player.pos.z).project(cam.camera);
    post.setFocus(
      (state === 'encounter' || state === 'transition') ? 0
        : Math.max(-0.9, Math.min(0.9, focusV.y)), dt);
    particles.update(dt, t, cam.halfH, renderer.domElement.clientHeight || window.innerHeight);

    post.render();

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
    glb,
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
