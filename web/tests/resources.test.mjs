import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { sourceFiles, sourceRoot, resourceRoot, validateSource } from '../scripts/prepare-resources.mjs';
import { parseCatalog, resourceUrl, tileKey, loadCatalog, loadJsonResource } from '../features/resources/catalog.ts';

const manifestBytes = await readFile(join(resourceRoot, 'manifest.json'));
const catalog = parseCatalog(JSON.parse(manifestBytes));
const base = new URL('https://example.test/luckymap/');

test('allowlist is complete; every output equals its original source byte for byte', async () => {
  assert.equal(sourceFiles.length, 109);
  assert.equal(sourceFiles.filter((p) => p.endsWith('.png')).length, 100);
  assert.deepEqual(Object.keys(catalog.files).sort(), [...sourceFiles].sort());
  let bytes = 0;
  for (const path of sourceFiles) {
    const source = await readFile(join(sourceRoot, path));
    const entry = catalog.files[path];
    assert.deepEqual(await readFile(join(resourceRoot, entry.file)), source, path);
    assert.equal(createHash('sha256').update(source).digest('hex'), entry.sha256);
    assert.equal(source.length, entry.bytes);
    bytes += source.length;
  }
  assert.equal(catalog.totalBytes, bytes);
  assert.deepEqual((await readdir(resourceRoot)).sort(), [...new Set(['manifest.json', ...Object.values(catalog.files).map((e) => e.file)])].sort());
  assert.ok(!sourceFiles.some((p) => /user-data|\.exe$|\.pak$|detail\/roads|registration|heightmap/.test(p)));
});

test('resource and corner tile URLs keep the hosting subdirectory', () => {
  for (const [x, y] of [[0, 0], [9, 0], [0, 9], [9, 9]]) {
    const key = tileKey(x, y);
    assert.equal(resourceUrl(catalog, key, base).pathname, `/luckymap/resources/${catalog.files[key].file}`);
  }
  assert.throws(() => tileKey(-1, 0));
  assert.throws(() => tileKey(0.5, 0));
  assert.throws(() => tileKey(0, 10));
  assert.throws(() => resourceUrl(catalog, '../user-data/session.json', base));
  assert.throws(() => resourceUrl(catalog, 'toString', base));
});

test('catalog rejects malformed entries, missing data and changed map registration', () => {
  for (const mutate of [
    (c) => { c.version = 2; },
    (c) => { c.map.extent = 10000; },
    (c) => { c.totalBytes += 1; },
    (c) => { delete c.files['data/game-tables.json']; },
    (c) => { c.files['unexpected.json'] = c.files[tileKey(9, 9)]; delete c.files[tileKey(9, 9)]; },
    (c) => { c.files.LICENSE.file = '../secret.txt'; },
    (c) => { c.files.LICENSE.file = 'https://example.test/file.txt'; },
  ]) {
    const bad = structuredClone(catalog);
    mutate(bad);
    assert.throws(() => parseCatalog(bad));
  }
});

test('source validation rejects corrupt JSON, geometry and image headers', () => {
  assert.throws(() => validateSource('data/game-tables.json', Buffer.from('{')));
  assert.throws(() => validateSource('data/game-tables.json', Buffer.from('[]')));
  assert.throws(() => validateSource('data/maps/bakhmut/roads.json', Buffer.from('{"schema":1,"roads":[{"quads":[[[1,2]]]}]}')));
  assert.throws(() => validateSource('data/maps/bakhmut/points.json', Buffer.from('[]')));
  assert.throws(() => validateSource('tile.png', Buffer.from('not an image')));
  assert.throws(() => validateSource('background.jpg', Buffer.from('not an image')));
});

test('catalog load fetches only the manifest; individual data is lazy and errors propagate', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return new Response(manifestBytes, { status: 200 });
  });
  const loaded = await loadCatalog(base);
  assert.deepEqual(calls, ['https://example.test/luckymap/resources/manifest.json']);
  assert.equal(loaded.totalBytes, catalog.totalBytes);
  globalThis.fetch.mock.mockImplementation(async () => new Response('missing', { status: 404 }));
  await assert.rejects(loadCatalog(base), /HTTP 404/);
  await assert.rejects(loadJsonResource(catalog, 'data/game-tables.json', base), /HTTP 404/);
  globalThis.fetch.mock.mockImplementation(async () => new Response('<html>fallback</html>'));
  await assert.rejects(loadCatalog(base));
  globalThis.fetch.mock.mockImplementation(async () => { throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(loadCatalog(base), { name: 'AbortError' });
});
