// Verify the actual static artifact without Vite's development/preview fallback.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { access, readFile, readdir, writeFile, mkdir, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('..', import.meta.url));
const root = resolve(web, 'dist');
const files = new Map();
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name), name = `${prefix}${entry.name}`;
    assert.ok(!(await lstat(path)).isSymbolicLink(), `Unexpected symlink: ${name}`);
    if (entry.isDirectory()) await collect(path, `${name}/`);
    else { assert.ok(entry.isFile()); files.set(name, await readFile(path)); }
  }
}
await collect(root);
const manifest = JSON.parse(files.get('resources/manifest.json'));
const expected = new Set(['index.html', 'resources/manifest.json']);
for (const resource of Object.values(manifest.files)) {
  const name = `resources/${resource.file}`;
  expected.add(name);
  assert.equal(files.get(name)?.length, resource.bytes, name);
  assert.equal(createHash('sha256').update(files.get(name)).digest('hex'), resource.sha256, name);
}
const assets = [...files.keys()].filter((name) => /^assets\/[\w.-]+\.(js|css)$/.test(name));
assert.ok(assets.some((name) => /planning\.worker-.*\.js$/.test(name)), 'Planning worker must be bundled');
for (const name of assets) expected.add(name);
assert.deepEqual([...files.keys()].sort((a, b) => a.localeCompare(b)), [...expected].sort((a, b) => a.localeCompare(b)), 'Only application bundles and allowlisted resources may be published');
const html = files.get('index.html').toString();
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(match[1].startsWith('./assets/'), `Non-relative asset: ${match[1]}`);
  assert.ok(files.has(match[1].slice(2)), `Missing HTML asset: ${match[1]}`);
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain' };
const server = createServer((request, response) => {
  let name;
  try {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path.startsWith('/luckymap/')) path = path.slice('/luckymap'.length);
    name = path === '/' ? 'index.html' : path.slice(1);
  } catch { response.writeHead(400).end(); return; }
  const data = files.get(name);
  if (!data) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': `${mime[extname(name)] ?? 'application/octet-stream'}`, 'Cache-Control': 'no-store' });
  response.end(data);
});
const run = (script, url, extraEnv = {}) => new Promise((done, fail) => {
  const child = spawn(process.execPath, ['--experimental-strip-types', join(web, 'scripts', script), url], { cwd: web, env: { ...process.env, ...extraEnv }, stdio: 'inherit', windowsHide: true });
  child.on('error', fail);
  child.on('exit', (code) => code === 0 ? done() : fail(Error(`${script} exited ${code}`)));
});
const report = { createdAt: new Date().toISOString(), files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })), checks: [] };
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/luckymap/']) {
    await run('verify-resource-delivery.mjs', origin + path);
    for (const forbidden of ['user-data/session.json', 'app/MapApp.cs', 'package.json', '.env', 'missing.js']) assert.equal((await fetch(origin + path + forbidden)).status, 404);
    await run('verify-storage-browser.mjs', origin + path);
    report.checks.push({ path, browser: 'CHROME_PATH or default Chrome', passed: true });
  }
  const edge = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  let hasEdge = false;
  try { await access(edge); hasEdge = true; } catch { /* Optional browser; record the omission. */ }
  if (hasEdge) {
    await run('verify-storage-browser.mjs', `${origin}/luckymap/`, { CHROME_PATH: edge });
    report.checks.push({ path: '/luckymap/', browser: 'Edge', passed: true });
  } else report.checks.push({ browser: 'Edge', skipped: 'Not installed; set EDGE_PATH to verify' });
  await mkdir(join(web, 'work'), { recursive: true });
  await writeFile(join(web, 'work', 'release-report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS static release: ${files.size} files, ${[...files.values()].reduce((n, b) => n + b.length, 0)} bytes; report: web/work/release-report.json`);
} finally {
  await new Promise((done) => server.close(done));
}
