import { distance, validPoint, type MapPoint } from './coordinates.ts';

export type WeaponId = 'mortar82' | 'm777';
export type Trajectory = 'high' | 'low';
export interface GameRow { distance: number; elevation: number; seconds: number; source?: string | null }
export interface GameTable {
  id: string; shell: string; rings: number; source: string; rows: GameRow[];
  weapon: WeaponId; trajectory: Trajectory; unitsPerCircle: 6000 | 6400;
}
export type SolutionReason = 'missing-points' | 'coincident-points' | 'missing-table' | 'out-of-range' | null;
export interface GameSolution {
  Available: boolean; Message: string | null; Reason: SolutionReason;
  Distance: number; AzimuthDegrees: number; AzimuthUnits: number;
  Elevation: number; ElevationUnits: number; ElevationDegrees: number;
  Seconds: number; LowerDistance: number; UpperDistance: number;
  UnitsPerCircle: number; Source: string | null;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

/** Validate untrusted JSON and apply the constructor defaults of GameTable in C#. */
export function parseGameTables(value: unknown): GameTable[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('No game tables');
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!object(item) || !text(item.id) || ids.has(item.id) || !text(item.shell) || !text(item.source) || !Array.isArray(item.rows) || item.rows.length < 2) throw new Error('Invalid game table');
    ids.add(item.id);
    const id = item.id;
    const weapon = item.weapon === undefined ? 'mortar82' : item.weapon;
    const trajectory = item.trajectory === undefined ? 'high' : item.trajectory;
    const units = item.unitsPerCircle === undefined ? 6000 : item.unitsPerCircle;
    const rings = item.rings === undefined ? 0 : item.rings;
    if (typeof rings !== 'number' || !Number.isInteger(rings)) throw new Error('Invalid charge');
    if (weapon === 'mortar82') {
      if (units !== 6000 || rings < 0 || rings > 4 || trajectory !== 'high') throw new Error('Invalid mortar profile');
    } else if (weapon === 'm777') {
      if (units !== 6400 || rings < 1 || rings > 5 || (trajectory !== 'high' && trajectory !== 'low')) throw new Error('Invalid M777 profile');
    } else throw new Error('Unknown weapon profile');
    let previous = -1;
    const rows = item.rows.map((row: unknown): GameRow => {
      if (!object(row) || typeof row.distance !== 'number' || !Number.isFinite(row.distance) || row.distance <= previous || row.distance <= 0
        || typeof row.elevation !== 'number' || !Number.isFinite(row.elevation) || row.elevation <= 0 || row.elevation >= (units as number) / 4
        || typeof row.seconds !== 'number' || !Number.isFinite(row.seconds) || row.seconds <= 0
        || (row.source != null && typeof row.source !== 'string')) throw new Error(`Invalid game table row: ${id}`);
      previous = row.distance;
      return { distance: row.distance, elevation: row.elevation, seconds: row.seconds, source: row.source as string | null | undefined };
    });
    return { id: item.id, shell: item.shell, source: item.source, rings, weapon, trajectory: trajectory as Trajectory, unitsPerCircle: units as 6000 | 6400, rows };
  });
}

/** Reproduce the existing LuckyUI M116 game profiles without changing base tables. */
export function createLuckyTables(mortarData: unknown, m777Data: unknown): GameTable[] {
  const base = [...parseGameTables(mortarData), ...parseGameTables(m777Data)];
  const smoke = base.filter((t) => t.weapon === 'm777' && t.shell === 'M107 HE').map((t) => ({
    ...t, id: `${t.id}-smoke`, shell: 'M116 SMOKE', rows: t.rows.map((row) => ({ ...row })),
  }));
  const all = [...base, ...smoke];
  if (new Set(all.map((t) => t.id)).size !== all.length) throw new Error('Duplicate game profile ID');
  return all;
}

export function roundAwayFromZero(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** Interpolation of supplied Arma game tables only; no new physical model. */
export function calculate(table: GameTable | null, position: MapPoint | null, target: MapPoint | null): GameSolution {
  const result: GameSolution = {
    Available: false, Message: null, Reason: null, Distance: 0, AzimuthDegrees: 0, AzimuthUnits: 0,
    Elevation: 0, ElevationUnits: 0, ElevationDegrees: 0, Seconds: 0, LowerDistance: 0, UpperDistance: 0,
    UnitsPerCircle: table?.unitsPerCircle ?? 6000, Source: null,
  };
  if (!validPoint(position) || !validPoint(target)) return { ...result, Reason: 'missing-points', Message: 'Выберите позицию и цель на карте.' };
  result.Distance = distance(position, target);
  if (result.Distance < 0.001) return { ...result, Reason: 'coincident-points', Message: 'Позиция и цель совпадают; азимут не определён.' };
  result.AzimuthDegrees = (Math.atan2(target.X - position.X, target.Z - position.Z) * 180 / Math.PI + 360) % 360;
  result.AzimuthUnits = roundAwayFromZero(result.AzimuthDegrees * result.UnitsPerCircle / 360) % result.UnitsPerCircle;
  if (table === null) return { ...result, Reason: 'missing-table', Message: 'Выберите игровую таблицу.' };
  const first = table.rows[0];
  const last = table.rows[table.rows.length - 1];
  if (result.Distance < first.distance - 1e-7 || result.Distance > last.distance + 1e-7) return {
    ...result, Reason: 'out-of-range', Message: `Вне выбранной таблицы: ${first.distance}–${last.distance} м. Измените заряд, траекторию или позицию.`,
  };
  let lower = first;
  let upper = last;
  const sampleDistance = Math.max(first.distance, Math.min(last.distance, result.Distance));
  for (const row of table.rows) {
    if (row.distance <= sampleDistance) lower = row;
    if (row.distance >= sampleDistance) { upper = row; break; }
  }
  const ratio = upper.distance === lower.distance ? 0 : (sampleDistance - lower.distance) / (upper.distance - lower.distance);
  result.Elevation = lower.elevation + (upper.elevation - lower.elevation) * ratio;
  result.Seconds = lower.seconds + (upper.seconds - lower.seconds) * ratio;
  result.LowerDistance = lower.distance;
  result.UpperDistance = upper.distance;
  result.Source = [...new Set([lower.source ?? table.source, upper.source ?? table.source])].join(' | ');
  result.ElevationUnits = roundAwayFromZero(result.Elevation);
  result.ElevationDegrees = result.ElevationUnits * 360 / result.UnitsPerCircle;
  result.Available = true;
  return result;
}
