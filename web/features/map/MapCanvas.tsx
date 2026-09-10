import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { validPoint, type MapPoint } from '../../domain/coordinates.ts';
import type { MapAssets } from './assets.ts';
import { fitMap, focusPoint, frameAround, framePair, initialCamera, pan, world, zoomAt, type Camera, type ScreenPoint } from './camera.ts';
import { MapRenderer, type MapScene } from './renderer.ts';

export type MapMode = 'move' | 'position' | 'target';
export interface MapHandle { fit(): void; frame(points?: { a: MapPoint | null; b: MapPoint | null }): void; around(point: MapPoint, radius: number): void; focus(point: MapPoint): void; zoom(multiplier: number): void; retryTiles(): void }
interface Props {
  assets: MapAssets; scene: MapScene; language: 'ru' | 'en'; mode: MapMode;
  onPick: (mode: 'position' | 'target', point: MapPoint) => void;
  onHover: (point: MapPoint | null) => void; onTileErrors: (count: number) => void;
  savedCamera?: Camera | null; onCamera?: (camera: Camera) => void;
  ref?: Ref<MapHandle>;
}

export function MapCanvas({ assets, scene, language, mode, onPick, onHover, onTileErrors, savedCamera, onCamera, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const frame = useRef(0);
  const draw = useRef<(() => void) | null>(null);
  const didFit = useRef(Boolean(savedCamera));
  const gesture = useRef<{ id: number; start: ScreenPoint; camera: Camera; drag: boolean; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState<Camera>(savedCamera ?? initialCamera);
  useEffect(() => { if (size.width > 1 && size.height > 1) onCamera?.(camera); }, [camera, size.width, size.height, onCamera]);
  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; draw.current?.(); });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) };
      setSize(next);
      if (!didFit.current) { didFit.current = true; setCamera(fitMap(next)); }
      schedule();
    });
    observer.observe(host);
    window.addEventListener('resize', schedule);
    return () => { observer.disconnect(); window.removeEventListener('resize', schedule); };
  }, [schedule]);

  useEffect(() => {
    const next = new MapRenderer(assets, schedule);
    renderer.current = next; schedule();
    return () => { next.dispose(); renderer.current = null; cancelAnimationFrame(frame.current); frame.current = 0; };
  }, [assets, schedule]);

  useLayoutEffect(() => {
    draw.current = () => {
      const canvas = canvasRef.current; const engine = renderer.current;
      if (!canvas || !engine) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(size.width * ratio)); const height = Math.max(1, Math.round(size.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      engine.draw(ctx, camera, size, scene, language);
      canvas.dataset.loadedTiles = String(engine.tiles.loadedCount);
      onTileErrors(engine.tiles.failedCount);
    };
    schedule();
  }, [camera, size, scene, language, schedule, onTileErrors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return; // Preserve browser page zoom.
      event.preventDefault();
      if (event.deltaY === 0) return;
      const rect = canvas.getBoundingClientRect();
      setCamera((current) => zoomAt(current, size, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaY < 0 ? 1.3 : 1 / 1.3));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [size]);

  useImperativeHandle(ref, () => ({
    fit: () => setCamera(fitMap(size)),
    around: (point, radius) => setCamera(frameAround(size, point, radius)),
    frame: (points) => setCamera((current) => framePair(current, size, points ? points.a : scene.position, points ? points.b : scene.target)),
    focus: (point) => setCamera((current) => focusPoint(current, point)),
    zoom: (multiplier) => setCamera((current) => zoomAt(current, size, { x: size.width / 2, y: size.height / 2 }, multiplier)),
    retryTiles: () => renderer.current?.tiles.retry(),
  }), [size, scene.position, scene.target]);

  const local = (event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }): ScreenPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  return (
    <div ref={hostRef} className="map-viewport">
      <canvas ref={canvasRef} tabIndex={0}
        aria-label={language === 'ru' ? 'Игровая карта Бахмута' : 'Bakhmut game map'} aria-describedby="map-help"
        data-camera-x={camera.X} data-camera-z={camera.Z} data-scale={camera.scale}
        data-road-count={assets.geometry.roadCount} data-building-count={assets.geometry.buildings.length}
        data-active-gun={scene.activeId} data-marker-count={scene.markers.length} data-mask-cells={scene.mask?.Cells ?? 0}
        className={mode === 'move' ? 'map-canvas move' : 'map-canvas pick'}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (gesture.current || ![0, 1, 2].includes(event.button)) return;
          event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = { id: event.pointerId, start: local(event), camera, drag: event.button !== 0 || mode === 'move', moved: false };
        }}
        onPointerMove={(event) => {
          const p = local(event); const active = gesture.current;
          let current = camera;
          if (active && active.id === event.pointerId) {
            const dx = p.x - active.start.x; const dy = p.y - active.start.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;
            if (active.drag) { current = pan(active.camera, dx, dy); setCamera(current); }
          }
          const point = world(p, current, size); onHover(validPoint(point) ? point : null);
        }}
        onPointerUp={(event) => {
          const active = gesture.current;
          if (!active || active.id !== event.pointerId) return;
          if (!active.drag && !active.moved && mode !== 'move') {
            const point = world(local(event), camera, size); if (validPoint(point)) onPick(mode, point);
          }
          gesture.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}
        onPointerLeave={() => onHover(null)}
        onKeyDown={(event) => {
          const delta: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
          if (event.key === 'Home') { event.preventDefault(); setCamera(fitMap(size)); }
          else if (Object.hasOwn(delta, event.key)) { event.preventDefault(); const [x, y] = delta[event.key]; setCamera((current) => pan(current, x, y)); }
        }}
      >{language === 'ru' ? 'Карта требует поддержки Canvas. Координаты можно задать в полях рядом.' : 'Canvas support is required. You can enter coordinates in the adjacent fields.'}</canvas>
    </div>
  );
}
