import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, lstat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sourceRoot = resolve(webRoot, '..');
export const resourceRoot = join(webRoot, 'public', 'resources');
export const sourceFiles = [
  'LICENSE', 'LICENSE.ru.md',
  'data/game-tables.json', 'data/m777-tables.json',
  'data/maps/bakhmut/desktop-background.jpg',
  'data/maps/bakhmut/roads.json', 'data/maps/bakhmut/buildings.json',
  'data/maps/bakhmut/points.json',
  'references/mod-luckygames/scenario0_1024x512.jpg',
  ...Array.from({ length: 100 }, (_, i) => `data/maps/bakhmut/detail/background/${i % 10}_${Math.floor(i / 10)}.png`),
];

export function validateSource(path, bytes) {
  if (bytes.length === 0) throw new Error(`Empty source: ${path}`);
  if (path.endsWith('.png')) {
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== 1026 || bytes.readUInt32BE(20) !== 1026) {
      throw new Error(`Expected 1026×1026 map tile with one-pixel border: ${path}`);
    }
  }
  if (path.endsWith('.jpg') && (bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)) throw new Error(`Invalid JPEG: ${path}`);
  if (!path.endsWith('.json')) return;
  const data = JSON.parse(bytes.toString('utf8'));
  const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const polygon = (p, minimum) => Array.isArray(p) && p.length >= minimum && p.every(point);
  let valid = false;
  if (path.endsWith('-tables.json')) {
    valid = Array.isArray(data) && data.length > 0 && new Set(data.map((t) => t?.id)).size === data.length && data.every((t) =>
      typeof t?.id === 'string' && typeof t.shell === 'string' && Array.isArray(t.rows) && t.rows.length >= 2 && t.rows.every((r, i) =>
        Number.isFinite(r?.distance) && Number.isFinite(r.elevation) && Number.isFinite(r.seconds) && (i === 0 || r.distance > t.rows[i - 1].distance)));
  } else if (path.endsWith('/points.json')) {
    valid = Array.isArray(data) && data.length === 10 && new Set(data.map((s) => s?.id)).size === data.length && data.every((s) =>
      typeof s?.id === 'string' && typeof s.name === 'string' && [s.x, s.z].every((n) => Number.isFinite(n) && n >= 0 && n <= 10240));
  } else if (path.endsWith('/roads.json')) {
    valid = data?.schema === 1 && Array.isArray(data.roads) && data.roads.length > 0 && data.roads.every((r) => Array.isArray(r?.quads) && r.quads.every((q) => polygon(q, 4) && q.length === 4));
  } else if (path.endsWith('/buildings.json')) {
    valid = data?.schema === 1 && Array.isArray(data.buildings) && data.buildings.length > 0 && data.buildings.every((b) => polygon(b?.vertices, 3));
  }
  if (!valid) throw new Error(`Invalid resource structure: ${path}`);
}

export async function prepareResources() {
  // Read and validate the whole allowlist before changing the previous output.
  const assets = [];
  for (const path of sourceFiles) {
    const bytes = await readFile(join(sourceRoot, path));
    validateSource(path, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const extension = path === 'LICENSE' ? 'txt' : path.split('.').at(-1);
    assets.push({ path, bytes, sha256, file: `${sha256}.${extension}` });
  }
  await mkdir(resourceRoot, { recursive: true });
  if ((await lstat(resourceRoot)).isSymbolicLink()) throw new Error('Resource output must not be a symlink.');
  // This folder is owned by this generator; never remove arbitrary paths.
  const existing = await readdir(resourceRoot);
  for (const file of existing) {
    if (!/^(?:manifest\.json(?:\.tmp)?|[a-f0-9]{64}\.(?:txt|md|json|jpg|png))$/.test(file) || !(await lstat(join(resourceRoot, file))).isFile()) throw new Error(`Unexpected file in generated resource folder: ${file}`);
  }
  const files = {};
  for (const asset of assets) {
    await writeFile(join(resourceRoot, asset.file), asset.bytes);
    files[asset.path] = { file: asset.file, bytes: asset.bytes.length, sha256: asset.sha256 };
  }
  const manifest = {
    version: 1,
    map: { id: 'bakhmut', extent: 10240, tileMetres: 1024, tilePixels: 1026, tileBorder: 1, columns: 10, rows: 10, tileOrigin: 'north-west' },
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes.length, 0),
    files,
  };
  const serialized = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(join(resourceRoot, 'manifest.json.tmp'), serialized);
  await rename(join(resourceRoot, 'manifest.json.tmp'), join(resourceRoot, 'manifest.json'));
  const current = new Set(assets.map((a) => a.file));
  for (const file of existing) {
    if (/^[a-f0-9]{64}\./.test(file) && !current.has(file)) await unlink(join(resourceRoot, file));
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await prepareResources();
  console.log(`Prepared ${Object.keys(manifest.files).length} resources (${(manifest.totalBytes / 1024 / 1024).toFixed(2)} MiB). Sources unchanged.`);
}
