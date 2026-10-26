import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { renderSVG } from 'uqr';
import { LETTERS, NUMBERS, callOf, columnOf, entryIds, faceOf } from '../content';
import { CALLER, canCall, drawnIds, hasCard, isPlaying, missing, type BingoMove, type BingoState } from '../rules';
import './styles.css';

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599', '#e8590c', '#5c940d', '#ae3ec9', '#495057'];
/** Kugelfarben je Spalte wie bei klassischen Bingo-Kugeln: B blau, I rot, N weiß, G grün, O gelb. */
const BALL_COLORS = ['#1c7ed6', '#e03131', '#f1f3f5', '#2f9e44', '#f59f00'];

/** So lange dreht die Trommel, bevor die gezogene Zahl erscheint. */
const SPIN_MS = 2_800;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const nameOf = (names: string[], seat: SeatId) => names[seat] ?? `Platz ${seat + 1}`;

/**
 * Die Zieh-Animation: Kommt eine neue Ziehung herein, wirbeln erst zufällige Einträge
 * durch die Kugel, immer langsamer, bis die echte Zahl erscheint. Bis dahin zählt die
 * neue Zahl in der Anzeige noch nicht als gezogen – auch nicht auf der Karte.
 */
function useDrawReveal(view: BingoState) {
  const [shown, setShown] = useState(view.drawn);
  const [flicker, setFlicker] = useState<number | null>(null);
  const spinning = shown < view.drawn;

  useEffect(() => {
    // Beim Öffnen, nach einem Wiedereinstieg oder Zurücknehmen: ohne Animation.
    if (view.drawn !== shown + 1) {
      setShown(view.drawn);
      return;
    }
    const duration = reducedMotion() ? 500 : SPIN_MS;
    const earlier = new Set(view.order.slice(0, view.drawn - 1));
    const pool = entryIds(view.content).filter((id) => !earlier.has(id));
    const timers: number[] = [];
    const started = performance.now();
    // Immer längere Pausen zwischen den Wechseln: erst ein Wirbel, dann ein Tröpfeln.
    const step = () => {
      const elapsed = performance.now() - started;
      if (elapsed >= duration) {
        setFlicker(null);
        setShown(view.drawn);
        return;
      }
      setFlicker(pool[Math.floor(Math.random() * pool.length)] ?? null);
      const progress = elapsed / duration;
      timers.push(window.setTimeout(step, 45 + 420 * progress ** 2.2));
    };
    step();
    return () => timers.forEach((t) => window.clearTimeout(t));
    // `shown` absichtlich nicht: Die Animation startet nur bei einer neuen Ziehung.
  }, [view.drawn]);

  const current = shown > 0 ? (view.order[shown - 1] ?? null) : null;
  return { shown, spinning, flicker, current };
}

function Ball({ content, id, size = 'large', spinning = false }: { content: string; id: number | null; size?: 'large' | 'small'; spinning?: boolean }) {
  if (content !== NUMBERS) {
    return (
      <span className={`bg-ball bg-ball-text bg-ball-${size} ${spinning ? 'bg-spinning' : ''}`}>
        <span className="bg-ball-call">{id === null ? '?' : callOf(content, id)}</span>
      </span>
    );
  }
  const column = id === null ? null : columnOf(id);
  const style = { '--bg-ball': column === null ? 'var(--color-surface-2)' : BALL_COLORS[column] } as CSSProperties;
  return (
    <span className={`bg-ball bg-ball-${size} ${spinning ? 'bg-spinning' : ''}`} style={style}>
      <span className="bg-ball-face">
        {column !== null && <span className="bg-ball-letter">{LETTERS[column]}</span>}
        <span className="bg-ball-number">{id ?? '?'}</span>
      </span>
    </span>
  );
}

