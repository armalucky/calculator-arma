import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadCatalog, resourceUrl } from '../features/resources/catalog.ts';

// Read-only: run against a local preview or a deployed site, including a subpath.
const base = new URL(process.argv[2] || 'http://127.0.0.1:4173/');
if (!base.pathname.endsWith('/')) throw new Error('Site directory URL must end with /.');
const catalog = await loadCatalog(base, AbortSignal.timeout(15000));
let total = 0;
for (const [key, entry] of Object.entries(catalog.files)) {
  const response = await fetch(resourceUrl(catalog, key, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, key);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, entry.bytes, key);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, key);
  total += bytes.length;
}
assert.equal(total, catalog.totalBytes);
console.log(`Verified HTTP delivery and SHA-256 for ${Object.keys(catalog.files).length} resources at ${base.href}`);
