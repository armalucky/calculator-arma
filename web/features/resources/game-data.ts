import { createLuckyTables } from '../../domain/game-tables.ts';
import { parseRoadIndex } from '../../domain/roads.ts';
import { parseSites } from '../../domain/planning.ts';
import { loadJsonResource, type ResourceCatalog } from './catalog.ts';

/** Explicit loaders: importing the domain never triggers network requests. */
export async function loadGameTables(catalog: ResourceCatalog, base: URL, signal?: AbortSignal) {
  const [mortar, m777] = await Promise.all([
    loadJsonResource(catalog, 'data/game-tables.json', base, signal),
    loadJsonResource(catalog, 'data/m777-tables.json', base, signal),
  ]);
  return createLuckyTables(mortar, m777);
}

export async function loadPlanningGeometry(catalog: ResourceCatalog, base: URL, signal?: AbortSignal) {
  const [roads, sites] = await Promise.all([
    loadJsonResource(catalog, 'data/maps/bakhmut/roads.json', base, signal),
    loadJsonResource(catalog, 'data/maps/bakhmut/points.json', base, signal),
  ]);
  return { roads: parseRoadIndex(roads), sites: parseSites(sites) };
}
