import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import test from 'node:test';
import { createLuckyTables } from '../domain/game-tables.ts';

test('production worker transfers the complete C#-matching area and handles invalid input', async () => {
  const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const reference = await json('./fixtures/domain-reference.json');
  const sample = reference.Masks.find((s) => s.RoadSet === 'real');
  const tables = createLuckyTables(await json('../../data/game-tables.json'), await json('../../data/m777-tables.json'));
  const roads = await json('../../data/maps/bakhmut/roads.json');
  const worker = new Worker(new URL('./helpers/planning-worker-node.mjs', import.meta.url));
  try {
    assert.deepEqual(await once(worker, 'message'), ['ready']);
    const request = { key: 'current', table: tables.find((t) => t.id === sample.TableId), position: { X: 4500, Z: 4000 }, target: sample.Target, options: { ...sample.Options, Show: true }, roads, sites: sample.Sites };
    worker.postMessage(request);
    const [reply] = await once(worker, 'message');
    assert.equal(reply.key, 'current'); assert.ok(!reply.error);
    assert.equal(reply.mask.Cells, sample.ExpectedCells);
    assert.equal(createHash('sha256').update(reply.mask.Occupancy).digest('hex'), sample.ExpectedSha256);
    assert.equal(typeof reply.assessment.Allowed, 'boolean');
    worker.postMessage({ ...request, key: 'hidden', options: { ...request.options, Show: false } });
    const [hidden] = await once(worker, 'message');
    assert.equal(hidden.mask, null); assert.deepEqual(hidden.assessment, reply.assessment);
    worker.postMessage({ ...request, key: 'invalid', roads: {} });
    const [invalid] = await once(worker, 'message');
    assert.deepEqual(invalid, { key: 'invalid', error: true, mask: null, assessment: null });
  } finally { await worker.terminate(); }
});
