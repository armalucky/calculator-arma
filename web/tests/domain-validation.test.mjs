import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validPoint, parseCoordinates } from '../domain/coordinates.ts';
import { parseGameTables, createLuckyTables, calculate } from '../domain/game-tables.ts';
import { RoadIndex, roadShape, roadDistanceSquared, parseRoadIndex } from '../domain/roads.ts';
import { defaultPlanningOptions, validPlanningOptions, nearestSite, parseSites, assessPosition, createCandidateMask } from '../domain/planning.ts';
import { loadGameTables, loadPlanningGeometry } from '../features/resources/game-data.ts';
import { parseCatalog } from '../features/resources/catalog.ts';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const mortar = await json('data/game-tables.json');
const m777 = await json('data/m777-tables.json');
const tables = createLuckyTables(mortar, m777);
const he = tables.find((t) => t.id === 'he4');
const rectangle = roadShape([[1000, 1000], [1100, 1000], [1100, 1020], [1000, 1020]]);
const roads = new RoadIndex([rectangle]);
const sites = [{ id: 'site', name: 'site', x: 5000, z: 4000 }];

test('invalid points never produce a solution; exponent overflow and hexadecimal input are rejected', () => {
  for (const point of [null, {}, { X: NaN, Z: 0 }, { X: Infinity, Z: 0 }, { X: '10', Z: 0 }, { X: -1, Z: 0 }, { X: 10241, Z: 0 }]) {
    assert.equal(validPoint(point), false);
    assert.equal(calculate(he, point, { X: 900, Z: 0 }).Available, false);
  }
  assert.throws(() => parseCoordinates('1e999 0', false));
  assert.throws(() => parseCoordinates('0xff 0', false));
  assert.deepEqual(parseCoordinates('102 102', true), { X: 10220, Z: 10220 });
});

test('malformed table metadata and rows are rejected before calculation', () => {
  for (const mutate of [
    (data) => { data[0].id = ''; },
    (data) => { data[1].id = data[0].id; },
    (data) => { data[0].weapon = 'unknown'; },
    (data) => { data[0].unitsPerCircle = 6400; },
    (data) => { data[0].rings = 1.5; },
    (data) => { data[0].trajectory = 'low'; },
    (data) => { data[0].rows = []; },
    (data) => { data[0].rows[1].distance = data[0].rows[0].distance; },
    (data) => { data[0].rows[0].elevation = NaN; },
    (data) => { data[0].rows[0].elevation = 1500; },
    (data) => { data[0].rows[0].seconds = 0; },
    (data) => { data[0].rows[0].source = {}; },
  ]) {
    const invalid = structuredClone(mortar); mutate(invalid);
    assert.throws(() => parseGameTables(invalid));
  }
  for (const invalid of [null, {}, [], [null]]) assert.throws(() => parseGameTables(invalid));
  const invalidM777 = structuredClone(m777); invalidM777[0].unitsPerCircle = 6000;
  assert.throws(() => parseGameTables(invalidM777));
  assert.throws(() => createLuckyTables(mortar, mortar));
});

test('M116 profiles are independent copies of the existing M107 game rows', () => {
  assert.equal(tables.filter((t) => t.shell === 'M116 SMOKE').length, 10);
  const copied = createLuckyTables(mortar, m777);
  for (const smoke of copied.filter((t) => t.shell === 'M116 SMOKE')) {
    const original = copied.find((t) => `${t.id}-smoke` === smoke.id);
    assert.deepEqual(smoke.rows, original.rows);
    assert.notEqual(smoke.rows, original.rows);
    smoke.rows[0].elevation = 1;
    assert.notEqual(original.rows[0].elevation, 1);
  }
  assert.deepEqual(parseGameTables(mortar)[0].rows[0].elevation, mortar[0].rows[0].elevation);
});

