import type { Camera } from '../map/camera.ts';
import type { MapLayers } from '../map/renderer.ts';
export const PREFERENCES_KEY = 'luckymap.web.preferences.v1';
export interface Preferences { language: 'ru' | 'en'; layers: MapLayers; camera: Camera | null }
export const defaultPreferences = (): Preferences => ({ language: 'ru', layers: { roads: true, buildings: true, grid: true, names: true }, camera: null });
export function parsePreferences(value: unknown): Preferences {
  const result = defaultPreferences();
  if (!value || typeof value !== 'object') return result;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return result;
  if (raw.language === 'en' || raw.language === 'ru') result.language = raw.language;
  if (raw.layers && typeof raw.layers === 'object') for (const key of Object.keys(result.layers) as (keyof MapLayers)[]) { const val = (raw.layers as Record<string, unknown>)[key]; if (typeof val === 'boolean') result.layers[key] = val; }
  if (raw.camera && typeof raw.camera === 'object') {
    const c = raw.camera as Camera;
    if ([c.X, c.Z, c.scale].every((n) => typeof n === 'number' && Number.isFinite(n)) && c.X >= -1024 && c.X <= 11264 && c.Z >= -1024 && c.Z <= 11264 && c.scale >= 0.02 && c.scale <= 5) result.camera = { X: c.X, Z: c.Z, scale: c.scale };
  }
  return result;
}
export function readPreferences(): Preferences {
  try { return parsePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null')); } catch { return defaultPreferences(); }
}
