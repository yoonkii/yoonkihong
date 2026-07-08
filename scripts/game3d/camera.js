/* ============================================================================
   YOONKI WORLD 3D — ortho quarter-view camera
   Damped follow with look-ahead, cinematic intro sweep (skippable),
   encounter dolly/zoom with cubic easing, idle drift.
   ========================================================================== */

import * as THREE from 'three';
import { CAM, REDUCED, dirFromAngles, damp, clamp } from './const.js';

const CENTER = new THREE.Vector3(20, 0, 15);

function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export function createCameraRig(aspect) {
  const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 560;
  const baseHalfH = isMobile ? CAM.halfHMobile : CAM.halfH;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  const state = {
    target: new THREE.Vector3(20, 0.4, 15),
    halfH: baseHalfH,
    azimuth: CAM.azimuth,
    look: new THREE.Vector3(),               // eased look-ahead
    aspect,
    mode: 'follow',                          // follow | title | tween | hold
    tween: null,
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
      .addScaledVector(dirFromAngles(state.azimuth, CAM.elevation), CAM.dist);
    camera.lookAt(state.target);
  }

  function startTween(to, dur, after) {
    state.mode = 'tween';
    state.tween = {
      t: 0, dur,
      fromT: state.target.clone(), toT: to.target,
      fromH: state.halfH, toH: to.halfH,
      fromA: state.azimuth, toA: to.azimuth != null ? to.azimuth : state.azimuth,
      after
    };
  }

  const rig = {
    camera,
    get halfH() { return state.halfH; },
    get azimuth() { return state.azimuth; },

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
      state.tween = null;
      state.mode = 'follow';
      applyProjection();
      const cb = state.introDone; state.introDone = null;
      cb && cb();
    },

    /**
     * Dolly toward the encounter subject. If playerPos is given, swing the
     * camera a full 90 deg off the player-subject line so the player sits at
     * the lower-left edge and the subject owns the center third of frame —
     * the player's back can never occlude the creature. The look target is
     * also nudged toward the subject's screen-right to bias the composition.
     * Returns the encounter azimuth (deg).
     */
    startEncounter(focus, playerPos) {
      let az = CAM.azimuth;
      let ax = 0, azd = 0;                       // player->subject push
      if (playerPos) {
        const dx = playerPos.x - focus.x, dz = playerPos.z - focus.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.01) {
          az = THREE.MathUtils.radToDeg(Math.atan2(dz, dx)) - 90;
          const d = Math.sqrt(d2);
          ax = -dx / d; azd = -dz / d;
        }
      }
      // screen-right in world XZ for this azimuth (camera right = up x dir).
      // 0.8u right-nudge + 0.15u push past the subject: the creature owns
      // the center third and the player shrinks to the frame corner — their
      // silhouettes can never overlap (navy hair on navy wing)
      const azr = THREE.MathUtils.degToRad(az);
      const rx = Math.sin(azr), rz = -Math.cos(azr);
      startTween({
        target: new THREE.Vector3(
          focus.x + rx * 0.8 + ax * 0.15,
          focus.y != null ? focus.y : 0.6,
          focus.z + rz * 0.8 + azd * 0.15),
        halfH: CAM.encounterHalfH,
        azimuth: az
      }, REDUCED ? 0.01 : 0.9, () => { state.mode = 'hold'; });
      return az;
    },

    endEncounter(playerPos) {
      startTween({
        target: new THREE.Vector3(playerPos.x, 0.4, playerPos.z),
        halfH: baseHalfH,
        azimuth: CAM.azimuth
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
        applyProjection();
        if (tw.t >= tw.dur) {
          state.tween = null;
          tw.after && tw.after();
        }
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
