import { useEffect, useState } from 'react';
import type { GameTable } from '../../domain/game-tables.ts';
import type { Gun } from '../fleet/state.ts';
import type { MapAssets } from '../map/assets.ts';
import type { PlanningReply, PlanningRequest } from './protocol.ts';

export function usePlanning(gun: Gun, table: GameTable | null, assets: MapAssets) {
  const [reply, setReply] = useState<PlanningReply | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Identity is also checked while rendering: stale work can never paint for new inputs.
  const key = table && gun.target ? JSON.stringify([gun.id, table.id, gun.position, gun.target, gun.planning, attempt]) : null;
  useEffect(() => {
    if (!key || !table || !gun.target) return;
    let worker: Worker | null = null;
    let cancelled = false;
    try {
      worker = new Worker(new URL('./planning.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<PlanningReply>) => { if (!cancelled && event.data.key === key) setReply(event.data); };
      worker.onerror = () => { if (!cancelled) setReply({ key, mask: null, assessment: null, error: true }); };
      worker.postMessage({ key, table, target: gun.target, position: gun.position, options: gun.planning, roads: assets.roadData, sites: assets.sites } satisfies PlanningRequest);
    } catch { queueMicrotask(() => { if (!cancelled) setReply({ key, mask: null, assessment: null, error: true }); }); }
    return () => { cancelled = true; worker?.terminate(); };
  }, [key, table, gun.target, gun.position, gun.planning, assets]);
  const current = reply?.key === key ? reply : null;
  return { mask: current?.mask ?? null, assessment: current?.assessment ?? null, status: !key ? 'missing' : !current ? 'busy' : current.error ? 'error' : 'ready', retry: () => setAttempt((n) => n + 1) };
}
