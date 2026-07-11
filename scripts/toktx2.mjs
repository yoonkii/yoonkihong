// Convert every texture inside a GLB to ETC1S KTX2 (KHR_texture_basisu)
// using the basisu CLI. Keeps meshopt/quantization intact.
// Usage: node toktx2.mjs <in.glb> <out.glb> [quality 1-255]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [src, out, qArg] = process.argv.slice(2);
const Q = Number(qArg || 224);

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder,
                          'meshopt.encoder': MeshoptEncoder });

const doc = await io.read(src);
const root = doc.getRoot();
const textures = root.listTextures();
if (!textures.length) { console.log('no textures, skipping'); process.exit(2); }

const tmp = mkdtempSync(join(tmpdir(), 'ktx2-'));
let before = 0, after = 0;
for (let i = 0; i < textures.length; i++) {
  const tex = textures[i];
  const mime = tex.getMimeType();
  if (mime === 'image/ktx2') continue;
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const inFile = join(tmp, `t${i}.${ext}`);
  const outFile = join(tmp, `t${i}.ktx2`);
  const bytes = tex.getImage();
  before += bytes.byteLength;
  writeFileSync(inFile, Buffer.from(bytes));
  execFileSync('basisu', [
    '-etc1s', '-q', String(Q), '-comp_level', '3',
    '-mipmap', '-mip_srgb', '-srgb', '-ktx2', '-quiet',
    '-file', inFile, '-output_file', outFile
  ], { stdio: 'pipe' });
  const ktx = readFileSync(outFile);
  after += ktx.byteLength;
  tex.setImage(new Uint8Array(ktx)).setMimeType('image/ktx2');
}
doc.createExtension(KHRTextureBasisu).setRequired(true);
await io.write(out, doc);
rmSync(tmp, { recursive: true, force: true });
console.log(`${src.split('/').pop()}: textures ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (${textures.length} tex, q${Q})`);
