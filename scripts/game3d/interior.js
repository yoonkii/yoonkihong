/* ============================================================================
   YOONKI WORLD 3D — the About-house interior (Link's-house career room)
   A self-contained mini-scene entered through the house door: warm wooden
   room, plank floor, timber beams, two hanging lanterns, a table with a
   flower vase, and THREE mounted display plaques on the back wall carrying
   voxel-built company logos (NAVER / LINE / GOOGLE) — Yoonki's career
   history, Zelda-weapon-display style.

   Design: its own THREE.Scene + fixed ortho quarter camera (same 45°/35°
   angles as the overworld, so the screen->world input mapping in game3d.js
   works unchanged — WASD and the mobile stick behave identically). The
   player group is REPARENTED into this scene on enter and back on exit;
   the same player.update() drives movement against this room's colliders.
   On narrow (portrait) screens the camera pans within clamped slack so the
   whole room stays reachable; on desktop it is effectively fixed.
   ========================================================================== */

import * as THREE from 'three';
import { buildGeometry, buildMesh, getModel, voxelMaterial } from '../voxel/voxel.js';
import '../voxel/models/index.js';
import { CAM, REDUCED, LIGHT_SCALE, dirFromAngles, damp, clamp } from './const.js';
import { createColliders } from './world.js';
import { createSparklePool } from './particles.js';

/* Room metrics (must match scripts/voxel/models/interior.js house_room):
   shell 72 x 52 voxels = 9 x 6.5 wu, walls 0.25 thick, door gap at
   x 4.0..5.25 in the south knee wall. */
const ROOM = {
  w: 9, d: 6.5,
  doorX: 4.625,                         // door gap center
  spawn: { x: 4.625, z: 5.3 },          // just inside the door
  camBase: new THREE.Vector3(4.4, 1.05, 3.0)
};

// short plaque line + MORE pages: the interact opens a Pokemon-style
// choice menu ([MORE][BACK]) instead of dumping the whole story at once
const PLAQUES = [
  {
    id: 'plaque_naver', model: 'house_plaque_naver', x: 2.2, name: 'NAVER',
    line: 'A green plaque with a blocky white N. NAVER — where it all started.',
    more: [
      'I joined through NAVER\'s global business track — and walked ' +
      'straight into the LINE division, back when LINE was still part ' +
      'of NAVER.',
      'Day one of a decade-long adventure in taking products global.'
    ]
  },
  {
    id: 'plaque_line', model: 'house_plaque_line', x: 4.5, name: 'LINE',
    line: 'A green plaque with a friendly speech bubble. LINE, Seoul — growth product manager, 2014-2018.',
    more: [
      'Four years growing a global messenger across Southeast Asia — ' +
      'user growth was the scoreboard, and I lived in it.',
      'Also built and ran brand-new services around the messenger: ' +
      'content, community, UGC, in-app promotions. The years that ' +
      'taught me how products actually spread.'
    ]
  },
  {
    id: 'plaque_google', model: 'house_plaque_google', x: 6.8, name: 'GOOGLE',
    line: 'A bright plaque with a big colorful G. GOOGLE — Google Play, 2018 to now.',
    more: [
      'Google Play, both sides of the Pacific. In Korea: running the ' +
      'store and curating its content for one of the world\'s toughest ' +
      'app markets.',
      'In San Francisco since 2021: AI/Social category strategy and new ' +
      'features — including launching Promotional Content. And since ' +
      '2025, PM for an AI agentic content system. By day, that is. By ' +
      'night, this island happens.'
    ]
  }
];

