import { useEffect, useRef, useState } from 'react';
import type { GameTable } from '../../domain/game-tables.ts';
import type { Site } from '../../domain/planning.ts';
import { newFleet, type Fleet } from '../fleet/state.ts';
import { Dialog } from '../fleet/Dialog.tsx';
import { exportSession, importSession, MAX_BYTES, SessionError } from './codec.ts';
import { storageMessages } from './messages.ts';
import type { SessionSnapshot, SessionStore } from './session-store.ts';

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  // Allow the browser/download manager to consume the Blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
type Pending = { type: 'import'; fleet: Fleet; filename: string } | { type: 'reload' | 'reset' | 'restore' };
export function StoragePanel({ store, snapshot, tables, sites, language }: { store: SessionStore; snapshot: SessionSnapshot; tables: GameTable[]; sites: Site[]; language: 'ru' | 'en' }) {
  const text = storageMessages[language];
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const recovery = snapshot.status === 'recovery';
  const writable = !['loading', 'recovery', 'conflict'].includes(snapshot.status);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); if (!document.querySelector('dialog[open]')) void store.retry();
      }
    };
    const focus = () => { void store.checkRemote(); };
    window.addEventListener('keydown', key); window.addEventListener('focus', focus);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('focus', focus); };
  }, [store]);
  const exportCurrent = () => { try { download(exportSession(snapshot.fleet), 'lucky-session.json'); setError(null); } catch (cause) { setError(cause instanceof SessionError ? cause.code : 'read'); } };
  return <section className="storage-panel" aria-label={text.save}>
    <div className="storage-actions">
      {!recovery ? <><button disabled={!writable || working} title={text.saveHint} onClick={() => { void store.retry(); }}>{text.save}</button><button onClick={exportCurrent}>{text.export}</button>
        <button disabled={!writable || working} onClick={() => input.current?.click()}>{text.import}</button></> : <>
        <button onClick={() => { try { download(JSON.stringify(snapshot.raw), 'luckymap-recovery.json'); } catch { setError('read'); } }}>{text.raw}</button>
        <button disabled={!snapshot.backup} onClick={() => setPending({ type: 'restore' })}>{text.restore}</button><button onClick={() => setPending({ type: 'reset' })}>{text.reset}</button>
      </>}
      {snapshot.status === 'error' ? <button onClick={() => { void store.retry(); }}>{text.retry}</button> : null}
      {snapshot.status === 'conflict' ? <button onClick={() => setPending({ type: 'reload' })}>{text.reload}</button> : null}
      {recovery ? <button onClick={() => { void store.reload(); }}>{text.retry}</button> : null}
      <input ref={input} type="file" className="visually-hidden" tabIndex={-1} accept=".json,application/json" aria-label={text.import} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        setError(null);
        if (file.size > MAX_BYTES) { setError('size'); return; }
        void file.text().then((value) => { try { setPending({ type: 'import', fleet: importSession(value, tables, sites), filename: file.name }); } catch (cause) { setError(cause instanceof SessionError ? cause.code : 'invalid'); } }, () => setError('read'));
      }} />
    </div>
    <output className={`save-status ${snapshot.status}`} data-save-status={snapshot.status}>{text[snapshot.status]}{snapshot.errorCode === 'size' ? ` ${text.size}` : ''}</output>
    {error ? <p role="alert" className="field-error">{text[error as keyof typeof text] ?? text.read}</p> : null}
    {pending ? <Dialog title={pending.type === 'import' ? text.confirmImport : pending.type === 'reload' ? text.confirmReload : pending.type === 'restore' ? text.confirmRestore : text.confirmReset} onClose={() => { if (!working) setPending(null); }}>
      {pending.type === 'import' ? <><p>{text.file}: {pending.filename}</p><p>{text.guns}: {pending.fleet.guns.length} · {text.bookmarks}: {pending.fleet.bookmarks.length} · {text.active}: {pending.fleet.activeId}</p>
        <ul>{pending.fleet.guns.map((g) => <li key={g.id}>A{g.id} · {g.weapon} · {g.weapon === 'm777' ? g.m777TableId : g.tableId} · A: {g.position ? `${g.position.X} / ${g.position.Z}` : '—'} · B: {g.target ? `${g.target.X} / ${g.target.Z}` : '—'}</li>)}</ul></> : null}
      {['error', 'conflict', 'recovery'].includes(snapshot.status) ? <p className="field-error">{text[snapshot.status]}</p> : null}
      <div className="dialog-actions"><button disabled={working} onClick={() => setPending(null)}>{text.cancel}</button><button disabled={working} onClick={() => {
        setWorking(true);
        void (async () => {
          try {
            if (pending.type === 'reload') { await store.reload(); setPending(null); }
            else if (await store.replace(pending.type === 'import' ? pending.fleet : pending.type === 'restore' ? snapshot.backup! : newFleet(), pending.type !== 'import')) setPending(null);
          } finally { setWorking(false); }
        })();
      }}>{working ? text.working : text.confirm}</button></div>
    </Dialog> : null}
  </section>;
}
