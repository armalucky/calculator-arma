import type { GameTable } from '../../domain/game-tables.ts';
import type { Site } from '../../domain/planning.ts';
import { fleetReducer, newFleet, type Fleet, type FleetAction } from '../fleet/state.ts';
import { desktopValue, exportSession, readRecord, SessionError, type StoredRecord } from './codec.ts';
import { openRepository, type Repository } from './database.ts';

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error' | 'conflict' | 'recovery';
export interface SessionSnapshot { fleet: Fleet; status: SaveStatus; epoch: number; backup: Fleet | null; raw: unknown; errorCode?: string }
export class SessionStore {
  private snapshot: SessionSnapshot = { fleet: newFleet(), status: 'loading', epoch: 0, backup: null, raw: null };
  private listeners = new Set<() => void>();
  private repository: Repository | null = null;
  private baseline: unknown;
  private savedFleet: Fleet | null = null;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private channel: BroadcastChannel | null = null;
  private tables: readonly GameTable[];
  private sites: readonly Site[];
  private connect: () => Promise<Repository>;
  constructor(tables: readonly GameTable[], sites: readonly Site[], connect = openRepository) { this.tables = tables; this.sites = sites; this.connect = connect; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SessionSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  private error(cause: unknown) { this.update({ status: cause instanceof SessionError && cause.code === 'conflict' ? 'conflict' : 'error', errorCode: cause instanceof SessionError ? cause.code : undefined }); }
  async start() {
    const generation = ++this.generation;
    try {
      const repository = await this.connect();
      if (generation !== this.generation) { repository.close(); return; }
      this.repository = repository;
      await this.load(generation);
      if (generation !== this.generation) return;
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('luckymap.web.sessions');
        this.channel.onmessage = () => { void this.checkRemote(); };
      }
    } catch (cause) { if (generation === this.generation) this.error(cause); }
  }
  stop() { ++this.generation; this.channel?.close(); this.channel = null; this.repository?.close(); this.repository = null; }
  private async load(generation: number) {
    const data = await this.repository!.read();
    if (generation !== this.generation) return;
    this.baseline = data.current;
    let backup: Fleet | null = null;
    try { if (data.previous !== undefined) backup = readRecord(data.previous, this.tables, this.sites).fleet; } catch { /* Keep the raw record for recovery download. */ }
    if (data.current === undefined) {
      const fleet = newFleet(); this.savedFleet = null;
      this.update({ fleet, status: 'saving', epoch: this.snapshot.epoch + 1, backup, raw: data, errorCode: undefined }); void this.save(); return;
    }
    try {
      const { fleet, migrated } = readRecord(data.current, this.tables, this.sites);
      this.savedFleet = migrated ? null : fleet;
      this.update({ fleet, status: migrated ? 'saving' : 'saved', epoch: this.snapshot.epoch + 1, backup, raw: data, errorCode: undefined });
      if (migrated) void this.save();
    } catch (cause) { this.update({ status: 'recovery', backup, raw: data, errorCode: cause instanceof SessionError ? cause.code : undefined }); }
  }
  dispatch = (action: FleetAction) => {
    if (this.snapshot.status === 'loading' || this.snapshot.status === 'recovery') return;
    const fleet = fleetReducer(this.snapshot.fleet, action);
    if (fleet === this.snapshot.fleet) return;
    this.update({ fleet });
    if (this.snapshot.status !== 'conflict') void this.save();
  };
  async save(): Promise<void> {
    if (this.pending) { await this.pending; return; }
    if (['conflict', 'recovery', 'loading'].includes(this.snapshot.status)) return;
    const generation = this.generation;
    this.pending = this.drain(generation);
    try { await this.pending; } finally {
      this.pending = null;
      if (generation === this.generation && this.savedFleet !== this.snapshot.fleet && this.snapshot.status === 'saved') void this.save();
    }
  }
  private record(fleet: Fleet): StoredRecord {
    exportSession(fleet); // Bound the actual compatible JSON, including duplicated shared fields.
    return { schema: 1, revision: crypto.randomUUID(), savedAt: new Date().toISOString(), session: desktopValue(fleet) };
  }
  private async drain(generation: number) {
    try {
      if (!this.repository) throw new Error('Storage unavailable');
      while (this.savedFleet !== this.snapshot.fleet && generation === this.generation && this.snapshot.status !== 'conflict') {
        const fleet = this.snapshot.fleet, next = this.record(fleet);
        this.update({ status: 'saving', errorCode: undefined });
        await this.repository.commit(next, this.baseline, true);
        if (generation !== this.generation) return;
        this.baseline = next; this.savedFleet = fleet;
        this.channel?.postMessage(next.revision);
      }
      if (generation === this.generation && this.snapshot.status !== 'conflict') this.update({ status: 'saved', errorCode: undefined });
    } catch (cause) { if (generation === this.generation) this.error(cause); }
  }
  async checkRemote() {
    if (!this.repository || ['loading', 'recovery', 'conflict'].includes(this.snapshot.status)) return;
    // A local commit may be in progress; compare after it establishes its baseline.
    if (this.pending) await this.pending;
    try {
      const data = await this.repository.read();
      if (JSON.stringify(data.current) !== JSON.stringify(this.baseline)) this.update({ status: 'conflict' });
    } catch (cause) { this.error(cause); }
  }
  async retry() {
    try {
      if (!this.repository) this.repository = await this.connect();
      await this.checkRemote();
      if (this.snapshot.status !== 'conflict') await this.save();
    } catch (cause) { this.error(cause); }
  }
  async reload() {
    if (this.pending) await this.pending;
    try { if (!this.repository) this.repository = await this.connect(); await this.load(this.generation); }
    catch (cause) { this.error(cause); }
  }
  async replace(fleet: Fleet, recovery = false): Promise<boolean> {
    if (!recovery) {
      await this.save();
      if (this.snapshot.status !== 'saved') return false;
    }
    try {
      if (!this.repository) throw new Error('Storage unavailable');
      const next = this.record(fleet);
      await this.repository.commit(next, this.baseline, !recovery);
      this.baseline = next; this.savedFleet = fleet;
      this.update({ fleet, status: 'saved', epoch: this.snapshot.epoch + 1, errorCode: undefined });
      this.channel?.postMessage(next.revision); return true;
    } catch (cause) { if (recovery && !(cause instanceof SessionError && cause.code === 'conflict')) this.update({ status: 'recovery', errorCode: 'write' }); else this.error(cause); return false; }
  }
}
