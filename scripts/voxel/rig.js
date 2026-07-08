/* ============================================================================
   YOONKI WORLD 3D — STANDARD SCENE RIG ("Ember Isle", docs/ART_BIBLE.md)
   Renderer + quarter-view camera + the golden-hour lighting rig + fog +
   gradient sky (with baked sun disc) + a grass ground-plate helper.

   BOTH viewer.html and the game import this module, so a model verified in
   the viewer lights identically in-game. Do not fork these numbers — they
   are the art bible's §1.2/§3/§4 values.

   Angle convention (matches the art bible's own vectors):
     dirFromAngles(azimuthDeg, elevationDeg) =
       ( cos(az)·cos(el), sin(el), sin(az)·cos(el) )
     azimuth measured in the XZ plane from +X toward +Z.
     Sun az 235° / el 22°  → ≈ (-0.53, 0.37, -0.76)  (bible §3.1, exact)
     Camera az 45° / el 35° → the (+X,+Z) south-east quadrant looking NW.
   ========================================================================== */

import * as THREE from 'three';
import { buildMesh, box, hash3, VOXELS_PER_TILE, VOXEL_SIZE } from './voxel.js';

/* ------------------------------------------------------------------ *
 *  ART BIBLE CONSTANTS (data-only exports for the game layer)          *
 *  Intensities are authored in legacy light units (pre-r155 three.js). *
 *  Modern three.js Lambert divides irradiance by PI (physical units),  *
 *  so createLights() multiplies every intensity by LIGHT_SCALE to hit  *
 *  the bible's target rendered read (§2.6: lit grass ~#C8B565,         *
 *  shadowed ~#4A7A6E — warm gold vs teal, never gray). Any runtime     *
 *  relight (e.g. ENCOUNTER) must apply the same scale.                 *
 * ------------------------------------------------------------------ */
export const LIGHT_SCALE = Math.PI;
export const SUN = { color: 0xFFB070, intensity: 2.3, azimuth: 235, elevation: 22 };
export const RIM = { color: 0x4FA8B8, intensity: 0.28, azimuth: 55, elevation: 30 };
export const HEMI = { sky: 0x7FD4D9, ground: 0xB96A45, intensity: 0.55 };
export const FOG = { color: 0xF5C6A0, near: 55, far: 130 };
export const CAMERA = { fov: 30, near: 1, far: 200, azimuth: 45, elevation: 35, distDesktop: 42, distMobile: 36 };

// Encounter relight targets (bible §3.4) — lerped over the 800ms BGM
// crossfade by the game layer; reversed over 700ms on RUN; 200ms if REDUCED.
export const ENCOUNTER = {
  sun: { color: 0xFF8E72, intensity: 1.9, elevation: 16 },
  hemi: { sky: 0x6C7BD9, ground: 0xC97A5A, intensity: 0.65 },
  fogNear: 30
};

// Sky gradient stops (bible §4): [sin(elevation), hex]
export const SKY_STOPS = {
  zenith: 0x3E7C8F,   // 90 deg
  upper: 0x6FB4BC,    // 35 deg
  warm: 0xFFD9A8,     // 12 deg
  horizon: 0xFF9E6B,  //  0 deg
  below: 0xE8A87A     // fades below horizon (continues into fog)
};

/* ------------------------------------------------------------------ */
export function dirFromAngles(azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    Math.cos(az) * Math.cos(el),
    Math.sin(el),
    Math.sin(az) * Math.cos(el)
  );
}

/* ------------------------------------------------------------------ *
 *  RENDERER (bible §3 header)                                          *
 * ------------------------------------------------------------------ */
export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(FOG.color);
  return renderer;
}

/* ------------------------------------------------------------------ *
 *  CAMERA (bible §1.2 — fov-30 perspective quarter view)               *
 * ------------------------------------------------------------------ */
export function createQuarterCamera(aspect = 1) {
  return new THREE.PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
}

/** Place a camera on the standard 45°/35° quarter axis, looking at target. */
export function placeQuarterCamera(camera, target, distance) {
  const d = distance != null
    ? distance
    : (typeof window !== 'undefined' && window.innerWidth < 520
        ? CAMERA.distMobile : CAMERA.distDesktop);
  camera.position.copy(target)
    .addScaledVector(dirFromAngles(CAMERA.azimuth, CAMERA.elevation), d);
  camera.lookAt(target);
  return camera;
}

/* ------------------------------------------------------------------ *
 *  LIGHTS (bible §3.1 + §3.2 — NO AmbientLight anywhere)               *
 * ------------------------------------------------------------------ */
export function createLights(center = new THREE.Vector3(0, 0, 0)) {
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity * LIGHT_SCALE);
  sun.position.copy(center).addScaledVector(dirFromAngles(SUN.azimuth, SUN.elevation), 60);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 120;
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;

  const hemi = new THREE.HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity * LIGHT_SCALE);

  const rim = new THREE.DirectionalLight(RIM.color, RIM.intensity * LIGHT_SCALE);
  rim.position.copy(center).addScaledVector(dirFromAngles(RIM.azimuth, RIM.elevation), 60);
  rim.target.position.copy(center);
  rim.castShadow = false;

  return { sun, hemi, rim };
}

