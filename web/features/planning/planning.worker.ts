import { assessPosition, createCandidateMask } from '../../domain/planning.ts';
import { parseRoadIndex } from '../../domain/roads.ts';
import type { PlanningRequest, PlanningReply } from './protocol.ts';

globalThis.onmessage = (event: MessageEvent<PlanningRequest>) => {
  const data = event.data;
  try {
    const roads = parseRoadIndex(data.roads);
    const mask = data.options.Show ? createCandidateMask(data.table, data.target, data.options, roads, data.sites) : null;
    const assessment = data.position ? assessPosition(data.table, data.target, data.position, data.options, roads, data.sites) : null;
    const reply: PlanningReply = { key: data.key, mask, assessment };
    globalThis.postMessage(reply, { transfer: mask ? [mask.Occupancy.buffer] : [] });
  } catch { globalThis.postMessage({ key: data.key, mask: null, assessment: null, error: true } satisfies PlanningReply); }
};
