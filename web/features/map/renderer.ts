import { grid, MAP_EXTENT, type MapPoint } from '../../domain/coordinates.ts';
import { MASK_RGBA, type CandidateMask, type Site } from '../../domain/planning.ts';
import { resourceUrl, tileKey } from '../resources/catalog.ts';
import { loadBitmap, type MapAssets } from './assets.ts';
import { screen, visibleTiles, world, type Camera, type Viewport } from './camera.ts';
import { intersects, type Bounds, type Polygon } from './geometry.ts';
import { TileCache } from './tile-cache.ts';

export interface MapLayers { roads: boolean; buildings: boolean; grid: boolean; names: boolean }
export interface GunMarker { id: number; point: MapPoint }
export interface MapScene {
  position: MapPoint | null; target: MapPoint | null; markers: readonly GunMarker[];
  activeId: number; layers: MapLayers; mask?: CandidateMask | null; sites?: readonly Site[];
}
interface CachedPath { path: Path2D; bounds: Bounds }
function pathFor(polygons: readonly Polygon[]): Path2D {
  const path = new Path2D();
  for (const polygon of polygons) {
    polygon.vertices.forEach(([x, z], i) => { if (i === 0) path.moveTo(x, z); else path.lineTo(x, z); });
    path.closePath();
  }
  return path;
}

