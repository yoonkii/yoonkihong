# yoonkihong.com — YOONKI WORLD

Yoonki Hong's portfolio as a tiny Pokemon-style explorable world.
Walk around the island, meet the creatures — every one of them is a real
app he shipped. GTM at Google by day, builder by night.

Static site for GitHub Pages: vanilla HTML/CSS/JS + canvas. No build step,
no frameworks, no external JS libraries.

## Pages

- `index.html` — the game (canvas overworld, GBA-style encounters)
- `classic.html` — the quiet one-pager version of the same content

## Structure

- `data/projects.js` — single source of truth for projects. Both the game map
  and the classic page render from this array. The comment at the top of the
  file documents how to add a new project (one object; eggs are coming-soon
  items and use the egg sprite automatically).
- `scripts/game.js` — game engine (map, movement, creatures, encounters, audio)
- `scripts/main.js` — boot + UI glue (start screen, HUD, touch controls)
- `styles/main.css` — game UI + classic page styles
- `images/game/` — tiles, player sprites, creature sprites, buildings
- `audio/` — overworld + encounter chiptune loops

## Controls

- Move: arrow keys / WASD (tap to turn, hold to walk) — or on-screen D-pad on touch
- Interact: Z / Enter / Space (A button)
- Back: X / Esc (B button)

## Local development

Any static server works:

```
python3 -m http.server 8899
```

Then open http://localhost:8899/

## Credits

- Font: Geist / Geist Mono (Google Fonts); Press Start 2P for the title
- Pixel art + music: AI-generated, hand-assembled

Created by Yoonki Hong
