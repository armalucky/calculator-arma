export interface MapPoint { X: number; Z: number }
export const MAP_EXTENT = 10240;

export function validPoint(point: unknown): point is MapPoint {
  if (typeof point !== 'object' || point === null) return false;
  const p = point as Partial<MapPoint>;
  return typeof p.X === 'number' && typeof p.Z === 'number' && Number.isFinite(p.X) && Number.isFinite(p.Z)
    && p.X >= 0 && p.Z >= 0 && p.X <= MAP_EXTENT && p.Z <= MAP_EXTENT;
}

export function distance(a: MapPoint, b: MapPoint): number {
  // Match the operations in C# rather than substituting Math.hypot.
  return Math.sqrt((a.X - b.X) ** 2 + (a.Z - b.Z) ** 2);
}

export function grid(point: MapPoint): string {
  if (!validPoint(point)) throw new Error('Invalid map point');
  return `${Math.floor(point.X / 100).toString().padStart(3, '0')} ${Math.floor(point.Z / 100).toString().padStart(3, '0')}`;
}

function parseNumber(input: string): number {
  const value = input.trim().replaceAll(',', '.');
  if (['NaN', 'Infinity', '-Infinity'].includes(value)) return Number(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error('Координаты должны быть числами.');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Координаты должны быть числами.');
  return parsed;
}

export function parseCoordinates(text: string, asGrid: boolean): MapPoint {
  const values = text.trim().split(/[ ;\t]+/).filter(Boolean);
  if (values.length !== 2) throw new Error('Введите две координаты через пробел.');
  let x = parseNumber(values[0]);
  let z = parseNumber(values[1]);
  if (asGrid) {
    if (![x, z].every((n) => Number.isInteger(n) && n >= 0 && n <= 102)) throw new Error('Номер клетки — целое число от 000 до 102.');
    x = (x * 100 + Math.min((x + 1) * 100, MAP_EXTENT)) / 2;
    z = (z * 100 + Math.min((z + 1) * 100, MAP_EXTENT)) / 2;
  }
  const result = { X: x, Z: z };
  if (!validPoint(result)) throw new Error('Точка должна быть в пределах карты: 0–10240 м.');
  return result;
}
