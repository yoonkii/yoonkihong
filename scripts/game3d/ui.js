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
    dlgMore: $('dlg-more'), dlgLinks: $('dlg-links'), dlgMenu: $('dlg-menu'),
    encounter: $('encounter'), encName: $('enc-name'), encTag: $('enc-tag'),
    encText: $('enc-text'), encMenu: $('enc-menu'), encMore: $('enc-more'),
    fx: $('fx'), hud: $('hud'), btnMute: $('btn-mute'), btnHelp: $('btn-help'),
    hudProgress: $('hud-progress'),
    help: $('help'), helpClose: $('help-close'), hint: $('hint'),
    joy: $('joy'), joyKnob: $('joy-knob'),
    fallback: $('fallback'), vignette: $('vignette')
  };

  const handlers = {
    action: null, cancel: null, dir: null, any: null, start: null
  };

  // live while the first-run HOW TO PLAY hint is showing (maybeShowHint):
  // touch players never fire a keydown, so the joystick / A/B pointerdown
  // paths and any dialog/encounter open dismiss it through this hook too
  let hintDismiss = null;

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
      if (hintDismiss) hintDismiss();
      if (handlers.any) handlers.any();
      // capture can throw on a pointer already released (fast tap) — never
      // let that kill the input handling above
      try { els.joy.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
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
      if (hintDismiss) hintDismiss();
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
   *  CHOICE MENU (shared Pokemon-style grid: dialog + encounter)          *
   *  2-column battle-menu grid: arrows/WASD move the ▶ cursor,            *
   *  action confirms, taps work directly (44px+ targets in CSS).          *
   * ------------------------------------------------------------------ */
  // mash guard: ignore confirms briefly after a menu (re)appears, so
  // "press to skip text, press again" can't accidentally activate the
  // pre-selected item (e.g. open an external tab the player never meant to)
  const MENU_GRACE_MS = 275;
  const MENU_COLS = 2;
  function gridStep(idx, n, dir) {
    if (n < 2) return idx;
    if (dir === 'left') return (idx + n - 1) % n;
    if (dir === 'right') return (idx + 1) % n;
    const lastRow = Math.floor((n - 1) / MENU_COLS);
    if (dir === 'down') {
      const t = idx + MENU_COLS;
      if (t < n) return t;
      if (Math.floor(idx / MENU_COLS) < lastRow) return n - 1; // clamp into last row
      const top = idx % MENU_COLS;                             // wrap to top row
      return top === idx ? idx : top;
    }
    // up
    const t = idx - MENU_COLS;
    if (t >= 0) return t;
    const bottom = Math.min(idx % MENU_COLS + MENU_COLS * lastRow, n - 1);
    return bottom === idx ? idx : bottom;
  }
  /** items: [{ label, href?, ...payload }]. onPick(item) fires on confirm/tap.
   *  href items render as real anchors (new tab, popup-blocker friendly). */
  function createChoiceMenu(container) {
    const st = { items: [], idx: 0, armedAt: 0, active: false, onPick: null };
    function render() {
      st.items.forEach((m, i) => {
        const sel = i === st.idx;
        m.btn.classList.toggle('sel', sel);
        // focus is withheld during the grace window — a mashed Enter would
        // otherwise natively activate a focused anchor, bypassing confirm()
        if (sel && st.active && performance.now() - st.armedAt >= MENU_GRACE_MS) {
          focusEl(m.btn);
        }
      });
    }
    function show(items, onPick, startIdx) {
      st.items = items; st.onPick = onPick || null;
      st.idx = Math.min(Math.max(startIdx || 0, 0), items.length - 1);
      st.active = true; st.armedAt = performance.now();
      container.innerHTML = '';
      items.forEach((m, i) => {
        let b;
        if (m.href) {
          b = document.createElement('a');
          b.href = m.href; b.target = '_blank'; b.rel = 'noopener';
          b.addEventListener('click', (ev) => {
            ev.stopPropagation();                // deliberate tap: let it navigate
            st.idx = i; render();
            audio.sfx.confirm();
            if (st.onPick) st.onPick(m);
          });
        } else {
          b = document.createElement('button');
          b.type = 'button';
          b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            st.idx = i; render();
            confirm();                           // taps share the mash guard
          });
        }
        b.addEventListener('pointerenter', () => {
          if (!st.active || i === st.idx) return;
          st.idx = i; render();
        });
        b.className = 'enc-btn';
        b.textContent = m.label;
        container.appendChild(b);
        m.btn = b;
      });
      container.hidden = false;
      if (!REDUCED) {                            // GBA menu slide-in
        container.classList.remove('pop');
        void container.offsetWidth;
        container.classList.add('pop');
      }
      render();
      // grant real focus to the selection once the grace period passes
      setTimeout(() => { if (st.active && !container.hidden) render(); }, MENU_GRACE_MS + 15);
    }
    function hide() {
      st.active = false;
      container.hidden = true;
    }
    function move(dir) {
      if (!st.active || st.items.length < 2) return;
      const t = gridStep(st.idx, st.items.length, dir);
      if (t === st.idx) return;
      st.idx = t;
      audio.sfx.blip();
      render();
    }
    function confirm() {
      if (!st.active) return;
      // swallow the mash press that lands right after the menu appears; the
      // highlight already shows the selection for the next deliberate press
      if (performance.now() - st.armedAt < MENU_GRACE_MS) return;
      const m = st.items[st.idx];
      if (!m) return;
      if (m.href && m.btn && m.btn.tagName === 'A') {
        m.btn.click();                           // anchor path plays sfx + onPick
        return;
      }
      audio.sfx.confirm();
      if (st.onPick) st.onPick(m);
    }
    return {
      show, hide, move, confirm,
      get active() { return st.active; },
      get idx() { return st.idx; }
    };
  }

  /** Split flavor text into GBA-sized pages (sentence-packed, \n\n = break). */
  function paginate(text, max) {
    max = max || 200;
    const pages = [];
    for (const block of String(text).split('\n\n')) {
      const sentences = [];
      let buf = '';
      for (let i = 0; i < block.length; i++) {
        buf += block[i];
        const nx = block[i + 1];
        if ('.!?'.indexOf(block[i]) !== -1 && (nx === ' ' || nx === undefined)) {
          sentences.push(buf.trim()); buf = '';
          while (block[i + 1] === ' ') i++;
        }
      }
      if (buf.trim()) sentences.push(buf.trim());
      let cur = '';
      for (const sn of sentences) {
        const cand = cur ? cur + ' ' + sn : sn;
        if (cur && cand.length > max) { pages.push(cur); cur = sn; }
        else cur = cand;
      }
      if (cur) pages.push(cur);
    }
    return pages.length ? pages : [String(text)];
  }

  /* ------------------------------------------------------------------ *
   *  DIALOG                                                              *
   *  Two flavors sharing the same box:                                    *
   *   openDialog     — classic linear pages (fountain, GOLDIE)            *
   *   openMenuDialog — Pokemon script: intro line -> choice menu ->       *
   *                    topic pages -> back to the menu, until close       *
   * ------------------------------------------------------------------ */
  const dialog = {
    mode: 'idle',   // idle | pages | intro | menu | topic
    pages: [], i: 0, links: false, onClose: null,
    script: null, topic: [], ti: 0, introText: '', menuIdx: 0
  };
  const dlgMenu = createChoiceMenu(els.dlgMenu);
  function openDialogShell(name, onClose) {
    if (hintDismiss) hintDismiss();            // never float over an open box
    dialog.onClose = onClose || null;
    els.dlgName.textContent = name;
    els.dlgLinks.hidden = true;
    dlgMenu.hide();
    els.dialog.hidden = false;
    document.body.classList.add('in-dialog');
    grabFocus(els.dialog);
  }
  function openDialog(name, pages, links, onClose) {
    dialog.mode = 'pages'; dialog.script = null;
    dialog.pages = pages; dialog.i = 0; dialog.links = !!links;
    openDialogShell(name, onClose);
    showDialogPage();
  }
  function showDialogPage() {
    els.dlgMore.style.visibility = 'hidden';
    typewrite(els.dlgText, dialog.pages[dialog.i], () => {
      els.dlgMore.style.visibility = 'visible';
      if (dialog.links && dialog.i === dialog.pages.length - 1) els.dlgLinks.hidden = false;
    });
  }
  /** script: { intro, menu: [{ label, pages? | links?+line? | close? }] } */
  function openMenuDialog(name, script, onClose) {
    dialog.mode = 'intro'; dialog.script = script;
    dialog.introText = script.intro; dialog.menuIdx = 0;
    openDialogShell(name, onClose);
    els.dlgMore.style.visibility = 'hidden';
    typewrite(els.dlgText, script.intro, () => enterDlgMenu());
  }
  function enterDlgMenu(restoreIntro) {
    dialog.mode = 'menu';
    els.dlgMore.style.visibility = 'hidden';
    if (restoreIntro) els.dlgText.textContent = dialog.introText;  // no re-type
    dlgMenu.show(dialog.script.menu, onDlgPick, dialog.menuIdx);
  }
  function onDlgPick(m) {
    dialog.menuIdx = Math.max(0, dialog.script.menu.indexOf(m));
    if (m.close) { closeDialog(); return; }
    if (m.links) {                               // reveal link row, stay in menu
      els.dlgLinks.hidden = false;
      if (m.line) els.dlgText.textContent = m.line;
      return;
    }
    if (m.pages) {
      dialog.mode = 'topic';
      dialog.topic = m.pages; dialog.ti = 0;
      els.dlgLinks.hidden = true;
      dlgMenu.hide();
      focusEl(els.dialog);
      showTopicPage();
    }
  }
  function showTopicPage() {
    els.dlgMore.style.visibility = 'hidden';
    typewrite(els.dlgText, dialog.topic[dialog.ti], () => {
      els.dlgMore.style.visibility = 'visible';
    });
  }
  function advanceDialog() {
    if (dialog.mode === 'idle') return;
    if (typer.active) { typerFinish(); return; }
    if (dialog.mode === 'menu') { dlgMenu.confirm(); return; }
    audio.sfx.blip();
    if (dialog.mode === 'topic') {
      if (dialog.ti < dialog.topic.length - 1) { dialog.ti++; showTopicPage(); }
      else enterDlgMenu(true);                   // DETAILS -> menu loop
      return;
    }
    if (dialog.mode === 'intro') { enterDlgMenu(); return; }
    if (dialog.i < dialog.pages.length - 1) {    // classic pages
      dialog.i++;
      showDialogPage();
    } else closeDialog();
  }
  /** B/X/Esc: topic backs out to the menu; everywhere else closes. */
  function cancelDialog() {
    if (dialog.mode === 'idle') return;
    audio.sfx.back();
    if (dialog.mode === 'topic') {
      typerStop();
      enterDlgMenu(true);
      return;
    }
    closeDialog();
  }
  function dlgMove(dir) {
    if (dialog.mode === 'menu') dlgMenu.move(dir);
  }
  function closeDialog() {
    typerStop();
    dialog.mode = 'idle';
    dlgMenu.hide();
    els.dlgLinks.hidden = true;
    els.dialog.hidden = true;
    document.body.classList.remove('in-dialog');
    restoreFocus();
    const cb = dialog.onClose; dialog.onClose = null;
    cb && cb();
  }
  els.dialog.addEventListener('click', (ev) => {
    if (ev.target.closest('a, button')) return;  // menu/links handle themselves
    if (dialog.mode === 'menu' && !typer.active) return; // stray taps never confirm
    if (handlers.action) handlers.action();
  });

  /* ------------------------------------------------------------------ *
   *  ENCOUNTER                                                           *
   *  Battle flow: short intro ("A wild X appeared!" + tagline) ->         *
   *  choice grid [DETAILS][VISIT]/[RUN]. DETAILS pages the Pokedex        *
   *  entry and returns to the menu; eggs get [DETAILS][BACK].             *
   * ------------------------------------------------------------------ */
  const enc = {
    project: null, mode: 'idle',  // idle | intro | menu | pages
    pages: [], pi: 0, introText: '', menuItems: [], menuIdx: 0,
    onVisit: null, onRun: null
  };
  const encMenu = createChoiceMenu(els.encMenu);
  function showEncounter(p, isEgg, onVisit, onRun) {
    if (hintDismiss) hintDismiss();            // never cover the name plate
    enc.project = p; enc.mode = 'intro';
    enc.onVisit = onVisit || null; enc.onRun = onRun || null;
    if (window.ywTrack) ywTrack('encounter_opened', { project: p.id, egg: !!isEgg });
    const soon = !isEgg && !p.url;               // non-egg without a live link
    els.encName.textContent = (isEgg ? 'EGG (' + p.name + ')' : p.name).toUpperCase();
    els.encTag.textContent = isEgg ? 'INCUBATING' : (soon ? 'COMING SOON' : 'WILD');
    els.encTag.classList.toggle('soon', soon);
    enc.introText = isEgg
      ? 'You found an EGG! It\'s still incubating...\n"' + p.tagline + '"'
      : 'A wild ' + p.name.toUpperCase() + ' appeared!\n"' + p.tagline + '"';
    enc.pages = paginate(p.desc
      + (soon ? '\n\nThis one isn\'t ready for visitors yet — check back soon!' : ''));
    enc.menuIdx = 0;
    enc.menuItems = [{ act: 'details', label: 'DETAILS' }];
    if (!isEgg && p.url) enc.menuItems.push({ act: 'visit', label: 'VISIT', href: p.url });
    enc.menuItems.push({ act: 'run', label: isEgg ? 'BACK' : 'RUN' });
    encMenu.hide();
    els.encMore.style.visibility = 'hidden';
    els.encounter.hidden = false;
    document.body.classList.add('in-encounter');
    grabFocus(els.encounter.querySelector('.enc-panel'));
    typewrite(els.encText, enc.introText, () => enterEncMenu());
  }
  function enterEncMenu(restoreIntro) {
    enc.mode = 'menu';
    els.encMore.style.visibility = 'hidden';
    if (restoreIntro) els.encText.textContent = enc.introText;     // no re-type
    encMenu.show(enc.menuItems, onEncPick, enc.menuIdx);
  }
  function onEncPick(m) {
    enc.menuIdx = Math.max(0, enc.menuItems.indexOf(m));
    if (m.act === 'details') {
      enc.mode = 'pages'; enc.pi = 0;
      encMenu.hide();
      focusEl(els.encounter.querySelector('.enc-panel'));
      showEncPage();
    } else if (m.act === 'visit') {
      if (window.ywTrack) ywTrack('project_visited', { project: enc.project.id });
      if (enc.onVisit) enc.onVisit(enc.project); // celebration counts VISIT only
    } else if (m.act === 'run') {
      if (enc.onRun) enc.onRun();
    }
  }
  function showEncPage() {
    els.encMore.style.visibility = 'hidden';
    typewrite(els.encText, enc.pages[enc.pi], () => {
      els.encMore.style.visibility = 'visible';
    });
  }
  function encMove(dir) {
    if (enc.mode === 'menu') encMenu.move(dir);
  }
  function encConfirm() {
    if (enc.mode === 'idle') return;
    if (typer.active) { typerFinish(); return; }
    if (enc.mode === 'pages') {
      audio.sfx.blip();
      if (enc.pi < enc.pages.length - 1) { enc.pi++; showEncPage(); }
      else enterEncMenu(true);                   // DETAILS -> menu loop
      return;
    }
    if (enc.mode === 'menu') encMenu.confirm();
  }
  /** B/X/Esc: DETAILS pages back out to the menu; menu/intro = RUN. */
  function encCancel() {
    if (enc.mode === 'idle') return;
    audio.sfx.back();
    if (enc.mode === 'pages') {
      typerStop();
      enterEncMenu(true);
      return;
    }
    if (enc.onRun) enc.onRun();
  }
  function encHide() {
    typerStop();
    enc.mode = 'idle';
    encMenu.hide();
    els.encounter.hidden = true;
    document.body.classList.remove('in-encounter');
    restoreFocus();
  }
  // tap-to-advance on the panel itself while DETAILS pages are typing/paged
  els.encounter.addEventListener('click', (ev) => {
    if (ev.target.closest('a, button')) return;
    if (enc.mode === 'pages' || typer.active) {
      if (handlers.action) handlers.action();
    }
  });

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
      hintDismiss = null;
      els.hint.hidden = true;
      try { localStorage.setItem('yw_hint', '1'); } catch (e) { /* noop */ }
      window.removeEventListener('keydown', dismiss);
      els.hint.removeEventListener('click', dismiss);
    };
    hintDismiss = dismiss;                     // touch paths + overlay opens
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
    // one prompt on the hero shot: after a "READY!" beat the finished loader
    // fades out (styles/main.css .load-wrap — opacity only, so PRESS START
    // never jumps) and PRESS START carries the title screen alone
    const wrap = els.loadFill.closest('.load-wrap');
    if (wrap) wrap.classList.add('done');
    els.pressStart.hidden = false;
  }
  function tryStart() {
    if (!ready || started) return;
    started = true;
    if (window.ywTrack) ywTrack('game_start', {
      mobile: matchMedia('(pointer: coarse)').matches
    });
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
    openDialog, openMenuDialog, advanceDialog, cancelDialog, closeDialog, dlgMove,
    get dialogOpen() { return !els.dialog.hidden; },
    showEncounter, encMove, encConfirm, encCancel, encHide,
    transitionIn, transitionOut,
    paintMute, setProgress, maybeShowHint,
    setLoad, enableStart, showFallback,
    get started() { return started; }
  };
}