/** Oben: die Kugel mit der aktuellen Ansage, die letzten fünf und der Knopf der Spielleitung. */
function Stage({ view, reveal, canDraw, onDraw, callerName }: { view: BingoState; reveal: ReturnType<typeof useDrawReveal>; canDraw: boolean; onDraw: () => void; callerName: string }) {
  const { shown, spinning, flicker, current } = reveal;
  const recent = view.order.slice(Math.max(0, shown - 6), Math.max(0, shown - 1)).reverse();
  const learning = view.content !== NUMBERS;
  return (
    <div className={`bg-stage ${spinning ? 'bg-stage-spinning' : ''}`}>
      <div className="bg-drum" aria-live="polite">
        {spinning ? (
          <>
            <span className="bg-drum-glow" aria-hidden="true" />
            <Ball content={view.content} id={flicker} spinning />
            <span className="sr-only">Es wird gezogen …</span>
          </>
        ) : current !== null ? (
          <span key={shown} className="bg-reveal">
            <Ball content={view.content} id={current} />
            <span className="sr-only">Gezogen: {callOf(view.content, current)}</span>
          </span>
        ) : (
          <Ball content={view.content} id={null} />
        )}
      </div>
      <div className="bg-stage-side">
        <p className="bg-count">
          {spinning ? 'Und die nächste ist …' : shown === 0 ? 'Noch nichts gezogen' : learning ? 'Gesucht: die Lösung' : `${shown} von ${view.total}`}
        </p>
        {recent.length > 0 && (
          <ol className="bg-recent" aria-label="Zuletzt gezogen">
            {recent.map((id) => (
              <li key={id}>
                <Ball content={view.content} id={id} size="small" />
              </li>
            ))}
          </ol>
        )}
        {canDraw ? (
          <button type="button" className="bg-button bg-draw" disabled={spinning} onClick={onDraw}>
            🎱 {shown === 0 ? 'Erste Zahl ziehen' : 'Nächste Zahl'}
          </button>
        ) : (
          view.drawn < view.total && view.winners.length === 0 && <p className="bg-help">{callerName} zieht.</p>
        )}
      </div>
    </div>
  );
}

