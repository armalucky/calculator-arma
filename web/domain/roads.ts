import { validPoint, type MapPoint } from './coordinates.ts';

type Vertex = readonly [number, number];
export interface RoadShape {
  Vertices: readonly Vertex[];
  MinX: number; MaxX: number; MinZ: number; MaxZ: number;
}
interface RoadNode {
  MinX: number; MaxX: number; MinZ: number; MaxZ: number;
  Shapes?: RoadShape[]; Left?: RoadNode; Right?: RoadNode;
}

export function roadShape(vertices: unknown): RoadShape {
  if (!Array.isArray(vertices) || vertices.length !== 4 || vertices.some((v: unknown) => !Array.isArray(v) || v.length !== 2 || v.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 100000))) throw new Error('Invalid road polygon');
  const copied = (vertices as number[][]).map((v): Vertex => [v[0], v[1]]);
  return { Vertices: copied, MinX: Math.min(...copied.map((v) => v[0])), MaxX: Math.max(...copied.map((v) => v[0])), MinZ: Math.min(...copied.map((v) => v[1])), MaxZ: Math.max(...copied.map((v) => v[1])) };
}

export function roadDistanceSquared(shape: RoadShape, x: number, z: number): number {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [ax, az] = shape.Vertices[j];
    const [bx, bz] = shape.Vertices[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length));
    const ex = x - ax - t * dx;
    const ez = z - az - t * dz;
    best = Math.min(best, ex * ex + ez * ez);
  }
  return inside ? 0 : best;
}

function build(shapes: RoadShape[]): RoadNode {
  const node: RoadNode = { MinX: Infinity, MaxX: -Infinity, MinZ: Infinity, MaxZ: -Infinity };
  for (const shape of shapes) {
    node.MinX = Math.min(node.MinX, shape.MinX); node.MaxX = Math.max(node.MaxX, shape.MaxX);
    node.MinZ = Math.min(node.MinZ, shape.MinZ); node.MaxZ = Math.max(node.MaxZ, shape.MaxZ);
  }
  if (shapes.length <= 8) node.Shapes = shapes;
  else {
    const byX = node.MaxX - node.MinX >= node.MaxZ - node.MinZ;
    shapes.sort((a, b) => byX ? a.MinX + a.MaxX - (b.MinX + b.MaxX) : a.MinZ + a.MaxZ - (b.MinZ + b.MaxZ));
    const half = Math.floor(shapes.length / 2);
    node.Left = build(shapes.slice(0, half)); node.Right = build(shapes.slice(half));
  }
  return node;
}

function lowerBound(node: RoadNode, x: number, z: number): number {
  const dx = Math.max(0, Math.max(node.MinX - x, x - node.MaxX));
  const dz = Math.max(0, Math.max(node.MinZ - z, z - node.MaxZ));
  return dx * dx + dz * dz;
}

function find(node: RoadNode, x: number, z: number, initial: number): number {
  let best = initial;
  if (lowerBound(node, x, z) > best) return best;
  if (node.Shapes) {
    for (const shape of node.Shapes) { best = Math.min(best, roadDistanceSquared(shape, x, z)); if (best === 0) break; }
    return best;
  }
  let first = node.Left!;
  let second = node.Right!;
  if (lowerBound(first, x, z) > lowerBound(second, x, z)) [first, second] = [second, first];
  best = find(first, x, z, best);
  return best === 0 ? 0 : find(second, x, z, best);
}

/** Same nearest-polygon BVH strategy as the desktop RoadIndex. */
export class RoadIndex {
  readonly Count: number;
  private readonly root: RoadNode;
  constructor(shapes: readonly RoadShape[]) {
    if (shapes.length === 0) throw new Error('No road geometry');
    this.Count = shapes.length;
    // Copy geometry: mutations of input data must not invalidate the BVH bounds.
    this.root = build(shapes.map((shape) => roadShape(shape.Vertices)));
  }
  distance(point: MapPoint): number {
    if (!validPoint(point)) throw new Error('Invalid map point');
    return Math.sqrt(find(this.root, point.X, point.Z, Infinity));
  }
}

export function parseRoadIndex(value: unknown): RoadIndex {
  if (typeof value !== 'object' || value === null || !('schema' in value) || value.schema !== 1 || !('roads' in value) || !Array.isArray(value.roads)) throw new Error('Invalid road data');
  const shapes: RoadShape[] = [];
  for (const road of value.roads as unknown[]) {
    if (typeof road !== 'object' || road === null || !('quads' in road) || !Array.isArray(road.quads)) throw new Error('Invalid road data');
    for (const quad of road.quads) shapes.push(roadShape(quad));
  }
  return new RoadIndex(shapes);
}
