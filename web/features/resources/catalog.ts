export interface ResourceEntry {
  file: string;
  bytes: number;
  sha256: string;
}

export interface ResourceCatalog {
  version: 1;
  map: { id: 'bakhmut'; extent: 10240; tileMetres: 1024; tilePixels: 1026; tileBorder: 1; columns: 10; rows: 10; tileOrigin: 'north-west' };
  totalBytes: number;
  files: Record<string, ResourceEntry>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCatalog(value: unknown): ResourceCatalog {
  if (!record(value) || value.version !== 1 || !record(value.map) || !record(value.files)) throw new Error('Invalid resource catalog.');
  const map = value.map;
  const files = value.files;
  if (map.id !== 'bakhmut' || map.extent !== 10240 || map.tileMetres !== 1024 || map.tilePixels !== 1026 || map.tileBorder !== 1 || map.columns !== 10 || map.rows !== 10 || map.tileOrigin !== 'north-west') throw new Error('Unsupported map registration.');
  let total = 0;
  for (const entry of Object.values(value.files)) {
    if (!record(entry) || typeof entry.file !== 'string' || !/^[a-f0-9]{64}\.(txt|md|json|jpg|png)$/.test(entry.file) || typeof entry.sha256 !== 'string' || entry.file.split('.')[0] !== entry.sha256 || typeof entry.bytes !== 'number' || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) throw new Error('Invalid resource entry.');
    total += entry.bytes;
  }
  const required = [
    'LICENSE', 'LICENSE.ru.md', 'data/game-tables.json', 'data/m777-tables.json',
    'data/maps/bakhmut/desktop-background.jpg', 'data/maps/bakhmut/roads.json',
    'data/maps/bakhmut/buildings.json', 'data/maps/bakhmut/points.json',
    'references/mod-luckygames/scenario0_1024x512.jpg',
    ...Array.from({ length: 100 }, (_, i) => tileKey(i % 10, Math.floor(i / 10))),
  ];
  if (required.some((key) => !Object.hasOwn(files, key)) || Object.keys(files).length !== required.length || total !== value.totalBytes) throw new Error('Incomplete resource catalog.');
  return value as unknown as ResourceCatalog;
}

/** baseUrl is the absolute directory URL, including the site's hosting subpath. */
export async function loadCatalog(baseUrl: URL, signal?: AbortSignal): Promise<ResourceCatalog> {
  const response = await fetch(new URL('resources/manifest.json', baseUrl), { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`Resource catalog HTTP ${response.status}`);
  return parseCatalog(await response.json());
}

export function resourceUrl(catalog: ResourceCatalog, key: string, baseUrl: URL): URL {
  if (!Object.hasOwn(catalog.files, key)) throw new Error(`Unknown resource: ${key}`);
  return new URL(`resources/${catalog.files[key].file}`, baseUrl);
}

/** JSON is deliberately unknown until the corresponding domain module validates it. */
export async function loadJsonResource(catalog: ResourceCatalog, key: string, baseUrl: URL, signal?: AbortSignal): Promise<unknown> {
  if (!key.endsWith('.json')) throw new Error('Expected a JSON resource.');
  const response = await fetch(resourceUrl(catalog, key, baseUrl), { signal });
  if (!response.ok) throw new Error(`Resource HTTP ${response.status}: ${key}`);
  return response.json();
}

export function tileKey(x: number, y: number): string {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 9 || y > 9) throw new Error('Tile outside map.');
  return `data/maps/bakhmut/detail/background/${x}_${y}.png`;
}
