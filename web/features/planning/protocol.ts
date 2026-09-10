import type { GameTable } from '../../domain/game-tables.ts';
import type { MapPoint } from '../../domain/coordinates.ts';
import type { CandidateMask, PlanningOptions, PositionAssessment, Site } from '../../domain/planning.ts';
export interface PlanningRequest { key: string; table: GameTable; target: MapPoint; position: MapPoint | null; options: PlanningOptions; roads: unknown; sites: Site[] }
export interface PlanningReply { key: string; mask: CandidateMask | null; assessment: PositionAssessment | null; error?: boolean }
