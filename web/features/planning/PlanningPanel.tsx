import { useState } from 'react';
import type { PlanningOptions } from '../../domain/planning.ts';
import type { GameTable } from '../../domain/game-tables.ts';
import { ui, type Language } from '../fleet/messages.ts';
import type { FleetAction, Gun } from '../fleet/state.ts';
import type { usePlanning } from './usePlanning.ts';

export function PlanningPanel({ gun, table, result, dispatch, around, language }: { gun: Gun; table: GameTable | null; result: ReturnType<typeof usePlanning>; dispatch: (action: FleetAction) => void; around: () => void; language: Language }) {
  const text = ui[language];
  const [draft, setDraft] = useState(() => ({ Reserve: String(gun.planning.Reserve), RoadOffset: String(gun.planning.RoadOffset), SiteOffset: String(gun.planning.SiteOffset) }));
  const [invalid, setInvalid] = useState(false);
  const fields = [{ key: 'Reserve', label: text.reserve, max: 3000 }, { key: 'RoadOffset', label: text.roads, max: 1000 }, { key: 'SiteOffset', label: text.sites, max: 2000 }] as const;
  const assessment = result.assessment;
  const max = table ? table.rows[table.rows.length - 1].distance - gun.planning.Reserve : 0;
  return <div className="planning-panel">
    <div className="planning-actions"><label><input type="checkbox" checked={gun.planning.Show} onChange={(e) => dispatch({ type: 'planning', options: { ...gun.planning, Show: e.target.checked } })} />{text.show}</label><button disabled={!table || !gun.target} onClick={around}>{text.around}</button></div>
    <form className="planning-filters" onSubmit={(e) => {
      e.preventDefault();
      if (fields.some(({ key, max: limit }) => !/^\d+$/.test(draft[key]) || Number(draft[key]) > limit)) { setInvalid(true); return; }
      const options: PlanningOptions = { Show: gun.planning.Show, Reserve: Number(draft.Reserve), RoadOffset: Number(draft.RoadOffset), SiteOffset: Number(draft.SiteOffset) };
      dispatch({ type: 'planning', options }); setInvalid(false);
    }}>
      {fields.map(({ key, label, max: limit }) => <label key={key}>{label}, {text.metres}<input aria-label={label} inputMode="numeric" value={draft[key]} onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))} aria-invalid={invalid} /><small>0–{limit}</small></label>)}
      <button type="submit">{text.apply}</button>
    </form>
    {invalid ? <p role="alert" className="field-error">{text.invalid}</p> : null}
    <div aria-live="polite" data-planning-status={result.status}>
      {result.status === 'missing' ? <p>{text.chooseTarget}</p> : result.status === 'busy' ? <p>{text.busy}</p> : result.status === 'error' ? <p className="field-error">{text.failed} <button onClick={result.retry}>{text.retry}</button></p> : <>
        <p className={assessment && !assessment.Allowed ? 'field-error' : 'planning-result'}>{assessment ? assessment.Allowed ? text.passes : `${text.fails} ${[!assessment.RangeAllowed ? text.rangeReason : '', !assessment.RoadAllowed ? text.roadReason : '', !assessment.SiteAllowed ? text.siteReason : ''].filter(Boolean).join(', ')}.` : text.choosePosition}</p>
        {assessment ? <p className="assessment-values">{text.reserve}: {Math.round(assessment.Reserve)} {text.metres} · {text.roads}: {Math.round(assessment.RoadDistance)} {text.metres} · {text.sites}: {Math.round(assessment.SiteDistance)} {text.metres}</p> : null}
        <p>{table && max < table.rows[0].distance ? text.impossible : `${text.range}: ${table?.rows[0].distance}–${max} ${text.metres}`} · {!gun.planning.Show ? text.off : result.mask?.Cells ? `${text.cells}: ${result.mask.Cells}` : text.noCells}</p>
      </>}
    </div>
    <p className="panel-note">{text.planNotice}</p>
  </div>;
}