export function createHouseInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1E1710);   // deep warm brown-black

  /* ---- room shell ---------------------------------------------------- */
  // corner origin: voxel (0,0,0) at world (0,0,0); floor is 1 voxel thick,
  // so drop the mesh 0.125 and the walkable floor top lands exactly at y=0.
  const roomModel = getModel('house_room');
  const room = new THREE.Mesh(
    roomModel ? buildGeometry(roomModel, { origin: 'corner' })
              : new THREE.BufferGeometry(),
    voxelMaterial()
  );
  room.position.y = -0.125;
  scene.add(room);

  /* ---- colliders ------------------------------------------------------ */
  // all-grass fake tile map: only the AABBs below block movement
  const tiles = Array.from({ length: 30 }, () => Array(40).fill('G'));
  const colliders = createColliders(tiles);
  colliders.addAABB(-2, -2, 0.25, ROOM.d + 2);                 // west wall
  colliders.addAABB(-2, -2, ROOM.w + 2, 0.25);                 // north wall
  colliders.addAABB(ROOM.w - 0.25, -2, ROOM.w + 2, ROOM.d + 2);// east knee
  colliders.addAABB(-2, ROOM.d - 0.25, 4.0, ROOM.d + 2);       // south knee (west of door)
  colliders.addAABB(5.25, ROOM.d - 0.25, ROOM.w + 2, ROOM.d + 2); // east of door
  colliders.addAABB(3.95, ROOM.d + 0.05, 5.3, ROOM.d + 2);     // door threshold

  /* ---- plaques on the back wall --------------------------------------- */
  const interactables = [];
  for (const p of PLAQUES) {
    const mesh = buildMesh(p.model, { material: voxelMaterial().clone() });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.position.set(p.x, 1.2, 0.25 + 0.1875);    // board back against wall
                                                   // (top 3.2 — under the 3.25 wall cap)
    scene.add(mesh);
    // keep the player's head out of the proud logo voxels
    colliders.addAABB(p.x - 0.8, -2, p.x + 0.8, 0.7);
    interactables.push({
      id: p.id, kind: 'plaque', name: p.name, line: p.line, more: p.more,
      pos: { x: p.x, z: 0.9 }, mesh,
      markerX: p.x, markerY: 3.45, markerZ: 0.7, r: 1.35
    });
  }

  /* ---- door (exit) ----------------------------------------------------- */
  const mat = buildMesh('house_mat', { material: voxelMaterial() });
  mat.castShadow = false;
  mat.receiveShadow = false;
  mat.position.set(ROOM.doorX, 0, ROOM.d - 0.75);
  scene.add(mat);
  interactables.push({
    id: 'house_exit', kind: 'housedoor',
    pos: { x: ROOM.doorX, z: ROOM.d - 0.55 }, mesh: mat,
    // marker floats over the door gap itself (under the lintel), so it
    // never overlaps the freshly-spawned player standing on the mat
    markerX: ROOM.doorX, markerY: 1.45, markerZ: ROOM.d - 0.15, r: 1.25
  });

  /* ---- table + vase ----------------------------------------------------- */
  const table = buildMesh('house_table', { material: voxelMaterial() });
  table.castShadow = false;
  table.receiveShadow = false;
  table.position.set(2.7, 0, 4.1);
  scene.add(table);
  colliders.addAABB(2.7 - 0.95, 4.1 - 0.65, 2.7 + 0.95, 4.1 + 0.65);

  /* ---- hanging lanterns + warm lights ----------------------------------- */
  // pivot groups sit ON the beams (beam undersides at y 3.0) so the sway
  // rotates around the hook, not the lantern's own center
  const lanterns = [];
  const lanternDefs = [
    // both on the mid beam (z 4.0-4.25): hung from the plaque-wall beam they
    // visually overlapped the boards from the quarter camera. z 4.31 hooks
    // them onto the beam's SOUTH (camera-facing) face — centered under the
    // beam (old 4.06) the SE sight line slices the hanging cord on the
    // beam's own near edge and the lamps read as floating sushi
    { x: 2.7, z: 4.31, phase: 0 },       // over the table
    { x: 6.1, z: 4.31, phase: 2.1 }      // over the rug, washing the plaque wall
  ];
  for (const d of lanternDefs) {
    const pivot = new THREE.Group();
    pivot.position.set(d.x, 3.02, d.z);
    const body = buildMesh('house_lantern', { material: voxelMaterial() });
    body.castShadow = false;
    body.receiveShadow = false;
    body.position.y = -1.03;             // 2 voxels of cord show under the beam
    pivot.add(body);
    // visible hanging cord: runs down across the beam's south face (the
    // lantern hangs proud of it at z 4.31) into the chain link — without it
    // the lantern reads as floating at the fixed quarter camera. Parented
    // to the pivot so it sways with the lantern; top reaches y 3.16, well
    // up the 3.0-3.25 timber face.
    const cord = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.66, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x2B2B33 })   // lantern iron
    );
    cord.position.y = -0.19;
    pivot.add(cord);
    // self-lit amber core (no bloom in here — MeshBasic reads as the glow).
    // Slightly WIDER than the voxel glass band so it pokes through all four
    // sides — inside the opaque voxel shell it would be invisible.
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.28, 0.56),
      new THREE.MeshBasicMaterial({ color: 0xFFBE66 })   // deep amber: ACES
                                                         // lifts it to warm glow
    );
    core.position.y = -0.65;             // tracks the glass band of the
    pivot.add(core);                     // lowered body (-1.03 + 0.25..0.5)
    const light = new THREE.PointLight(0xFFCF8E, 1.35 * LIGHT_SCALE, 10, 1.3);
    light.position.y = -0.69;
    pivot.add(light);
    scene.add(pivot);
    lanterns.push({ pivot, light, base: light.intensity, phase: d.phase });
  }
  /* ---- plaque-open sparkles --------------------------------------------- */
  // a small additive star burst over the board when a plaque is read —
  // its own mini pool (the overworld particle system lives in the other
  // scene and its ambient emitters are world-coordinate-bound)
  const sparkles = createSparklePool(scene);
  function sparkleAt(x, y, z) { sparkles.burst(x, y, z); }

  // warm ambient wrap + a soft shaping key so Lambert faces keep definition
  scene.add(new THREE.HemisphereLight(0xFFE0B8, 0x4A3626, 0.5 * LIGHT_SCALE));
  const key = new THREE.DirectionalLight(0xFFEFD8, 0.42 * LIGHT_SCALE);
  key.position.copy(dirFromAngles(70, 55).multiplyScalar(30));
  scene.add(key, key.target);

  /* ---- fixed quarter camera (pans only when the room outgrows the view) - */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  let aspect = 1;
  let halfH = 4.55;
  const target = ROOM.camBase.clone();
  function applyProjection() {
    // portrait phones: zoom out so the ~2.1 wu-wide slice becomes ~3 wu —
    // the clamped pan still covers the rest of the room while walking
    halfH = aspect < 0.9 ? 6.0 : 4.55;
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  function placeCamera() {
    camera.position.copy(target)
      .addScaledVector(dirFromAngles(CAM.azimuth, CAM.elevation), CAM.dist);
    camera.lookAt(target);
  }
  function setAspect(a) {
    aspect = a;
    applyProjection();
    placeCamera();
  }
  setAspect(window.innerWidth / window.innerHeight);

  /* ---- enter / exit ------------------------------------------------------ */
  const saved = { x: 0, z: 0 };
  function enter(player, marker) {
    saved.x = player.pos.x;
    saved.z = player.pos.z;
    scene.add(player.group);              // reparents out of the world scene
    scene.add(marker);
    player.pos.set(ROOM.spawn.x, 0, ROOM.spawn.z);
    player.vel.set(0, 0);
    player.yaw = Math.PI;                 // walking in — faces the back wall
    player.group.position.set(player.pos.x, 0, player.pos.z);
    target.copy(ROOM.camBase);
    placeCamera();
  }
  function exit(player, marker, worldScene) {
    worldScene.add(player.group);
    worldScene.add(marker);
    player.pos.set(saved.x, 0, saved.z);
    player.vel.set(0, 0);
    player.yaw = 0;                       // stepping out — faces the path
    player.group.position.set(saved.x, 0, saved.z);
  }

  /* ---- per-frame -------------------------------------------------------- */
  function update(dt, t, playerPos) {
    if (!REDUCED) {
      for (const l of lanterns) {
        l.pivot.rotation.z = Math.sin(t * 0.9 + l.phase) * 0.05;
        l.pivot.rotation.x = Math.cos(t * 0.7 + l.phase * 1.3) * 0.035;
        l.light.intensity = l.base * (1 + Math.sin(t * 9 + l.phase * 5) * 0.03);
      }
    }
    // clamped pan: zero slack on wide screens (fixed camera), just enough
    // on portrait phones that walking reveals the whole room
    const sx = Math.max(0, 5.6 - halfH * aspect);
    const sz = Math.max(0, 4.4 - halfH);
    const tx = clamp(playerPos.x, ROOM.camBase.x - sx, ROOM.camBase.x + sx);
    const tz = clamp(playerPos.z, ROOM.camBase.z - sz, ROOM.camBase.z + sz);
    target.x = damp(target.x, tx, 5, dt);
    target.z = damp(target.z, tz, 5, dt);
    placeCamera();
    sparkles.update(dt, t, halfH, window.innerHeight);
  }

  return {
    scene, camera, colliders, interactables, enter, exit, update, setAspect,
    sparkleAt, ROOM
  };
}
