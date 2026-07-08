/* ============================================================================
   YOONKI WORLD 3D — audio
   BGM: the existing overworld/encounter MP3s with lazy load + crossfade
   (ported from the 2D engine). SFX: generated one-shot MP3s (audio/sfx/*)
   lazy-loaded after the start gesture and played through WebAudio; every
   sound keeps its original synthesized fallback so a missing/failed file
   never silences the game. One mute flag rules them all (localStorage
   `yw_muted`).
   ========================================================================== */

import { REDUCED, ASSET_V } from './const.js';

export function createAudio() {
  /* ---- BGM ------------------------------------------------------------ */
  const bgm = {
    tracks: {}, muted: false, started: false, current: null, fadeTimer: null,
    VOL: 0.55
  };
  function mkTrack(url) {
    const t = { el: null, dead: false, loadStarted: false };
    try {
      t.el = new Audio();
      t.el.loop = true;
      t.el.preload = 'none';
      t.el.volume = 0;
      t.el.addEventListener('error', () => { t.dead = true; });
      t.el.src = url;
    } catch (e) { t.dead = true; }
    return t;
  }
  bgm.tracks.over = mkTrack('audio/overworld.mp3?v=' + ASSET_V);
  bgm.tracks.enc = mkTrack('audio/encounter.mp3?v=' + ASSET_V);
  try { bgm.muted = localStorage.getItem('yw_muted') === '1'; } catch (e) { /* noop */ }

  document.addEventListener('visibilitychange', () => {
    const t = bgm.current && bgm.tracks[bgm.current];
    if (!t || t.dead || !bgm.started) return;
    if (document.hidden) { try { t.el.pause(); } catch (e) { /* noop */ } }
    else t.el.play().catch(() => {});
  });

  bgm.fadeTo = function (name, ms = 700) {
    const from = bgm.current && bgm.current !== name ? bgm.tracks[bgm.current] : null;
    const to = bgm.tracks[name];
    bgm.current = name;
    if (!bgm.started) return;
    if (to && !to.dead && to.el) {
      if (!to.loadStarted) { to.loadStarted = true; try { to.el.load(); } catch (e) { /* noop */ } }
      try { to.el.currentTime = 0; } catch (e) { /* noop */ }
      to.el.volume = 0;
      to.el.muted = bgm.muted;
      to.el.play().catch(() => {});
    }
    if (bgm.fadeTimer) { clearInterval(bgm.fadeTimer); bgm.fadeTimer = null; }
    const steps = Math.max(1, Math.round(ms / 50));
    let i = 0;
    bgm.fadeTimer = setInterval(() => {
      i++;
      const k = Math.min(1, i / steps);
      const tgt = bgm.muted ? 0 : bgm.VOL;
      if (to && !to.dead && to.el) to.el.volume = tgt * k;
      if (from && !from.dead && from.el) from.el.volume = Math.max(0, tgt * (1 - k));
      if (k >= 1) {
        clearInterval(bgm.fadeTimer); bgm.fadeTimer = null;
        if (from && !from.dead && from.el) { try { from.el.pause(); } catch (e) { /* noop */ } }
      }
    }, 50);
  };
  bgm.start = function () {
    if (bgm.started) return;
    bgm.started = true;
    bgm.fadeTo('over', REDUCED ? 0 : 500);
  };

  /* ---- SFX synth -------------------------------------------------------- */
  let ctx = null, master = null;
  function ac() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = bgm.muted ? 0 : 1;
    master.connect(ctx.destination);
    return ctx;
  }
  function env(gainNode, t0, peak, dur) {
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function osc(type, freq, peak, dur, opts = {}) {
    const c = ac(); if (!c || bgm.muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    const t0 = c.currentTime + (opts.delay || 0);
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    env(g, t0, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(peak, dur, filterFreq, opts = {}) {
    const c = ac(); if (!c || bgm.muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = opts.rate || 1;
    const f = c.createBiquadFilter();
    f.type = opts.type || 'lowpass';
    f.frequency.value = filterFreq;
    const g = c.createGain();
    const t0 = c.currentTime + (opts.delay || 0);
    env(g, t0, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /* ---- file-backed SFX (generated one-shots, lazy-loaded after start) ----
     Small MP3s decoded to AudioBuffers, played through the same master gain
     as the synth (so the mute toggle rules both). A missing / 404 / broken
     file simply never fills its slot and the caller drops through to the
     synthesized version — per-sound fallback, zero regressions. */
  const SFX_FILES = {
    step: 'audio/sfx/footstep_grass.mp3?v=' + ASSET_V,
    bump: 'audio/sfx/bump.mp3?v=' + ASSET_V,
    pop: 'audio/sfx/pop.mp3?v=' + ASSET_V,
    sting: 'audio/sfx/encounter_sting.mp3?v=' + ASSET_V,
    blip: 'audio/sfx/blip.mp3?v=' + ASSET_V,
    firework: 'audio/sfx/fireworks.mp3?v=' + ASSET_V
  };
  const SFX_GAIN = {
    step: 0.22, bump: 0.4, pop: 0.42, sting: 0.6, blip: 0.3, firework: 0.75
  };
  const sfxBuf = {};
  let sfxFetched = false;
  function loadSfxFiles() {
    if (sfxFetched) return;
    const c = ac();
    if (!c) return;
    sfxFetched = true;
    for (const name of Object.keys(SFX_FILES)) {
      fetch(SFX_FILES[name])
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))))
        .then(ab => c.decodeAudioData(ab))
        .then(buf => { sfxBuf[name] = buf; })
        .catch(() => { /* slot stays empty -> synth fallback */ });
    }
  }
  /** Play a decoded one-shot. Returns false only when the buffer is
   *  unavailable (caller then runs its synth fallback). When muted it
   *  returns true and plays nothing — the synth would no-op anyway. */
  function playFile(name, opts = {}) {
    const c = ac();
    if (!c || bgm.muted) return true;
    const buf = sfxBuf[name];
    if (!buf) return false;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate || 1;
    const g = c.createGain();
    const v = (SFX_GAIN[name] != null ? SFX_GAIN[name] : 0.5) * (opts.gain || 1);
    g.gain.value = v;
    const t0 = c.currentTime + (opts.delay || 0);
    src.connect(g); g.connect(master);
    src.start(t0);
    if (opts.dur) {                            // truncated play (typewriter tick)
      g.gain.setValueAtTime(v, t0 + Math.max(0, opts.dur - 0.02));
      g.gain.linearRampToValueAtTime(0.0001, t0 + opts.dur);
      src.stop(t0 + opts.dur + 0.01);
    }
    return true;
  }

  let lastStep = 0;
  const sfx = {
    unlock() {
      const c = ac();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
      loadSfxFiles();                          // lazy: first start gesture
    },
    step() {
      const now = performance.now();
      if (now - lastStep < 130) return;        // throttled to hop cadence
      lastStep = now;
      if (playFile('step', { rate: 0.92 + Math.random() * 0.2 })) return;
      noise(0.05, 0.07, 700 + Math.random() * 300, { rate: 0.8 + Math.random() * 0.3 });
    },
    bump() {
      if (playFile('bump')) return;
      osc('triangle', 130, 0.09, 0.08);
    },
    knock(strength = 1) {
      noise(Math.min(0.14, 0.05 * strength), 0.06, 1200);
      osc('sine', 170 + Math.random() * 40, Math.min(0.16, 0.07 * strength), 0.12, { slideTo: 90 });
    },
    bounce() { osc('sine', 300, 0.08, 0.12, { slideTo: 170 }); },
    pop() {
      if (playFile('pop', { rate: 0.95 + Math.random() * 0.15 })) return;
      osc('sine', 620, 0.07, 0.09, { slideTo: 290 }); noise(0.03, 0.04, 2400, { type: 'highpass' });
    },
    blip() {
      if (playFile('blip')) return;
      osc('square', 880, 0.045, 0.07);
    },
    confirm() {
      if (playFile('blip')) { playFile('blip', { rate: 1.33, delay: 0.07 }); return; }
      osc('square', 990, 0.05, 0.07); osc('square', 1320, 0.05, 0.09, { delay: 0.07 });
    },
    back() {
      if (playFile('blip', { rate: 0.8 })) { playFile('blip', { rate: 0.62, delay: 0.06 }); return; }
      osc('square', 660, 0.045, 0.07); osc('square', 440, 0.045, 0.09, { delay: 0.06 });
    },
    tick() {
      // typewriter: a whisper-level, truncated, pitched-up blip
      if (playFile('blip', { gain: 0.2, rate: 1.7, dur: 0.05 })) return;
      osc('square', 1900, 0.014, 0.025);
    },
    sting() {
      if (playFile('sting')) return;
      [523, 659, 784, 1047].forEach((f, i) => osc('sawtooth', f, 0.06, 0.16, { delay: i * 0.07 }));
      noise(0.05, 0.5, 1600, { delay: 0.02 });
    },
    sparkle() {
      [1568, 1976, 2637].forEach((f, i) => osc('sine', f, 0.045, 0.2, { delay: i * 0.05 }));
    },
    firework() {
      if (playFile('firework', { rate: 0.9 + Math.random() * 0.25 })) return;
      noise(0.12, 0.5, 900);
      osc('sine', 220, 0.07, 0.5, { slideTo: 60 });
    },
    splash() { noise(0.06, 0.25, 1000, { rate: 0.7 }); }
  };

  /* ---- mute ----------------------------------------------------------------- */
  function setMuted(m) {
    bgm.muted = m;
    try { localStorage.setItem('yw_muted', m ? '1' : '0'); } catch (e) { /* noop */ }
    for (const name in bgm.tracks) {
      const t = bgm.tracks[name];
      if (t && !t.dead && t.el) t.el.muted = m;
    }
    const cur = bgm.current && bgm.tracks[bgm.current];
    if (cur && !cur.dead && cur.el && !bgm.fadeTimer) cur.el.volume = m ? 0 : bgm.VOL;
    if (master) master.gain.value = m ? 0 : 1;
  }

  return { bgm, sfx, setMuted, get muted() { return bgm.muted; } };
}
