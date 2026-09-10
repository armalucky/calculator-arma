import { MAP_EXTENT, type MapPoint } from '../../domain/coordinates.ts';

export interface Viewport { width: number; height: number }
export interface ScreenPoint { x: number; y: number }
export interface Camera { X: number; Z: number; scale: number }
export interface Tile { x: number; y: number }
export const initialCamera: Camera = { X: 5120, Z: 5120, scale: 0.08 };
export function screen(p: MapPoint, camera: Camera, size: Viewport): ScreenPoint {
  return { x: size.width / 2 + (p.X - camera.X) * camera.scale, y: size.height / 2 - (p.Z - camera.Z) * camera.scale };
}
export function world(p: ScreenPoint, camera: Camera, size: Viewport): MapPoint {
  return { X: camera.X + (p.x - size.width / 2) / camera.scale, Z: camera.Z - (p.y - size.height / 2) / camera.scale };
}
export function clampCamera(camera: Camera): Camera {
  return { ...camera, X: Math.max(-1024, Math.min(11264, camera.X)), Z: Math.max(-1024, Math.min(11264, camera.Z)) };
}
export function fitMap(size: Viewport): Camera {
  return { X: 5120, Z: 5120, scale: Math.max(0.02, Math.min(size.width, size.height) / MAP_EXTENT * 0.94) };
}
export function zoomAt(camera: Camera, size: Viewport, anchor: ScreenPoint, multiplier: number): Camera {
  const before = world(anchor, camera, size);
  const next = { ...camera, scale: Math.max(0.025, Math.min(5, camera.scale * multiplier)) };
  const after = world(anchor, next, size);
  return clampCamera({ ...next, X: next.X + before.X - after.X, Z: next.Z + before.Z - after.Z });
}
export function pan(camera: Camera, dx: number, dy: number): Camera {
  return clampCamera({ ...camera, X: camera.X - dx / camera.scale, Z: camera.Z + dy / camera.scale });
}
export function focusPoint(camera: Camera, p: MapPoint): Camera { return { X: p.X, Z: p.Z, scale: Math.max(0.6, camera.scale) }; }
export function frameAround(size: Viewport, target: MapPoint, radius: number): Camera {
  radius = Math.max(300, radius);
  const left = Math.max(0, target.X - radius), right = Math.min(MAP_EXTENT, target.X + radius);
  const bottom = Math.max(0, target.Z - radius), top = Math.min(MAP_EXTENT, target.Z + radius);
  return { X: (left + right) / 2, Z: (bottom + top) / 2, scale: Math.max(0.025, Math.min(size.width / (right - left + 200), size.height / (top - bottom + 200))) };
}
export function framePair(camera: Camera, size: Viewport, a: MapPoint | null, b: MapPoint | null): Camera {
  if (!a && !b) return fitMap(size);
  if (!a || !b) return focusPoint(camera, (a ?? b)!);
  return { X: (a.X + b.X) / 2, Z: (a.Z + b.Z) / 2, scale: Math.max(0.025, Math.min(3, Math.min((size.width - 100) / Math.max(300, Math.abs(a.X - b.X)), (size.height - 100) / Math.max(300, Math.abs(a.Z - b.Z))))) };
}
export function visibleTiles(camera: Camera, size: Viewport): Tile[] {
  if (camera.scale < 0.5) return [];
  const nw = world({ x: 0, y: 0 }, camera, size);
  const se = world({ x: size.width, y: size.height }, camera, size);
  const tiles: Tile[] = [];
  for (let y = Math.max(0, Math.floor((MAP_EXTENT - nw.Z) / 1024)); y <= Math.min(9, Math.floor((MAP_EXTENT - se.Z) / 1024)); y++) {
    for (let x = Math.max(0, Math.floor(nw.X / 1024)); x <= Math.min(9, Math.floor(se.X / 1024)); x++) tiles.push({ x, y });
  }
  return tiles;
}