export function addLights(scene, lights) {
  scene.add(lights.sun, lights.sun.target, lights.hemi, lights.rim, lights.rim.target);
}

/* ------------------------------------------------------------------ *
 *  SKY (bible §4 — gradient sphere + baked sun disc, no lens flare)    *
 *  Radius sits just inside the camera far plane; the rig re-centers    *
 *  the sphere on the camera every frame (rig.render / updateSky).      *
 * ------------------------------------------------------------------ */
export function createSky() {
  const geo = new THREE.SphereGeometry(190, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(SKY_STOPS.zenith) },
      uUpper: { value: new THREE.Color(SKY_STOPS.upper) },
      uWarm: { value: new THREE.Color(SKY_STOPS.warm) },
      uHorizon: { value: new THREE.Color(SKY_STOPS.horizon) },
      uBelow: { value: new THREE.Color(SKY_STOPS.below) },
      uSunDir: { value: dirFromAngles(SUN.azimuth, SUN.elevation) },
      uSunCore: { value: new THREE.Color(0xFFF3D6) },
      uSunGlow: { value: new THREE.Color(0xFFB070) }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;              // sphere is camera-centered
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uZenith, uUpper, uWarm, uHorizon, uBelow;
      uniform vec3 uSunDir, uSunCore, uSunGlow;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;                          // sin(elevation)
        // 4 stops: horizon 0deg -> 12deg -> 35deg -> zenith 90deg
        vec3 col = mix(uHorizon, uWarm, smoothstep(0.0, 0.2079, h));
        col = mix(col, uUpper, smoothstep(0.2079, 0.5736, h));
        col = mix(col, uZenith, smoothstep(0.5736, 1.0, h));
        // below horizon: fade to the fog continuation tone
        col = mix(uBelow, col, smoothstep(-0.22, 0.0, h));
        // sun disc: 3deg core inside an 8deg glow, smoothstep falloff
        float ang = degrees(acos(clamp(dot(dir, normalize(uSunDir)), -1.0, 1.0)));
        col = mix(col, uSunGlow, (1.0 - smoothstep(3.0, 8.0, ang)) * 0.85);
        col = mix(col, uSunCore, 1.0 - smoothstep(0.6, 3.0, ang));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  return sky;
}

/* ------------------------------------------------------------------ *
 *  GROUND PLATE (viewer helper — 3-voxel grass slab, top at y = 0)     *
 *  Per-tile grass A/B/C variation + 6% dry-gold, dirt strata sides,    *
 *  organic jitter, chamfered lip. Deterministic via hash3.             *
 * ------------------------------------------------------------------ */
export function createGroundPlate(tilesX = 7, tilesZ = 7, seed = 11) {
  const GRASS = ['#7FB069', '#74A65F', '#689A55'];   // A/B/C
  const palette = GRASS.concat(['#A5B05E', '#8A5A3C', '#7A4C32']);
  const DRY = 3, DIRT_HI = 4, DIRT_LO = 5;
  const voxels = [];
  const W = tilesX * VOXELS_PER_TILE, D = tilesZ * VOXELS_PER_TILE;
  for (let tx = 0; tx < tilesX; tx++) {
    for (let tz = 0; tz < tilesZ; tz++) {
      const r = hash3(tx, 0, tz, seed);
      const top = r < 0.06 ? DRY : Math.floor(r * 997) % 3;   // A/B/C or dry
      box(tx * VOXELS_PER_TILE, 2, tz * VOXELS_PER_TILE,
          (tx + 1) * VOXELS_PER_TILE - 1, 2, (tz + 1) * VOXELS_PER_TILE - 1,
          top, voxels);
    }
  }
  box(0, 1, 0, W - 1, 1, D - 1, DIRT_HI, voxels);
  box(0, 0, 0, W - 1, 0, D - 1, DIRT_LO, voxels);
  const mesh = buildMesh(
    { palette, voxels },
    { jitter: true, chamfer: 0.25, seed }
  );
  mesh.position.y = -3 * VOXEL_SIZE;   // grass top surface sits at y = 0
  return mesh;
}

/* ------------------------------------------------------------------ *
 *  createRig — one call to the full standard look                      *
 * ------------------------------------------------------------------ */
/**
 * opts: {
 *   canvas                  required
 *   target: Vector3         look target (default origin)
 *   distance: number        camera distance (default: bible 42 / 36 mobile)
 *   preserveDrawingBuffer   for pixel-readback debugging only
 * }
 * Returns { renderer, scene, camera, sky, lights, render, setSize }.
 * Call rig.render() each frame (it re-centers the sky on the camera).
 */
export function createRig(opts) {
  const target = opts.target || new THREE.Vector3(0, 0, 0);
  const renderer = createRenderer(opts.canvas, opts);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);

  const lights = createLights(target);
  addLights(scene, lights);

  const sky = createSky();
  scene.add(sky);

  const camera = createQuarterCamera(1);
  placeQuarterCamera(camera, target, opts.distance);

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sky, lights, render, setSize };
}
