import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Nur für den Dev-Server (#454): Stationen im Hauptmenü mit der Maus verschieben und skalieren. */
export interface EditableStation {
  id: string;
  label: string;
  to: string;
  x: number;
  y: number;
  w: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function StationEditor({
  stations,
  onChange,
  onReset,
  spriteUrl,
}: {
  stations: EditableStation[];
  onChange: (next: EditableStation[]) => void;
  onReset: () => void;
  spriteUrl: (id: string) => string | undefined;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const patch = (id: string, change: Partial<EditableStation>) =>
    onChange(stations.map((s) => (s.id === id ? { ...s, ...change } : s)));

  // Pfeiltasten verschieben die Auswahl (Umschalt = grob), + und - ändern die Größe.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const st = stations.find((x) => x.id === selected);
      if (!st) return;
      const step = e.shiftKey ? 1 : 0.1;
      const change: Partial<EditableStation> = {};
      if (e.key === 'ArrowLeft') change.x = round1(st.x - step);
      else if (e.key === 'ArrowRight') change.x = round1(st.x + step);
      else if (e.key === 'ArrowUp') change.y = round1(st.y - step);
      else if (e.key === 'ArrowDown') change.y = round1(st.y + step);
      else if (e.key === '+' || e.key === '=') change.w = round1(st.w + step);
      else if (e.key === '-') change.w = round1(Math.max(3, st.w - step));
      else return;
      e.preventDefault();
      patch(st.id, change);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startDrag = (event: React.PointerEvent, st: EditableStation, mode: 'move' | 'size') => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(st.id);
    const start = { px: event.clientX, py: event.clientY, x: st.x, y: st.y, w: st.w };
    const move = (e: PointerEvent) => {
      const dx = ((e.clientX - start.px) / rect.width) * 100;
      const dy = ((e.clientY - start.py) / rect.height) * 100;
      if (mode === 'move') patch(st.id, { x: round1(start.x + dx), y: round1(start.y + dy) });
      else patch(st.id, { w: Math.min(45, Math.max(3, round1(start.w + dx * 2))) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const code = stations
    .map((s) => `  { id: '${s.id}', label: '${s.label}', to: '${s.to}', x: ${s.x}, y: ${s.y}, w: ${s.w} },`)
    .join('\n');

  return createPortal(
    <>
      <div className="bub-menu-stations bub-menu-edit">
        <div className="bub-menu-stage" ref={stage}>
          {stations.map((st) => (
            <div
              key={st.id}
              className="bub-menu-edit-item"
              data-selected={selected === st.id ? 'true' : undefined}
              style={{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.w}%` }}
              onPointerDown={(e) => startDrag(e, st, 'move')}
            >
              <img src={spriteUrl(st.id)} alt="" draggable={false} />
              <span className="bub-menu-edit-tag">{st.id}</span>
              <span className="bub-menu-edit-grip" onPointerDown={(e) => startDrag(e, st, 'size')} />
            </div>
          ))}
        </div>
      </div>
      <div className="bub-menu-edit-panel">
        <strong>Stationen bearbeiten</strong>
        <small>Ziehen = verschieben, Griff unten rechts = Größe. Pfeiltasten (Umschalt = grob) und + / − feinjustieren die Auswahl.</small>
        <pre>{code}</pre>
        <div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(code).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Kopiert ✓' : 'Code kopieren'}
          </button>
          <button type="button" onClick={onReset}>Zurücksetzen</button>
        </div>
      </div>
    </>,
    document.body,
  );
}
