/* ============================================================================
   YOONKI WORLD 3D — ground chunk + animated water
   The island top is a single merged BufferGeometry: 4x4 color cells per tile
   (baked jitter per VISUAL_PLAYBOOK), stratified dirt-cliff walls wherever
   land meets water — the "cut cake" diorama edge.
   Water is one subdivided Lambert plane: baked shore-distance colors, vertex
   bob + lapping foam + facet sparkle injected via onBeforeCompile.
   ========================================================================== */

import * as THREE from 'three';
import { MAP_W, MAP_H, tileAt, hash2 } from './const.js';

const CELLS = 4;                     // color cells per tile edge
const CS = 1 / CELLS;                // cell size in world units

/* ---- palette (VISUAL_PLAYBOOK) ---------------------------------------- */
// A/B/C tile ramp pulled 45% toward the mid green: Pokopia lawns read as one
// calm green with occasional accents, not a checkerboard (hue variety kept).
const GRASS_RAMP = ['#7CC24E', '#83C955', '#8FD05C', '#78BC49'].map(h =>
  '#' + new THREE.Color(h).lerp(new THREE.Color('#83C955'), 0.45).getHexString());
const GRASS_DRY = '#A5B05E';
const PATH_TOP = '#E8D5A8';
const PATH_WARM = '#DDBE8B';
const PATH_RIM = '#C9A97B';
const PATH_PEBBLE = '#D9A36A';
// ART_BIBLE 2.1 cliff strata (cut-cake slab, top -> bottom) — playbook tans,
// light enough to survive the hemisphere-only light on the SE camera faces
const STRATA = ['#C9986B', '#9C6B43', '#8A5A38', '#7A5233'];
const LIP = 0.25;                    // grass lip overhang past the cliff face
const LIPD = 0.12;                   // lip slab thickness
const LEDGE_Y = -0.98;               // terrace step: mid-cliff grass-capped lip
const LEDGE_W = 0.3;                 // ledge overhang past the cliff face
const LEDGE_D = 0.18;                // ledge slab thickness
export const SEA_Y = -1.9;           // sea sits low so ~1.8u of cliff shows
const WATER_SHALLOW = new THREE.Color('#5BC8DC');
// deep/shallow contrast pulled ~40% toward shallow: living water, not spots
const WATER_DEEP = new THREE.Color('#3A9EC9').lerp(WATER_SHALLOW, 0.4);
const WATER_ABYSS = new THREE.Color('#2E8BB4').lerp(WATER_SHALLOW, 0.3);
const POND = { x0: 33, z0: 13, x1: 36, z1: 16 };  // enclosed pond tiles (world rect)
const POND_SHALLOW = new THREE.Color('#5FBFC9'); // ART_BIBLE 2.2 pond ramp
const POND_MID = new THREE.Color('#4FB2C4');

function isLand(tiles, x, y) { return tileAt(tiles, x, y) !== 'W'; }
function isPath(tiles, x, y) { return tileAt(tiles, x, y) === 'P'; }

/* ------------------------------------------------------------------ *
 *  GROUND MESH                                                         *
 * ------------------------------------------------------------------ */
