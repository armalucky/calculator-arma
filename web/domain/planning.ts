import { distance, validPoint, type MapPoint } from './coordinates.ts';
import type { GameTable } from './game-tables.ts';
import type { RoadIndex } from './roads.ts';

export interface Site { id: string; name: string; x: number; z: number; source?: string }
export interface PlanningOptions { Reserve: number; RoadOffset: number; SiteOffset: number; Show: boolean }
export interface PositionAssessment {
  Distance: number; Reserve: number; RoadDistance: number; SiteDistance: number;
  RangeAllowed: boolean; RoadAllowed: boolean; SiteAllowed: boolean; Allowed: boolean;
}
export const MASK_SIZE = 512;
export const MASK_CELL_SIZE = 20;
export const MASK_RGBA = [45, 235, 174, 105] as const;
export interface CandidateMask {
  Size: 512; CellSize: 20; Cells: number;
  /** One byte per cell, 0/1, row-major from the north-west (same as C# Bitmap). */
  Occupancy: Uint8Array;
}

export function defaultPlanningOptions(): PlanningOptions { return { Reserve: 200, RoadOffset: 100, SiteOffset: 300, Show: false }; }

export function validPlanningOptions(value: unknown): value is PlanningOptions {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<PlanningOptions>;
  return typeof p.Reserve === 'number' && Number.isFinite(p.Reserve) && p.Reserve >= 0 && p.Reserve <= 3000
    && typeof p.RoadOffset === 'number' && Number.isFinite(p.RoadOffset) && p.RoadOffset >= 0 && p.RoadOffset <= 1000
    && typeof p.SiteOffset === 'number' && Number.isFinite(p.SiteOffset) && p.SiteOffset >= 0 && p.SiteOffset <= 2000
    && typeof p.Show === 'boolean';
}

export function parseSites(value: unknown): Site[] {
  if (!Array.isArray(value)) throw new Error('Invalid scenario points');
  const ids = new Set<string>();
  return value.map((item: unknown): Site => {
    if (typeof item !== 'object' || item === null) throw new Error('Invalid scenario point');
    const s = item as Partial<Site>;
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.name !== 'string' || !s.name.trim() || !validPoint({ X: s.x, Z: s.z }) || (s.source !== undefined && typeof s.source !== 'string')) throw new Error('Invalid scenario point');
    ids.add(s.id);
    return { id: s.id, name: s.name, x: s.x as number, z: s.z as number, source: s.source };
  });
}

export function nearestSite(point: MapPoint, sites: readonly Site[]): number {
  let nearest = Infinity;
  for (const site of sites) nearest = Math.min(nearest, distance(point, { X: site.x, Z: site.z }));
  return nearest;
}

export function assessPosition(table: GameTable | null, target: MapPoint, position: MapPoint, options: PlanningOptions, roads: RoadIndex, sites: readonly Site[]): PositionAssessment {
  if (!table || !validPoint(target) || !validPoint(position) || !validPlanningOptions(options)) throw new Error('Invalid planning input');
  const d = distance(target, position);
  const roadDistance = roads.distance(position);
  const siteDistance = nearestSite(position, sites);
  const rangeAllowed = d >= table.rows[0].distance && d <= table.rows[table.rows.length - 1].distance - options.Reserve;
  const roadAllowed = roadDistance > 0 && roadDistance >= options.RoadOffset;
  const siteAllowed = siteDistance > 0 && siteDistance >= options.SiteOffset;
  return {
    Distance: d, Reserve: table.rows[table.rows.length - 1].distance - d, RoadDistance: roadDistance, SiteDistance: siteDistance,
    RangeAllowed: rangeAllowed, RoadAllowed: roadAllowed, SiteAllowed: siteAllowed, Allowed: rangeAllowed && roadAllowed && siteAllowed,
  };
}

export function createCandidateMask(table: GameTable | null, target: MapPoint, options: PlanningOptions, roads: RoadIndex, sites: readonly Site[]): CandidateMask {
  if (!table || !validPoint(target) || !validPlanningOptions(options)) throw new Error('Invalid planning input');
  const mask: CandidateMask = { Size: MASK_SIZE, CellSize: MASK_CELL_SIZE, Cells: 0, Occupancy: new Uint8Array(MASK_SIZE * MASK_SIZE) };
  const step = MASK_CELL_SIZE;
  const margin = step / Math.sqrt(2);
  const inner = table.rows[0].distance + margin;
  const outer = table.rows[table.rows.length - 1].distance - options.Reserve - margin;
  if (outer < inner) return mask;
  const minX = Math.max(0, Math.floor((target.X - outer) / step));
  const maxX = Math.min(MASK_SIZE - 1, Math.floor((target.X + outer) / step));
  const minZ = Math.max(0, Math.floor((target.Z - outer) / step));
  const maxZ = Math.min(MASK_SIZE - 1, Math.floor((target.Z + outer) / step));
  for (let iz = minZ; iz <= maxZ; iz++) for (let ix = minX; ix <= maxX; ix++) {
    const p = { X: (ix + 0.5) * step, Z: (iz + 0.5) * step };
    const d = distance(target, p);
    if (d < inner || d > outer || nearestSite(p, sites) < options.SiteOffset + margin || roads.distance(p) < options.RoadOffset + margin) continue;
    mask.Occupancy[(MASK_SIZE - 1 - iz) * MASK_SIZE + ix] = 1;
    mask.Cells++;
  }
  return mask;
}
