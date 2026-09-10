// Real Chrome/IndexedDB integration. Isolated profile and generated files only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const web = fileURLToPath(new URL('..', import.meta.url));
const folder = resolve(web, 'work', `storage-browser-${randomUUID()}`);
const profile = join(folder, 'profile');
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
await mkdir(profile, { recursive: true });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const pending = new Map(); let sequence = 0;
const browserErrors = [];
const call = (method, params = {}, sessionId) => new Promise((done, fail) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); fail(Error(`CDP timeout: ${method}`)); }, 15_000);
  pending.set(id, { done: (value) => { clearTimeout(timer); done(value); }, fail: (cause) => { clearTimeout(timer); fail(cause); } });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const evaluate = async (session, expression) => {
  const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, session);
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
};
const until = async (session, expression) => {
  for (let i = 0; i < 150; i++) { if (await evaluate(session, expression)) return; await pause(100); }
  throw Error(`Timed out: ${expression}`);
};
const ready = (s) => until(s, "document.querySelector('[data-save-status]')?.dataset.saveStatus==='saved'");
const click = (s, name) => evaluate(s, `(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(name)});if(!b||b.disabled)throw Error('Button unavailable');b.click()})()`);
const fill = async (s, selector, value, submit = false) => {
  await evaluate(s, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
  await pause(50); // A background tab does not run requestAnimationFrame.
  if (submit) await evaluate(s, `document.querySelector(${JSON.stringify(selector)}).closest('form').requestSubmit()`);
};
const readDatabase = (s) => evaluate(s, `new Promise((done,fail)=>{const q=indexedDB.open('luckymap.web.sessions',1);q.onerror=()=>fail(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('records'),st=tx.objectStore('records'),a=st.get('current'),b=st.get('previous'),c=st.get('recovery');tx.oncomplete=()=>{done({current:a.result,previous:b.result,recovery:c.result});db.close()}}})`);
const upload = async (s, filename) => {
  const { root } = await call('DOM.getDocument', {}, s);
  const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' }, s);
  await call('DOM.setFileInputFiles', { nodeId, files: [filename] }, s);
};
const newTab = async () => {
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Page.enable', {}, sessionId);
  await call('Runtime.enable', {}, sessionId);
  await call('Network.enable', {}, sessionId);
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false }, sessionId);
  await call('Page.navigate', { url }, sessionId); await ready(sessionId);
  return { targetId, sessionId };
};
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); break; } catch { await pause(100); } }
  if (!port) throw Error('Chrome did not start');
  const [number, endpoint] = port.trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${number}${endpoint}`);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data); const task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.fail(Error(message.error.message)); else task.done(message.result); }
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails);
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400 && !message.params.response.url.endsWith('/favicon.ico')) browserErrors.push(message.params.response);
  };
  socket.onclose = () => { for (const task of pending.values()) task.fail(Error('Chrome closed')); pending.clear(); };
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: folder, eventsEnabled: true });
  const browserVersion = await call('Browser.getVersion');
  console.log(`Browser: ${browserVersion.product}; URL: ${url}`);
  const first = await newTab(), s = first.sessionId;
  await fill(s, '#position-input', '5000 5000', true); await fill(s, '#target-input', '5400 5000', true);
  await click(s, 'Добавить орудие'); await fill(s, '[aria-label="Оружие"]', 'm777');
  await evaluate(s, "document.querySelector('.scenario-points').open=true");
  await fill(s, '.scenario-points input', 'Test bookmark'); await click(s, 'Добавить закладку'); await click(s, 'Орудие 1');
  await fill(s, '#position-input', 'unapplied draft'); await fill(s, '.language-picker select', 'en');
  for (let i = 0; i < 4; i++) await click(s, 'Add gun');
  assert.equal(await evaluate(s, "[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()==='Add gun').disabled"), true);
  await click(s, 'Gun 1');
  await click(s, 'Position planning');
  await evaluate(s, "document.querySelector('.planning-actions input').click()");
  await until(s, "Number(document.querySelector('canvas').dataset.maskCells)>0 && document.querySelector('[data-planning-status]').dataset.planningStatus==='ready'");
  const maskCells = await evaluate(s, "Number(document.querySelector('canvas').dataset.maskCells)");
  await evaluate(s, "document.querySelector('.planning-actions input').click()");
  await until(s, "document.querySelector('canvas').dataset.maskCells==='0'");
  await click(s, 'Calculation');
  // Switching guns intentionally discards drafts, so create another before reload.
  await fill(s, '#position-input', 'unapplied draft');
  console.log(`PASS six-gun limit and real planning worker: ${maskCells} cells; hidden mask removed`);
  await evaluate(s, "document.querySelector('.layer-picker input').click()"); await click(s, 'Zoom in'); await ready(s); await pause(250);
  const original = (await readDatabase(s)).current.session;
  const preferences = await evaluate(s, "localStorage.getItem('luckymap.web.preferences.v1')");
  await call('Page.reload', {}, s); await until(s, 'document.readyState===\'complete\''); await ready(s);
  assert.equal(await evaluate(s, "document.querySelector('#position-input').value"), '5000 5000');
  assert.equal(await evaluate(s, 'document.documentElement.lang'), 'en');
  assert.deepEqual((await readDatabase(s)).current.session, original);
  assert.equal(await evaluate(s, "localStorage.getItem('luckymap.web.preferences.v1')"), preferences);
  console.log('PASS reload, independent guns/bookmark, language/layers/camera; draft excluded');

  await click(s, 'Export JSON');
  let exported;
  for (let i = 0; i < 100; i++) { try { exported = await readFile(join(folder, 'lucky-session.json'), 'utf8'); break; } catch { await pause(100); } }
  assert.ok(exported, 'Actual browser download must complete'); assert.deepEqual(JSON.parse(exported), original);
  await click(s, 'Clear A/B'); await ready(s);
  const cleared = (await readDatabase(s)).current;
  await upload(s, join(folder, 'lucky-session.json')); await until(s, '!!document.querySelector("dialog[open]")');
  await click(s, 'Cancel'); assert.deepEqual((await readDatabase(s)).current, cleared);
  await upload(s, join(folder, 'lucky-session.json')); await until(s, '!!document.querySelector("dialog[open]")'); await click(s, 'Confirm');
  await until(s, '!document.querySelector("dialog[open]")'); await ready(s);
  assert.deepEqual((await readDatabase(s)).current.session, original); assert.deepEqual((await readDatabase(s)).previous, cleared);
  await writeFile(join(folder, 'bad.json'), '{invalid'); await upload(s, join(folder, 'bad.json'));
  await until(s, '!!document.querySelector(".storage-panel [role=alert]")'); assert.deepEqual((await readDatabase(s)).current.session, original);
  console.log('PASS actual JSON download, file import preview/cancel/replace/backup, invalid file');

  const second = await newTab(), t = second.sessionId;
  await fill(s, '#target-input', '5600 5100', true); await ready(s);
  await until(t, "document.querySelector('[data-save-status]').dataset.saveStatus==='conflict'");
  const latest = (await readDatabase(s)).current;
  await fill(t, '#target-input', '7000 7000', true); assert.deepEqual((await readDatabase(t)).current, latest);
  await click(t, 'Load latest'); await until(t, '!!document.querySelector("dialog[open]")'); await click(t, 'Confirm'); await ready(t);
  assert.equal(await evaluate(t, "document.querySelector('#target-input').value"), '5600 5100');
  await call('Target.closeTarget', { targetId: second.targetId });
  console.log('PASS two real tabs: conflict blocks stale writes; explicit reload adopts latest');

  await evaluate(s, "window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Test quota','QuotaExceededError')}");
  await fill(s, '#target-input', '5800 5200', true); await until(s, "document.querySelector('[data-save-status]').dataset.saveStatus==='error'");
  assert.deepEqual((await readDatabase(s)).current, latest);
  await evaluate(s, 'IDBObjectStore.prototype.put=window.originalPut'); await click(s, 'Retry'); await ready(s);
  assert.equal((await readDatabase(s)).current.session.Guns[0].Data.Target.X, 5800);
  console.log('PASS IndexedDB write failure preserves durable data and memory; retry succeeds');

  await evaluate(s, `new Promise((done,fail)=>{const q=indexedDB.open('luckymap.web.sessions');q.onsuccess=()=>{const db=q.result,tx=db.transaction('records','readwrite'),st=tx.objectStore('records'),r=st.get('current');r.onsuccess=()=>st.put({...r.result,revision:'corrupt-test',session:{Version:99}},'current');tx.oncomplete=()=>{db.close();done()};tx.onabort=()=>fail(tx.error)}})`);
  await call('Page.reload', {}, s); await until(s, "document.querySelector('[data-save-status]')?.dataset.saveStatus==='recovery'");
  const corrupt = (await readDatabase(s)).current;
  await pause(200); assert.deepEqual((await readDatabase(s)).current, corrupt);
  await click(s, 'Restore backup'); await until(s, '!!document.querySelector("dialog[open]")'); await click(s, 'Confirm'); await ready(s);
  assert.deepEqual((await readDatabase(s)).recovery, corrupt);
  console.log('PASS corrupt startup never writes automatically; restore archives damaged primary');
  const shot = await call('Page.captureScreenshot', { format: 'png' }, s);
  await writeFile(join(folder, 'verified.png'), Buffer.from(shot.data, 'base64'));
  assert.deepEqual(browserErrors, [], 'No uncaught page errors or failed HTTP responses');
  await writeFile(join(folder, 'report.json'), JSON.stringify({ url, browser: browserVersion, maskCells, browserErrors, passedAt: new Date().toISOString() }, null, 2));
  console.log(`Artifacts: ${folder}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await call('Browser.close').catch(() => {}); socket.close(); }
  chrome.kill();
}
