/* ============================================================================
   YOONKI WORLD 3D — sky dome, drifting clouds, lighting rig
   Pokopia daylight per docs/VISUAL_PLAYBOOK.md: gradient sky dome, warm
   hemisphere fill, one soft warm sun; clouds are one InstancedMesh of merged
   squashed icosahedrons that drift and cast moving shadows.
   ========================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SUN, HEMI, SKY, LIGHT_SCALE, dirFromAngles, hash2, REDUCED } from './const.js';

export function createSkyDome() {
  const geo = new THREE.SphereGeometry(180, 28, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(SKY.zenith) },
      uBottom: { value: new THREE.Color(SKY.horizon) },
      uSunDir: { value: dirFromAngles(SUN.azimuth, SUN.elevation) }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uBottom, uSunDir;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 col = mix(uBottom, uTop, pow(max(dir.y, 0.0), 0.6));
        // soft warm halo where the sun lives — no hard disc
        float ang = dot(dir, normalize(uSunDir));
        col = mix(col, vec3(1.0, 0.97, 0.88), smoothstep(0.965, 0.998, ang) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

export function createLights(center) {
  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity * LIGHT_SCALE);
  sun.position.copy(center).addScaledVector(dirFromAngles(SUN.azimuth, SUN.elevation), 55);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Tight ortho frustum around the diorama (beats resolution).
  sun.shadow.camera.left = -27;
  sun.shadow.camera.right = 27;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 12;
  sun.shadow.camera.far = 110;
  sun.shadow.radius = 2.5;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;

  const hemi = new THREE.HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity * LIGHT_SCALE);
  return { sun, hemi };
}

/* ---- clouds ------------------------------------------------------------ */
export function createClouds(count = 12) {
  // one puffy cloud = 3 squashed icosahedrons merged
  const parts = [];
  const lobe = (r, x, y, z, sy) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.35, sy, 1);
    g.translate(x, y, z);
    return g;
  };
  parts.push(lobe(1.5, 0, 0, 0, 0.52));
  parts.push(lobe(1.0, 1.6, -0.1, 0.4, 0.5));
  parts.push(lobe(0.85, -1.5, -0.15, -0.3, 0.48));
  const geo = mergeGeometries(parts);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xFFFFFF, emissive: 0xC8D8E8, emissiveIntensity: 0.3,
    flatShading: true, fog: false, transparent: true, opacity: 0.92
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  // NO shadow-map shadows: hard voxel-cloud shadows read as dirt stains on
  // the cream paths. Each cloud instead drags a soft radial-gradient blob
  // (the VISUAL_PLAYBOOK low-cost blob-shadow pattern).
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // instances live far from the shared geometry's bounding sphere — never
  // let three cull the whole batch when the origin leaves the frustum
  mesh.frustumCulled = false;

  // one soft blue-gray radial blob shared by all cloud shadows
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(58,74,90,0.9)');       // #3A4A5A core
  grad.addColorStop(0.55, 'rgba(58,74,90,0.5)');
  grad.addColorStop(1, 'rgba(58,74,90,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  // plane matches the cloud footprint (x ~5.9, z ~2.8), lying flat on grass
  const sGeo = new THREE.PlaneGeometry(5.9, 2.8);
  sGeo.rotateX(-Math.PI / 2);
  const sMat = new THREE.MeshBasicMaterial({
    map: shadowTex, transparent: true, opacity: 0.28, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const shadowMesh = new THREE.InstancedMesh(sGeo, sMat, count);
  shadowMesh.renderOrder = 1;
  shadowMesh.receiveShadow = false;
  shadowMesh.frustumCulled = false;

  const drift = [];
  const m = new THREE.Matrix4();
  function writeMatrices(i, c) {
    m.makeScale(c.s, c.s, c.s).setPosition(c.x, c.y, c.z);
    mesh.setMatrixAt(i, m);
    // blob shadows only over the island — over open sea they float above
    // the (lower) water plane and read as dark stains, not shadows
    const k = Math.max(0.001, Math.min(1,
      Math.min(c.x - 2, 38 - c.x, c.z - 2, 28 - c.z) / 3));
    const ss = c.s * 1.3 * k;                         // shadow ~1.3x footprint
    m.makeScale(ss, 1, ss).setPosition(c.x, 0.015, c.z);
    shadowMesh.setMatrixAt(i, m);
  }
  for (let i = 0; i < count; i++) {
    const r1 = hash2(i, 7), r2 = hash2(i, 13), r3 = hash2(i, 29);
    const y = 17 + r2 * 6;
    // The ortho camera (az 45 / el 34) projects a cloud at height y onto the
    // ground ~1.05*y toward (-x,-z), so a mid-sky cloud lands visually ON the
    // town and reads as a marshmallow on the grass. Pick each cloud's z so the
    // projected point always falls on open water: most drift the north sea
    // lane (their blob shadows still sweep the island — the alive signal),
    // a few take the south lane for balance in the wide shot.
    const K = 1.048;                                  // = cos(34deg)/sin(34deg) * cos45-ish
    // Lanes by projected ground point: a couple of SMALL, quick puffs cross
    // the ISLAND band (clouds overlapping terrain are the only ortho
    // altitude cue — but kept small/fast so they never park over a POI or
    // an encounter), the rest take open-sea lanes held >4u clear of the
    // shoreline (z 2 / z 28) so no puff ever reads as shore foam or a snow
    // pile kissing the water line.
    const island = i === 0;
    const zProj = island ? 9 + r3 * 11
                : (i % 2 === 1) ? -16 + r3 * 9.5
                : 35 + r3 * 8;
    const c = {
      x: -20 + r1 * 76, y, z: zProj + K * y,
      s: island ? 0.5 + hash2(i, 43) * 0.2 : 0.9 + hash2(i, 43) * 0.7,
      speed: island ? 0.65 + hash2(i, 57) * 0.3 : 0.25 + hash2(i, 57) * 0.3
    };
    drift.push(c);
    writeMatrices(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  shadowMesh.instanceMatrix.needsUpdate = true;

  function update(dt) {
    if (REDUCED) return;
    for (let i = 0; i < count; i++) {
      const c = drift[i];
      c.x += c.speed * dt;
      if (c.x > 62) c.x = -24;
      writeMatrices(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, shadowMesh, update };
}
