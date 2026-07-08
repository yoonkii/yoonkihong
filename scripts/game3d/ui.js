/* ============================================================================
   YOONKI WORLD 3D — DOM UI + input
   Keyboard (8-dir analog-normalized) + virtual joystick + A/B buttons,
   dialog + encounter overlays with the GBA typewriter, transition FX chain
   (timings ported verbatim from the 2D engine), HUD, help, hint, title.
   ========================================================================== */

import { REDUCED } from './const.js';

function $(id) { return document.getElementById(id); }

export function createUI(audio) {
  const els = {
    canvas: $('game'),
    title: $('title-screen'), loadFill: $('load-fill'), loadLabel: $('load-label'),
    pressStart: $('press-start'),
    dialog: $('dialog'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
    dlgMore: $('dlg-more'), dlgLinks: $('dlg-links'),
    encounter: $('encounter'), encName: $('enc-name'), encTag: $('enc-tag'),
    encText: $('enc-text'), encMenu: $('enc-menu'),
    fx: $('fx'), hud: $('hud'), btnMute: $('btn-mute'), btnHelp: $('btn-help'),
    hudProgress: $('hud-progress'),
    help: $('help'), helpClose: $('help-close'), hint: $('hint'),
    joy: $('joy'), joyKnob: $('joy-knob'),
    fallback: $('fallback'), vignette: $('vignette')
  };

  const handlers = {
    action: null, cancel: null, dir: null, any: null, start: null
  };

  /* ------------------------------------------------------------------ *
   *  INPUT                                                               *
   * ------------------------------------------------------------------ */
  const KEY_DIR = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };
  const keys = new Set();
  const joy = { active: false, id: null, x: 0, z: 0 };

  function isActionKey(k) { return k === 'z' || k === 'Z' || k === 'Enter' || k === ' '; }
  function isCancelKey(k) { return k === 'x' || k === 'X' || k === 'Escape'; }
  function helpVisible() { return !els.help.hidden; }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (handlers.any) handlers.any();
    const d = KEY_DIR[e.key];
    if (d) {
      e.preventDefault();
      keys.add(d);
      if (!e.repeat && handlers.dir) handlers.dir(d);
      return;
    }
    if (isActionKey(e.key)) {
      const it = e.target && e.target.closest
        ? e.target.closest('a, button, input, select, textarea') : null;
      if (it && (e.key === 'Enter' || (e.key === ' ' && it.tagName !== 'A'))) return;
      e.preventDefault();
      if (!e.repeat && handlers.action) handlers.action();
      return;
    }
    if (isCancelKey(e.key)) {
      if (helpVisible()) return;               // help's own Esc handler closes it
      if (e.key !== 'Escape') e.preventDefault();
      if (!e.repeat && handlers.cancel) handlers.cancel();
    }
  });
  window.addEventListener('keyup', (e) => {
    const d = KEY_DIR[e.key];
    if (d) keys.delete(d);
  });
  window.addEventListener('blur', () => keys.clear());

  // virtual joystick (coarse pointers)
  if (els.joy) {
    const R = 52;
    const setKnob = (dx, dz) => {
      els.joyKnob.style.transform = `translate(${dx * R}px, ${dz * R}px)`;
    };
    const onMove = (e) => {
      if (!joy.active || e.pointerId !== joy.id) return;
      const rect = els.joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = (e.clientX - cx) / R, dz = (e.clientY - cy) / R;
      const m = Math.hypot(dx, dz);
      if (m > 1) { dx /= m; dz /= m; }
      joy.x = dx; joy.z = dz;
      setKnob(dx, dz);
    };
    els.joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joy.active = true; joy.id = e.pointerId;
      els.joy.setPointerCapture(e.pointerId);
      if (handlers.any) handlers.any();
      onMove(e);
    });
    els.joy.addEventListener('pointermove', onMove);
    const end = (e) => {
      if (e.pointerId !== joy.id) return;
      joy.active = false; joy.x = 0; joy.z = 0;
      setKnob(0, 0);
    };
    els.joy.addEventListener('pointerup', end);
    els.joy.addEventListener('pointercancel', end);
  }
  for (const [sel, kind] of [['[data-btn="a"]', 'action'], ['[data-btn="b"]', 'cancel']]) {
    const b = document.querySelector(sel);
    if (!b) continue;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('active');
      if (handlers.any) handlers.any();
      if (handlers[kind]) handlers[kind]();
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      b.addEventListener(ev, () => b.classList.remove('active'));
    }
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // no rubber-band scrolling while playing
  document.addEventListener('touchmove', (ev) => {
    if (ev.target.closest('#help') || ev.target.closest('#encounter')) return;
    ev.preventDefault();
  }, { passive: false });

  /** Screen-space move vector (x right, z down), analog, |v| <= 1. */
  function getMove() {
    let x = 0, z = 0;
    if (keys.has('up')) z -= 1;
    if (keys.has('down')) z += 1;
    if (keys.has('left')) x -= 1;
    if (keys.has('right')) x += 1;
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    x += joy.x; z += joy.z;
    const m2 = Math.hypot(x, z);
    if (m2 > 1) { x /= m2; z /= m2; }
    return { x, z };
  }

  /* ------------------------------------------------------------------ *
   *  TYPEWRITER                                                          *
   * ------------------------------------------------------------------ */
  const typer = { timer: null, active: false, el: null, text: '', done: null };
  function typewrite(el, text, done) {
    typerStop();
    typer.el = el; typer.text = text; typer.done = done || null;
    if (REDUCED) {
      el.textContent = text;
      typer.active = false;
      done && done();
      return;
    }
    el.textContent = '';
    typer.active = true;
    let i = 0;
    typer.timer = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i % 8 < 2) audio.sfx.tick();
      if (i >= text.length) typerFinish();
    }, 24);
  }
  function typerFinish() {
    if (typer.timer) { clearInterval(typer.timer); typer.timer = null; }
    if (typer.el) typer.el.textContent = typer.text;
    const was = typer.active;
    typer.active = false;
    if (was && typer.done) typer.done();
  }
  function typerStop() {
    if (typer.timer) { clearInterval(typer.timer); typer.timer = null; }
    typer.active = false;
  }

  /* ------------------------------------------------------------------ *
   *  FOCUS MANAGEMENT                                                     *
   * ------------------------------------------------------------------ */
  let lastFocus = null;
  function grabFocus(el) { lastFocus = document.activeElement; focusEl(el); }
  function focusEl(el) {
    if (!el || !el.focus) return;
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* noop */ } }
  }
  function restoreFocus() {
    const f = lastFocus;
    lastFocus = null;
    if (f && f.focus && document.contains(f)) focusEl(f);
  }

  /* ------------------------------------------------------------------ *
   *  DIALOG                                                              *
   * ------------------------------------------------------------------ */
  const dialog = { pages: [], i: 0, links: false, onClose: null };
  function openDialog(name, pages, links, onClose) {
    dialog.pages = pages; dialog.i = 0; dialog.links = !!links;
    dialog.onClose = onClose || null;
    els.dlgName.textContent = name;
    els.dlgLinks.hidden = true;
    els.dialog.hidden = false;
    document.body.classList.add('in-dialog');
    grabFocus(els.dialog);
    showDialogPage();
  }
  function showDialogPage() {
    els.dlgMore.style.visibility = 'hidden';
    typewrite(els.dlgText, dialog.pages[dialog.i], () => {
      els.dlgMore.style.visibility = 'visible';
      if (dialog.links && dialog.i === dialog.pages.length - 1) els.dlgLinks.hidden = false;
    });
  }
  function advanceDialog() {
    if (typer.active) { typerFinish(); return; }
    audio.sfx.blip();
    if (dialog.i < dialog.pages.length - 1) {
      dialog.i++;
      showDialogPage();
    } else closeDialog();
  }
  function closeDialog() {
    typerStop();
    els.dialog.hidden = true;
    document.body.classList.remove('in-dialog');
    restoreFocus();
    const cb = dialog.onClose; dialog.onClose = null;
    cb && cb();
  }
  els.dialog.addEventListener('click', (ev) => {
    if (ev.target.tagName === 'A') return;
    if (handlers.action) handlers.action();
  });

  /* ------------------------------------------------------------------ *
   *  ENCOUNTER                                                           *
   * ------------------------------------------------------------------ */
  const enc = { project: null, menu: [], idx: 0, ready: false, readyAt: 0, onVisit: null };
  // mash guard: ignore confirms briefly after the intro text completes, so
  // "press to skip text, press again" can't accidentally activate VISIT
  // (the pre-selected item) and open an external tab the player never meant to
  const ENC_CONFIRM_GRACE_MS = 275;
  function showEncounter(p, isEgg, onVisit) {
    enc.project = p; enc.idx = 0; enc.ready = false; enc.readyAt = 0; enc.onVisit = onVisit || null;
    const soon = !isEgg && !p.url;               // non-egg without a live link
    els.encName.textContent = (isEgg ? 'EGG (' + p.name + ')' : p.name).toUpperCase();
    els.encTag.textContent = isEgg ? 'INCUBATING' : (soon ? 'COMING SOON' : 'WILD');
    els.encTag.classList.toggle('soon', soon);
    const text = isEgg
      ? 'You found an EGG! It\'s still incubating...\n\n' + p.desc
      : 'A wild ' + p.name.toUpperCase() + ' appeared!\n\n"' + p.tagline + '"\n\n' + p.desc
        + (soon ? '\n\nThis one isn\'t ready for visitors yet — check back soon!' : '');
    enc.menu = (isEgg || !p.url)
      ? [{ act: 'run', label: 'BACK' }]
      : [{ act: 'visit', label: 'VISIT' }, { act: 'run', label: 'RUN' }];
    els.encMenu.innerHTML = '';
    enc.menu.forEach((m, i) => {
      let b;
      if (m.act === 'visit') {
        b = document.createElement('a');
        b.href = p.url;
        b.target = '_blank';
        b.rel = 'noopener';
        b.addEventListener('click', () => {
          enc.idx = i; encRenderMenu();
          audio.sfx.confirm();
          if (enc.onVisit) enc.onVisit(p);
        });
      } else {
        b = document.createElement('button');
        b.type = 'button';
        b.addEventListener('click', () => { enc.idx = i; encRenderMenu(); encConfirm(); });
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
    typewrite(els.encText, text, () => {
      enc.ready = true;
      enc.readyAt = performance.now();
      els.encMenu.style.visibility = 'visible';
      encRenderMenu();
      // re-render once the grace period passes so the selected item gains
      // real focus (focus is withheld below — a mashed Enter would otherwise
      // natively activate the focused VISIT anchor, bypassing encConfirm)
      setTimeout(() => {
        if (enc.ready && !els.encounter.hidden) encRenderMenu();
      }, ENC_CONFIRM_GRACE_MS + 15);
    });
  }
  function encRenderMenu() {
    enc.menu.forEach((m, i) => {
      const sel = i === enc.idx;
      m.btn.classList.toggle('sel', sel);
      if (sel && enc.ready && performance.now() - enc.readyAt >= ENC_CONFIRM_GRACE_MS) {
        focusEl(m.btn);
      }
    });
  }
  function encMove(dir) {
    if (!enc.ready || enc.menu.length < 2) return;
    if (dir === 'left' || dir === 'up') enc.idx = (enc.idx + enc.menu.length - 1) % enc.menu.length;
    else enc.idx = (enc.idx + 1) % enc.menu.length;
    audio.sfx.blip();
    encRenderMenu();
  }
  /** Returns 'visit' | 'run' | null (null = typer finished early). */
  function encConfirm() {
    if (typer.active) { typerFinish(); return null; }
    if (!enc.ready) return null;
    // swallow the mash press that lands right after the text completes; the
    // highlight already shows the selection for the next deliberate press
    if (performance.now() - enc.readyAt < ENC_CONFIRM_GRACE_MS) return null;
    const m = enc.menu[enc.idx];
    if (!m) return null;
    audio.sfx.confirm();
    if (m.act === 'visit') {
      if (m.btn && m.btn.tagName === 'A') m.btn.click();
      else if (enc.project && enc.project.url) window.open(enc.project.url, '_blank', 'noopener');
      return 'visit';
    }
    return 'run';
  }
  function encHide() {
    typerStop();
    enc.ready = false;
    els.encounter.hidden = true;
    document.body.classList.remove('in-encounter');
    restoreFocus();
  }

  /* ------------------------------------------------------------------ *
   *  TRANSITION FX (timings ported from the 2D engine)                   *
   * ------------------------------------------------------------------ */
  let fxTimers = [];
  function fxClear() { fxTimers.forEach(clearTimeout); fxTimers = []; }
  function fxT(fn, ms) { fxTimers.push(setTimeout(fn, ms)); }
  function transitionIn(cb) {
    fxClear();
    if (REDUCED) {
      els.fx.className = 'fx on black';
      fxT(() => { cb(); els.fx.className = 'fx'; }, 80);
      return;
    }
    els.fx.className = 'fx on flash';
    fxT(() => { els.fx.className = 'fx on iris'; }, 420);
    fxT(() => { void els.fx.offsetWidth; els.fx.classList.add('closed'); }, 440);
    fxT(() => {
      cb();
      els.fx.className = 'fx on iris closed';
      fxT(() => { els.fx.classList.remove('closed'); }, 60);
      fxT(() => { els.fx.className = 'fx'; }, 520);
    }, 900);
  }
  function transitionOut(cb) {
    fxClear();
    if (REDUCED) {
      els.fx.className = 'fx on black';
      fxT(() => { cb(); els.fx.className = 'fx'; }, 80);
      return;
    }
    els.fx.className = 'fx on fade';
    fxT(() => {
      cb();
      fxT(() => { els.fx.className = 'fx'; }, 60);
    }, 260);
  }

  /* ------------------------------------------------------------------ *
   *  HUD + HELP + HINT                                                    *
   * ------------------------------------------------------------------ */
  function paintMute() {
    const m = audio.muted;
    els.btnMute.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
    els.btnMute.setAttribute('aria-pressed', m ? 'true' : 'false');
  }
  paintMute();
  els.btnMute.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    paintMute();
  });

  function setProgress(n, total) {
    els.hudProgress.hidden = false;
    els.hudProgress.textContent = n + '/' + total;
    els.hudProgress.classList.toggle('done', n >= total);
  }

  let helpReturnFocus = null;
  function openHelp() {
    helpReturnFocus = document.activeElement;
    els.help.hidden = false;
    focusEl(els.helpClose);
  }
  function closeHelp() {
    els.help.hidden = true;
    if (helpReturnFocus && document.contains(helpReturnFocus)) focusEl(helpReturnFocus);
    helpReturnFocus = null;
  }
  els.btnHelp.addEventListener('click', openHelp);
  els.helpClose.addEventListener('click', closeHelp);
  els.help.addEventListener('click', (ev) => { if (ev.target === els.help) closeHelp(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.help.hidden) closeHelp();
  });

  function maybeShowHint() {
    let seen = false;
    try { seen = localStorage.getItem('yw_hint') === '1'; } catch (e) { /* noop */ }
    if (seen) return;
    els.hint.hidden = false;
    const dismiss = () => {
      els.hint.hidden = true;
      try { localStorage.setItem('yw_hint', '1'); } catch (e) { /* noop */ }
      window.removeEventListener('keydown', dismiss);
      els.hint.removeEventListener('click', dismiss);
    };
    window.addEventListener('keydown', dismiss);
    els.hint.addEventListener('click', dismiss);
    setTimeout(() => { if (!els.hint.hidden) dismiss(); }, 9000);
  }

  /* ------------------------------------------------------------------ *
   *  TITLE SCREEN                                                          *
   * ------------------------------------------------------------------ */
  let ready = false, started = false;
  function setLoad(pct, label) {
    if (ready) return;
    els.loadFill.style.width = pct + '%';
    els.loadLabel.textContent = label || ('LOADING... ' + pct + '%');
  }
  function enableStart() {
    if (ready) return;
    ready = true;
    els.loadLabel.textContent = 'READY!';
    els.loadFill.style.width = '100%';
    els.pressStart.hidden = false;
  }
  function tryStart() {
    if (!ready || started) return;
    started = true;
    // drops the HUD/help back under the overlay layers (styles/main.css)
    document.body.classList.add('game-started');
    els.title.classList.add('gone');
    setTimeout(() => { els.title.hidden = true; }, REDUCED ? 0 : 450);
    if (handlers.start) handlers.start();
    maybeShowHint();
  }
  els.title.addEventListener('click', (ev) => {
    if (ev.target.closest('a')) return;
    tryStart();
  });
  window.addEventListener('keydown', (e) => {
    if (started) return;
    if (e.target && e.target.closest && e.target.closest('a, button, input, select, textarea')) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      tryStart();
    }
  });
  els.pressStart.addEventListener('click', tryStart);

  function showFallback(err) {
    if (err) console.warn('[yw3] falling back to classic card:', err);
    els.title.hidden = true;
    els.fallback.hidden = false;
  }

  return {
    els, handlers, getMove,
    typewrite, typerFinish, typerStop, get typing() { return typer.active; },
    openDialog, advanceDialog, closeDialog,
    get dialogOpen() { return !els.dialog.hidden; },
    showEncounter, encMove, encConfirm, encHide,
    transitionIn, transitionOut,
    paintMute, setProgress, maybeShowHint,
    setLoad, enableStart, showFallback,
    get started() { return started; }
  };
}
