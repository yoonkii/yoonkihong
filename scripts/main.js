/* ============================================================================
   YOONKI WORLD — boot + UI glue (start screen, HUD, touch controls, help)
   Depends on: data/projects.js, scripts/game.js
   ========================================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var els = {
    canvas: $('game'),
    title: $('title-screen'),
    loadFill: $('load-fill'),
    loadLabel: $('load-label'),
    pressStart: $('press-start'),
    dialog: $('dialog'),
    dlgName: $('dlg-name'),
    dlgText: $('dlg-text'),
    dlgMore: $('dlg-more'),
    dlgLinks: $('dlg-links'),
    encounter: $('encounter'),
    encName: $('enc-name'),
    encTag: $('enc-tag'),
    encSprite: $('enc-sprite'),
    encFallback: $('enc-fallback'),
    encAlly: $('enc-ally'),
    encText: $('enc-text'),
    encMenu: $('enc-menu'),
    fx: $('fx'),
    hud: $('hud'),
    btnMute: $('btn-mute'),
    btnHelp: $('btn-help'),
    help: $('help'),
    helpClose: $('help-close'),
    hint: $('hint'),
    touch: $('touch-ui')
  };

  YW.init({
    canvas: els.canvas,
    els: {
      dialog: els.dialog, dlgName: els.dlgName, dlgText: els.dlgText,
      dlgMore: els.dlgMore, dlgLinks: els.dlgLinks,
      encounter: els.encounter, encName: els.encName, encTag: els.encTag,
      encSprite: els.encSprite, encFallback: els.encFallback, encAlly: els.encAlly,
      encText: els.encText, encMenu: els.encMenu, fx: els.fx
    }
  });

  /* ---------------- preload + start screen ---------------- */
  var assets = YW.assetList();
  var loaded = 0, ready = false;

  function progress() {
    if (ready) return;   // never regress READY!/100% after the fallback fires
    loaded++;
    var pct = Math.round(loaded / assets.length * 100);
    els.loadFill.style.width = pct + '%';
    els.loadLabel.textContent = 'LOADING... ' + pct + '%';
  }
  function enableStart() {
    if (ready) return;
    ready = true;
    els.loadLabel.textContent = 'READY!';
    els.loadFill.style.width = '100%';
    els.pressStart.hidden = false;
  }

  YW.preloadImages(assets, progress).then(enableStart);
  setTimeout(enableStart, 8000);   // never block the start on a slow/missing file

  var started = false;
  function startGame() {
    if (!ready || started) return;
    started = true;
    YW.start();                     // user gesture: also starts BGM
    els.title.classList.add('gone');
    setTimeout(function () { els.title.hidden = true; }, YW.reduced ? 0 : 450);
    maybeShowHint();
  }
  els.title.addEventListener('click', function (ev) {
    if (ev.target.closest('a')) return;         // classic-site link
    startGame();
  });
  window.addEventListener('keydown', function (e) {
    if (started) return;
    // Enter on the focused "view classic version" link (or any control)
    // must run its native activation, not start the game.
    if (e.target && e.target.closest && e.target.closest('a, button, input, select, textarea')) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      startGame();
    }
  });

  /* ---------------- HUD ---------------- */
  function paintMute() {
    var m = YW.audio.muted;
    els.btnMute.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
    els.btnMute.setAttribute('aria-pressed', m ? 'true' : 'false');
  }
  paintMute();
  els.btnMute.addEventListener('click', function () {
    YW.audio.setMuted(!YW.audio.muted);
    paintMute();
  });

  var helpReturnFocus = null;
  function openHelp() {
    helpReturnFocus = document.activeElement;
    els.help.hidden = false;
    try { els.helpClose.focus({ preventScroll: true }); } catch (e) { els.helpClose.focus(); }
  }
  function closeHelp() {
    els.help.hidden = true;
    var f = helpReturnFocus;
    helpReturnFocus = null;
    if (f && f.focus && document.contains(f)) {
      try { f.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }
  els.btnHelp.addEventListener('click', openHelp);
  els.helpClose.addEventListener('click', closeHelp);
  els.help.addEventListener('click', function (ev) { if (ev.target === els.help) closeHelp(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !els.help.hidden) closeHelp();
  });

  /* ---------------- first-time hint ---------------- */
  function maybeShowHint() {
    var seen = false;
    try { seen = localStorage.getItem('yw_hint') === '1'; } catch (e) { /* noop */ }
    if (seen) return;
    els.hint.hidden = false;
    var dismiss = function () {
      els.hint.hidden = true;
      try { localStorage.setItem('yw_hint', '1'); } catch (e) { /* noop */ }
      window.removeEventListener('keydown', dismiss);
      els.hint.removeEventListener('click', dismiss);
    };
    window.addEventListener('keydown', dismiss);
    els.hint.addEventListener('click', dismiss);
    setTimeout(function () { if (!els.hint.hidden) dismiss(); }, 9000);
  }

  /* ---------------- touch controls ---------------- */
  function bindHold(btn, onDown, onUp) {
    var down = function (ev) {
      ev.preventDefault();
      btn.classList.add('active');
      onDown();
      try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    };
    var up = function (ev) {
      if (ev) ev.preventDefault();
      btn.classList.remove('active');
      if (onUp) onUp();
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', function () { up(null); });
    btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }
  ['up', 'down', 'left', 'right'].forEach(function (d) {
    var b = document.querySelector('[data-dir="' + d + '"]');
    if (b) bindHold(b, function () { YW.virtualDir(d, true); }, function () { YW.virtualDir(d, false); });
  });
  var btnA = document.querySelector('[data-btn="a"]');
  var btnB = document.querySelector('[data-btn="b"]');
  if (btnA) bindHold(btnA, function () { YW.virtualAction(); });
  if (btnB) bindHold(btnB, function () { YW.virtualCancel(); });

  // no rubber-band scrolling / pinch zoom while playing
  document.addEventListener('touchmove', function (ev) {
    if (ev.target.closest('#help') || ev.target.closest('#encounter')) return;
    ev.preventDefault();
  }, { passive: false });
})();
