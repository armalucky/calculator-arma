import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createLuckyTables } from '../domain/game-tables.ts';
import { newFleet, fleetReducer } from '../features/fleet/state.ts';
import { desktopValue, exportSession, importSession, readRecord, SessionError, MAX_BYTES } from '../features/storage/codec.ts';
import { SessionStore } from '../features/storage/session-store.ts';
import { parsePreferences } from '../features/storage/preferences.ts';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const tables = createLuckyTables(await json('../../data/game-tables.json'), await json('../../data/m777-tables.json'));
const sites = await json('../../data/maps/bakhmut/points.json');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const populated = () => {
  let fleet = newFleet();
  fleet = fleetReducer(fleet, { type: 'point', kind: 'position', point: { X: 1234.5, Z: 4321.25 } });
  fleet = fleetReducer(fleet, { type: 'point', kind: 'target', point: { X: 3400, Z: 5200 } });
  fleet = fleetReducer(fleet, { type: 'bookmark', site: { id: 'user:sample', name: 'My point', x: 3400, z: 5200, source: 'user' } });
  return fleetReducer(fleet, { type: 'add' });
};
const record = (fleet, revision = 'original') => ({ schema: 1, revision, savedAt: '2026-09-09', session: desktopValue(fleet) });
class MemoryRepository {
  current; previous; recovery; failWrite = false; commits = 0;
  async read() { return structuredClone({ current: this.current, previous: this.previous, recovery: this.recovery }); }
  async commit(next, expected, preserveValid) {
    await tick();
    if (this.failWrite) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    if (JSON.stringify(this.current) !== JSON.stringify(expected)) throw new SessionError('conflict');
    if (this.current !== undefined) this[preserveValid ? 'previous' : 'recovery'] = structuredClone(this.current);
    this.current = structuredClone(next); this.commits++;
  }
  close() {}
}
const create = (repo) => new SessionStore(tables, sites, async () => repo);

test('desktop fleet roundtrip retains every independent and shared field', () => {
  let fleet = populated();
  fleet = fleetReducer(fleet, { type: 'weapon', weapon: 'm777' });
  fleet = fleetReducer(fleet, { type: 'planning', options: { Reserve: 700, RoadOffset: 200, SiteOffset: 500, Show: true } });
  fleet = fleetReducer(fleet, { type: 'rename', id: sites[0].id, name: 'Custom scenario name' });
  assert.deepEqual(importSession('\uFEFF' + exportSession(fleet), tables, sites), fleet);
  assert.ok(!exportSession(fleet).includes('camera'));
});

test('classic import applies desktop naming migration once and defaults missing legacy profiles', () => {
  const classic = desktopValue(newFleet()).Guns[0].Data;
  classic.NamingVersion = 0; classic.Names[sites[0].id] = 'Old name';
  delete classic.Planning; delete classic.TableId; delete classic.WeaponId; delete classic.M777TableId;
  const imported = importSession(JSON.stringify(classic), tables, sites);
  assert.equal(imported.guns.length, 1); assert.equal(imported.names[sites[0].id], sites[0].name);
  imported.names[sites[0].id] = 'My new name';
  assert.equal(importSession(exportSession(imported), tables, sites).names[sites[0].id], 'My new name');
});

test('import rejects corruption, versions, incompatible fields, bad profiles and divergent shared data', () => {
  const cases = [
    (x) => { x.Version = 9; }, (x) => { x.ActiveId = 6; }, (x) => { x.Guns[1].Id = 1; },
    (x) => { x.Guns[0].Data.Position.X = 10241; }, (x) => { x.Guns[0].Data.Target = { X: '4', Z: 3 }; },
    (x) => { x.Guns[0].Data.Planning.Reserve = -1; }, (x) => { x.Guns[0].Data.TableId = 'not-a-table'; },
    (x) => { x.Guns[0].Data.Bookmarks.push(x.Guns[0].Data.Bookmarks[0]); },
    (x) => { x.Guns[0].Data.Names.extra = 'Divergent'; }, (x) => { x.FutureField = true; },
  ];
  for (const mutate of cases) { const data = JSON.parse(exportSession(populated())); mutate(data); assert.throws(() => importSession(JSON.stringify(data), tables, sites), SessionError); }
  assert.throws(() => importSession('{', tables, sites));
  assert.throws(() => importSession(' '.repeat(MAX_BYTES + 1), tables, sites), (e) => e.code === 'size');
  const unsafe = JSON.parse(exportSession(newFleet())); unsafe.Guns[0].Data.Names = JSON.parse('{"__proto__":"bad"}');
  assert.throws(() => importSession(JSON.stringify(unsafe), tables, sites));
});

