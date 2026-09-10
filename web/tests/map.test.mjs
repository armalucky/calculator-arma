import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { screen, world, fitMap, zoomAt, pan, framePair, visibleTiles } from '../features/map/camera.ts';
import { parseMapGeometry } from '../features/map/geometry.ts';
import { TileCache } from '../features/map/tile-cache.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('camera preserves world coordinates, cursor anchor, framing and desktop orientation', () => {
  for (const size of [{ width: 1102, height: 675 }, { width: 500, height: 360 }]) {
    const camera = fitMap(size);
    for (const point of [{ X: 0, Z: 10240 }, { X: 10240, Z: 0 }, { X: 4723.68, Z: 5218.409 }]) {
      const px = screen(point, camera, size);
      assert.ok(px.x >= 0 && px.x <= size.width && px.y >= 0 && px.y <= size.height);
      const result = world(px, camera, size);
      near(result.X, point.X); near(result.Z, point.Z);
    }
    const anchor = { x: 150, y: 170 };
    const before = world(anchor, camera, size);
    const after = world(anchor, zoomAt(camera, size, anchor, 1.3), size);
    near(before.X, after.X); near(before.Z, after.Z);
    const moved = pan(camera, 40, 30);
    const origin = screen({ X: camera.X, Z: camera.Z }, moved, size);
    near(origin.x, size.width / 2 + 40); near(origin.y, size.height / 2 + 30);
    const a = { X: 1000, Z: 9000 }, b = { X: 9500, Z: 500 };
    const framed = framePair(camera, size, a, b);
    for (const point of [a, b]) {
      const px = screen(point, framed, size);
      assert.ok(px.x >= 49 && px.x <= size.width - 49 && px.y >= 49 && px.y <= size.height - 49);
    }
    assert.equal(zoomAt(camera, size, anchor, 10000).scale, 5);
    assert.equal(zoomAt(camera, size, anchor, 0.00001).scale, 0.025);
  }
});

test('tiles follow northwest numbering, scale threshold and map boundary', () => {
  const size = { width: 500, height: 400 };
  assert.deepEqual(visibleTiles(fitMap(size), size), []);
  assert.deepEqual(visibleTiles({ X: 512, Z: 9728, scale: 1 }, size), [{ x: 0, y: 0 }]);
  assert.deepEqual(visibleTiles({ X: 9728, Z: 512, scale: 1 }, size), [{ x: 9, y: 9 }]);
  assert.deepEqual(visibleTiles({ X: -1024, Z: -1024, scale: 5 }, size), []);
  assert.ok(visibleTiles({ X: 5120, Z: 5120, scale: 0.5 }, size).length < 10);
});

test('vector geometry retains every source vertex and road quad', async () => {
  const load = async (name) => JSON.parse(await readFile(new URL(`../../data/maps/bakhmut/${name}.json`, import.meta.url), 'utf8'));
  const roads = await load('roads'), buildings = await load('buildings');
  const parsed = parseMapGeometry(roads, buildings);
  assert.equal(parsed.roadCount, 9426); assert.equal(parsed.buildings.length, 9626);
  for (let i = 0; i < buildings.buildings.length; i++) assert.deepEqual(parsed.buildings[i].vertices, buildings.buildings[i].vertices);
  for (let i = 0; i < roads.roads.length; i++) {
    for (let j = 0; j < roads.roads[i].quads.length; j++) {
      const quad = roads.roads[i].quads[j];
      const compare = (a, b) => a[0] - b[0] || a[1] - b[1];
      assert.deepEqual([...parsed.roads[i].polygons[j].vertices].sort(compare), [...quad].sort(compare));
    }
  }
  assert.throws(() => parseMapGeometry({}, buildings));
});

test('tile cache bounds concurrency, evicts old images and closes aborted late arrivals', async () => {
  const requests = [], closed = [];
  const cache = new TileCache((key, signal) => new Promise((resolve, reject) => requests.push({ key, signal, resolve, reject })), () => {}, 2, 1);
  const image = (key) => ({ close: () => closed.push(key) });
  cache.setWanted(['a', 'b', 'c']);
  assert.equal(requests.length, 1);
  requests[0].resolve(image('a')); await tick();
  assert.equal(requests.length, 2);
  requests[1].resolve(image('b')); await tick();
  assert.equal(cache.loadedCount, 2); assert.equal(requests.length, 2);
  cache.setWanted(['c']); requests[2].resolve(image('c')); await tick();
  assert.equal(cache.loadedCount, 2); assert.ok(closed.includes('a'));
  cache.setWanted(['d']); cache.setWanted(['e']);
  assert.equal(requests[3].signal.aborted, true);
  requests[3].resolve(image('d')); await tick();
  assert.ok(closed.includes('d')); assert.equal(requests[4].key, 'e');
  cache.dispose(); requests[4].resolve(image('e')); await tick();
  assert.equal(cache.loadedCount, 0);
  assert.deepEqual(closed.sort((a, b) => a.localeCompare(b)), ['a', 'b', 'c', 'd', 'e']);
});

test('failed tiles do not retry in a render loop; explicit retry recovers', async () => {
  let calls = 0;
  const cache = new TileCache(async () => { if (++calls === 1) throw new Error('offline'); return { close() {} }; }, () => {});
  cache.setWanted(['a']); await tick();
  assert.equal(cache.failedCount, 1);
  for (let i = 0; i < 10; i++) cache.setWanted(['a']);
  await tick(); assert.equal(calls, 1);
  cache.retry(); await tick();
  assert.equal(cache.failedCount, 0); assert.equal(cache.loadedCount, 1);
  cache.dispose();
});