export function buildGround(tiles) {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();

  function quad(p0, p1, p2, p3, n, color) {
    const b = pos.length / 3;
    pos.push(...p0, ...p1, ...p2, ...p3);
    for (let i = 0; i < 4; i++) nor.push(...n);
    for (let i = 0; i < 4; i++) col.push(color.r, color.g, color.b);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  /* ---- shoreline foam (2026-07-10 polish pack) -------------------------
     A soft white band hugging every cliff foot where land meets water —
     UV v runs 0 at the shore to 1 offshore against a 1D alpha-fade
     texture, so the band dissolves into the sea instead of ending in a
     hard edge. Collected per coastal tile below, built as ONE transparent
     mesh riding slightly above the animated water plane. */
  const foamPos = [], foamUV = [], foamIdx = [];
  // (x0,z0) = shore corner A, (x1,z1) = shore corner B; (ox,oz) = offshore
  // offset. Vertices: A, B (v=0, shore) then B+o, A+o (v=1, faded).
  function foamStrip(x0, z0, x1, z1, ox, oz) {
    const b = foamPos.length / 3;
    foamPos.push(x0, 0, z0, x1, 0, z1, x1 + ox, 0, z1 + oz, x0 + ox, 0, z0 + oz);
    foamUV.push(0.5, 0, 0.5, 0, 0.5, 1, 0.5, 1);
    foamIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // convex corner cap: inner corner (v=0) fanning to the outer arc (v=1)
  function foamCorner(cx0, cz0, sx, sz, w) {
    const b = foamPos.length / 3;
    foamPos.push(cx0, 0, cz0, cx0 + sx * w, 0, cz0, cx0 + sx * w, 0, cz0 + sz * w, cx0, 0, cz0 + sz * w);
    foamUV.push(0.5, 0, 0.5, 1, 0.5, 1, 0.5, 1);
    foamIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = tiles[ty][tx];
      if (t === 'W') continue;

      // ---- top cells --------------------------------------------------
      const path = t === 'P';
      const baseGrass = hash2(tx, ty, 3) < 0.045
        ? GRASS_DRY
        : GRASS_RAMP[Math.floor(hash2(tx, ty, 1) * GRASS_RAMP.length)];
      for (let cy = 0; cy < CELLS; cy++) {
        for (let cx = 0; cx < CELLS; cx++) {
          const wx = tx + cx * CS, wz = ty + cy * CS;
          if (path) {
            // rim course where the path meets grass
            const rim =
              (cx === 0 && !isPath(tiles, tx - 1, ty) && isLand(tiles, tx - 1, ty)) ||
              (cx === CELLS - 1 && !isPath(tiles, tx + 1, ty) && isLand(tiles, tx + 1, ty)) ||
              (cy === 0 && !isPath(tiles, tx, ty - 1) && isLand(tiles, tx, ty - 1)) ||
              (cy === CELLS - 1 && !isPath(tiles, tx, ty + 1) && isLand(tiles, tx, ty + 1));
            // Pokopia clean surfaces: pebbles/warm accents on ~12% of cells
            // (was ~16% + heavy jitter, which read as an every-other-tile checker)
            const r = hash2(tx * CELLS + cx, ty * CELLS + cy, 5);
            c.set(rim ? PATH_RIM : r < 0.02 ? PATH_PEBBLE : r < 0.12 ? PATH_WARM : PATH_TOP);
            c.offsetHSL(0, 0, (hash2(tx * CELLS + cx, ty * CELLS + cy, 9) - 0.5) * 0.028);
          } else {
            c.set(baseGrass);
            if (t === 'L') c.offsetHSL(0.008, 0.02, -0.018);          // a shade richer under tufts
            if (t === 'T') c.offsetHSL(0, 0, -0.045);                 // shaded under trees
            // ~8% of tiles get a warmer, hue-shifted tint — reads as mown
            // stripes/sun patches and breaks the uniform lime at wide zoom
            if (hash2(tx, ty, 6) < 0.08) c.offsetHSL(-0.014, 0.02, 0.012);
            // ±4% value spread (hue jitter lives in the tile ramp)
            c.offsetHSL(0, 0, (hash2(tx * CELLS + cx, ty * CELLS + cy, 9) - 0.5) * 0.08);
          }
          // darker lip where land meets water (reads as the cliff shadow)
          const nearWater =
            (cx === 0 && !isLand(tiles, tx - 1, ty)) ||
            (cx === CELLS - 1 && !isLand(tiles, tx + 1, ty)) ||
            (cy === 0 && !isLand(tiles, tx, ty - 1)) ||
            (cy === CELLS - 1 && !isLand(tiles, tx, ty + 1));
          if (nearWater) c.multiplyScalar(0.9);
          quad(
            [wx, 0, wz + CS], [wx + CS, 0, wz + CS],
            [wx + CS, 0, wz], [wx, 0, wz],
            [0, 1, 0], c);
        }
      }

      // ---- cliff walls + overhanging grass lip where tile borders water --
      // ART_BIBLE 2.1: stratified cut-cake slab; the grass lip overhangs the
      // strata by LIP so the silhouette reads hand-carved, not extruded.
      const bands = [
        { y0: -LIPD, y1: -0.55, col: STRATA[0] },
        { y0: -0.55, y1: LEDGE_Y, col: STRATA[1] },
        { y0: LEDGE_Y, y1: -1.62, col: STRATA[2] },
        { y0: -1.62, y1: -2.75, col: STRATA[3] }   // runs on below the waterline
      ];
      const sides = [
        { dx: 0, dy: -1, n: [0, 0, -1] },   // north face
        { dx: 0, dy: 1, n: [0, 0, 1] },     // south face
        { dx: -1, dy: 0, n: [-1, 0, 0] },   // west face
        { dx: 1, dy: 0, n: [1, 0, 0] }      // east face
      ];
      const waterN = !isLand(tiles, tx, ty - 1), waterS = !isLand(tiles, tx, ty + 1);
      const waterW = !isLand(tiles, tx - 1, ty), waterE = !isLand(tiles, tx + 1, ty);
      // emit one overhanging slab ring (top cap + underside + outer faces)
      // at a given depth: reused for the grass lip at y=0 AND the mid-cliff
      // terrace ledge — the "hand-carved" step in the island silhouette
      const emitRing = (yT, thick, w, cTop, cSide, cUnder) => {
        const yB = yT - thick;
        const lipBox = (x0, x1, z0, z1, faces) => {
          quad([x0, yT, z1], [x1, yT, z1], [x1, yT, z0], [x0, yT, z0], [0, 1, 0], cTop);
          quad([x0, yB, z0], [x1, yB, z0], [x1, yB, z1], [x0, yB, z1], [0, -1, 0], cUnder);
          if (faces.indexOf('n') >= 0)
            quad([x0, yT, z0], [x1, yT, z0], [x1, yB, z0], [x0, yB, z0], [0, 0, -1], cSide);
          if (faces.indexOf('s') >= 0)
            quad([x1, yT, z1], [x0, yT, z1], [x0, yB, z1], [x1, yB, z1], [0, 0, 1], cSide);
          if (faces.indexOf('w') >= 0)
            quad([x0, yT, z1], [x0, yT, z0], [x0, yB, z0], [x0, yB, z1], [-1, 0, 0], cSide);
          if (faces.indexOf('e') >= 0)
            quad([x1, yT, z0], [x1, yT, z1], [x1, yB, z1], [x1, yB, z0], [1, 0, 0], cSide);
        };
        // lips (E/W spans trimmed where a perpendicular lip from the diagonal
        // land tile already covers the concave corner — avoids z-fighting)
        if (waterN) lipBox(tx, tx + 1, ty - w, ty, 'nwe');
        if (waterS) lipBox(tx, tx + 1, ty + 1, ty + 1 + w, 'swe');
        if (waterW) {
          const z0 = ty + (isLand(tiles, tx - 1, ty - 1) ? w : 0);
          const z1 = ty + 1 - (isLand(tiles, tx - 1, ty + 1) ? w : 0);
          lipBox(tx - w, tx, z0, z1, 'wns');
        }
        if (waterE) {
          const z0 = ty + (isLand(tiles, tx + 1, ty - 1) ? w : 0);
          const z1 = ty + 1 - (isLand(tiles, tx + 1, ty + 1) ? w : 0);
          lipBox(tx + 1, tx + 1 + w, z0, z1, 'ens');
        }
        // convex corner caps so the lip wraps island corners cleanly
        if (waterN && waterW) lipBox(tx - w, tx, ty - w, ty, 'nw');
        if (waterN && waterE) lipBox(tx + 1, tx + 1 + w, ty - w, ty, 'ne');
        if (waterS && waterW) lipBox(tx - w, tx, ty + 1, ty + 1 + w, 'sw');
        if (waterS && waterE) lipBox(tx + 1, tx + 1 + w, ty + 1, ty + 1 + w, 'se');
      };
      // shoreline foam band for this tile (width wobbles per tile so the
      // ring reads organic, not ruled)
      {
        const FW = 0.26 + hash2(tx, ty, 31) * 0.16;
        if (waterN) foamStrip(tx, ty, tx + 1, ty, 0, -FW);
        if (waterS) foamStrip(tx, ty + 1, tx + 1, ty + 1, 0, FW);
        if (waterW) foamStrip(tx, ty, tx, ty + 1, -FW, 0);
        if (waterE) foamStrip(tx + 1, ty, tx + 1, ty + 1, FW, 0);
        if (waterN && waterW) foamCorner(tx, ty, -1, -1, FW);
        if (waterN && waterE) foamCorner(tx + 1, ty, 1, -1, FW);
        if (waterS && waterW) foamCorner(tx, ty + 1, -1, 1, FW);
        if (waterS && waterE) foamCorner(tx + 1, ty + 1, 1, 1, FW);
      }
      const lipTop = new THREE.Color(baseGrass).multiplyScalar(0.92);
      const lipSide = new THREE.Color(baseGrass).multiplyScalar(0.7);
      const lipUnder = new THREE.Color(STRATA[1]).multiplyScalar(0.62);
      lipTop.offsetHSL(0, 0, (hash2(tx, ty, 21) - 0.5) * 0.05);
      emitRing(0, LIPD, LIP, lipTop, lipSide, lipUnder);
      // terrace ledge: muted grass cap, so the cliff reads as two carved
      // tiers (Pokopia cake-slice) instead of one sheer wall
      const ledgeTop = new THREE.Color(baseGrass).multiplyScalar(0.82);
      ledgeTop.offsetHSL(-0.01, -0.04, 0);
      const ledgeSide = new THREE.Color(STRATA[1]).multiplyScalar(1.02);
      const ledgeUnder = new THREE.Color(STRATA[2]).multiplyScalar(0.62);
      ledgeTop.offsetHSL(0, 0, (hash2(tx, ty, 23) - 0.5) * 0.05);
      emitRing(LEDGE_Y, LEDGE_D, LEDGE_W, ledgeTop, ledgeSide, ledgeUnder);

      for (const s of sides) {
        if (isLand(tiles, tx + s.dx, ty + s.dy)) continue;
        for (let ci = 0; ci < CELLS; ci++) {
          // wall strip endpoints along the edge
          let ax, az, bx, bz;
          if (s.dy === -1) { ax = tx + ci * CS; az = ty; bx = ax + CS; bz = ty; }
          else if (s.dy === 1) { ax = tx + (ci + 1) * CS; az = ty + 1; bx = ax - CS; bz = az; }
          else if (s.dx === -1) { ax = tx; az = ty + (ci + 1) * CS; bx = tx; bz = az - CS; }
          else { ax = tx + 1; az = ty + ci * CS; bx = tx + 1; bz = az + CS; }
          const jag = (hash2(Math.round(ax * 4 + az), Math.round(bz * 4), 31) - 0.5) * 0.1;
          for (let bi = 0; bi < bands.length; bi++) {
            const b = bands[bi];
            c.set(b.col);
            // S/E faces point at the SE camera but AWAY from the NW sun —
            // they only get hemisphere fill, so bake a compensating lift or
            // they crush to near-black and the island reads as a burnt crust
            if (s.n[0] > 0 || s.n[2] > 0) c.multiplyScalar(1.18);
            c.offsetHSL(0, 0, (hash2(Math.round(ax * 4), Math.round(az * 4) + bi, 17) - 0.5) * 0.06);
            const y0 = b.y0 + (bi === 0 ? 0 : jag);
            const y1 = b.y1 + (bi === bands.length - 1 ? 0 : jag);
            quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az],
              s.n, c);
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true
  }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  // shoreline foam: one merged transparent band, fading offshore via a 1D
  // alpha gradient (canvas row 0 = v1 = open sea). Rides just above the
  // animated water plane like the prop foam rings (world.js).
  if (foamIdx.length) {
    const fc = document.createElement('canvas');
    fc.width = 4; fc.height = 64;
    const fg = fc.getContext('2d');
    const grad = fg.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.20)');
    grad.addColorStop(1, 'rgba(255,255,255,0.55)');
    fg.fillStyle = grad;
    fg.fillRect(0, 0, 4, 64);
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(foamPos, 3));
    fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(foamUV, 2));
    fgeo.setIndex(foamIdx);
    fgeo.computeBoundingSphere();
    const foam = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(fc), color: 0xF4FBF8,
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    foam.position.y = SEA_Y + 0.1;
    foam.renderOrder = 1;
    mesh.add(foam);
  }
  return mesh;
}

