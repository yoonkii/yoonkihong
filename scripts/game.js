/* ============================================================================
   YOONKI WORLD — game engine (vanilla JS + canvas, no deps)
   Exposes window.YW — booted by scripts/main.js
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  CONSTANTS + MAP                                                    *
   * ------------------------------------------------------------------ */
  var TILE = 32;                 // logical pixels per tile
  var STEP_MS = 170;             // player: ms per tile
  var CREATURE_STEP_MS = 300;    // creatures walk slower
  var TURN_MS = 90;              // tap-to-turn grace period

  // Legend: W water  G grass  P path  T tree  L tall grass  F flower  X fence
  var MAP = [
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
    'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGFGGGGGGGGFGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGFGGGGGGFGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
    'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
    'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
    'WWTGGGGGGGGGGFGGGGGPPGGGGGFGGGGGGGGGGTWW',
    'WWTGFGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGFGTWW',
    'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
    'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
    'WWTGGGLLLLLLGGGGGGGPPGGGGLLLLLLGGWWWGTWW',
    'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGGGGGPPGGGGGGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGFGGGGGPPGGGGGFGGGGGGGGGGTWW',
    'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
    'WWTGGPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPGGTWW',
    'WWTGGGGGFGGGGGGXXXXPPXXXXXGGGGGFGGGGGTWW',
    'WWTGGGGGGGGGGGGXGGGPPGGGGXGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGXFGGGGGGGFXGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGXGGGGGGGGGXGGGGGGGGGGGTWW',
    'WWTGGGGGGGGGGGGXXXXXXXXXXXGGGGGGGGGGGTWW',
    'WWTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'
  ];
  var MAP_W = MAP[0].length, MAP_H = MAP.length;
  var SOLID = { W: 1, T: 1, X: 1 };

  // Building footprints are 4x4 tiles (drawn 128x128 logical px).
  var HOME_SLOT = { x: 18, y: 4 };
  var BUILDING_SLOTS = [
    { x: 5,  y: 5 },  { x: 31, y: 5 },
    { x: 5,  y: 16 }, { x: 31, y: 16 },
    { x: 14, y: 16 }, { x: 22, y: 16 }        // spares for future projects
  ];
  var CREATURE_SPOTS = [
    { x: 10, y: 11 }, { x: 29, y: 11 },
    { x: 10, y: 22 }, { x: 29, y: 22 },
    { x: 13, y: 22 }, { x: 27, y: 22 }
  ];
  var EGG_SLOTS = [
    { x: 17, y: 24 }, { x: 20, y: 25 }, { x: 23, y: 24 },
    { x: 18, y: 25 }, { x: 22, y: 25 }, { x: 17, y: 23 }
  ];
  var NPC_TILE  = { x: 17, y: 8 };
  var SIGN_TILE = { x: 22, y: 8 };
  var PLAYER_START = { x: 19, y: 12 };

  var REDUCED = false;
  try {
    REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* noop */ }

  /* ------------------------------------------------------------------ *
   *  ASSET PRELOADER (per-file error tolerance)                         *
   * ------------------------------------------------------------------ */
  var IMGS = {};   // key -> {img, ok}

  function preloadImages(list, onEach) {
    // list: [{key, url}]
    return Promise.all(list.map(function (item) {
      return new Promise(function (resolve) {
        var img = new Image();
        var entry = { img: img, ok: false };
        IMGS[item.key] = entry;
        img.onload = function () { entry.ok = true; onEach(); resolve(); };
        img.onerror = function () { entry.ok = false; onEach(); resolve(); };
        img.src = item.url;
      });
    }));
  }

  /* ------------------------------------------------------------------ *
   *  AUDIO                                                              *
   * ------------------------------------------------------------------ */
  var AudioMan = {
    tracks: {},
    muted: false,
    started: false,
    current: null,
    fadeTimer: null,
    VOL: 0.55,

    init: function () {
      this.tracks.over = this._mk('audio/overworld.mp3');
      this.tracks.enc = this._mk('audio/encounter.mp3');
      try { this.muted = localStorage.getItem('yw_muted') === '1'; } catch (e) { /* noop */ }
      var self = this;
      document.addEventListener('visibilitychange', function () {
        var t = self.current && self.tracks[self.current];
        if (!t || t.dead || !self.started) return;
        if (document.hidden) { try { t.el.pause(); } catch (e) { /* noop */ } }
        else { t.el.play().catch(function () {}); }
      });
    },
    _mk: function (url) {
      // Lazy: no bytes are fetched until the track is first faded in
      // (saves ~1.6MB of pre-gesture download on phones).
      var t = { el: null, dead: false, loadStarted: false };
      try {
        t.el = new Audio();
        t.el.loop = true;
        t.el.preload = 'none';
        t.el.volume = 0;
        t.el.addEventListener('error', function () { t.dead = true; });
        t.el.src = url;
      } catch (e) { t.dead = true; }
      return t;
    },
    start: function () {                       // must be called from a user gesture
      if (this.started) return;
      this.started = true;
      this.fadeTo('over', REDUCED ? 0 : 500);
    },
    setMuted: function (m) {
      this.muted = m;
      try { localStorage.setItem('yw_muted', m ? '1' : '0'); } catch (e) { /* noop */ }
      // .muted works everywhere (iOS Safari treats .volume as read-only).
      for (var name in this.tracks) {
        var t = this.tracks[name];
        if (t && !t.dead && t.el) t.el.muted = m;
      }
      // Snap the current track unless a fade is running — the fade interval
      // recomputes its target from this.muted every tick, so it converges.
      var cur = this.current && this.tracks[this.current];
      if (cur && !cur.dead && cur.el && !this.fadeTimer) cur.el.volume = m ? 0 : this.VOL;
    },
    fadeTo: function (name, ms) {
      var self = this;
      if (ms == null) ms = 700;
      var from = this.current && this.current !== name ? this.tracks[this.current] : null;
      var to = this.tracks[name];
      this.current = name;
      if (!this.started) return;
      if (to && !to.dead && to.el) {
        if (!to.loadStarted) {
          to.loadStarted = true;
          try { to.el.load(); } catch (e) { /* noop */ }
        }
        try { to.el.currentTime = 0; } catch (e) { /* noop */ }
        to.el.volume = 0;
        to.el.muted = this.muted;
        to.el.play().catch(function () {});
      }
      if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
      var steps = Math.max(1, Math.round(ms / 50));
      var i = 0;
      this.fadeTimer = setInterval(function () {
        i++;
        var k = Math.min(1, i / steps);
        // Recompute each tick so muting mid-fade sticks.
        var tgt = self.muted ? 0 : self.VOL;
        if (to && !to.dead && to.el) to.el.volume = tgt * k;
        if (from && !from.dead && from.el) from.el.volume = Math.max(0, tgt * (1 - k));
        if (k >= 1) {
          clearInterval(self.fadeTimer); self.fadeTimer = null;
          if (from && !from.dead && from.el) { try { from.el.pause(); } catch (e) { /* noop */ } }
        }
      }, 50);
    }
  };

  /* ------------------------------------------------------------------ *
   *  TINY SFX (WebAudio blips — no files needed)                        *
   * ------------------------------------------------------------------ */
  var Sfx = {
    ctx: null,
    beep: function (freq, dur, type) {
      if (AudioMan.muted) return;
      try {
        if (!this.ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        var o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.045, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch (e) { /* noop */ }
    },
    select: function () { this.beep(880, 0.07); },
    confirm: function () { this.beep(1240, 0.09); },
    bump: function () { this.beep(160, 0.05, 'triangle'); }
  };

  /* ------------------------------------------------------------------ *
   *  WORLD STATE                                                        *
   * ------------------------------------------------------------------ */
  var state = 'title';           // title | world | dialog | encounter | transition
  var canvas, ctx, els = {};
  var zoom = 2, viewW = 320, viewH = 240;
  var buildings = [];            // {project|'about', slot, img}
  var footprint = [];            // footprint[y][x] -> building ref (grid: no per-frame string keys)
  var creatures = [];            // {project, x, y, fx, fy, moving, t, from, to, nextAt, spriteKey}
  var eggs = [];                 // {project, x, y}
  var player = {
    x: PLAYER_START.x, y: PLAYER_START.y,
    from: null, to: null, moving: false, t: 0,
    facing: 'down', turnUntil: 0, bobPhase: 0
  };
  var dirStack = [];             // held directions, last = active
  var lastTime = 0;
  var startedAt = 0;

  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'W';
    return MAP[y].charAt(x);
  }
  function buildingAt(x, y) {
    var row = footprint[y];
    return (row && row[x]) || null;
  }
  function solidAt(x, y) {
    if (SOLID[tileAt(x, y)]) return true;
    if (buildingAt(x, y)) return true;
    return false;
  }
  function entityAt(x, y) {
    var i;
    if (NPC_TILE.x === x && NPC_TILE.y === y) return { type: 'npc' };
    if (SIGN_TILE.x === x && SIGN_TILE.y === y) return { type: 'sign' };
    for (i = 0; i < eggs.length; i++) {
      if (eggs[i].x === x && eggs[i].y === y) return { type: 'egg', project: eggs[i].project };
    }
    for (i = 0; i < creatures.length; i++) {
      var c = creatures[i];
      if ((c.x === x && c.y === y) || (c.moving && c.to && c.to.x === x && c.to.y === y)) {
        return { type: 'creature', project: c.project };
      }
    }
    return null;
  }
  function playerOccupies(x, y) {
    if (player.x === x && player.y === y) return true;
    if (player.moving && player.to && player.to.x === x && player.to.y === y) return true;
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  SETUP                                                              *
   * ------------------------------------------------------------------ */
  function setupWorld(projects) {
    buildings.push({ id: 'about', slot: HOME_SLOT, imgKey: 'b_home' });
    var bi = 0, ci = 0, ei = 0;
    projects.forEach(function (p) {
      if (p.kind === 'egg' || !p.sprite) {
        if (ei < EGG_SLOTS.length) {
          eggs.push({ project: p, x: EGG_SLOTS[ei].x, y: EGG_SLOTS[ei].y });
          ei++;
        }
        return;
      }
      if (bi < BUILDING_SLOTS.length) {
        buildings.push({ id: p.id, project: p, slot: BUILDING_SLOTS[bi], imgKey: 'b_' + p.id });
        bi++;
      }
      if (ci < CREATURE_SPOTS.length) {
        var s = CREATURE_SPOTS[ci];
        creatures.push({
          project: p, x: s.x, y: s.y, home: { x: s.x, y: s.y },
          moving: false, t: 0, from: null, to: null,
          nextAt: 1000 + Math.random() * 2500, spriteKey: 'c_' + p.id
        });
        ci++;
      }
    });
    buildings.forEach(function (b) {
      for (var dx = 0; dx < 4; dx++) for (var dy = 0; dy < 4; dy++) {
        var fy = b.slot.y + dy, fx = b.slot.x + dx;
        if (!footprint[fy]) footprint[fy] = [];
        footprint[fy][fx] = b;
      }
    });
  }

  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    zoom = (Math.min(vw, vh) < 520) ? 2 : 3;
    viewW = Math.ceil(vw / zoom);
    viewH = Math.ceil(vh / zoom);
    canvas.width = viewW;
    canvas.height = viewH;
    canvas.style.width = (viewW * zoom) + 'px';
    canvas.style.height = (viewH * zoom) + 'px';
    ctx.imageSmoothingEnabled = false;
  }

  /* ------------------------------------------------------------------ *
   *  INPUT                                                              *
   * ------------------------------------------------------------------ */
  var KEY_DIR = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };
  function isActionKey(k) { return k === 'z' || k === 'Z' || k === 'Enter' || k === ' '; }
  function isCancelKey(k) { return k === 'x' || k === 'X' || k === 'Escape'; }

  function pressDir(d) {
    var i = dirStack.indexOf(d);
    if (i !== -1) dirStack.splice(i, 1);
    dirStack.push(d);
    // Turn instantly on press (a super-quick tap should still turn the player,
    // even if the key is released before the next animation frame).
    if (state === 'world' && !player.moving && player.facing !== d) {
      player.facing = d;
      player.turnUntil = performance.now() + TURN_MS;
    }
  }
  function releaseDir(d) {
    var i = dirStack.indexOf(d);
    if (i !== -1) dirStack.splice(i, 1);
  }
  function heldDir() { return dirStack.length ? dirStack[dirStack.length - 1] : null; }
  function clearInput() { dirStack.length = 0; }

  function helpVisible() {
    var help = document.getElementById('help');
    return !!(help && !help.hidden);
  }

  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var d = KEY_DIR[e.key];
    if (d) {
      e.preventDefault();
      if (!e.repeat) pressDir(d);
      if (state === 'encounter') { if (!e.repeat) encMove(d); }
      return;
    }
    if (isActionKey(e.key)) {
      // Don't steal Enter/Space from a focused link or button (HUD, signpost
      // links, encounter menu) — let the browser's native activation run.
      // Space doesn't natively activate links, so it stays a game action there.
      var it = e.target && e.target.closest
        ? e.target.closest('a, button, input, select, textarea')
        : null;
      if (it && (e.key === 'Enter' || (e.key === ' ' && it.tagName !== 'A'))) return;
      e.preventDefault();
      if (!e.repeat) handleAction();
      return;
    }
    if (isCancelKey(e.key)) {
      // Help sits on top of everything: let main.js close it (Escape) without
      // also closing the dialog/encounter underneath.
      if (helpVisible()) return;
      if (e.key !== 'Escape') e.preventDefault();
      if (!e.repeat) handleCancel();
    }
  }
  function onKeyUp(e) {
    var d = KEY_DIR[e.key];
    if (d) releaseDir(d);
  }

  /* ------------------------------------------------------------------ *
   *  PLAYER + CREATURE UPDATE                                           *
   * ------------------------------------------------------------------ */
  function tryStep(dir) {
    var v = DIRS[dir];
    var nx = player.x + v[0], ny = player.y + v[1];
    if (solidAt(nx, ny) || entityAt(nx, ny)) return false;
    player.moving = true;
    player.t = 0;
    player.from = { x: player.x, y: player.y };
    player.to = { x: nx, y: ny };
    player.bobPhase ^= 1;
    return true;
  }

  function updatePlayer(dt, now) {
    if (player.moving) {
      player.t += dt / STEP_MS;
      if (player.t >= 1) {
        player.x = player.to.x; player.y = player.to.y;
        player.moving = false; player.t = 0;
        var d = heldDir();                       // chain steps for smooth walking
        if (state === 'world' && d) {
          player.facing = d;
          tryStep(d);
        }
      }
      return;
    }
    if (state !== 'world') return;
    var dir = heldDir();
    if (!dir) return;
    if (player.facing !== dir) {
      player.facing = dir;
      player.turnUntil = now + TURN_MS;
      return;
    }
    if (now >= player.turnUntil) tryStep(dir);
  }

  function updateCreatures(dt, now) {
    creatures.forEach(function (c) {
      if (c.moving) {
        c.t += dt / CREATURE_STEP_MS;
        if (c.t >= 1) {
          c.x = c.to.x; c.y = c.to.y;
          c.moving = false; c.t = 0;
          c.nextAt = now + 900 + Math.random() * 2600;
        }
        return;
      }
      if (state !== 'world' || now < c.nextAt) return;
      c.nextAt = now + 900 + Math.random() * 2600;
      if (Math.random() < 0.35) return;          // sometimes just idle
      var dirs = ['up', 'down', 'left', 'right'];
      var d = dirs[Math.floor(Math.random() * 4)];
      var v = DIRS[d];
      var nx = c.x + v[0], ny = c.y + v[1];
      if (Math.abs(nx - c.home.x) > 2 || Math.abs(ny - c.home.y) > 2) return;
      if (solidAt(nx, ny) || entityAt(nx, ny) || playerOccupies(nx, ny)) return;
      c.moving = true; c.t = 0;
      c.from = { x: c.x, y: c.y };
      c.to = { x: nx, y: ny };
    });
  }

  /* ------------------------------------------------------------------ *
   *  RENDERING                                                          *
   * ------------------------------------------------------------------ */
  var TILE_FALLBACK = {
    G: '#79c850', P: '#e0c078', W: '#4890d8', L: '#489838', F: '#88d060',
    T: '#286830', X: '#a87840'
  };
  var TILE_IMG = { G: 't_grass', P: 't_path', W: 't_water', L: 't_tall', F: 't_flower', T: 't_tree', X: 't_fence' };

  function drawSprite(key, x, y, w, h, fallback, label) {
    var a = IMGS[key];
    if (a && a.ok) { ctx.drawImage(a.img, x, y, w, h); return; }
    ctx.fillStyle = fallback || '#d05098';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.floor(h / 3) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label.charAt(0).toUpperCase(), x + w / 2, y + h / 2);
    }
  }
  function drawTile(ch, sx, sy) {
    var overlay = (ch === 'T' || ch === 'X');
    if (overlay) drawTileBase('G', sx, sy);
    drawTileBase(ch, sx, sy);
  }
  function drawTileBase(ch, sx, sy) {
    var a = IMGS[TILE_IMG[ch]];
    if (a && a.ok) ctx.drawImage(a.img, sx, sy, TILE, TILE);
    else { ctx.fillStyle = TILE_FALLBACK[ch] || '#000'; ctx.fillRect(sx, sy, TILE, TILE); }
  }

  var ppScratch = { x: 0, y: 0 };          // reused: no per-frame allocation
  function playerPixel() {
    var px = player.x * TILE, py = player.y * TILE;
    if (player.moving) {
      px = (player.from.x + (player.to.x - player.from.x) * player.t) * TILE;
      py = (player.from.y + (player.to.y - player.from.y) * player.t) * TILE;
    }
    ppScratch.x = px; ppScratch.y = py;
    return ppScratch;
  }

  // Reusable y-sorted draw list: records are pooled and mutated in place,
  // so the render loop allocates nothing per frame.
  var drawList = [];
  var drawCount = 0;
  function pushDrawable(y, kind, ref, px, py) {
    var r = drawList[drawCount];
    if (!r) { r = { y: 0, kind: '', ref: null, px: 0, py: 0 }; drawList[drawCount] = r; }
    r.y = y; r.kind = kind; r.ref = ref; r.px = px; r.py = py;
    drawCount++;
  }
  function byY(a, b) { return a.y - b.y; }

  function drawSign(sx, sy) {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(sx + 14, sy + 12, 4, 18);        // post
    ctx.fillStyle = '#a87840';
    ctx.fillRect(sx + 4, sy + 4, 24, 14);         // board
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(sx + 4, sy + 4, 24, 2);
    ctx.fillStyle = '#5c3d22';
    ctx.fillRect(sx + 8, sy + 9, 16, 2);
    ctx.fillRect(sx + 8, sy + 13, 12, 2);
  }

  function draw(now) {
    var pp = playerPixel();
    var camX = Math.round(pp.x + TILE / 2 - viewW / 2);
    var camY = Math.round(pp.y + TILE / 2 - viewH / 2);
    var maxX = MAP_W * TILE - viewW, maxY = MAP_H * TILE - viewH;
    camX = maxX < 0 ? Math.floor(maxX / 2) : Math.max(0, Math.min(maxX, camX));
    camY = maxY < 0 ? Math.floor(maxY / 2) : Math.max(0, Math.min(maxY, camY));

    ctx.fillStyle = '#10305c';
    ctx.fillRect(0, 0, viewW, viewH);

    var x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((camX + viewW) / TILE));
    var y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((camY + viewH) / TILE));
    var x, y;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      drawTile(MAP[y].charAt(x), x * TILE - camX, y * TILE - camY);
    }

    // buildings (below characters)
    buildings.forEach(function (b) {
      var bx = b.slot.x * TILE - camX, by = b.slot.y * TILE - camY;
      if (bx > viewW || by > viewH || bx + 128 < 0 || by + 128 < 0) return;
      drawSprite(b.imgKey, bx, by, 128, 128, '#b08858', b.id);
    });

    drawSign(SIGN_TILE.x * TILE - camX, SIGN_TILE.y * TILE - camY);

    // y-sorted characters (pooled records + kind switch: no per-frame closures)
    var i;
    drawCount = 0;
    for (i = 0; i < eggs.length; i++) {
      var eg = eggs[i];
      pushDrawable(eg.y * TILE, 'egg', eg, eg.x * TILE, eg.y * TILE);
    }
    for (i = 0; i < creatures.length; i++) {
      var c = creatures[i];
      var cx = c.x * TILE, cy = c.y * TILE;
      if (c.moving) {
        cx = (c.from.x + (c.to.x - c.from.x) * c.t) * TILE;
        cy = (c.from.y + (c.to.y - c.from.y) * c.t) * TILE;
      }
      pushDrawable(cy, 'creature', c, cx, cy);
    }
    // NPC (uses the "down" player sprite — it IS Yoonki, after all)
    pushDrawable(NPC_TILE.y * TILE, 'npc', null, NPC_TILE.x * TILE, NPC_TILE.y * TILE);
    // player
    pushDrawable(pp.y + 1, 'player', null, pp.x, pp.y);

    if (drawList.length > drawCount) drawList.length = drawCount;
    drawList.sort(byY);
    for (i = 0; i < drawCount; i++) {
      var r = drawList[i];
      switch (r.kind) {
        case 'egg':
          drawSprite('egg', r.px - 2 - camX, r.py - 6 - camY, 36, 36, '#f0e8d0', 'e');
          break;
        case 'creature':
          var bob = REDUCED ? 0 : Math.round(Math.sin(now / 320 + r.ref.home.x) * 1.5);
          drawSprite(r.ref.spriteKey, r.px - 8 - camX, r.py - 18 + bob - camY, 48, 48, '#d05098', r.ref.project.name);
          break;
        case 'npc':
          drawSprite('p_down', r.px - 8 - camX, r.py - 16 - camY, 48, 48, '#3aa080', 'Y');
          break;
        case 'player':
          var bobY = (player.moving && !REDUCED) ? -Math.round(2 * Math.sin(player.t * Math.PI)) : 0;
          drawSprite('p_' + player.facing, r.px - 8 - camX, r.py - 16 + bobY - camY, 48, 48, '#40b0a0', 'me');
          break;
      }
    }

    // interaction hint "!" above facing target
    if (state === 'world' && !player.moving) {
      var f = facingTile();
      var t = entityAt(f.x, f.y) || buildingAt(f.x, f.y);
      if (t) {
        var hx = f.x * TILE - camX + TILE / 2, hy = f.y * TILE - camY - 8;
        var bump = REDUCED ? 0 : Math.round(Math.sin(now / 200) * 2);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#203040';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px "Geist", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.strokeText('!', hx, hy + bump);
        ctx.fillText('!', hx, hy + bump);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   *  MAIN LOOP                                                          *
   * ------------------------------------------------------------------ */
  function loop(now) {
    var dt = Math.min(50, now - lastTime);
    lastTime = now;
    if (state !== 'title') {
      updatePlayer(dt, now);
      updateCreatures(dt, now);
      draw(now);
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ *
   *  INTERACTION                                                        *
   * ------------------------------------------------------------------ */
  function facingTile() {
    var v = DIRS[player.facing];
    return { x: player.x + v[0], y: player.y + v[1] };
  }

  function handleAction() {
    if (state === 'world') {
      if (player.moving) return;
      var f = facingTile();
      var ent = entityAt(f.x, f.y);
      if (ent) {
        if (ent.type === 'npc') return openNpcDialog();
        if (ent.type === 'sign') return openSignDialog();
        if (ent.type === 'egg') return startEncounter(ent.project);
        if (ent.type === 'creature') return startEncounter(ent.project);
      }
      var b = buildingAt(f.x, f.y);
      if (b) {
        if (b.id === 'about') return openNpcDialog(true);
        return startEncounter(b.project);
      }
      return;
    }
    if (state === 'dialog') return advanceDialog();
    if (state === 'encounter') return encConfirm();
  }

  function handleCancel() {
    if (state === 'dialog') return closeDialog();
    if (state === 'encounter') return encRun();
  }

  /* ------------------------------------------------------------------ *
   *  TYPEWRITER                                                         *
   * ------------------------------------------------------------------ */
  var typer = { timer: null, active: false, el: null, text: '', done: null };
  function typewrite(el, text, done) {
    typerStop();
    typer.el = el; typer.text = text; typer.done = done || null;
    if (REDUCED) {
      el.textContent = text;
      typer.active = false;
      if (done) done();
      return;
    }
    el.textContent = '';
    typer.active = true;
    var i = 0;
    typer.timer = setInterval(function () {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) typerFinish();
    }, 24);
  }
  function typerFinish() {
    if (typer.timer) { clearInterval(typer.timer); typer.timer = null; }
    if (typer.el) typer.el.textContent = typer.text;
    var wasActive = typer.active;
    typer.active = false;
    if (wasActive && typer.done) typer.done();
  }
  function typerStop() {
    if (typer.timer) { clearInterval(typer.timer); typer.timer = null; }
    typer.active = false;
  }

  /* ------------------------------------------------------------------ *
   *  FOCUS MANAGEMENT (overlays)                                        *
   * ------------------------------------------------------------------ */
  var lastFocus = null;
  function grabFocus(el) {
    lastFocus = document.activeElement;
    focusEl(el);
  }
  function focusEl(el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* noop */ } }
  }
  function restoreFocus() {
    var f = lastFocus;
    lastFocus = null;
    if (f && f.focus && document.contains(f)) focusEl(f);
  }

  /* ------------------------------------------------------------------ *
   *  DIALOG (NPC + sign)                                                *
   * ------------------------------------------------------------------ */
  var dialog = { pages: [], i: 0, links: false };

  var NPC_PAGES = [
    'Oh! A visitor! I\'m YOONKI. Hold on... you look strangely familiar.',
    'By day I lead go-to-market at GOOGLE in San Francisco. Launches, strategy, a heroic amount of spreadsheets.',
    'By night, I build. Every creature roaming this island is a real thing I shipped — AI apps, arcade games, even music.',
    'Career log: LINE, Seoul (2014-2018), growth PM. GOOGLE KOREA (2018-2021), product marketing. GOOGLE SF (2021-now), GTM.',
    'Off duty you\'ll find me deep in tech & AI, making songs, or losing gracefully at video games.',
    'Go say hi to the creatures — walk up and press the action button. And check the eggs in the nursery. They\'re almost ready.'
  ];

  function openNpcDialog(fromHouse) {
    var pages = fromHouse
      ? ['It\'s YOONKI\'s house. Smells like coffee and synthesizers. The trainer himself is standing right outside.']
      : NPC_PAGES;
    openDialog('YOONKI', pages, false);
  }
  function openSignDialog() {
    openDialog('SIGNPOST', [
      '« YOONKI WORLD »  Population: 1 human, ' + creatures.length +
      ' creature' + (creatures.length === 1 ? '' : 's') + ', ' + eggs.length +
      ' egg' + (eggs.length === 1 ? '' : 's') + '. Links below, traveler.'
    ], true);
  }
  function openDialog(name, pages, links) {
    state = 'dialog';
    clearInput();
    dialog.pages = pages; dialog.i = 0; dialog.links = !!links;
    els.dlgName.textContent = name;
    els.dlgLinks.hidden = true;
    els.dialog.hidden = false;
    grabFocus(els.dialog);
    showDialogPage();
  }
  function showDialogPage() {
    els.dlgMore.style.visibility = 'hidden';
    typewrite(els.dlgText, dialog.pages[dialog.i], function () {
      els.dlgMore.style.visibility = 'visible';
      if (dialog.links && dialog.i === dialog.pages.length - 1) els.dlgLinks.hidden = false;
    });
  }
  function advanceDialog() {
    if (typer.active) { typerFinish(); return; }
    Sfx.select();
    if (dialog.i < dialog.pages.length - 1) {
      dialog.i++;
      showDialogPage();
    } else {
      closeDialog();
    }
  }
  function closeDialog() {
    typerStop();
    els.dialog.hidden = true;
    state = 'world';
    clearInput();
    restoreFocus();
  }

  /* ------------------------------------------------------------------ *
   *  TRANSITION FX                                                      *
   * ------------------------------------------------------------------ */
  var fxTimers = [];
  function fxClear() { fxTimers.forEach(clearTimeout); fxTimers = []; }
  function fxT(fn, ms) { fxTimers.push(setTimeout(fn, ms)); }

  function transitionIn(cb) {
    fxClear();
    if (REDUCED) {
      els.fx.className = 'fx on black';
      fxT(function () { cb(); els.fx.className = 'fx'; }, 80);
      return;
    }
    els.fx.className = 'fx on flash';
    fxT(function () { els.fx.className = 'fx on iris'; }, 420);
    // force reflow so the clip-path transition runs
    fxT(function () { void els.fx.offsetWidth; els.fx.classList.add('closed'); }, 440);
    fxT(function () {
      cb();
      els.fx.className = 'fx on iris closed';
      fxT(function () { els.fx.classList.remove('closed'); }, 60);
      fxT(function () { els.fx.className = 'fx'; }, 520);
    }, 900);
  }
  function transitionOut(cb) {
    fxClear();
    if (REDUCED) {
      els.fx.className = 'fx on black';
      fxT(function () { cb(); els.fx.className = 'fx'; }, 80);
      return;
    }
    els.fx.className = 'fx on fade';
    fxT(function () {
      cb();
      fxT(function () { els.fx.className = 'fx'; }, 60);
    }, 260);
  }

  /* ------------------------------------------------------------------ *
   *  ENCOUNTER                                                          *
   * ------------------------------------------------------------------ */
  var enc = { project: null, menu: [], idx: 0, ready: false };

  function startEncounter(project) {
    if (!project || state === 'transition' || state === 'encounter') return;
    state = 'transition';
    clearInput();
    Sfx.confirm();
    AudioMan.fadeTo('enc', REDUCED ? 200 : 800);
    transitionIn(function () {
      showEncounterUI(project);
      state = 'encounter';
    });
  }

  function showEncounterUI(p) {
    enc.project = p;
    enc.idx = 0;
    enc.ready = false;
    var isEgg = p.kind === 'egg' || !p.url;
    els.encName.textContent = (p.kind === 'egg' ? 'EGG (' + p.name + ')' : p.name).toUpperCase();
    els.encTag.textContent = isEgg ? 'INCUBATING' : 'WILD';

    var spriteUrl = p.kind === 'egg' || !p.sprite ? 'images/game/creatures/egg.png' : p.sprite;
    var key = p.kind === 'egg' || !p.sprite ? 'egg' : 'c_' + p.id;
    var rec = IMGS[key];
    if (rec && rec.ok) {
      els.encSprite.src = spriteUrl;
      els.encSprite.style.display = '';
      els.encFallback.style.display = 'none';
    } else {
      els.encSprite.style.display = 'none';
      els.encFallback.style.display = '';
      els.encFallback.textContent = p.name.charAt(0).toUpperCase();
    }
    var ally = IMGS.p_up;
    els.encAlly.style.display = (ally && ally.ok) ? '' : 'none';

    var text = p.kind === 'egg'
      ? 'You found an EGG! It\'s still incubating...\n\n' + p.desc
      : 'A wild ' + p.name.toUpperCase() + ' appeared!\n\n"' + p.tagline + '"\n\n' + p.desc;

    enc.menu = isEgg ? [{ act: 'run', label: 'BACK' }] : [{ act: 'visit', label: 'VISIT' }, { act: 'run', label: 'RUN' }];
    els.encMenu.innerHTML = '';
    enc.menu.forEach(function (m, i) {
      var b;
      if (m.act === 'visit') {
        // A real link: immune to popup blockers, middle-clickable, accessible.
        b = document.createElement('a');
        b.href = p.url;
        b.target = '_blank';
        b.rel = 'noopener';
        b.addEventListener('click', function () { enc.idx = i; encRenderMenu(); Sfx.confirm(); });
      } else {
        b = document.createElement('button');
        b.type = 'button';
        b.addEventListener('click', function () { enc.idx = i; encRenderMenu(); encConfirm(); });
      }
      b.className = 'enc-btn';
      b.textContent = m.label;
      els.encMenu.appendChild(b);
      m.btn = b;
    });
    els.encMenu.style.visibility = 'hidden';
    els.encounter.hidden = false;
    document.body.classList.add('in-encounter');
    grabFocus(els.encounter.querySelector('.enc-panel'));

    typewrite(els.encText, text, function () {
      enc.ready = true;
      els.encMenu.style.visibility = 'visible';
      encRenderMenu();
    });
  }

  function encRenderMenu() {
    enc.menu.forEach(function (m, i) {
      var sel = (i === enc.idx);
      m.btn.classList.toggle('sel', sel);
      // Keep DOM focus in sync with the visual cursor so Enter always
      // activates the highlighted option.
      if (sel && enc.ready) focusEl(m.btn);
    });
  }
  function encMove(dir) {
    if (state !== 'encounter' || !enc.ready || enc.menu.length < 2) return;
    if (dir === 'left' || dir === 'up') enc.idx = (enc.idx + enc.menu.length - 1) % enc.menu.length;
    else enc.idx = (enc.idx + 1) % enc.menu.length;
    Sfx.select();
    encRenderMenu();
  }
  function encConfirm() {
    if (typer.active) { typerFinish(); return; }
    if (!enc.ready) return;
    var m = enc.menu[enc.idx];
    if (!m) return;
    Sfx.confirm();
    if (m.act === 'visit') {
      if (m.btn && m.btn.tagName === 'A') m.btn.click();
      else if (enc.project && enc.project.url) window.open(enc.project.url, '_blank', 'noopener');
      return;
    }
    encRun();
  }
  function encRun() {
    if (state !== 'encounter') return;
    state = 'transition';
    typerStop();
    AudioMan.fadeTo('over', REDUCED ? 200 : 700);
    transitionOut(function () {
      els.encounter.hidden = true;
      document.body.classList.remove('in-encounter');
      state = 'world';
      clearInput();
      restoreFocus();
    });
  }

  /* ------------------------------------------------------------------ *
   *  PUBLIC API                                                         *
   * ------------------------------------------------------------------ */
  window.YW = {
    audio: AudioMan,
    sfx: Sfx,
    reduced: REDUCED,

    // main.js calls this once with DOM refs
    init: function (options) {
      canvas = options.canvas;
      ctx = canvas.getContext('2d');
      els = options.els;
      AudioMan.init();
      setupWorld(window.PROJECTS || []);
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      els.dialog.addEventListener('click', function (ev) {
        if (ev.target.tagName === 'A') return;   // let signpost links work
        handleAction();
      });
      requestAnimationFrame(function (t) { lastTime = t; requestAnimationFrame(loop); });
    },

    // asset list for the preloader
    assetList: function () {
      var list = [
        { key: 't_grass', url: 'images/game/tiles/grass.png' },
        { key: 't_path', url: 'images/game/tiles/path.png' },
        { key: 't_water', url: 'images/game/tiles/water.png' },
        { key: 't_tall', url: 'images/game/tiles/tallgrass.png' },
        { key: 't_flower', url: 'images/game/tiles/flower.png' },
        { key: 't_tree', url: 'images/game/tiles/tree.png' },
        { key: 't_fence', url: 'images/game/tiles/fence.png' },
        { key: 'p_down', url: 'images/game/player/down.png' },
        { key: 'p_up', url: 'images/game/player/up.png' },
        { key: 'p_left', url: 'images/game/player/left.png' },
        { key: 'p_right', url: 'images/game/player/right.png' },
        { key: 'b_home', url: 'images/game/buildings/home.png' },
        { key: 'egg', url: 'images/game/creatures/egg.png' }
      ];
      (window.PROJECTS || []).forEach(function (p) {
        if (p.sprite) list.push({ key: 'c_' + p.id, url: p.sprite });
        if (p.building) list.push({ key: 'b_' + p.id, url: p.building });
      });
      return list;
    },
    preloadImages: preloadImages,

    start: function () {                        // called from the START gesture
      AudioMan.start();
      state = 'world';
      clearInput();
    },
    getState: function () { return state; },
    getPos: function () { return { x: player.x, y: player.y, facing: player.facing, moving: player.moving }; },

    // touch controls glue
    virtualDir: function (d, down) { if (down) pressDir(d); else releaseDir(d); if (down && state === 'encounter') encMove(d); },
    virtualAction: function () { handleAction(); },
    virtualCancel: function () { handleCancel(); }
  };
})();