test('road BVH equals exhaustive search and retains its own geometry', () => {
  const shapes = Array.from({ length: 32 }, (_, i) => roadShape([[100 + i * 90, 200], [170 + i * 90, 200], [170 + i * 90, 230], [100 + i * 90, 230]]));
  const index = new RoadIndex(shapes);
  for (let i = 0; i < 100; i++) {
    const p = { X: (i * 743) % 4000, Z: (i * 389) % 2000 };
    const expected = Math.sqrt(Math.min(...shapes.map((s) => roadDistanceSquared(s, p.X, p.Z))));
    assert.equal(index.distance(p), expected);
  }
  const point = { X: 100, Z: 200 };
  shapes[0].Vertices[0][0] = 9999;
  assert.equal(index.distance(point), 0);
  assert.equal(roadDistanceSquared(roadShape([[1, 1], [1, 1], [1, 1], [1, 1]]), 4, 5), 25);
  assert.throws(() => new RoadIndex([]));
  assert.throws(() => roadShape([[0, 0]]));
  assert.throws(() => parseRoadIndex({ schema: 2, roads: [] }));
  assert.throws(() => roads.distance({ X: Infinity, Z: 0 }));
});

test('planning validates limits and excludes occupied road/site points even with zero offsets', () => {
  const options = defaultPlanningOptions();
  assert.notEqual(options, defaultPlanningOptions());
  for (const key of ['Reserve', 'RoadOffset', 'SiteOffset']) {
    for (const value of [-1, Infinity, NaN, 99999]) {
      const bad = { ...options, [key]: value };
      assert.equal(validPlanningOptions(bad), false);
      assert.throws(() => createCandidateMask(he, { X: 4000, Z: 4000 }, bad, roads, sites));
    }
  }
  assert.throws(() => createCandidateMask(null, { X: 0, Z: 0 }, options, roads, sites));
  assert.throws(() => assessPosition(he, { X: -1, Z: 0 }, { X: 0, Z: 0 }, options, roads, sites));
  const zero = { Reserve: 0, RoadOffset: 0, SiteOffset: 0, Show: false };
  assert.equal(assessPosition(he, { X: 0, Z: 0 }, { X: 1050, Z: 1010 }, zero, roads, sites).RoadAllowed, false);
  assert.equal(assessPosition(he, { X: 4000, Z: 4000 }, { X: 5000, Z: 4000 }, zero, roads, sites).SiteAllowed, false);
  assert.equal(nearestSite({ X: 0, Z: 0 }, []), Infinity);
  assert.throws(() => parseSites([{ id: 'x', name: 'x', x: -1, z: 0 }]));
});

test('sampled green-cell corners pass exact assessment; Show does not change geometry', () => {
  const target = { X: 4000, Z: 4000 };
  const options = defaultPlanningOptions();
  const mask = createCandidateMask(he, target, options, roads, sites);
  assert.deepEqual(mask.Occupancy, createCandidateMask(he, target, { ...options, Show: true }, roads, sites).Occupancy);
  let checked = 0;
  for (let index = 0; index < mask.Occupancy.length; index += 37) {
    if (!mask.Occupancy[index]) continue;
    const x = index % 512;
    const z = 511 - Math.floor(index / 512);
    for (const [dx, dz] of [[0, 0], [20, 0], [20, 20], [0, 20]]) {
      assert.equal(assessPosition(he, target, { X: x * 20 + dx, Z: z * 20 + dz }, options, roads, sites).Allowed, true);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('data adapters request only their data, preserve subpaths and reject invalid fetched data', async (t) => {
  const catalog = parseCatalog(await json('web/public/resources/manifest.json'));
  const base = new URL('https://example.test/luckymap/');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ path: url.pathname, signal: options.signal });
    const file = url.pathname.split('/').at(-1);
    return new Response(await readFile(new URL(`web/public/resources/${file}`, root)));
  });
  const controller = new AbortController();
  const result = await loadGameTables(catalog, base, controller.signal);
  assert.equal(result.length, 31); assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => r.path.startsWith('/luckymap/resources/') && r.path.endsWith('.json') && r.signal === controller.signal));
  const geometry = await loadPlanningGeometry(catalog, base);
  assert.equal(geometry.roads.Count, 9426); assert.equal(geometry.sites.length, 10);
  assert.equal(requests.length, 4);
  globalThis.fetch.mock.mockImplementation(async () => new Response('{}'));
  await assert.rejects(loadGameTables(catalog, base));
  await assert.rejects(loadPlanningGeometry(catalog, base));
});
