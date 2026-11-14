/**
 * Eingaben im Raum (#358): Zahlenfeld, Tastatur, Reihenfolge, Rechnung und Symbole, schräg vor
 * dem eigenen Platz über dem Tisch. Was eingegeben wird, entscheidet `inputPlan` (input-spec.ts);
 * hier wird nur gezeichnet und der fertige Zug an `onMove` gegeben.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { useState } from 'react';
import { inputPlan, type InputSpec } from './input-spec';
import { TABLE_CENTER } from './Tavern';
import { WOOD_DARK } from './text';
import { Button3D, Sign } from './ui3d';

const W = 0.05;
const GAP = 0.006;

/** Eine Reihe von Knöpfen, mittig ausgerichtet. */
function Keys({ labels, y, onKey, width = W, active }: { labels: string[]; y: number; onKey: (key: string) => void; width?: number; active?: (key: string) => boolean }) {
  return (
    <>
      {labels.map((label, i) => (
        <Button3D key={`${y}-${label}-${i}`} label={label} position={[(i - (labels.length - 1) / 2) * (width + GAP), y, 0]} width={width} height={0.045} active={active?.(label)} onPress={() => onKey(label)} />
      ))}
    </>
  );
}

function Display({ lines }: { lines: string[] }) {
  return <Sign lines={lines} position={[0, 0.11, 0]} width={0.6} height={0.03 + lines.length * 0.034} background={WOOD_DARK} />;
}

