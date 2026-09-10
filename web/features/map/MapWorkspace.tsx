import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { distance, grid, parseCoordinates, type MapPoint } from '../../domain/coordinates.ts';
import { loadMapAssets, type MapAssets } from './assets.ts';
import { MapCanvas, type MapHandle, type MapMode } from './MapCanvas.tsx';
import { coordinateError, mapMessages } from './messages.ts';
import type { MapLayers, MapScene } from './renderer.ts';
import { activeGun, selectedTable, type Fleet, type FleetAction } from '../fleet/state.ts';
import { ui } from '../fleet/messages.ts';
import { Dialog } from '../fleet/Dialog.tsx';
import { CalculationPanel } from '../calculation/CalculationPanel.tsx';
import { PlanningPanel } from '../planning/PlanningPanel.tsx';
import { usePlanning } from '../planning/usePlanning.ts';
import { shellLabel } from '../calculation/format.ts';
import { resourceUrl } from '../resources/catalog.ts';
import { SessionStore } from '../storage/session-store.ts';
import { StoragePanel } from '../storage/StoragePanel.tsx';
import { storageMessages } from '../storage/messages.ts';
import type { Preferences } from '../storage/preferences.ts';
import type { Camera } from './camera.ts';

type LoadState = { status: 'loading' | 'error' } | { status: 'ready'; assets: MapAssets };
type PointKind = 'position' | 'target';
const formatPoint = (point: MapPoint, cell: boolean) => cell ? grid(point) : `${Number(point.X.toFixed(3))} ${Number(point.Z.toFixed(3))}`;

interface WorkspacePreferences { language: 'ru' | 'en'; preferences: Preferences; onPreferences: (patch: Partial<Preferences>) => void }
export function MapWorkspace({ language, preferences, onPreferences }: WorkspacePreferences) {
  const text = mapMessages[language];
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let owned: MapAssets | null = null;
    void loadMapAssets(new URL(import.meta.env.BASE_URL, document.baseURI), controller.signal).then((assets) => {
      if (controller.signal.aborted) { assets.background.close(); return; }
      owned = assets; setLoad({ status: 'ready', assets });
    }, () => { if (!controller.signal.aborted) setLoad({ status: 'error' }); });
    return () => { controller.abort(); owned?.background.close(); };
  }, [attempt]);
  if (load.status !== 'ready') return <main className="map-loading" aria-live="polite">
    <h1>{text.heading}</h1><p>{load.status === 'error' ? text.error : text.loading}</p>
    {load.status === 'error' ? <button onClick={() => { setLoad({ status: 'loading' }); setAttempt((n) => n + 1); }}>{text.retry}</button> : null}
  </main>;
  return <PersistentWorkspace assets={load.assets} language={language} preferences={preferences} onPreferences={onPreferences} />;
}

