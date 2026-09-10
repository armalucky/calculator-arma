import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCoordinates, grid } from '../domain/coordinates.ts';
import { calculate, createLuckyTables, roundAwayFromZero } from '../domain/game-tables.ts';
import { parseRoadIndex, RoadIndex, roadShape } from '../domain/roads.ts';
import { assessPosition, createCandidateMask } from '../domain/planning.ts';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const reference = await json('web/tests/fixtures/domain-reference.json');
const tables = createLuckyTables(await json('data/game-tables.json'), await json('data/m777-tables.json'));
const tableById = (id) => id === null ? null : tables.find((t) => t.id === id);
const indexes = {
  real: parseRoadIndex(await json('data/maps/bakhmut/roads.json')),
  rectangle: new RoadIndex([roadShape([[1000, 1000], [1100, 1000], [1100, 1020], [1000, 1020]])]),
};

// Defined before comparison: integral units/flags/messages/row bounds match exactly.
// Continuous doubles allow 1e-9 absolute + 1e-12 relative for runtime math/JSON differences.
const exactNumbers = new Set(['AzimuthUnits', 'ElevationUnits', 'UnitsPerCircle', 'LowerDistance', 'UpperDistance']);
function compare(actual, expected, label) {
  for (const [key, wanted] of Object.entries(expected)) {
    if (typeof wanted === 'number' && !exactNumbers.has(key)) {
      const tolerance = 1e-9 + Math.abs(wanted) * 1e-12;
      assert.ok(Number.isFinite(actual[key]) && Math.abs(actual[key] - wanted) <= tolerance, `${label} ${key}: ${actual[key]} != ${wanted}`);
    } else assert.deepEqual(actual[key], wanted, `${label} ${key}`);
  }
}

test('C# oracle corresponds to unchanged desktop sources and data', async () => {
  for (const [path, hash] of Object.entries(reference.SourceHashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(path, root))).digest('hex'), hash, `Regenerate C# oracle after intentional source changes: ${path}`);
  }
  assert.equal(tables.length, reference.TableCount);
  assert.equal(indexes.real.Count, reference.RoadCount);
});

test(`C# coordinate parsing, cell centers and errors (${reference.Coordinates.length})`, () => {
  for (const sample of reference.Coordinates) {
    if (sample.Error) assert.throws(() => parseCoordinates(sample.Text, sample.Grid), { message: sample.Error }, sample.Text);
    else {
      const point = parseCoordinates(sample.Text, sample.Grid);
      assert.deepEqual(point, sample.Expected);
      assert.equal(grid(point), sample.GridText);
    }
  }
});

test(`C# calculations across all ${reference.TableCount} profiles (${reference.Calculations.length})`, () => {
  for (const sample of reference.Calculations) compare(calculate(tableById(sample.TableId), sample.Position, sample.Target), sample.Expected, `${sample.TableId} ${sample.Label}`);
  for (const sample of reference.Rounding) assert.equal(roundAwayFromZero(sample.Input), sample.Expected);
});

test(`C# nearest-road distances (${reference.RoadDistances.length})`, () => {
  for (const sample of reference.RoadDistances) compare({ value: indexes[sample.RoadSet].distance(sample.Position) }, { value: sample.Expected }, 'road distance');
});

test(`C# position assessments (${reference.Assessments.length})`, () => {
  for (const sample of reference.Assessments) compare(assessPosition(tableById(sample.TableId), sample.Target, sample.Position, sample.Options, indexes[sample.RoadSet], sample.Sites), sample.Expected, sample.TableId);
});

test(`C# full 512×512 candidate masks (${reference.Masks.length})`, () => {
  for (const sample of reference.Masks) {
    const mask = createCandidateMask(tableById(sample.TableId), sample.Target, sample.Options, indexes[sample.RoadSet], sample.Sites);
    assert.equal(mask.Cells, sample.ExpectedCells, sample.TableId);
    assert.equal(createHash('sha256').update(mask.Occupancy).digest('hex'), sample.ExpectedSha256, `${sample.TableId}: every cell and orientation`);
  }
});