function NumberPad({ prompt, onOk, decimals }: { prompt: string; onOk: (value: number) => void; decimals?: boolean }) {
  const [text, setText] = useState('');
  const key = (k: string) => {
    if (k === '⌫') setText((t) => t.slice(0, -1));
    else if (k === '±') setText((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`));
    else if (k === ',') setText((t) => (t.includes(',') ? t : `${t},`));
    else if (k === 'OK') {
      const value = Number(text.replace(',', '.'));
      if (text !== '' && Number.isFinite(value)) {
        onOk(value);
        setText('');
      }
    } else setText((t) => (t.length < 9 ? t + k : t));
  };
  return (
    <>
      <Display lines={[prompt, text === '' ? '…' : text]} />
      <Keys labels={['7', '8', '9', '⌫']} y={0.03} onKey={key} />
      <Keys labels={['4', '5', '6', '±']} y={-0.021} onKey={key} />
      <Keys labels={['1', '2', '3', decimals ? ',' : ' ']} y={-0.072} onKey={(k) => k !== ' ' && key(k)} />
      <Keys labels={['0', 'OK']} y={-0.123} width={W * 2 + GAP} onKey={key} active={(k) => k === 'OK'} />
    </>
  );
}

const ROWS = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNMß'];

function Keyboard({ prompt, fields, onOk }: { prompt: string; fields?: string[]; onOk: (text: string, field: number) => void }) {
  const [text, setText] = useState('');
  const [field, setField] = useState(0);
  const key = (k: string) => {
    if (k === '⌫') setText((t) => t.slice(0, -1));
    else if (k === 'Leer') setText((t) => `${t} `);
    else if (k === 'OK') {
      if (text.trim()) {
        onOk(text.trim(), field);
        setText('');
      }
    } else setText((t) => (t.length < 40 ? t + k.toLowerCase() : t));
  };
  const shown = text === '' ? '…' : text.charAt(0).toUpperCase() + text.slice(1);
  return (
    <>
      <Display lines={[fields ? `${prompt} · ${fields[field] ?? ''}` : prompt, shown]} />
      {fields && (
        <group position={[0, 0.2, 0]}>
          <Keys labels={fields} y={0} width={Math.min(0.12, 0.6 / fields.length - GAP)} onKey={(k) => setField(fields.indexOf(k))} active={(k) => fields.indexOf(k) === field} />
        </group>
      )}
      {ROWS.map((row, r) => (
        <Keys key={row} labels={[...row]} y={0.03 - r * 0.051} width={0.042} onKey={key} />
      ))}
      <Keys labels={['⌫', 'Leer', 'OK']} y={0.03 - 3 * 0.051} width={0.12} onKey={key} active={(k) => k === 'OK'} />
    </>
  );
}

function NumbersInput({ spec, onMove }: { spec: Extract<InputSpec, { kind: 'numbers' }>; onMove: (move: unknown) => void }) {
  const [values, setValues] = useState<(number | null)[]>(spec.slots);
  const next = values.findIndex((v) => v === null);
  // Index → Reihe von unten und Platz von links (wie in der Rechenmauer).
  let row = 0;
  let col = next;
  while (col >= spec.height - row) col -= spec.height - row++;
  const show = (v: number | null) => (v === null ? '?' : String(v / spec.scale).replace('.', ','));
  const rows: string[] = [];
  let start = 0;
  for (let r = 0; r < spec.height; r++) {
    rows.unshift(values.slice(start, start + spec.height - r).map(show).join('  '));
    start += spec.height - r;
  }
  if (next < 0) {
    return (
      <>
        <Display lines={[spec.prompt, ...rows]} />
        <Keys labels={['Zurücksetzen', 'Abgeben']} y={0} width={0.18} active={(k) => k === 'Abgeben'} onKey={(k) => (k === 'Abgeben' ? onMove(spec.make(values as number[])) : setValues(spec.slots))} />
      </>
    );
  }
  return (
    <>
      <group position={[0, 0.17, 0]}>
        <Sign lines={rows} width={0.4} height={0.03 + rows.length * 0.032} background={WOOD_DARK} position={[0, 0, 0]} />
      </group>
      <NumberPad prompt={`Reihe ${row + 1} von unten, Platz ${col + 1}`} decimals={spec.scale === 10} onOk={(value) => setValues((v) => v.map((x, i) => (i === next ? Math.round(value * spec.scale) : x)))} />
    </>
  );
}

function OrderInput({ spec, onMove }: { spec: Extract<InputSpec, { kind: 'order' }>; onMove: (move: unknown) => void }) {
  const [order, setOrder] = useState<number[]>([]);
  const rest = spec.items.map((_, i) => i).filter((i) => !order.includes(i));
  return (
    <>
      <Display lines={[spec.prompt, ...order.map((i, k) => `${k + 1}. ${spec.items[i]}`)]} />
      {rest.map((i, k) => (
        <Button3D key={i} label={spec.items[i]!} position={[0, 0.03 - k * 0.05, 0]} width={0.5} height={0.044} onPress={() => setOrder((o) => [...o, i])} />
      ))}
      <Keys labels={order.length === spec.items.length ? ['Neu', 'Abgeben'] : ['Neu']} y={0.03 - rest.length * 0.05} width={0.16} active={(k) => k === 'Abgeben'} onKey={(k) => (k === 'Abgeben' ? onMove(spec.make(order)) : setOrder([]))} />
    </>
  );
}

const OPS: Record<string, string> = { '+': '+', '−': '-', '·': '*', ':': '/' };

function CalcInput({ spec, onMove }: { spec: Extract<InputSpec, { kind: 'calc' }>; onMove: (move: unknown) => void }) {
  const start = spec.cards.map((v) => ({ value: v, text: String(v) }));
  const [items, setItems] = useState(start);
  const [steps, setSteps] = useState<{ a: number; op: string; b: number }[]>([]);
  const [a, setA] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const pick = (index: number) => {
    if (a === null || op === null) return setA(index === a ? null : index);
    if (index === a) return;
    const x = items[a]!;
    const y = items[index]!;
    const value = op === '+' ? x.value + y.value : op === '−' ? x.value - y.value : op === '·' ? x.value * y.value : x.value / y.value;
    const next = items.filter((_, i) => i !== a && i !== index);
    next.push({ value: Math.round(value * 1000) / 1000, text: `(${x.text} ${op} ${y.text})` });
    setSteps((s) => [...s, { a, op: OPS[op]!, b: index }]);
    setItems(next);
    setA(null);
    setOp(null);
  };
  return (
    <>
      <Display lines={[spec.prompt, a === null ? 'Zahl antippen' : op === null ? 'Rechenzeichen wählen' : 'zweite Zahl antippen']} />
      {items.map((item, i) => (
        <Button3D key={`${steps.length}-${i}`} label={String(item.value).replace('.', ',')} position={[(i - (items.length - 1) / 2) * 0.1, 0.03, 0]} width={0.09} height={0.05} active={i === a} onPress={() => pick(i)} />
      ))}
      <Keys labels={Object.keys(OPS)} y={-0.03} width={0.07} active={(k) => k === op} onKey={(k) => a !== null && setOp(k)} />
      <Keys
        labels={['Neu', 'Abgeben']}
        y={-0.09}
        width={0.16}
        active={(k) => k === 'Abgeben'}
        onKey={(k) => {
          if (k === 'Abgeben') onMove(spec.make(steps, a ?? items.length - 1));
          else {
            setItems(start);
            setSteps([]);
            setA(null);
            setOp(null);
          }
        }}
      />
    </>
  );
}

function SymbolsInput({ spec, onMove }: { spec: Extract<InputSpec, { kind: 'symbols' }>; onMove: (move: unknown) => void }) {
  const card = (labels: string[], x: number, title: string, press?: (i: number) => void) => (
    <group position={[x, 0, 0]}>
      <Sign lines={[title]} position={[0, 0.12, 0]} width={0.22} height={0.03} />
      {labels.map((label, i) => (
        <Button3D key={i} label={label} position={[((i % 3) - 1) * 0.07, 0.07 - Math.floor(i / 3) * 0.055, 0]} width={0.065} height={0.05} onPress={press ? () => press(i) : undefined} disabled={!press} />
      ))}
    </group>
  );
  const count = spec.targets.length + 1;
  return (
    <>
      {card(spec.center, -((count - 1) / 2) * 0.25, 'Mitte')}
      {spec.targets.map((t, k) => card(t.symbols.map((s) => s.label), (k + 1 - (count - 1) / 2) * 0.25, t.name, (i) => onMove(t.symbols[i]!.move)))}
    </>
  );
}

/** Die Eingabe für das laufende Spiel, falls es eine braucht. */
export function InputDesk({ game, onMove }: { game: GameMessage; onMove: (move: unknown) => void }) {
  const plan = inputPlan(game);
  if (!plan) return null;
  const { spec } = plan;
  return (
    // Neue Aufgabe, neue Eingabe: der Schlüssel setzt angefangene Eingaben zurück.
    <group key={`${spec.kind}:${spec.prompt}`} position={[TABLE_CENTER[0], TABLE_CENTER[1] + 0.3, TABLE_CENTER[2] + 0.2]} rotation={[-0.45, 0, 0]}>
      {spec.kind === 'number' && <NumberPad prompt={spec.prompt} onOk={(value) => onMove(spec.make(value))} />}
      {spec.kind === 'text' && <Keyboard prompt={spec.prompt} fields={spec.fields} onOk={(text, field) => onMove(spec.make(text, field))} />}
      {spec.kind === 'choice' && (
        <>
          <Display lines={[spec.prompt]} />
          {spec.options.map((o, i) => (
            <Button3D key={o.label} label={o.label} position={[((i % 3) - 1) * 0.15, 0.03 - Math.floor(i / 3) * 0.06, 0]} width={0.13} height={0.05} onPress={() => onMove(o.move)} />
          ))}
        </>
      )}
      {spec.kind === 'numbers' && <NumbersInput spec={spec} onMove={onMove} />}
      {spec.kind === 'order' && <OrderInput spec={spec} onMove={onMove} />}
      {spec.kind === 'calc' && <CalcInput spec={spec} onMove={onMove} />}
      {spec.kind === 'symbols' && <SymbolsInput spec={spec} onMove={onMove} />}
    </group>
  );
}
