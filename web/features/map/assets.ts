import { parseSites, type Site } from '../../domain/planning.ts';
import { loadCatalog, loadJsonResource, resourceUrl, type ResourceCatalog } from '../resources/catalog.ts';
import { parseMapGeometry, type MapGeometry } from './geometry.ts';
import { loadGameTables } from '../resources/game-data.ts';
import type { GameTable } from '../../domain/game-tables.ts';

export interface MapAssets { catalog: ResourceCatalog; base: URL; background: ImageBitmap; geometry: MapGeometry; sites: Site[]; roadData: unknown; tables: GameTable[] }
export async function loadBitmap(url: URL, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Map image HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  if (signal.aborted) { bitmap.close(); throw new DOMException('Aborted', 'AbortError'); }
  return bitmap;
}
export async function loadMapAssets(base: URL, signal: AbortSignal): Promise<MapAssets> {
  const catalog = await loadCatalog(base, signal);
  const [roads, buildings, sites, tables] = await Promise.all([
    loadJsonResource(catalog, 'data/maps/bakhmut/roads.json', base, signal),
    loadJsonResource(catalog, 'data/maps/bakhmut/buildings.json', base, signal),
    loadJsonResource(catalog, 'data/maps/bakhmut/points.json', base, signal),
    loadGameTables(catalog, base, signal),
  ]);
  const geometry = parseMapGeometry(roads, buildings);
  const points = parseSites(sites);
  const background = await loadBitmap(resourceUrl(catalog, 'data/maps/bakhmut/desktop-background.jpg', base), signal);
  return { catalog, base, background, geometry, sites: points, roadData: roads, tables };
}