test('accepted changes queue durably; saved status follows commit and reload retains the latest revision', async () => {
  const repo = new MemoryRepository(), store = create(repo);
  try {
    await store.start(); await store.save();
    for (let n = 0; n < 20; n++) store.dispatch({ type: 'point', kind: 'position', point: { X: n, Z: 3000 } });
    assert.equal(store.getSnapshot().status, 'saving');
    await store.save();
    assert.equal(store.getSnapshot().status, 'saved');
    assert.equal(readRecord(repo.current, tables, sites).fleet.guns[0].position.X, 19);
    await store.reload(); assert.equal(store.getSnapshot().fleet.guns[0].position.X, 19);
  } finally { store.stop(); }
});

test('quota failure preserves durable data and current memory; retry writes the unsaved session', async () => {
  const repo = new MemoryRepository(); repo.current = record(populated()); const store = create(repo);
  try {
    await store.start(); repo.failWrite = true;
    store.dispatch({ type: 'reset' }); await store.save();
    assert.equal(store.getSnapshot().status, 'error'); assert.equal(store.getSnapshot().fleet.guns[1].target, null);
    assert.ok(readRecord(repo.current, tables, sites).fleet.guns[1].target);
    assert.equal(await store.replace(newFleet()), false);
    repo.failWrite = false; await store.retry();
    assert.equal(store.getSnapshot().status, 'saved'); assert.equal(readRecord(repo.current, tables, sites).fleet.guns[1].target, null);
  } finally { store.stop(); }
});

test('stale tabs cannot overwrite; explicit reload adopts latest without changing it', async () => {
  const repo = new MemoryRepository(); repo.current = record(newFleet()); const a = create(repo), b = create(repo);
  try {
    await a.start(); await b.start();
    a.dispatch({ type: 'add' }); await a.save();
    b.dispatch({ type: 'point', kind: 'target', point: { X: 2000, Z: 3000 } }); await b.save();
    assert.equal(b.getSnapshot().status, 'conflict'); assert.equal(readRecord(repo.current, tables, sites).fleet.guns.length, 2);
    assert.ok(b.getSnapshot().fleet.guns[0].target);
    await b.reload(); assert.deepEqual(b.getSnapshot().fleet, a.getSnapshot().fleet);
  } finally { a.stop(); b.stop(); }
});

test('damaged or future primary is not overwritten; explicit restore archives it and preserves backup', async () => {
  for (const current of [{ schema: 9, revision: 'future', session: {} }, { schema: 1, revision: 'broken', session: {} }]) {
    const repo = new MemoryRepository(); repo.current = current; repo.previous = record(populated()); const store = create(repo);
    try {
      await store.start(); await store.save(); assert.equal(store.getSnapshot().status, 'recovery'); assert.equal(repo.commits, 0);
      assert.equal(await store.replace(store.getSnapshot().backup, true), true);
      assert.deepEqual(repo.recovery, current); assert.deepEqual(repo.previous, record(populated()));
      assert.deepEqual(store.getSnapshot().fleet, populated());
    } finally { store.stop(); }
  }
});

test('import and web schema migration keep original record until atomic replacement succeeds', async () => {
  const repo = new MemoryRepository(); repo.current = { schema: 0, revision: 'legacy', payload: desktopValue(populated()) };
  const original = structuredClone(repo.current), store = create(repo);
  try {
    await store.start(); await store.save(); assert.equal(repo.current.schema, 1); assert.deepEqual(repo.previous, original);
    const previous = structuredClone(repo.current);
    assert.equal(await store.replace(newFleet()), true); assert.deepEqual(repo.previous, previous);
    assert.equal(readRecord(repo.current, tables, sites).fleet.guns.length, 1);
  } finally { store.stop(); }
});

test('denied startup allows memory work; reconnect never overwrites an existing session', async () => {
  const repo = new MemoryRepository(); repo.current = record(populated()); let denied = true;
  const store = new SessionStore(tables, sites, async () => { if (denied) throw Error('Denied'); return repo; });
  try {
    await store.start(); assert.equal(store.getSnapshot().status, 'error');
    store.dispatch({ type: 'add' }); await store.save(); assert.equal(store.getSnapshot().fleet.guns.length, 2);
    denied = false; await store.retry(); assert.equal(store.getSnapshot().status, 'conflict'); assert.equal(repo.commits, 0);
  } finally { store.stop(); }
});

test('invalid display preferences fall back independently of session data', () => {
  const result = parsePreferences({ version: 1, language: 'en', layers: { roads: false, grid: 'bad' }, camera: { X: 0, Z: 0, scale: 999 } });
  assert.equal(result.language, 'en'); assert.equal(result.layers.roads, false); assert.equal(result.layers.grid, true); assert.equal(result.camera, null);
});
