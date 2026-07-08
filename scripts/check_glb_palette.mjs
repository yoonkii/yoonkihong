#!/usr/bin/env node
/* ============================================================================
   GLB PALETTE GATE — pre-ship acceptance check (GLB_PIPELINE.md §8)

   Decodes every baseColor texture embedded in assets/3d/*.glb and verifies
   the dominant colors sit inside the ART_BIBLE / VISUAL_PLAYBOOK bands:

     1. NEON GATE (all assets): any hue family covering ≥ 25% of the texture
        must NOT be simultaneously oversaturated AND overbright
        (mean sat > 0.75 with mean val > 0.85). This is exactly the failure
        that shipped the radioactive tree_a canopy (sat .84-.90, val .97)
        through the human glbviewer check.
     2. TREE HUE GATE (tree_* only): the dominant green-family mass
        (hue 60-180°) must average hue 85-120° — the playbook canopy band
        (#5FAE49 / #84C862, warm yellow-greens). Catches teal/emerald drift
        (the tree_b regression: hue ~153°).
     3. TREE VALUE + HIGHLIGHT GATE (tree_* only): canopy greens must
        average value ≥ 0.70, and ≥ 8% of the green mass must sit at
        value ≥ 0.80 — the playbook canopy is TWO greens (#5FAE49 body +
        #84C862 top highlight). Catches the dark-flat-cutout regression
        (tree_b shipped at val 0.68 with zero highlight stop: pines read
        as dark silhouettes in the coastal ring that frames every zone).

   Usage:
     node scripts/check_glb_palette.mjs                # checks assets/3d/*.glb
     node scripts/check_glb_palette.mjs assets/3d/tree_a.glb [...]

   Exit 0 = all pass; exit 1 = at least one FAIL (do not ship).

   Zero npm deps: the GLB container is parsed here (embedded JPEG/PNG image
   bufferViews are plain bytes — EXT_meshopt_compression only touches
   geometry). Pixel decode is delegated to python3 + Pillow, which is already
   the pipeline's texture-regrade tool.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = path.join(ROOT, 'assets', '3d');

/* ---- thresholds (keep in sync with the doc block above) ------------------ */
const DOMINANT_COVERAGE = 0.25;   // hue family is "dominant" above this
const NEON_SAT = 0.75;
const NEON_VAL = 0.85;
const TREE_HUE_MIN = 85, TREE_HUE_MAX = 120;
const TREE_GREEN_LO = 60, TREE_GREEN_HI = 180;
const TREE_VAL_MIN = 0.70;      // canopy mean value (dark-cutout gate)
const TREE_HI_VAL = 0.80;       // "top highlight" stop threshold …
const TREE_HI_FRAC = 0.08;      // … and how much of the green mass needs it

/* ---- GLB container parse (glTF 2.0 binary) ------------------------------- */
function extractImages(glbPath) {
  const buf = fs.readFileSync(glbPath);
  if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12;
  let json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004E4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error('no JSON chunk');
  const out = [];
  for (const img of json.images || []) {
    if (img.bufferView == null) continue;
    const bv = json.bufferViews[img.bufferView];
    const start = bv.byteOffset || 0;
    out.push({
      mime: img.mimeType || 'image/png',
      bytes: bin.subarray(start, start + bv.byteLength)
    });
  }
  return out;
}

/* ---- pixel stats via python3 + Pillow ------------------------------------ */
const PY = `
import sys, json, io, colorsys
from PIL import Image
im = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGB').resize((128,128))
fams = {}
gn = 0; gval = 0.0; ghi = 0
for r,g,b in im.getdata():
    h,s,v = colorsys.rgb_to_hsv(r/255,g/255,b/255)
    key = 'neutral' if s < 0.15 else int((h*360)//30)*30
    f = fams.setdefault(key, [0,0.0,0.0,0.0])
    f[0]+=1; f[1]+=h*360; f[2]+=s; f[3]+=v
    if s >= 0.15 and 60 <= h*360 <= 180:
        gn += 1; gval += v; ghi += (v >= %HI%)
n = 128*128
print(json.dumps({
  'families': [{ 'family':k, 'coverage':f[0]/n, 'hue':f[1]/f[0],
                 'sat':f[2]/f[0], 'val':f[3]/f[0] }
               for k,f in sorted(fams.items(), key=lambda kv:-kv[1][0])],
  'greens': { 'n': gn, 'val': (gval/gn if gn else 0),
              'hiFrac': (ghi/gn if gn else 0) }}))
`.replace('%HI%', String(TREE_HI_VAL));