export class MapRenderer {
  readonly tiles: TileCache<ImageBitmap>;
  private readonly assets: MapAssets;
  private readonly roads: (CachedPath & { color: string })[];
  private readonly buildings: CachedPath[];
  private mask: CandidateMask | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  constructor(assets: MapAssets, changed: () => void) {
    this.assets = assets;
    this.roads = assets.geometry.roads.map((road) => ({ path: pathFor(road.polygons), bounds: road.bounds, color: road.color }));
    this.buildings = assets.geometry.buildings.map((b) => ({ path: pathFor([b]), bounds: b.bounds }));
    this.tiles = new TileCache(async (key, signal) => {
      const bitmap = await loadBitmap(resourceUrl(assets.catalog, key, assets.base), signal);
      if (bitmap.width !== 1026 || bitmap.height !== 1026) { bitmap.close(); throw new Error('Invalid map tile size'); }
      return bitmap;
    }, changed);
  }
  dispose(): void { this.tiles.dispose(); this.maskCanvas = null; }
  draw(ctx: CanvasRenderingContext2D, camera: Camera, size: Viewport, scene: MapScene, language: 'ru' | 'en'): void {
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#151b1b'; ctx.fillRect(0, 0, size.width, size.height);
    const nw = screen({ X: 0, Z: MAP_EXTENT }, camera, size);
    const extent = MAP_EXTENT * camera.scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.assets.background, nw.x, nw.y, extent, extent);
    const visible = visibleTiles(camera, size);
    // Prioritise central tiles when the viewport exceeds the memory budget.
    const priority = [...visible].sort((a, b) => {
      const d = (t: { x: number; y: number }) => ((t.x + 0.5) * 1024 - camera.X) ** 2 + (MAP_EXTENT - (t.y + 0.5) * 1024 - camera.Z) ** 2;
      return d(a) - d(b);
    });
    this.tiles.setWanted(priority.map((tile) => tileKey(tile.x, tile.y)));
    for (const tile of visible) {
      const bitmap = this.tiles.get(tileKey(tile.x, tile.y));
      if (!bitmap) continue;
      const corner = screen({ X: tile.x * 1024, Z: MAP_EXTENT - tile.y * 1024 }, camera, size);
      ctx.drawImage(bitmap, 1, 1, 1024, 1024, corner.x, corner.y, 1024 * camera.scale, 1024 * camera.scale);
    }
    const viewNW = world({ x: 0, y: 0 }, camera, size);
    const viewSE = world({ x: size.width, y: size.height }, camera, size);
    const view = { minX: viewNW.X, maxX: viewSE.X, minZ: viewSE.Z, maxZ: viewNW.Z };
    ctx.save();
    ctx.beginPath(); ctx.rect(nw.x, nw.y, extent, extent); ctx.clip();
    ctx.translate(size.width / 2 - camera.X * camera.scale, size.height / 2 + camera.Z * camera.scale);
    ctx.scale(camera.scale, -camera.scale);
    if (scene.layers.roads) for (const road of this.roads) if (intersects(road.bounds, view)) { ctx.fillStyle = road.color; ctx.fill(road.path, 'nonzero'); }
    if (scene.layers.buildings && camera.scale >= 0.3) {
      ctx.fillStyle = '#b6bcb2'; ctx.strokeStyle = '#414941'; ctx.lineWidth = 0.8 / camera.scale;
      for (const building of this.buildings) if (intersects(building.bounds, view)) { ctx.fill(building.path); ctx.stroke(building.path); }
    }
    ctx.restore();
    if (scene.mask) {
      if (scene.mask !== this.mask) {
        this.mask = scene.mask;
        this.maskCanvas = document.createElement('canvas'); this.maskCanvas.width = 512; this.maskCanvas.height = 512;
        const maskContext = this.maskCanvas.getContext('2d')!;
        const image = maskContext.createImageData(512, 512);
        for (let i = 0; i < scene.mask.Occupancy.length; i++) if (scene.mask.Occupancy[i]) image.data.set(MASK_RGBA, i * 4);
        maskContext.putImageData(image, 0, 0);
      }
      if (this.maskCanvas) { ctx.imageSmoothingEnabled = false; ctx.drawImage(this.maskCanvas, nw.x, nw.y, extent, extent); ctx.imageSmoothingEnabled = true; }
    }
    ctx.font = '14px "Segoe UI", sans-serif'; ctx.textBaseline = 'top';
    const label = (text: string, x: number, y: number, color = '#efede1') => {
      const width = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(17,24,24,0.88)'; ctx.fillRect(x - 3, y - 2, width + 6, 20);
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    };
    if (scene.layers.grid) {
      const cell = camera.scale >= 0.65 ? 100 : camera.scale >= 0.2 ? 500 : 1000;
      ctx.strokeStyle = 'rgba(215,219,193,0.35)'; ctx.lineWidth = 1;
      for (let x = Math.max(0, Math.ceil(viewNW.X / cell) * cell); x <= Math.min(MAP_EXTENT, viewSE.X); x += cell) {
        const at = screen({ X: x, Z: 0 }, camera, size).x;
        ctx.beginPath(); ctx.moveTo(at, Math.max(0, nw.y)); ctx.lineTo(at, Math.min(size.height, nw.y + extent)); ctx.stroke();
        label((x / 100).toString().padStart(3, '0'), at + 3, 5);
      }
      for (let z = Math.max(0, Math.ceil(viewSE.Z / cell) * cell); z <= Math.min(MAP_EXTENT, viewNW.Z); z += cell) {
        const at = screen({ X: 0, Z: z }, camera, size).y;
        ctx.beginPath(); ctx.moveTo(Math.max(0, nw.x), at); ctx.lineTo(Math.min(size.width, nw.x + extent), at); ctx.stroke();
        label((z / 100).toString().padStart(3, '0'), 5, at + 3);
      }
    }
    if (scene.layers.names) for (const site of scene.sites ?? this.assets.sites) {
      const p = screen({ X: site.x, Z: site.z }, camera, size);
      if (p.x < -100 || p.y < -30 || p.x > size.width || p.y > size.height) continue;
      ctx.fillStyle = '#ff7f50'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); label(site.name, p.x + 7, p.y - 8);
    }
    if (scene.position && scene.target) {
      const a = screen(scene.position, camera, size); const b = screen(scene.target, camera, size);
      ctx.strokeStyle = '#dcf3f0'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    }
    const marker = (point: MapPoint | null, caption: string, color: string) => {
      if (!point) return;
      const p = screen(point, camera, size);
      if (p.x < -10 || p.y < -10 || p.x > size.width + 10 || p.y > size.height + 10) return;
      ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const text = `${caption}  ${grid(point)}`; const width = ctx.measureText(text).width;
      const x = p.x + 12 + width > size.width - 5 ? p.x - width - 12 : p.x + 12;
      label(text, Math.max(4, x), Math.max(4, Math.min(size.height - 22, p.y - 11)), color);
    };
    for (const gun of scene.markers) if (gun.id !== scene.activeId) marker(gun.point, `A${gun.id}`, '#9fb49a');
    marker(scene.position, `A${scene.activeId}`, '#4dddc6'); marker(scene.target, 'B', '#ffa370');
    const metres = camera.scale > 0.7 ? 100 : camera.scale > 0.2 ? 500 : 1000;
    ctx.strokeStyle = '#efede1'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, size.height - 25); ctx.lineTo(22 + metres * camera.scale, size.height - 25); ctx.stroke();
    label(`${metres} ${language === 'ru' ? 'м' : 'm'}`, 22, size.height - 48);
    label(language === 'ru' ? 'Север ↑' : 'North ↑', size.width - 80, size.height - 32);
  }
}
