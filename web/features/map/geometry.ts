import { roadShape } from '../../domain/roads.ts';

export interface Bounds { minX: number; minZ: number; maxX: number; maxZ: number }
export interface Polygon { vertices: [number, number][]; bounds: Bounds }
export interface RoadGroup { polygons: Polygon[]; color: string; bounds: Bounds }
export interface MapGeometry { roads: RoadGroup[]; buildings: Polygon[]; roadCount: number }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function bounds(vertices: readonly (readonly number[])[]): Bounds {
  return { minX: Math.min(...vertices.map((v) => v[0])), maxX: Math.max(...vertices.map((v) => v[0])), minZ: Math.min(...vertices.map((v) => v[1])), maxZ: Math.max(...vertices.map((v) => v[1])) };
}
export function intersects(a: Bounds, b: Bounds): boolean { return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ; }
export function parseMapGeometry(roads: unknown, buildings: unknown): MapGeometry {
  if (!record(roads) || roads.schema !== 1 || !Array.isArray(roads.roads) || !record(buildings) || buildings.schema !== 1 || !Array.isArray(buildings.buildings)) throw new Error('Invalid map geometry');
  let count = 0;
  const groups = roads.roads.map((raw: unknown): RoadGroup => {
    if (!record(raw) || !Array.isArray(raw.quads)) throw new Error('Invalid road group');
    const polygons = raw.quads.map((quad: unknown): Polygon => {
      const shape = roadShape(quad);
      const vertices: [number, number][] = shape.Vertices.map((p) => [p[0], p[1]]);
      let winding = 0;
      for (let i = 0; i < 4; i++) winding += vertices[i][0] * vertices[(i + 1) % 4][1] - vertices[(i + 1) % 4][0] * vertices[i][1];
      if (winding < 0) vertices.reverse();
      count++;
      return { vertices, bounds: bounds(vertices) };
    });
    const colors: Record<number, string> = { 1: '#dbc857', 2: '#dcc078', 3: '#a88964', 5: '#a8997b' };
    return { polygons, color: typeof raw.type === 'number' ? colors[raw.type] ?? '#cab575' : '#cab575', bounds: {
      minX: Math.min(...polygons.map((p) => p.bounds.minX)), maxX: Math.max(...polygons.map((p) => p.bounds.maxX)),
      minZ: Math.min(...polygons.map((p) => p.bounds.minZ)), maxZ: Math.max(...polygons.map((p) => p.bounds.maxZ)),
    } };
  });
  const contours = buildings.buildings.map((raw: unknown): Polygon => {
    if (!record(raw) || !Array.isArray(raw.vertices) || raw.vertices.length < 3) throw new Error('Invalid building');
    const vertices = raw.vertices.map((p: unknown): [number, number] => {
      if (!Array.isArray(p) || p.length !== 2 || p.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 100000)) throw new Error('Invalid building vertex');
      return [p[0] as number, p[1] as number];
    });
    return { vertices, bounds: bounds(vertices) };
  });
  if (!count || !contours.length) throw new Error('Missing map geometry');
  return { roads: groups, buildings: contours, roadCount: count };
}
