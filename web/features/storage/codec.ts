import { validPoint, type MapPoint } from '../../domain/coordinates.ts';
import type { GameTable } from '../../domain/game-tables.ts';
import { defaultPlanningOptions, validPlanningOptions, type Site } from '../../domain/planning.ts';
import type { Fleet, Gun } from '../fleet/state.ts';

export const MAX_BYTES = 2_000_000;
export class SessionError extends Error {
  readonly code: 'invalid' | 'version' | 'size' | 'profile' | 'shared' | 'conflict';
  constructor(code: SessionError['code']) { super(code); this.code = code; }
}
type RecordValue = Record<string, unknown>;
const fail = (): never => { throw new SessionError('invalid'); };
function record(value: unknown): RecordValue { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : fail(); }
function keys(value: RecordValue, allowed: string[]): void { if (Object.keys(value).some((key) => !allowed.includes(key))) fail(); }
function name(value: unknown): string { return typeof value === 'string' && value.trim() ? value : fail(); }
function safeId(value: unknown): string { const id = name(value); return ['__proto__', 'constructor', 'prototype'].includes(id) ? fail() : id; }
function point(value: unknown): MapPoint | null {
  if (value == null) return null;
  const p = record(value); keys(p, ['X', 'Z']);
  return validPoint(p) ? { X: p.X as number, Z: p.Z as number } : fail();
}
function sharedNames(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(value)).map(([key, value]) => [safeId(key), name(value)]));
}
function bookmarks(value: unknown, originals: readonly Site[]): Site[] {
  if (!Array.isArray(value) || value.length > 1000) return fail();
  const ids = new Set(originals.map((s) => s.id));
  return value.map((raw: unknown) => {
    const s = record(raw); keys(s, ['id', 'name', 'x', 'z', 'source']);
    const id = safeId(s.id); if (ids.has(id)) fail(); ids.add(id);
    if (!validPoint({ X: s.x, Z: s.z }) || (s.source != null && typeof s.source !== 'string')) return fail();
    return { id, name: name(s.name), x: s.x as number, z: s.z as number, ...(s.source == null ? {} : { source: s.source as string }) };
  });
}
function parseGun(raw: unknown, id: number, tables: readonly GameTable[], originals: readonly Site[]) {
  const s = record(raw);
  keys(s, ['Version', 'Position', 'Target', 'Names', 'Bookmarks', 'TableId', 'WeaponId', 'M777TableId', 'NamingVersion', 'Planning']);
  if (s.Version !== 1) throw new SessionError('version');
  const weapon = s.WeaponId == null || s.WeaponId === '' ? 'mortar82' : s.WeaponId;
  if (weapon !== 'mortar82' && weapon !== 'm777') throw new SessionError('profile');
  const profile = (value: unknown, fallback: string, kind: string) => {
    const id = value == null || value === '' ? fallback : value;
    if (!tables.some((t) => t.weapon === kind && t.id === id)) throw new SessionError('profile');
    return id as string;
  };
  const planning = s.Planning === undefined ? defaultPlanningOptions() : record(s.Planning);
  keys(planning as unknown as RecordValue, ['Reserve', 'RoadOffset', 'SiteOffset', 'Show']);
  if (!validPlanningOptions(planning)) return fail();
  const names = sharedNames(s.Names), saved = bookmarks(s.Bookmarks, originals);
  const naming = s.NamingVersion ?? 0;
  if (typeof naming !== 'number' || !Number.isInteger(naming) || naming < 0 || naming > 2) throw new SessionError('version');
  // Match SiteNames.ApplyScenarioNames exactly; subsequent custom names remain intact.
  if (naming < 2) for (const site of originals) names[site.id] = site.name;
  const gun: Gun = { id, position: point(s.Position), target: point(s.Target), weapon,
    tableId: profile(s.TableId, 'he4', 'mortar82'), m777TableId: profile(s.M777TableId, 'm777-2-low', 'm777'), planning: { ...planning } };
  return { gun, names, bookmarks: saved };
}
export function parseDesktop(value: unknown, tables: readonly GameTable[], originals: readonly Site[]): Fleet {
  const root = record(value);
  if (root.Version !== 1) throw new SessionError('version');
  const isFleet = Object.hasOwn(root, 'Guns');
  if (isFleet) keys(root, ['Version', 'ActiveId', 'Guns']);
  const slots = isFleet ? root.Guns : [{ Id: 1, Data: root }];
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > 6) return fail();
  const ids = new Set<number>();
  const parsed = slots.map((raw: unknown) => {
    const slot = record(raw); keys(slot, ['Id', 'Data']);
    const id = slot.Id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 6 || ids.has(id)) return fail();
    ids.add(id); return parseGun(slot.Data, id, tables, originals);
  });
  const activeId = isFleet ? root.ActiveId : 1;
  if (typeof activeId !== 'number' || !ids.has(activeId)) return fail();
  const shared = parsed.find((s) => s.gun.id === activeId)!;
  const orderedNames = (names: Record<string, string>) => JSON.stringify(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)));
  if (parsed.some((s) => orderedNames(s.names) !== orderedNames(shared.names) || JSON.stringify(s.bookmarks) !== JSON.stringify(shared.bookmarks))) throw new SessionError('shared');
  return { activeId, guns: parsed.map((s) => s.gun), names: shared.names, bookmarks: shared.bookmarks };
}
export function desktopValue(fleet: Fleet) {
  return { Version: 1, ActiveId: fleet.activeId, Guns: fleet.guns.map((g) => ({ Id: g.id, Data: {
    Version: 1, Position: g.position, Target: g.target, Names: fleet.names, Bookmarks: fleet.bookmarks,
    TableId: g.tableId, WeaponId: g.weapon, M777TableId: g.m777TableId, NamingVersion: 2, Planning: g.planning,
  } })) };
}
export function exportSession(fleet: Fleet): string {
  const text = JSON.stringify(desktopValue(fleet));
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new SessionError('size');
  return text;
}
export function importSession(text: string, tables: readonly GameTable[], originals: readonly Site[]): Fleet {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new SessionError('size');
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { return fail(); }
  return parseDesktop(value, tables, originals);
}

export interface StoredRecord { schema: 1; revision: string; session: unknown; savedAt: string }
export function readRecord(value: unknown, tables: readonly GameTable[], sites: readonly Site[]) {
  const raw = record(value);
  // Version 0 is the migration input: same desktop payload under `payload`.
  if ((raw.schema !== 1 && raw.schema !== 0) || typeof raw.revision !== 'string' || !raw.revision) throw new SessionError('version');
  const session = raw.schema === 0 ? raw.payload : raw.session;
  const fleet = parseDesktop(session, tables, sites);
  exportSession(fleet);
  return { fleet, migrated: raw.schema === 0 };
}