/** Eine Bingo-Karte mit „Bingo!“-Knopf. */
function Card({
  view,
  seat,
  name,
  legalMoves,
  onMove,
  reveal,
  compact,
}: {
  view: BingoState;
  seat: SeatId;
  name: string | null;
  legalMoves: BingoMove[];
  onMove: (move: BingoMove) => void;
  reveal: ReturnType<typeof useDrawReveal>;
  compact: boolean;
}) {
  const card = view.cards[seat] ?? [];
  const marks = view.marks[seat] ?? [];
  // Während die Trommel dreht, ist die neue Zahl noch geheim – auch automatische Markierungen warten.
  const hidden = reveal.spinning ? view.order[view.drawn - 1] : undefined;
  const markable = new Set(legalMoves.flatMap((m) => (m.type === 'mark' && card[m.cell] !== hidden ? [m.cell] : [])));
  const canShout = legalMoves.some((m) => m.type === 'bingo');
  const left = missing(view, seat);
  const [shake, setShake] = useState<number | null>(null);
  const [notYet, setNotYet] = useState(false);
  // Der Knopf ist immer bereit, solange man rufen darf – sonst verriete er, dass noch eine Zahl zu markieren ist.
  // Ohne erlaubten Ruf (nichts zu markieren, keine volle Reihe) gibt es nur einen Hinweis, keine Strafe.
  const shoutReady = canCall(view, seat) && view.winners.length === 0;
  const shout = () => {
    if (canShout) onMove({ type: 'bingo' });
    else {
      setNotYet(true);
      window.setTimeout(() => setNotYet(false), 1_500);
    }
  };
  const numbers = view.content === NUMBERS;

  const tap = (cell: number) => {
    if (markable.has(cell)) onMove({ type: 'mark', cell });
    else if (!marks[cell]) {
      setShake(cell);
      window.setTimeout(() => setShake((s) => (s === cell ? null : s)), 400);
    }
  };

  let status: string;
  if (view.out[seat]) status = 'Ausgeschieden';
  else if (!canCall(view, seat)) status = 'Aussetzen bis zur nächsten Ziehung';
  else if (notYet) status = 'Noch keine volle Reihe!';
  else if (left === 0) status = 'Bingo! Schnell drücken!';
  else status = left === 1 ? 'Noch 1 Feld' : `Noch ${left} Felder`;

  return (
    <section className={`bg-card-wrap ${numbers ? 'bg-numbers' : ''} ${compact ? 'bg-compact' : ''}`} aria-label={name ? `Karte von ${name}` : 'Deine Karte'}>
      {name && <h3 className="bg-card-name">{name}</h3>}
      <div className="bg-card" style={{ '--bg-size': view.size } as CSSProperties}>
        {numbers &&
          LETTERS.map((letter, i) => (
            <span key={letter} className="bg-letter" style={{ '--bg-ball': BALL_COLORS[i] } as CSSProperties}>
              {letter}
            </span>
          ))}
        {card.map((id, cell) => {
          const marked = marks[cell] === true && id !== hidden;
          const face = id === null ? '⭐' : faceOf(view.content, id);
          return (
            <button
              key={cell}
              type="button"
              className={`bg-cell ${id === null ? 'bg-free' : ''} ${marked ? 'bg-marked' : ''} ${shake === cell ? 'bg-shake' : ''} ${face.length > 3 ? 'bg-long' : ''}`}
              aria-pressed={marked}
              aria-label={id === null ? 'Freies Feld' : face}
              disabled={id === null || marked || legalMoves.length === 0}
              onClick={() => tap(cell)}
            >
              <span className="bg-face">{face}</span>
              {marked && id !== null && <span className="bg-stamp" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="bg-card-foot">
        <button type="button" className={`bg-button bg-shout ${left === 0 && canShout ? 'bg-ready' : ''}`} disabled={!shoutReady} onClick={shout}>
          Bingo!
        </button>
        <p className="bg-help">{status}</p>
      </div>
    </section>
  );
}

/** Für Zuschauer und eine Spielleitung ohne Karte: alle Einträge, die gezogenen leuchten. */
function Tally({ view, shown }: { view: BingoState; shown: number }) {
  const drawn = new Set(view.order.slice(0, shown));
  const latest = shown > 0 ? view.order[shown - 1] : undefined;
  const ids = entryIds(view.content);
  const numbers = view.content === NUMBERS;
  return (
    <div className={`bg-tally ${numbers ? 'bg-tally-numbers' : ''}`} aria-label="Gezogene Einträge">
      {ids.map((id) => (
        <span key={id} className={`bg-tally-cell ${drawn.has(id) ? 'bg-on' : ''} ${id === latest ? 'bg-latest' : ''}`} style={numbers ? ({ '--bg-ball': BALL_COLORS[columnOf(id)] } as CSSProperties) : undefined}>
          {numbers ? id : callOf(view.content, id)}
        </span>
      ))}
    </div>
  );
}

/** Wer ist wie nah dran? Die besten fünf (auf der Tafel zehn), damit es bei 30 Mitspielern übersichtlich bleibt. */
function Leaders({ view, names, exclude, limit = 5 }: { view: BingoState; names: string[]; exclude: SeatId[]; limit?: number }) {
  const drawnSet = new Set(drawnIds(view));
  const players = view.cards
    .map((_, seat) => seat)
    .filter((seat) => isPlaying(view, seat) && !exclude.includes(seat))
    .map((seat) => ({ seat, left: missing(view, seat, 'marks', drawnSet) }))
    .sort((a, b) => a.left - b.left || a.seat - b.seat);
  if (players.length === 0) return null;
  const top = players.slice(0, limit);
  return (
    <ol className="bg-leaders" aria-label="Wer ist nah dran?">
      {top.map(({ seat, left }) => (
        <li key={seat} className={left <= 1 ? 'bg-close' : ''}>
          <span className="bg-dot" style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }} />
          {nameOf(names, seat)}: <strong>{left === 0 ? 'fertig!' : `noch ${left}`}</strong>
        </li>
      ))}
      {players.length > top.length && <li className="bg-more">+ {players.length - top.length} weitere</li>}
    </ol>
  );
}

/** Einblendung nach jedem „Bingo!“-Ruf. */
function CallFlash({ view, names }: { view: BingoState; names: string[] }) {
  const n = view.lastCall?.n ?? 0;
  const first = useRef(n);
  const [visible, setVisible] = useState<number | null>(null);
  useEffect(() => {
    if (n === 0 || n === first.current) return;
    setVisible(n);
    const timer = window.setTimeout(() => setVisible(null), view.lastCall?.valid ? 4_000 : 2_500);
    return () => window.clearTimeout(timer);
  }, [n]);
  const call = view.lastCall;
  if (visible === null || !call || call.n !== visible) return null;
  const who = nameOf(names, call.seat);
  if (call.valid) {
    const others = view.winners.filter((s) => s !== call.seat).map((s) => nameOf(names, s));
    return (
      <div className="bg-flash bg-flash-win" role="status">
        <span className="bg-flash-big">BINGO!</span>
        <span>
          🎉 {who}
          {others.length > 0 && ` – und ${others.join(', ')}`}
        </span>
      </div>
    );
  }
  const penalty = view.falseCall === 'out' ? 'scheidet aus' : view.falseCall === 'pause' ? 'setzt eine Ziehung aus' : 'hat sich vertan';
  return (
    <div className="bg-flash bg-flash-false" role="status">
      <span className="bg-flash-big">Falsches Bingo</span>
      <span>
        🙈 {who} {penalty}.
      </span>
    </div>
  );
}

/** QR-Code zum Mitspielen – aus dem eigenen Einladungslink, ohne fremden Dienst. */
function Invite({ code, link }: { code: string; link: string }) {
  const svg = useMemo(() => renderSVG(link, { border: 2, whiteColor: '#ffffff', blackColor: '#1f2328' }), [link]);
  return (
    <div className="bg-invite">
      <div className="bg-qr" role="img" aria-label={`QR-Code: ${link}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p>
        Mitspielen: QR-Code scannen
        <br />
        oder Raum <strong className="bg-code">{code}</strong>
      </p>
    </div>
  );
}

/**
 * Die Tafel für den Beamer: im Vollbild die Kugel groß, alle gezogenen Einträge, die Rangliste
 * und der QR-Code zum Beitreten. Die Spielleitung kann von hier aus auch ziehen.
 */
function Wallboard({ view, reveal, canDraw, onDraw, names, invite, onClose }: { view: BingoState; reveal: ReturnType<typeof useDrawReveal>; canDraw: boolean; onDraw: () => void; names: string[]; invite?: { code: string; link: string }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    // Vollbild, wo der Browser es erlaubt; sonst füllt die Tafel einfach das Fenster.
    node?.requestFullscreen?.().catch(() => undefined);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onChange = () => !document.fullscreenElement && onClose();
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="bg-wall" role="dialog" aria-label="Tafel">
      <button type="button" className="bg-wall-close" aria-label="Tafel schließen" onClick={onClose}>
        ✕
      </button>
      <div className="bg-wall-side">
        <Stage view={view} reveal={reveal} canDraw={canDraw} onDraw={onDraw} callerName={nameOf(names, CALLER)} />
        <Leaders view={view} names={names} exclude={[]} limit={10} />
        {invite && <Invite code={invite.code} link={invite.link} />}
      </div>
      <Tally view={view} shown={reveal.shown} />
      <CallFlash view={view} names={names} />
    </div>
  );
}

function Board({ view, legalMoves, onMove, viewer, seatNames, humanSeats, invite }: BoardProps<BingoState, BingoMove>) {
  const reveal = useDrawReveal(view);
  const [wall, setWall] = useState(false);
  const closeWall = useCallback(() => setWall(false), []);
  // Die Spielleitung zieht mit ihrem eigenen Platz – lokal mit mehreren Menschen über deren Züge.
  const local = humanSeats && humanSeats.length > 1 ? humanSeats : null;
  const callerMoves = local ? (local.find((h) => h.seat === CALLER)?.legalMoves ?? []) : viewer === CALLER ? legalMoves : [];
  const canDraw = callerMoves.some((m) => m.type === 'draw');
  const draw = () => (local ? local.find((h) => h.seat === CALLER)?.onMove({ type: 'draw' }) : onMove({ type: 'draw' }));

  const cards: { seat: SeatId; legalMoves: BingoMove[]; onMove: (m: BingoMove) => void }[] = local
    ? local.filter((h) => hasCard(view, h.seat))
    : typeof viewer === 'number' && hasCard(view, viewer)
      ? [{ seat: viewer, legalMoves, onMove }]
      : [];

  return (
    <div className={`bg-table ${cards.length > 1 ? 'bg-many' : ''}`}>
      <div className="bg-layout">
        <Stage view={view} reveal={reveal} canDraw={canDraw} onDraw={draw} callerName={nameOf(seatNames, CALLER)} />
        {cards.length > 0 ? (
          <div className="bg-cards">
            {cards.map((c) => (
              <Card key={c.seat} view={view} seat={c.seat} name={cards.length > 1 ? nameOf(seatNames, c.seat) : null} legalMoves={c.legalMoves} onMove={c.onMove} reveal={reveal} compact={cards.length > 1} />
            ))}
          </div>
        ) : (
          <Tally view={view} shown={reveal.shown} />
        )}
        <Leaders view={view} names={seatNames} exclude={cards.map((c) => c.seat)} />
      </div>
      <button type="button" className="bg-wall-open" title="Tafel für den Beamer" onClick={() => setWall(true)}>
        📺 Tafel
      </button>
      {wall ? (
        <Wallboard view={view} reveal={reveal} canDraw={canDraw} onDraw={draw} names={seatNames} invite={invite} onClose={closeWall} />
      ) : (
        <CallFlash view={view} names={seatNames} />
      )}
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`bg-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat === CALLER ? '🎱' : seat + 1}
    </span>
  );
}

export const gameUi: GameUi<BingoState, BingoMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => (seat === CALLER ? 'Spielleitung' : `Platz ${seat + 1}`),
  seatDetail: (view, seat) => {
    if (!hasCard(view, seat)) return 'zieht';
    if (view.out[seat]) return 'ausgeschieden';
    if (!canCall(view, seat)) return 'setzt aus';
    const left = missing(view, seat);
    const prefix = seat === CALLER ? 'zieht · ' : '';
    return left === 0 ? `${prefix}fertig!` : `${prefix}noch ${left}`;
  },
};
