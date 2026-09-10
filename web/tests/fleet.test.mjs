import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeGun, newFleet, fleetReducer as reduce, selectedTable, changeProfile } from '../features/fleet/state.ts';
import { createLuckyTables } from '../domain/game-tables.ts';
import { decimal } from '../features/calculation/format.ts';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const tables = createLuckyTables(await json('../../data/game-tables.json'), await json('../../data/m777-tables.json'));
const point = (state, kind, X, Z) => reduce(state, { type: 'point', kind, point: { X, Z } });

test('fleet copies settings but keeps independent points and bounded stable gun numbers', () => {
  let state = point(point(newFleet(), 'position', 5000, 5000), 'target', 5600, 4000);
  state = reduce(state, { type: 'planning', options: { Reserve: 500, RoadOffset: 200, SiteOffset: 400, Show: true } });
  const original = activeGun(state);
  state = reduce(state, { type: 'add' });
  assert.equal(activeGun(state).position, null); assert.deepEqual(activeGun(state).target, original.target);
  assert.notEqual(activeGun(state).target, original.target); assert.equal(activeGun(state).planning.Show, false);
  assert.equal(activeGun(state).planning.Reserve, 500);
  state = point(state, 'target', 8000, 8000);
  assert.deepEqual(state.guns[0].target, { X: 5600, Z: 4000 });
  for (let i = 0; i < 8; i++) state = reduce(state, { type: 'add' });
  assert.deepEqual(state.guns.map((g) => g.id), [1, 2, 3, 4, 5, 6]);
  state = reduce(state, { type: 'remove', id: 3 });
  state = reduce(state, { type: 'add' });
  assert.equal(state.activeId, 3); assert.deepEqual(state.guns.map((g) => g.id), [1, 2, 4, 5, 6, 3]);
  for (const gun of state.guns) state = reduce(state, { type: 'remove', id: gun.id });
  assert.equal(state.guns.length, 1);
});

test('share is a snapshot; reset affects only active points; bookmarks and names are shared', () => {
  let state = reduce(point(newFleet(), 'target', 5500, 4000), { type: 'add' });
  state = point(state, 'position', 4500, 4000);
  state = point(state, 'target', 5700, 4000);
  state = reduce(state, { type: 'share' });
  assert.deepEqual(state.guns[0].target, state.guns[1].target); assert.notEqual(state.guns[0].target, state.guns[1].target);
  state = point(state, 'target', 6000, 4000);
  assert.equal(state.guns[0].target.X, 5700);
  state = reduce(state, { type: 'bookmark', site: { id: 'user:test', name: 'Named point', x: 4500, z: 4000 } });
  state = reduce(state, { type: 'rename', id: 'user:test', name: 'Shared name' });
  state = reduce(state, { type: 'reset' });
  assert.equal(activeGun(state).target, null); assert.equal(activeGun(state).position, null);
  assert.equal(state.guns[0].target.X, 5700); assert.equal(state.names['user:test'], 'Shared name'); assert.equal(state.bookmarks.length, 1);
  const before = state;
  assert.equal(reduce(state, { type: 'share' }), before);
  assert.equal(reduce(state, { type: 'point', kind: 'position', point: { X: -1, Z: 0 } }), before);
  assert.equal(reduce(state, { type: 'planning', options: { ...activeGun(state).planning, Reserve: 3001 } }), before);
});

test('weapon selections are independent and every profile is reachable with legal selectors', () => {
  let state = newFleet();
  assert.equal(selectedTable(activeGun(state), tables).id, 'he4');
  state = reduce(state, { type: 'profile', table: tables.find((t) => t.id === 'he2') });
  state = reduce(state, { type: 'weapon', weapon: 'm777' });
  assert.equal(selectedTable(activeGun(state), tables).id, 'm777-2-low');
  state = reduce(state, { type: 'profile', table: tables.find((t) => t.id === 'm777-3-high-smoke') });
  state = reduce(state, { type: 'weapon', weapon: 'mortar82' });
  assert.equal(selectedTable(activeGun(state), tables).id, 'he2');
  state = reduce(state, { type: 'weapon', weapon: 'm777' });
  assert.equal(selectedTable(activeGun(state), tables).id, 'm777-3-high-smoke');
  for (const desired of tables) {
    let current = tables.find((t) => t.weapon === desired.weapon);
    current = changeProfile(current, tables, { trajectory: desired.trajectory });
    current = changeProfile(current, tables, { shell: desired.shell });
    current = changeProfile(current, tables, { rings: desired.rings });
    assert.equal(current.id, desired.id);
  }
});

test('one-decimal display uses desktop midpoint rounding', () => {
  for (const [input, expected] of [[12.25, '12.3'], [2.55, '2.6'], [-12.25, '-12.3'], [359.96, '360.0'], [0, '0.0']]) assert.equal(decimal(input), expected);
});
