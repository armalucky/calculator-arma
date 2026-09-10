import { SessionError, type StoredRecord } from './codec.ts';
export const DATABASE_NAME = 'luckymap.web.sessions';
export const STORE_NAME = 'records';
export interface Repository {
  read(): Promise<{ current: unknown; previous: unknown; recovery: unknown }>;
  commit(next: StoredRecord, expected: unknown, preserveValid: boolean): Promise<void>;
  close(): void;
}
export function openRepository(): Promise<Repository> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Database upgrade blocked')); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve({
        close: () => db.close(),
        read: () => new Promise((done, fail) => {
          const tx = db.transaction(STORE_NAME, 'readonly'), store = tx.objectStore(STORE_NAME);
          const current = store.get('current'), previous = store.get('previous'), recovery = store.get('recovery');
          tx.oncomplete = () => done({ current: current.result, previous: previous.result, recovery: recovery.result });
          tx.onabort = () => fail(tx.error); tx.onerror = () => fail(tx.error);
        }),
        commit: (next, expected, preserveValid) => new Promise((done, fail) => {
          const tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
          let conflict = false;
          let writeError: unknown;
          const get = store.get('current');
          get.onsuccess = () => {
            try {
            // Compare and replace in one serialized transaction, even without BroadcastChannel.
            if (JSON.stringify(get.result) !== JSON.stringify(expected)) { conflict = true; tx.abort(); return; }
            if (get.result !== undefined) store.put(get.result, preserveValid ? 'previous' : 'recovery');
            store.put(next, 'current');
            } catch (cause) { writeError = cause; tx.abort(); }
          };
          tx.oncomplete = () => done();
          tx.onabort = () => fail(conflict ? new SessionError('conflict') : writeError ?? tx.error ?? new Error('Write aborted'));
          tx.onerror = () => { /* onabort reports the transaction outcome. */ };
        }),
      });
    };
  });
}
