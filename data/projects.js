/* ============================================================================
   PROJECT DATA — single source of truth for BOTH the game (index.html)
   and the classic site (classic.html).

   HOW TO ADD A NEW PROJECT:
   1) Append one object to window.PROJECTS below. Fields:
        id       (required) unique slug, e.g. "myapp"
        name     (required) display name
        tagline  (required) one-liner
        desc     (required) a couple of Pokedex-flavored sentences
        url      (optional) live link. Empty/missing => shown as "coming soon"
        kind     (optional) 'creature' (default) or 'egg'.
                 'egg' items live in the fenced nursery garden on the map and
                 can't be visited until they get a url + kind:'creature'.
        category (optional) 'product' (default) or 'demo'.
                 'product' = polished production services (main map zones).
                 'demo' = experiments/prototypes — they live together in the
                 Demo Lab zone on the map and under "Demos & Experiments"
                 on classic.html.
        sprite   (optional) path to a 192x192 transparent PNG creature.
                 If omitted, the egg sprite is used automatically.
        building (optional) path to a 192x192 transparent PNG building.
                 Only 'creature' projects get a building on the map.
   2) That's it. The game auto-assigns the next free map slot for the
      building + wandering creature (see BUILDING_SLOTS / CREATURE_SPOTS /
      EGG_SLOTS in scripts/game.js — add more slots there if you run out),
      and classic.html renders the new card from this same array.
   ========================================================================== */

window.PROJECTS = [
  {
    id: "macrodoc",
    name: "Macro Doc Refinement",
    url: "https://www.macrodocrefinement.com/",
    tagline: "Your text, refined in real time — in seven voices.",
    desc: "MACRODOC lurks in quiet office basements, sorting messy sentences into mysteriously pleasing rows. Feed it up to 10,000 characters and it hums politely, returning your words polished for LinkedIn, X, Instagram, or Substack. It can speak in seven voices — from an eerily polite Severance-style corporate drone to full Gen Z chaos — and you can even teach it new ones.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/macrodoc.png",
    building: "images/game/buildings/macrodoc.png"
  },
  {
    id: "mathstreet",
    name: "MathStreet",
    url: "https://apps.apple.com/us/app/mathstreet/id6760241309",
    tagline: "Trade smart. Climb higher.",
    desc: "A wild MathStreet appeared! This speedy math platformer sends a little trader leaping up a Wall Street skyline — solve arithmetic problems fast to jump higher while a market crash rises from below. Quick answers earn combo bonuses, and leaderboards decide who's the sharpest trader on the street.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/mathstreet.png",
    building: "images/game/buildings/mathstreet.png"
  },
  {
    id: "mathwings",
    name: "Math Wings",
    url: "https://mathwingsgame.com/",
    tagline: "Your brain is the button — solve math, stay airborne.",
    desc: "Spotted soaring over a midnight city skyline, this arcade game keeps a tiny caped hero aloft only as long as you keep solving math — every correct answer is a wing-flap, every miss is pure gravity. The problems evolve as you climb, from single-digit addition all the way to multiplication and division, with a global top-20 leaderboard waiting at the top of the sky.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/mathwings.png",
    building: "images/game/buildings/mathwings.png"
  },
  {
    id: "funnify",
    name: "Funnify",
    url: "https://www.funnify.ai/",
    tagline: "Make study fun — AI quizzes you battle with friends.",
    desc: "A playful spirit born wherever studying turns into a game. It spins any text or topic into quiz cards with its AI magic, then challenges friends to real-time quiz battles. Trainers report that dull textbooks mysteriously become fun after it scurries past.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/funnify.png",
    building: "images/game/buildings/funnify.png"
  },
  {
    id: "lasthand",
    name: "LAST HAND",
    url: "https://www.roblox.com/games/111840491549271/LAST-HAND-Rock-Scissor-Paper-Party",
    tagline: "Rock, scissor, paper — in the dark, for keeps.",
    desc: "This shadowy party creature deals rock-scissor-paper under a single swinging lamp, where four trainers throw their hands in the dark and reveal all at once. The sneaky part: you can pay to switch your hand after the reveal while everyone watches — and every tie feeds a pot that never resets. After eight rounds of bluffs and cold reads, the biggest stack takes the table. Best played with sound on and a straight face.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/lasthand.png"
  },
  {
    id: "gunball",
    name: "GUNBALL",
    url: "https://www.roblox.com/games/70813132206095/GUNBALL",
    tagline: "Soccer, but everyone has a rocket launcher.",
    desc: "This round rowdy creature rolls around a neon stadium waiting to be blasted — no feet allowed, guns only. Two teams of three shove a giant ball toward the net with pure force: rifles knock it around, rockets send it (and you) flying, and rocket-jumping over your own teammates is not just legal but encouraged. Nothing deals damage, so the only casualties are clean sheets — it's all chaos, goals, and one very smug MVP.",
    kind: "creature",
    category: "product",
    sprite: "images/game/creatures/gunball.png"
  },
  {
    id: "suno",
    name: "Music",
    url: "",
    tagline: "Songs made with AI.",
    desc: "A mysterious egg humming a melody. Yoonki writes and produces songs with AI. It will hatch when the Suno link arrives.",
    kind: "egg"
  },
  {
    id: "substack",
    name: "Writing",
    url: "",
    tagline: "Essays & notes.",
    desc: "A quiet egg that smells faintly of ink. Essays on tech, AI, and building things. Hatching on Substack soon.",
    kind: "egg"
  },
  {
    id: "x",
    name: "X",
    url: "",
    tagline: "Thoughts in the wild.",
    desc: "A twitchy little egg that chirps in short bursts. Follow along once it hatches.",
    kind: "egg"
  }
];
