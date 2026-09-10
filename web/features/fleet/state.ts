import { validPoint, type MapPoint } from '../../domain/coordinates.ts';
import { defaultPlanningOptions, validPlanningOptions, type PlanningOptions, type Site } from '../../domain/planning.ts';
import type { GameTable, WeaponId } from '../../domain/game-tables.ts';

export interface Gun {
  id: number; position: MapPoint | null; target: MapPoint | null;
  weapon: WeaponId; tableId: string; m777TableId: string; planning: PlanningOptions;
}
export interface Fleet { activeId: number; guns: Gun[]; names: Record<string, string>; bookmarks: Site[] }
export const activeGun = (state: Fleet): Gun => state.guns.find((g) => g.id === state.activeId)!;
export const selectedTable = (gun: Gun, tables: readonly GameTable[]): GameTable | null => tables.find((t) => t.weapon === gun.weapon && t.id === (gun.weapon === 'm777' ? gun.m777TableId : gun.tableId)) ?? null;
export function newFleet(): Fleet {
  return { activeId: 1, guns: [{ id: 1, position: null, target: null, weapon: 'mortar82', tableId: 'he4', m777TableId: 'm777-2-low', planning: defaultPlanningOptions() }], names: {}, bookmarks: [] };
}
export type FleetAction =
  | { type: 'select'; id: number } | { type: 'add' } | { type: 'remove'; id: number }
  | { type: 'point'; kind: 'position' | 'target'; point: MapPoint }
  | { type: 'reset' } | { type: 'share' }
  | { type: 'weapon'; weapon: WeaponId } | { type: 'profile'; table: GameTable }
  | { type: 'planning'; options: PlanningOptions }
  | { type: 'rename'; id: string; name: string }
  | { type: 'bookmark'; site: Site };
export function fleetReducer(state: Fleet, action: FleetAction): Fleet {
  const gun = activeGun(state);
  const update = (patch: Partial<Gun>) => ({ ...state, guns: state.guns.map((g) => g.id === gun.id ? { ...g, ...patch } : g) });
  switch (action.type) {
    case 'select': return state.guns.some((g) => g.id === action.id) ? { ...state, activeId: action.id } : state;
    case 'add': {
      if (state.guns.length >= 6) return state;
      const id = [1, 2, 3, 4, 5, 6].find((n) => !state.guns.some((g) => g.id === n))!;
      return { ...state, activeId: id, guns: [...state.guns, { ...gun, id, position: null, target: gun.target ? { ...gun.target } : null, planning: { ...gun.planning, Show: false } }] };
    }
    case 'remove': {
      if (state.guns.length === 1 || !state.guns.some((g) => g.id === action.id)) return state;
      const guns = state.guns.filter((g) => g.id !== action.id);
      return { ...state, guns, activeId: state.activeId === action.id ? guns[0].id : state.activeId };
    }
    case 'point': return validPoint(action.point) ? update({ [action.kind]: { ...action.point } }) : state;
    case 'reset': return update({ position: null, target: null });
    case 'share': return gun.target ? { ...state, guns: state.guns.map((g) => ({ ...g, target: { ...gun.target! } })) } : state;
    case 'weapon': return update({ weapon: action.weapon });
    case 'profile': return action.table.weapon === gun.weapon ? update(gun.weapon === 'm777' ? { m777TableId: action.table.id } : { tableId: action.table.id }) : state;
    case 'planning': return validPlanningOptions(action.options) ? update({ planning: { ...action.options } }) : state;
    case 'rename': return action.name.trim() ? { ...state, names: { ...state.names, [action.id]: action.name.trim() } } : state;
    case 'bookmark': return state.bookmarks.length < 1000 && action.site.name.trim() && validPoint({ X: action.site.x, Z: action.site.z }) && !state.bookmarks.some((s) => s.id === action.site.id)
      ? { ...state, bookmarks: [...state.bookmarks, { ...action.site }] } : state;
  }
}

/** Desktop selector behavior: shell changes reset charge; trajectory preserves it when available. */
export function changeProfile(current: GameTable, tables: readonly GameTable[], change: Partial<Pick<GameTable, 'shell' | 'rings' | 'trajectory'>>): GameTable {
  const candidates = tables.filter((t) => t.weapon === current.weapon && t.shell === (change.shell ?? current.shell) && t.trajectory === (change.trajectory ?? current.trajectory));
  return candidates.find((t) => t.rings === (change.shell ? -1 : change.rings ?? current.rings)) ?? candidates[0] ?? current;
}
