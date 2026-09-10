import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLuckyTables } from '../domain/game-tables.ts';
import { newFleet, fleetReducer } from '../features/fleet/state.ts';
import { desktopValue, exportSession, importSession } from '../features/storage/codec.ts';

const [mode, folder] = process.argv.slice(2);
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const tables = createLuckyTables(await json('../../data/game-tables.json'), await json('../../data/m777-tables.json'));
const sites = await json('../../data/maps/bakhmut/points.json');
if (mode === 'generate') {
  await mkdir(folder, { recursive: true });
  let fleet = newFleet();
  for (let id = 1; id <= 6; id++) {
    if (id > 1) fleet = fleetReducer(fleet, { type: 'add' });
    fleet = fleetReducer(fleet, { type: 'point', kind: 'position', point: { X: 1000 + id * 100.125, Z: 4000 + id } });
    fleet = fleetReducer(fleet, { type: 'point', kind: 'target', point: { X: 6000 + id, Z: 3000 + id * 0.5 } });
    fleet = fleetReducer(fleet, { type: 'weapon', weapon: id % 2 ? 'mortar82' : 'm777' });
    fleet = fleetReducer(fleet, { type: 'planning', options: { Reserve: id * 50, RoadOffset: id * 25, SiteOffset: id * 30, Show: id % 2 === 0 } });
  }
  fleet = fleetReducer(fleet, { type: 'bookmark', site: { id: 'user:interop', name: 'Тестовая закладка', x: 1234.5, z: 4321.5, source: 'user' } });
  fleet = fleetReducer(fleet, { type: 'rename', id: sites[0].id, name: 'Моё имя' });
  await writeFile(join(folder, 'web.json'), exportSession(fleet));
  const classic = desktopValue(fleet).Guns[0].Data; classic.NamingVersion = 0;
  await writeFile(join(folder, 'classic.json'), JSON.stringify(classic));
} else if (mode === 'verify') {
  const load = async (file) => importSession(await readFile(join(folder, file), 'utf8'), tables, sites);
  assert.deepEqual(await load('desktop.json'), await load('web.json'));
  assert.deepEqual(await load('classic-desktop.json'), await load('classic.json'));
  console.log('PASS: web → original C# FleetState.Load/Save → web; classic Session naming migration agrees.');
} else throw Error('Expected generate or verify and a work directory');