/* ------------------------------------------------------------------ *
 *  WATER                                                               *
 * ------------------------------------------------------------------ */
export function buildWater(tiles) {
  // shore-distance field via BFS on an extended tile grid
  const M = 16;                              // margin tiles around the map
  const GW = MAP_W + M * 2, GH = MAP_H + M * 2;
  const dist = new Float32Array(GW * GH).fill(1e9);
  const qx = [], qy = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (isLand(tiles, x, y)) {
      dist[(y + M) * GW + (x + M)] = 0;
      qx.push(x + M); qy.push(y + M);
    }
  }
  let head = 0;
  while (head < qx.length) {
    const x = qx[head], y = qy[head], d = dist[y * GW + x]; head++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      if (dist[ny * GW + nx] > d + 1) {
        dist[ny * GW + nx] = d + 1;
        qx.push(nx); qy.push(ny);
      }
    }
  }
  function sampleDist(wx, wz) {              // bilinear over tile centers
    const gx = wx - 0.5 + M, gy = wz - 0.5 + M;
    const x0 = Math.max(0, Math.min(GW - 2, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(GH - 2, Math.floor(gy)));
    const fx = Math.min(1, Math.max(0, gx - x0)), fy = Math.min(1, Math.max(0, gy - y0));
    const d00 = dist[y0 * GW + x0], d10 = dist[y0 * GW + x0 + 1];
    const d01 = dist[(y0 + 1) * GW + x0], d11 = dist[(y0 + 1) * GW + x0 + 1];
    return (d00 * (1 - fx) + d10 * fx) * (1 - fy) + (d01 * (1 - fx) + d11 * fx) * fy;
  }

  const W = 96, D = 82, SEGX = 128, SEGZ = 108;
  const geo = new THREE.PlaneGeometry(W, D, SEGX, SEGZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(MAP_W / 2, 0, MAP_H / 2);

  const posAttr = geo.attributes.position;
  const n = posAttr.count;
  const colors = new Float32Array(n * 3);
  const foam = new Float32Array(n);
  const rand = new Float32Array(n);
  const c = new THREE.Color();
  const OPEN_SEA = new THREE.Color('#55B8CE');   // desaturated open-sea base:
  for (let i = 0; i < n; i++) {                  // the island stays the most
    const wx = posAttr.getX(i), wz = posAttr.getZ(i);   // saturated thing in frame
    const d = sampleDist(wx, wz);
    const t = Math.min(1, d / 4.2);
    c.copy(WATER_SHALLOW).lerp(WATER_DEEP, t * t * (3 - 2 * t));
    if (d > 5) c.lerp(WATER_ABYSS, Math.min(1, (d - 5) / 6));
    if (d > 4) c.lerp(OPEN_SEA, Math.min(1, (d - 4) / 7) * 0.55);
    c.offsetHSL(0, 0, (hash2(i, 0, 77) - 0.5) * 0.015);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    foam[i] = 1 - THREE.MathUtils.smoothstep(d, 0.45, 1.15);
    rand[i] = hash2(i, 1, 91);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aFoam', new THREE.BufferAttribute(foam, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

  const uTime = { value: 0 };
  const HORIZON = new THREE.Color('#BDE3F5');
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uHorizon = { value: HORIZON };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFoam; attribute float aRand;
        varying float vFoam; varying float vRand; varying vec2 vWXZ; varying float vFar;
        uniform float uTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFoam = aFoam; vRand = aRand; vWXZ = position.xz;
        float bobAmp = 0.07 * (1.0 - aFoam * 0.55);
        // facet contrast fades to ~40% on the open sea so the flat-shaded
        // tiling never reads as wallpaper at wide zoom
        vFar = smoothstep(18.0, 28.0, length(position.xz - vec2(20.0, 15.0)));
        // near-kill the far-field bob: at wide zoom the flat-shaded facets
        // otherwise tile into a diamond/checker lattice across the open sea
        bobAmp *= mix(1.0, 0.12, vFar);
        transformed.y += (sin(uTime * 0.9 + position.x * 2.02)
                        + sin(uTime * 0.66 + position.z * 1.31 + position.x * 0.71)) * bobAmp;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFoam; varying float vRand; varying vec2 vWXZ; varying float vFar;
        uniform float uTime; uniform vec3 uHorizon;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // second low-frequency value modulation (13-19u wavelengths): breaks
        // the hex/facet repetition across the whole sea at wide zoom
        float lf = sin(vWXZ.x * 0.43 + vWXZ.y * 0.17 + uTime * 0.11)
                 + sin(vWXZ.x * 0.13 - vWXZ.y * 0.39 + 1.7 + uTime * 0.07);
        diffuseColor.rgb *= 1.0 + lf * 0.02;
        float lap = 0.62 + 0.38 * sin(uTime * 1.4 + vRand * 6.2831);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.99, 0.97),
                               clamp(vFoam * lap, 0.0, 1.0) * 0.9);
        // sun glints: tiny dots inside a facet, never the whole triangle.
        // Twinkle phase is hashed PER CELL (interpolated vRand alone made
        // whole patches flash together as a dot lattice), the mask drifts
        // slowly, and the flash clears the 1.05 bloom threshold. Glints
        // fade with the facets on the open sea.
        vec2 cuv = (vWXZ + uTime * 0.02) * vec2(1.31, 1.13);
        vec2 cell = fract(cuv) - 0.5;
        float ch = fract(sin(dot(floor(cuv), vec2(127.1, 311.7))) * 43758.5453);
        // sparse, soft, near-shore only: glints are sun-glints, never a
        // dust-field of white specks across the open sea in stills
        float dotMask = smoothstep(0.30, 0.10, length(cell));
        float tw = smoothstep(0.965, 1.0, sin(uTime * 1.7 + ch * 87.0))
                 * step(0.93, ch) * (1.0 - vFoam) * dotMask * (1.0 - vFar);
        diffuseColor.rgb += tw * vec3(2.6, 2.4, 1.5);
        // distant water melts toward the horizon color — gives the wide shot
        // a real horizon line instead of one flat cyan field
        float hd = smoothstep(28.0, 80.0, length(vWXZ - vec2(20.0, 15.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, uHorizon, hd);`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = SEA_Y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  // ---- pond: enclosed water sits just under the grass lip, shallow cyan
  // with a thin foam rim only (ART_BIBLE 2.2) — never a milk-white pool.
  const pondGeo = new THREE.PlaneGeometry(
    POND.x1 - POND.x0 + 0.3, POND.z1 - POND.z0 + 0.3, 14, 14);
  pondGeo.rotateX(-Math.PI / 2);
  pondGeo.translate((POND.x0 + POND.x1) / 2, 0, (POND.z0 + POND.z1) / 2);
  {
    const pAttr = pondGeo.attributes.position;
    const pn = pAttr.count;
    const pCol = new Float32Array(pn * 3);
    const pFoam = new Float32Array(pn);
    const pRand = new Float32Array(pn);
    for (let i = 0; i < pn; i++) {
      const wx = pAttr.getX(i), wz = pAttr.getZ(i);
      const edge = Math.min(wx - POND.x0, POND.x1 - wx, wz - POND.z0, POND.z1 - wz);
      const center = Math.min(1, Math.max(0, (edge - 0.3) / 1.0));
      c.copy(POND_SHALLOW).lerp(POND_MID, center * 0.7);
      c.offsetHSL(0, 0, (hash2(i, 2, 53) - 0.5) * 0.012);
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      // thin rim: 0.2-0.5u band, capped well below full foam
      pFoam[i] = Math.min(0.4, 1 - THREE.MathUtils.smoothstep(edge, 0.2, 0.5));
      pRand[i] = hash2(i, 3, 97);
    }
    pondGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    pondGeo.setAttribute('aFoam', new THREE.BufferAttribute(pFoam, 1));
    pondGeo.setAttribute('aRand', new THREE.BufferAttribute(pRand, 1));
  }
  const pond = new THREE.Mesh(pondGeo, mat);
  pond.position.y = -0.16;
  pond.receiveShadow = true;
  pond.castShadow = false;

  // ---- far-water skirt: coarse 220x220 plane under everything, so the
  // intro/wide shot never exposes the void past the detailed moat plane.
  // Unlit color matched to the deep ramp; same horizon melt as above.
  const skirtGeo = new THREE.PlaneGeometry(220, 220, 44, 44);
  skirtGeo.rotateX(-Math.PI / 2);
  skirtGeo.translate(MAP_W / 2, 0, MAP_H / 2);
  const skirtMat = new THREE.MeshLambertMaterial({ color: WATER_ABYSS });
  skirtMat.onBeforeCompile = (shader) => {
    shader.uniforms.uHorizon = { value: HORIZON };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWXZ = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vWXZ; uniform vec3 uHorizon;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float hd = smoothstep(28.0, 80.0, length(vWXZ - vec2(20.0, 15.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, uHorizon, hd);`);
  };
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = SEA_Y - 0.08;
  skirt.receiveShadow = false;
  skirt.castShadow = false;

  const group = new THREE.Group();
  group.add(mesh, pond, skirt);

  return {
    mesh: group,
    update(t) { uTime.value = t; }
  };
}
