/* ============================================================================
   YOONKI WORLD 3D — ortho quarter-view camera
   Damped follow with look-ahead, cinematic intro sweep (skippable),
   encounter dolly/zoom with cubic easing, idle drift.
   ========================================================================== */

import * as THREE from 'three';
import { CAM, REDUCED, dirFromAngles, damp, clamp } from './const.js';

const CENTER = new THREE.Vector3(20, 0, 15);

function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

/**
 * Convert a screen-space offset (wu right, wu up — at the fixed encounter
 * azimuth and the given elevation) into a ground-plane world offset.
 * Used to place the staged encounter "trainer slot" relative to a subject.
 */
export function screenToGround(elevationDeg, sx, sy) {
  const az = THREE.MathUtils.degToRad(CAM.azimuth);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const c = -sy / Math.sin(el);                // screen-down = toward camera
  return {
    dx: sx * Math.sin(az) + c * Math.cos(az),
    dz: -sx * Math.cos(az) + c * Math.sin(az)
  };
}

export function createCameraRig(aspect) {
  const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 560;
  const baseHalfH = isMobile ? CAM.halfHMobile : CAM.halfH;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  const state = {
    target: new THREE.Vector3(20, 0.4, 15),
    halfH: baseHalfH,
    azimuth: CAM.azimuth,
    elevation: CAM.elevation,
    look: new THREE.Vector3(),               // eased look-ahead
    aspect,
    mode: 'follow',                          // follow | title | tween | hold
    tween: null,
    hold: null,                              // encounter ultra-slow push-in
    idleT: 0,
    introDone: null
  };

  function applyProjection() {
    const hh = state.halfH, hw = hh * state.aspect;
    camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
    camera.updateProjectionMatrix();
  }
  applyProjection();

  function placeCamera() {
    camera.position.copy(state.target)
      .addScaledVector(dirFromAngles(state.azimuth, state.elevation), CAM.dist);
    camera.lookAt(state.target);
  }

  function startTween(to, dur, after) {
    state.mode = 'tween';
    state.hold = null;
    state.tween = {
      t: 0, dur,
      fromT: state.target.clone(), toT: to.target,
      fromH: state.halfH, toH: to.halfH,
      fromA: state.azimuth, toA: to.azimuth != null ? to.azimuth : state.azimuth,
      fromE: state.elevation, toE: to.elevation != null ? to.elevation : state.elevation,
      after
    };
  }

  const rig = {
    camera,
    get halfH() { return state.halfH; },
    get azimuth() { return state.azimuth; },
    get elevation() { return state.elevation; },
    get aspect() { return state.aspect; },

    setAspect(a) { state.aspect = a; applyProjection(); },

    /** Title screen: hold the wide diorama (the money shot) with a slow
     *  azimuth drift behind the dimmed logotype — the renderer boots behind
     *  the title instead of hiding the game's best asset. */
    showTitle() {
      state.mode = 'title';
      state.target.copy(CENTER).setY(0.4);
      state.halfH = CAM.introHalfH;
      state.azimuth = 118;
      applyProjection();
      placeCamera();
    },

    startIntro(playerPos, onDone) {
      if (REDUCED) {
        // no sweep: snap straight to the follow framing
        state.mode = 'follow';
        state.target.set(playerPos.x, 0.4, playerPos.z);
        state.halfH = baseHalfH;
        state.azimuth = CAM.azimuth;
        applyProjection();
        placeCamera();
        onDone && onDone();
        return false;
      }
      // tween from wherever the title drift left us (or reset if not shown)
      if (state.mode !== 'title') {
        state.target.copy(CENTER).setY(0.4);
        state.halfH = CAM.introHalfH;
        state.azimuth = 118;
        applyProjection();
        placeCamera();
      }
      state.introDone = onDone || null;
      startTween({
        target: new THREE.Vector3(playerPos.x, 0.4, playerPos.z),
        halfH: baseHalfH, azimuth: CAM.azimuth
      }, 3.6, () => {
        state.mode = 'follow';
        const cb = state.introDone; state.introDone = null;
        cb && cb();
      });
      return true;
    },

    skipIntro() {
      if (!(state.mode === 'tween' && state.introDone)) return;
      const tw = state.tween;
      state.target.copy(tw.toT);
      state.halfH = tw.toH;
      state.azimuth = tw.toA;
      state.elevation = tw.toE;
      state.tween = null;
      state.mode = 'follow';
      applyProjection();
      const cb = state.introDone; state.introDone = null;
      cb && cb();
    },

    /**
     * Pokemon battle framing: ONE short dolly+zoom to a composed two-shot,
     * then hold dead still. The azimuth never leaves the world's 45° (the
     * island is authored for that read — and a spinning cut disoriented
     * players), so the "move" is only pan + zoom + an optional elevation
     * raise that clears foreground occluders (nursery fence, tree ring).
     * The subject sits heroX wu right of frame center at a zoom sized to
     * its measured height; game3d stages the player into the lower-left
     * foreground slot during the iris blackout. While holding, the only
     * motion allowed is an ultra-slow push-in (1.5% over 10s; skipped
     * under prefers-reduced-motion).
     * frame = { x, z, subjectH, halfH, elevation, heroX }
     */
    startEncounter(frame) {
      const el = frame.elevation != null ? frame.elevation : CAM.elevation;
      const azr = THREE.MathUtils.degToRad(CAM.azimuth);
      const elr = THREE.MathUtils.degToRad(el);
      // screen basis in world space for (azimuth, elevation)
      const right = new THREE.Vector3(Math.sin(azr), 0, -Math.cos(azr));
      const up = new THREE.Vector3(
        -Math.cos(azr) * Math.sin(elr), Math.cos(elr), -Math.sin(azr) * Math.sin(elr));
      // look at the subject's visual mass, shifted so the subject lands
      // heroX right of center and above the vertical midline (frame.lift:
      // a hair on desktop; a third of the frame on portrait phones, where
      // the dialog panel swallows the whole bottom half)
      const target = new THREE.Vector3(frame.x, frame.subjectH * 0.55, frame.z)
        .addScaledVector(right, -frame.heroX)
        .addScaledVector(up, -(frame.lift != null ? frame.lift : frame.halfH * 0.04));
      startTween({
        target, halfH: frame.halfH, azimuth: CAM.azimuth, elevation: el
      }, REDUCED ? 0.01 : 0.9, () => {
        state.mode = 'hold';
        state.hold = { h0: frame.halfH, t: 0 };
      });
      return CAM.azimuth;
    },

    endEncounter(playerPos) {
      startTween({
        target: new THREE.Vector3(playerPos.x, 0.4, playerPos.z),
        halfH: baseHalfH,
        azimuth: CAM.azimuth,
        elevation: CAM.elevation
      }, REDUCED ? 0.01 : 0.7, () => { state.mode = 'follow'; });
    },

    update(dt, playerPos, playerYaw, playerSpeed, t) {
      if (state.mode === 'title') {
        if (!REDUCED) state.azimuth = 118 + Math.sin(t * 0.05) * 6;
        placeCamera();
        return;
      }
      if (state.mode === 'tween' && state.tween) {
        const tw = state.tween;
        tw.t += dt;
        const k = easeInOut(Math.min(1, tw.t / tw.dur));
        state.target.lerpVectors(tw.fromT, tw.toT, k);
        state.halfH = tw.fromH + (tw.toH - tw.fromH) * k;
        state.azimuth = tw.fromA + (tw.toA - tw.fromA) * k;
        state.elevation = tw.fromE + (tw.toE - tw.fromE) * k;
        applyProjection();
        if (tw.t >= tw.dur) {
          state.tween = null;
          tw.after && tw.after();
        }
      } else if (state.mode === 'hold' && state.hold && !REDUCED) {
        // held encounter shot: the one motion allowed is a whisper of a
        // push-in — 1.5% tighter over 10s, then rock still
        const hd = state.hold;
        hd.t = Math.min(10, hd.t + dt);
        const k = hd.t / 10;
        state.halfH = hd.h0 * (1 - 0.015 * k * k * (3 - 2 * k));
        applyProjection();
      } else if (state.mode === 'follow') {
        // look-ahead in the walk direction
        const ahead = playerSpeed > 1 ? 0.6 : 0;
        state.look.x = damp(state.look.x, Math.sin(playerYaw) * ahead, 3.5, dt);
        state.look.z = damp(state.look.z, Math.cos(playerYaw) * ahead, 3.5, dt);
        // idle figure-eight drift
        if (playerSpeed < 0.2 && !REDUCED) state.idleT += dt;
        else state.idleT = 0;
        let ix = 0, iz = 0;
        if (state.idleT > 4) {
          const p = (state.idleT - 4) / 8 * Math.PI * 2;
          ix = Math.sin(p) * 0.15; iz = Math.sin(p * 2) * 0.1;
        }
        const lam = REDUCED ? 20 : 6;
        const tx = clamp(playerPos.x + state.look.x + ix, 6.5, 33.5);
        // tz max 25.2: at the south POIs (demo lab / nursery) the frame
        // stays weighted onto the island instead of half-empty water
        const tz = clamp(playerPos.z + state.look.z + iz, 4.5, 25.2);
        state.target.x = damp(state.target.x, tx, lam, dt);
        state.target.y = damp(state.target.y, 0.4, lam, dt);
        state.target.z = damp(state.target.z, tz, lam, dt);
        if (Math.abs(state.halfH - baseHalfH) > 1e-4) {
          state.halfH = damp(state.halfH, baseHalfH, 6, dt);
          applyProjection();
        }
      }
      placeCamera();
    }
  };

  placeCamera();
  return rig;
}