function pixelStats(bytes) {
  const r = spawnSync('python3', ['-c', PY], { input: bytes, maxBuffer: 1 << 24 });
  if (r.status !== 0) {
    throw new Error('python3+Pillow unavailable (pip install Pillow): ' +
      (r.stderr ? r.stderr.toString().trim().split('\n').pop() : 'spawn failed'));
  }
  return JSON.parse(r.stdout.toString());
}

/* ---- gates ---------------------------------------------------------------- */
function checkAsset(glbPath) {
  const name = path.basename(glbPath, '.glb');
  const fails = [], notes = [];
  const images = extractImages(glbPath);
  if (!images.length) notes.push('no embedded textures');
  images.forEach((img, i) => {
    const { families: fams, greens: greenPx } = pixelStats(img.bytes);
    for (const f of fams) {
      if (f.family === 'neutral') continue;
      if (f.coverage >= DOMINANT_COVERAGE && f.sat > NEON_SAT && f.val > NEON_VAL) {
        fails.push(`tex${i}: dominant hue ~${f.hue.toFixed(0)}° covers ` +
          `${(f.coverage * 100).toFixed(0)}% at sat ${f.sat.toFixed(2)} / val ` +
          `${f.val.toFixed(2)} — neon (limits: sat ≤ ${NEON_SAT} or val ≤ ${NEON_VAL})`);
      }
    }
    if (name.startsWith('tree_')) {
      const greens = fams.filter(f => f.family !== 'neutral' &&
        f.hue >= TREE_GREEN_LO && f.hue <= TREE_GREEN_HI);
      if (!greens.length) {
        fails.push(`tex${i}: no green-family mass (hue ${TREE_GREEN_LO}-${TREE_GREEN_HI}°) — wrong palette for a tree`);
      } else {
        const cov = greens.reduce((a, f) => a + f.coverage, 0);
        const hue = greens.reduce((a, f) => a + f.hue * f.coverage, 0) / cov;
        if (hue < TREE_HUE_MIN || hue > TREE_HUE_MAX) {
          fails.push(`tex${i}: canopy green averages hue ${hue.toFixed(0)}° — ` +
            `outside the playbook canopy band ${TREE_HUE_MIN}-${TREE_HUE_MAX}°`);
        } else {
          notes.push(`canopy hue ${hue.toFixed(0)}° ok (${(cov * 100).toFixed(0)}% coverage)`);
        }
      }
      if (greenPx.n > 0 && greenPx.val < TREE_VAL_MIN) {
        fails.push(`tex${i}: canopy green averages value ${greenPx.val.toFixed(2)} — ` +
          `below ${TREE_VAL_MIN} (dark flat cutout; playbook canopy is ` +
          `#5FAE49/#84C862 bright two-green)`);
      }
      if (greenPx.n > 0 && greenPx.hiFrac < TREE_HI_FRAC) {
        fails.push(`tex${i}: only ${(greenPx.hiFrac * 100).toFixed(1)}% of canopy green ` +
          `sits at value ≥ ${TREE_HI_VAL} — missing the #84C862 top-highlight stop ` +
          `(need ≥ ${TREE_HI_FRAC * 100}%)`);
      } else if (greenPx.n > 0) {
        notes.push(`highlight stop ${(greenPx.hiFrac * 100).toFixed(0)}% ≥ v${TREE_HI_VAL}, ` +
          `val ${greenPx.val.toFixed(2)}`);
      }
    }
  });
  return { name, fails, notes };
}

/* ---- main ------------------------------------------------------------------ */
const args = process.argv.slice(2);
const files = args.length
  ? args
  : fs.readdirSync(ASSET_DIR).filter(f => f.endsWith('.glb'))
      .map(f => path.join(ASSET_DIR, f));

let failed = 0;
for (const f of files) {
  let res;
  try {
    res = checkAsset(f);
  } catch (e) {
    console.error(`ERROR  ${path.basename(f)}: ${e.message}`);
    failed++;
    continue;
  }
  if (res.fails.length) {
    failed++;
    console.error(`FAIL   ${res.name}`);
    for (const m of res.fails) console.error(`       ${m}`);
  } else {
    console.log(`ok     ${res.name}${res.notes.length ? '  (' + res.notes.join('; ') + ')' : ''}`);
  }
}
console.log(failed ? `\n${failed} asset(s) off-palette — do not ship.` : '\nAll textures inside palette bands.');
process.exit(failed ? 1 : 0);