function PersistentWorkspace({ assets, ...prefs }: WorkspacePreferences & { assets: MapAssets }) {
  const [store] = useState(() => new SessionStore(assets.tables, assets.sites));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => { void store.start(); return () => store.stop(); }, [store]);
  if (snapshot.status === 'loading') return <main className="map-loading"><p>{storageMessages[prefs.language].loading}</p></main>;
  return <div className="persistent-workspace">
    <StoragePanel store={store} snapshot={snapshot} tables={assets.tables} sites={assets.sites} language={prefs.language} />
    {snapshot.status !== 'recovery' ? <FleetWorkspace key={snapshot.epoch} assets={assets} fleet={snapshot.fleet} dispatch={store.dispatch} {...prefs} /> : null}
  </div>;
}
const emptyFormats = { position: false, target: false };
function FleetWorkspace({ assets, language, preferences, onPreferences, fleet, dispatch }: WorkspacePreferences & { assets: MapAssets; fleet: Fleet; dispatch: (action: FleetAction) => void }) {
  const text = mapMessages[language], labels = ui[language];
  const gun = activeGun(fleet), points = gun;
  const table = selectedTable(gun, assets.tables);
  const plan = usePlanning(gun, table, assets);
  const [mode, setMode] = useState<MapMode>('move');
  const [drafts, setDrafts] = useState<Record<number, Partial<Record<PointKind, string>>>>({});
  const [allFormats, setAllFormats] = useState<Record<number, Record<PointKind, boolean>>>({});
  const formats = allFormats[gun.id] ?? emptyFormats;
  const inputs = { position: drafts[gun.id]?.position ?? (gun.position ? formatPoint(gun.position, formats.position) : ''), target: drafts[gun.id]?.target ?? (gun.target ? formatPoint(gun.target, formats.target) : '') };
  const [error, setError] = useState<{ kind: PointKind; message: string } | null>(null);
  const [hover, setHover] = useState<MapPoint | null>(null);
  const layers = preferences.layers;
  const viewChanged = useCallback((camera: Camera) => onPreferences({ camera }), [onPreferences]);
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteError, setSiteError] = useState<'bookmarkMissing' | 'bookmarkLimit' | null>(null);
  const [tileErrors, setTileErrors] = useState(0);
  const [tab, setTab] = useState<'calculation' | 'planning'>('calculation');
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const map = useRef<MapHandle>(null);
  const visibleSites = useMemo(() => [...assets.sites, ...fleet.bookmarks].map((s) => ({ ...s, name: fleet.names[s.id] ?? s.name })), [assets.sites, fleet.bookmarks, fleet.names]);
  const editInput = useCallback((kind: PointKind, value: string | undefined) => setDrafts((current) => ({ ...current, [gun.id]: { ...current[gun.id], [kind]: value } })), [gun.id]);
  const applyPoint = useCallback((kind: PointKind, point: MapPoint) => {
    dispatch({ type: 'point', kind, point }); editInput(kind, undefined); setError(null); setShared(false);
  }, [editInput, setError, setShared, dispatch]);
  const scene = useMemo<MapScene>(() => ({ position: gun.position, target: gun.target, markers: fleet.guns.flatMap((g) => g.position ? [{ id: g.id, point: g.position }] : []), activeId: gun.id, layers, sites: visibleSites, mask: plan.mask }), [gun.position, gun.target, gun.id, fleet.guns, layers, visibleSites, plan.mask]);

  return (
    <main className="map-workspace">
      <fieldset className="fleet-bar" aria-label={labels.gun}>
        {fleet.guns.map((g) => <button key={g.id} aria-pressed={g.id === gun.id} onClick={() => { dispatch({ type: 'select', id: g.id }); setError(null); setShared(false); }}>{labels.gun} {g.id}</button>)}
        <button aria-label={labels.add} title={labels.add} disabled={fleet.guns.length >= 6} onClick={() => { dispatch({ type: 'add' }); setError(null); }}>+</button>
        <button disabled={fleet.guns.length <= 1} onClick={() => setRemoveId(gun.id)}>{labels.remove}</button><span>{fleet.guns.length} / 6</span>
      </fieldset>
      {removeId !== null ? <Dialog title={`${labels.gun} ${removeId}`} onClose={() => setRemoveId(null)}><p>{labels.removeQuestion}</p><div className="dialog-actions"><button onClick={() => setRemoveId(null)}>{labels.cancel}</button><button onClick={() => {
        dispatch({ type: 'remove', id: removeId });
        setDrafts((current) => { const next = { ...current }; delete next[removeId]; return next; });
        setAllFormats((current) => { const next = { ...current }; delete next[removeId]; return next; });
        setRemoveId(null); setError(null);
      }}>{labels.confirm}</button></div></Dialog> : null}
      <aside className="map-sidebar" aria-label={text.modes}>
        <div className="map-heading"><img className="map-cover" src={resourceUrl(assets.catalog, 'references/mod-luckygames/scenario0_1024x512.jpg', assets.base).href} width={1024} height={512} alt="LuckyGames · Arma Reforger" /><h1>{text.heading}</h1><p>{text.subtitle}</p></div>
        <fieldset className="mode-picker"><legend>{text.modes}</legend>
          {(['move', 'position', 'target'] as const).map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{text[item]}</button>)}
        </fieldset>
        {(['position', 'target'] as const).map((kind) => <form className={`point-form ${kind}`} key={kind} onSubmit={(event) => {
          event.preventDefault();
          try {
            const point = parseCoordinates(inputs[kind], formats[kind]); applyPoint(kind, point);
            map.current?.frame({ a: kind === 'position' ? point : points.position, b: kind === 'target' ? point : points.target });
          } catch (cause) { setError({ kind, message: cause instanceof Error ? cause.message : '' }); }
        }}>
          <h2>{kind === 'position' ? text.a.replace('A1', `A${gun.id}`) : text.b}</h2>
          <label className="format-label" htmlFor={`${kind}-format`}>{text.format}
            <select id={`${kind}-format`} value={formats[kind] ? 'grid' : 'exact'} onChange={(event) => {
              const cell = event.target.value === 'grid'; setAllFormats((current) => ({ ...current, [gun.id]: { ...formats, [kind]: cell } }));
              const point = points[kind]; if (point) editInput(kind, undefined);
              setError(null);
            }}><option value="exact">{text.exact}</option><option value="grid">{text.cell}</option></select>
          </label>
          <label className="visually-hidden" htmlFor={`${kind}-input`}>{text.coordinates} {kind === 'position' ? 'A' : 'B'}</label>
          <div className="coordinate-row"><input id={`${kind}-input`} value={inputs[kind]} autoComplete="off" spellCheck={false}
            placeholder={formats[kind] ? '056 039' : 'X Z'} aria-invalid={error?.kind === kind} aria-describedby={error?.kind === kind ? `${kind}-error` : undefined}
            onChange={(event) => editInput(kind, event.target.value)} />
            <button type="submit">{text.apply}</button></div>
          <p className="point-readout">{points[kind] ? `${grid(points[kind])} · ${formatPoint(points[kind], false)}` : text.noPoint}</p>
          {error?.kind === kind ? <p className="field-error" id={`${kind}-error`} role="alert">{coordinateError(error.message, language)}</p> : null}
        </form>)}
        <div className="shared-target"><button disabled={!gun.target || fleet.guns.length < 2} onClick={() => {
          dispatch({ type: 'share' }); setShared(true);
          setDrafts((current) => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id, { ...draft, target: undefined }])));
        }}>{labels.share}</button>{shared ? <output>{labels.shared}</output> : null}</div>
        <fieldset className="layer-picker"><legend>{text.layers}</legend>
          {(Object.keys(layers) as (keyof MapLayers)[]).map((key) => <label key={key}><input type="checkbox" checked={layers[key]} onChange={(event) => onPreferences({ layers: { ...layers, [key]: event.target.checked } })} />{text[key]}</label>)}
        </fieldset>
        <details className="scenario-points"><summary>{text.points}</summary>
          <label className="visually-hidden" htmlFor="scenario-point">{text.select}</label>
          <select id="scenario-point" value={siteId} onChange={(event) => setSiteId(event.target.value)}><option value="">{text.select}</option>
            {visibleSites.map((site) => <option key={site.id} value={site.id}>{site.name} · {grid({ X: site.x, Z: site.z })}</option>)}
          </select>
          <button disabled={!siteId} title={labels.selectHelp} onClick={() => {
            const site = visibleSites.find((item) => item.id === siteId);
            if (site) { const point = { X: site.x, Z: site.z }; applyPoint(mode === 'position' ? 'position' : 'target', point); map.current?.focus(point); }
          }}>{text.use}</button>
          <label>{labels.name}<input value={siteName} maxLength={200} onChange={(e) => setSiteName(e.target.value)} /></label>
          <button disabled={!siteId || !siteName.trim()} onClick={() => dispatch({ type: 'rename', id: siteId, name: siteName })}>{labels.rename}</button>
          <button onClick={() => {
            const point = mode === 'position' ? gun.position : gun.target;
            if (!point) { setSiteError('bookmarkMissing'); return; }
            if (fleet.bookmarks.length >= 1000) { setSiteError('bookmarkLimit'); return; }
            const id = `user:${crypto.randomUUID().replaceAll('-', '')}`;
            dispatch({ type: 'bookmark', site: { id, name: siteName.trim() || `${labels.point} ${grid(point)}`, x: point.X, z: point.Z, source: 'user' } });
            setSiteId(id); setSiteError(null);
          }}>{labels.bookmark}</button>
          {siteError ? <p role="alert" className="field-error">{labels[siteError]}</p> : null}
        </details>
        <p className="session-note">{storageMessages[language].local}</p>
      </aside>
      <section className="map-surface" aria-label={text.heading}>
        <div className="map-toolbar">
          <div><button onClick={() => map.current?.fit()}>{text.all}</button><button onClick={() => map.current?.frame()}>{text.pair}</button></div>
          <div><button onClick={() => { dispatch({ type: 'reset' }); setDrafts((current) => ({ ...current, [gun.id]: {} })); setError(null); setShared(false); }}>{text.reset}</button>
            <button aria-label={text.minus} title={text.minus} onClick={() => map.current?.zoom(1 / 1.3)}>−</button>
            <button aria-label={text.plus} title={text.plus} onClick={() => map.current?.zoom(1.3)}>+</button></div>
        </div>
        <div className="map-stage">
          <MapCanvas ref={map} assets={assets} scene={scene} language={language} mode={mode} onPick={applyPoint} onHover={setHover} onTileErrors={setTileErrors} savedCamera={preferences.camera} onCamera={viewChanged} />
          {tileErrors > 0 ? <output className="tile-warning"><span>{text.tileError}</span><button onClick={() => map.current?.retryTiles()}>{text.retry}</button></output> : null}
        </div>
        <div className="map-status"><span>{text.cursor}: <span className="coordinate-value">{hover ? `${grid(hover)} · ${formatPoint(hover, false)}` : '—'}</span></span>
          <span>{text.length}: <span className="coordinate-value">{points.position && points.target ? `${distance(points.position, points.target).toFixed(0)} ${text.metres}` : '—'}</span></span></div>
        <p id="map-help" className="map-help">{text.help}</p>
        <div className="calculation-dock">
          <fieldset className="panel-tabs" aria-label={`${labels.calculation} / ${labels.planning}`}>
            <button aria-pressed={tab === 'calculation'} onClick={() => setTab('calculation')}>{labels.calculation}</button><button aria-pressed={tab === 'planning'} onClick={() => setTab('planning')}>{labels.planning}</button>
            <span>{labels.gun} {gun.id} · {shellLabel(table?.shell ?? '', language)}</span>
          </fieldset>
          <div className="panel-scroll">
            <div hidden={tab !== 'calculation'}><CalculationPanel gun={gun} tables={assets.tables} dispatch={dispatch} language={language} /></div>
            <div hidden={tab !== 'planning'}><PlanningPanel key={gun.id} gun={gun} table={table} result={plan} dispatch={dispatch} language={language} around={() => { if (gun.target && table) map.current?.around(gun.target, table.rows[table.rows.length - 1].distance - gun.planning.Reserve); }} /></div>
          </div>
        </div>
      </section>
    </main>
  );
}
