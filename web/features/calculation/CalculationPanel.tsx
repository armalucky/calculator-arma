import { calculate, type GameTable } from '../../domain/game-tables.ts';
import { changeProfile, selectedTable, type FleetAction, type Gun } from '../fleet/state.ts';
import { ui, type Language } from '../fleet/messages.ts';

import { decimal, shellLabel } from './format.ts';
export function CalculationPanel({ gun, tables, dispatch, language }: { gun: Gun; tables: GameTable[]; dispatch: (action: FleetAction) => void; language: Language }) {
  const text = ui[language], table = selectedTable(gun, tables), result = calculate(table, gun.position, gun.target);
  const profiles = tables.filter((t) => t.weapon === gun.weapon);
  const shells = [...new Set(profiles.filter((t) => t.trajectory === table?.trajectory).map((t) => t.shell))];
  const variants = profiles.filter((t) => t.shell === table?.shell && t.trajectory === table?.trajectory);
  const change = (patch: Partial<Pick<GameTable, 'shell' | 'rings' | 'trajectory'>>) => { if (table) dispatch({ type: 'profile', table: changeProfile(table, tables, patch) }); };
  const reason = { 'missing-points': text.missing, 'coincident-points': text.coincident, 'missing-table': text.noTable, 'out-of-range': text.outside };
  const unit = gun.weapon === 'm777' ? 'mil' : text.units;
  return <div className="calculation-panel">
    <div className="profile-selectors">
      <label>{text.weapon}<select aria-label={text.weapon} value={gun.weapon} onChange={(e) => dispatch({ type: 'weapon', weapon: e.target.value === 'm777' ? 'm777' : 'mortar82' })}><option value="mortar82">{text.mortar}</option><option value="m777">M777</option></select></label>
      <label>{text.shell}<select aria-label={text.shell} value={table?.shell ?? ''} onChange={(e) => change({ shell: e.target.value })}>{shells.map((shell) => <option key={shell} value={shell}>{shellLabel(shell, language)}</option>)}</select></label>
      {gun.weapon === 'm777' ? <label>{text.trajectory}<select aria-label={text.trajectory} value={table?.trajectory ?? 'low'} onChange={(e) => change({ trajectory: e.target.value === 'high' ? 'high' : 'low' })}><option value="high">{text.high}</option><option value="low">{text.low}</option></select></label> : null}
      <label>{gun.weapon === 'm777' ? text.charge : text.rings}<select aria-label={gun.weapon === 'm777' ? text.charge : text.rings} value={table?.rings ?? ''} onChange={(e) => change({ rings: Number(e.target.value) })}>{variants.map((t) => <option key={t.id} value={t.rings}>{gun.weapon === 'm777' ? ['', '1L', '2L', '3H', '4H', '5H'][t.rings] : t.rings}</option>)}</select></label>
    </div>
    <div className="solution" aria-live="polite" data-profile={table?.id} data-available={result.Available}>
      {result.Available ? <div className="solution-values">
        <div><span>{text.azimuth}</span><strong data-result="azimuth">{decimal(result.AzimuthDegrees)}°</strong><small>{String(result.AzimuthUnits).padStart(4, '0')} {unit}</small></div>
        <div><span>{text.elevation}</span><strong data-result="elevation">{decimal(result.ElevationDegrees)}°</strong><small>{String(result.ElevationUnits).padStart(4, '0')} {unit}</small></div>
        <div><span>{text.flight}</span><strong data-result="seconds">{decimal(result.Seconds)} {text.seconds}</strong><small>{Math.round(result.Distance)} {text.metres}</small></div>
      </div> : <p className="field-error">{result.Reason ? reason[result.Reason] : text.noTable}</p>}
    </div>
    <details className="calculation-details"><summary>{table ? `${text.range}: ${table.rows[0].distance}–${table.rows[table.rows.length - 1].distance} ${text.metres}` : text.noTable} · {text.source}</summary>
      <p>{result.Available ? `${result.LowerDistance === result.UpperDistance ? text.row : text.interpolation}: ${result.LowerDistance}${result.LowerDistance === result.UpperDistance ? '' : `–${result.UpperDistance}`} ${text.metres}` : text.noExtrapolation}</p>
      <p>{text.source}: {result.Source ?? table?.source}</p>
      <p>{text.notice} {gun.weapon === 'mortar82' ? text.illumination : '6400 mil · M231 (1L/2L), M232 (3H/4H/5H)'}</p>
    </details>
  </div>;
}
