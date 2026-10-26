import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { setOf, type Ask, type QuartettMove, type QuartettState, type Trick } from '../rules';
import { cardOf, formatWithUnit, groupOf, valueOf, type CardId, type CardSet } from '../sets';
import './styles.css';

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599'];
const GROUP_COLORS: Record<string, string> = { A: '#e03131', B: '#1971c2', C: '#2f9e44', D: '#f08c00', E: '#7048e8', F: '#0c8599', G: '#c2255c', H: '#5c940d' };

const nameOf = (names: string[], seat: SeatId) => names[seat] ?? `Platz ${seat + 1}`;

/** Eine Quartettkarte: Kopf mit Gruppe, Bild, Name und die Werte – auf Wunsch als Tippflächen. */
function QCard({
  set,
  card,
  size = 'large',
  highlight,
  onPick,
  hint,
  winner,
}: {
  set: CardSet;
  card: CardId;
  size?: 'large' | 'small';
  /** Hervorgehobene Eigenschaft (die gewählte). */
  highlight?: string | null;
  onPick?: (property: string) => void;
  hint?: string | null;
  winner?: boolean;
}) {
  const data = cardOf(set.id, card);
  const group = groupOf(card);
  const groupName = set.groups.find((g) => g.id === group)?.name ?? '';
  const [info, setInfo] = useState(false);
  useEffect(() => setInfo(false), [card]);
  const sources = [...new Set([data.source, ...Object.values(data.sources ?? {})].filter(Boolean))];

  return (
    <article className={`qt-card qt-${size} ${winner ? 'qt-winner' : ''}`} style={{ '--qt-group': GROUP_COLORS[group] } as CSSProperties} aria-label={`${card} ${data.name}`}>
      <header className="qt-card-head">
        <span className="qt-card-id">{card}</span>
        <span className="qt-card-group">{groupName}</span>
        {size === 'large' && (
          <button type="button" className="qt-info" aria-expanded={info} aria-label="Quellen der Werte" onClick={() => setInfo((open) => !open)}>
            ⓘ
          </button>
        )}
      </header>
      <div className="qt-card-face">
        <span className="qt-emoji" aria-hidden="true">
          {data.emoji}
        </span>
        <span className="qt-name">{data.name}</span>
      </div>
      {info ? (
        <div className="qt-sources">
          <p>{set.note}</p>
          <p>Quelle{sources.length > 1 ? 'n' : ''}:</p>
          <ul>
            {sources.map((source) => (
              <li key={source}>{source!.startsWith('http') ? <a href={source} target="_blank" rel="noreferrer">{source}</a> : source}</li>
            ))}
          </ul>
          {set.status && <p className="qt-status">Stand: {set.status}</p>}
        </div>
      ) : (
        <ul className="qt-values">
          {set.properties.filter((p) => size === 'large' || !highlight || p.id === highlight).map((p) => {
            const text = formatWithUnit(p, valueOf(set.id, card, p.id));
            const classes = `qt-value ${highlight === p.id ? 'qt-chosen' : ''} ${hint === p.id ? 'qt-hint' : ''}`;
            const content = (
              <>
                <span className="qt-label">
                  {p.label}
                  {!p.higherWins && (
                    <span className="qt-lower" title="Hier gewinnt der kleinere Wert">
                      {' '}
                      ▼
                    </span>
                  )}
                </span>
                <span className="qt-number">{text}</span>
              </>
            );
            return (
              <li key={p.id}>
                {onPick ? (
                  <button type="button" className={classes} onClick={() => onPick(p.id)} aria-label={`${p.label}: ${text}${p.higherWins ? '' : ' (kleiner gewinnt)'}`}>
                    {content}
                  </button>
                ) : (
                  <span className={classes}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function CardBack({ count, label }: { count: number; label: string }) {
  return (
    <span className="qt-back" aria-label={label}>
      <span className="qt-back-count">{count}</span>
    </span>
  );
}

/**
 * Aufgedeckte Runden: Jede bleibt `revealMs` stehen, auch wenn Bots inzwischen weiterspielen.
 * Folgen viele Runden schnell aufeinander, wird die Anzeige kürzer, damit sie nicht zurückfällt.
 */
function useTrickQueue(events: GameEvent[], revealMs: number): Trick | null {
  const [queue, setQueue] = useState<Trick[]>([]);
  const seen = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    if (seen.current === events) return;
    seen.current = events;
    const tricks = events.filter((e) => e.type === 'trick') as unknown as Trick[];
    if (tricks.length > 0) setQueue((q) => [...q, ...tricks]);
  }, [events]);
  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    const ms = queue.length > 3 ? Math.min(revealMs, 700) : revealMs;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), ms);
    return () => clearTimeout(timer);
  }, [current, queue.length, revealMs]);
  return current;
}

function TrickText({ trick, set, names }: { trick: Trick; set: CardSet; names: string[] }) {
  const property = set.properties.find((p) => p.id === trick.property);
  const label = property?.label ?? trick.property;
  if (trick.winner === null) return <>{label}: Gleichstand – die Karten kommen in die Mitte.</>;
  return (
    <>
      {label}: {nameOf(names, trick.winner)} gewinnt {trick.cards} Karten.
    </>
  );
}

function TrumpBoard({ view, legalMoves, onMove, viewer, seatNames, events, hint }: BoardProps<QuartettState, QuartettMove>) {
  const set = setOf(view);
  const shown = useTrickQueue(events, view.revealMs);
  const own = viewer === 'spectator' ? null : (view.stacks[viewer]?.[0]?.card ?? null);
  const canChoose = legalMoves.length > 0 && shown === null;
  const hintProperty = hint?.type === 'chooseProperty' ? hint.property : null;
  const others = view.stacks.map((_, seat) => seat).filter((seat) => seat !== viewer);

  return (
    <div className="qt-table">
      <div className="qt-others">
        {others.map((seat) => (
          <div key={seat} className={`qt-seat ${seat === view.turn ? 'qt-turn' : ''} ${view.stacks[seat]!.length === 0 ? 'qt-out' : ''}`}>
            <span className="qt-seat-name" style={{ color: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
              {nameOf(seatNames, seat)}
            </span>
            <CardBack count={view.stacks[seat]!.length} label={`${view.stacks[seat]!.length} Karten`} />
          </div>
        ))}
        {view.middle.length > 0 && (
          <div className="qt-seat qt-middle">
            <span className="qt-seat-name">Mitte</span>
            <CardBack count={view.middle.length} label={`${view.middle.length} Karten in der Mitte`} />
          </div>
        )}
      </div>

      <div className="qt-center">
        {shown ? (
          <div className="qt-reveal" aria-live="polite">
            <p className="qt-said">
              <TrickText trick={shown} set={set} names={seatNames} />
            </p>
            <div className="qt-reveal-cards">
              {shown.plays.map((play) => (
                <div key={play.seat} className="qt-play">
                  <span className="qt-seat-name" style={{ color: SEAT_COLORS[play.seat % SEAT_COLORS.length] }}>
                    {nameOf(seatNames, play.seat)}
                  </span>
                  <QCard set={set} card={play.card} size="small" highlight={shown.property} winner={play.seat === shown.winner} />
                </div>
              ))}
            </div>
          </div>
        ) : own ? (
          <>
            <p className="qt-help">
              {canChoose
                ? 'Wähle eine Eigenschaft – alle decken auf.'
                : view.turn === viewer
                  ? ' '
                  : `${nameOf(seatNames, view.turn)} wählt …`}
            </p>
            <QCard set={set} card={own} onPick={canChoose ? (property) => onMove({ type: 'chooseProperty', property }) : undefined} hint={hintProperty} />
          </>
        ) : (
          <p className="qt-help">{viewer === 'spectator' ? `${nameOf(seatNames, view.turn)} wählt …` : 'Du hast keine Karten mehr.'}</p>
        )}
      </div>

      <p className="qt-footer">
        {viewer !== 'spectator' && `Dein Stapel: ${view.stacks[viewer]?.length ?? 0} Karten · `}
        Runde {view.round}
        {view.roundLimit > 0 ? ` von ${view.roundLimit}` : ''}
      </p>
    </div>
  );
}

function AskText({ ask, set, names }: { ask: Ask; set: CardSet; names: string[] }) {
  return (
    <>
      {nameOf(names, ask.asker)} fragt {nameOf(names, ask.target)} nach {ask.card} {cardOf(set.id, ask.card).name} – {ask.got ? 'Treffer!' : 'leider nicht.'}
      {ask.drew.includes(ask.asker) && !ask.got ? ` ${nameOf(names, ask.asker)} zieht eine Karte.` : ''}
    </>
  );
}

function CollectBoard({ view, legalMoves, onMove, viewer, seatNames, hint }: BoardProps<QuartettState, QuartettMove>) {
  const set = setOf(view);
  const hand = viewer === 'spectator' ? [] : (view.hands[viewer] ?? []).filter((c): c is CardId => c !== null);
  const targets = [...new Set(legalMoves.flatMap((m) => (m.type === 'ask' ? [m.target] : [])))];
  const askable = new Set(legalMoves.flatMap((m) => (m.type === 'ask' ? [m.card] : [])));
  const [target, setTarget] = useState<SeatId | null>(null);
  const [card, setCard] = useState<CardId | null>(null);
  // Nach jedem Zug neu wählen; ist nur ein Mitspieler übrig, ist er schon gewählt.
  useEffect(() => {
    setCard(null);
    setTarget(targets.length === 1 ? targets[0]! : null);
  }, [view.asks.length, targets.length === 1 ? targets[0] : null]); // eslint-disable-line react-hooks/exhaustive-deps
  const hintMove = hint?.type === 'ask' ? hint : null;
  const groups = set.groups.filter((g) => hand.some((c) => groupOf(c) === g.id));
  const last = view.asks.at(-1);
  const quartetsOf = (seat: SeatId) => view.quartets.filter((q) => q.seat === seat);
  const others = view.hands.map((_, seat) => seat).filter((seat) => seat !== viewer);
  const ready = target !== null && card !== null && askable.has(card) && targets.includes(target);

  return (
    <div className="qt-table">
      <div className="qt-others">
        {others.map((seat) => {
          const selectable = targets.includes(seat);
          const classes = `qt-seat ${seat === view.turn ? 'qt-turn' : ''} ${target === seat ? 'qt-selected' : ''} ${hintMove?.target === seat ? 'qt-hint' : ''} ${view.hands[seat]!.length === 0 ? 'qt-out' : ''}`;
          const content = (
            <>
              <span className="qt-seat-name" style={{ color: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
                {nameOf(seatNames, seat)}
              </span>
              <CardBack count={view.hands[seat]!.length} label={`${view.hands[seat]!.length} Karten`} />
              <span className="qt-quartets">{quartetsOf(seat).map((q) => <span key={q.group} className="qt-q" style={{ background: GROUP_COLORS[q.group] }}>{q.group}</span>)}</span>
            </>
          );
          return selectable ? (
            <button key={seat} type="button" className={classes} aria-pressed={target === seat} onClick={() => setTarget(seat)}>
              {content}
            </button>
          ) : (
            <div key={seat} className={classes}>
              {content}
            </div>
          );
        })}
        {view.talon.length > 0 && (
          <div className="qt-seat qt-middle">
            <span className="qt-seat-name">Stapel</span>
            <CardBack count={view.talon.length} label={`${view.talon.length} Karten im Stapel`} />
          </div>
        )}
      </div>

      <div className="qt-center qt-collect">
        {last && (
          <p key={view.asks.length} className={`qt-last ${last.got ? 'qt-got' : ''}`} aria-live="polite">
            <AskText ask={last} set={set} names={seatNames} />
          </p>
        )}
        {legalMoves.length > 0 ? (
          <p className="qt-help">{target === null ? 'Wen fragst du? Tippe oben einen Mitspieler an.' : card === null ? 'Welche Karte fehlt dir? Tippe einen grauen Platzhalter an.' : ' '}</p>
        ) : (
          viewer !== 'spectator' && <p className="qt-help">{hand.length === 0 ? 'Du hast keine Karten mehr.' : `${nameOf(seatNames, view.turn)} fragt …`}</p>
        )}
        <div className="qt-hand" aria-label="Deine Karten">
          {groups.map((group) => (
            <div key={group.id} className="qt-group" style={{ '--qt-group': GROUP_COLORS[group.id] } as CSSProperties}>
              <span className="qt-group-name">
                {group.id} · {group.name}
              </span>
              <div className="qt-group-cards">
                {[1, 2, 3, 4].map((n) => {
                  const id = `${group.id}${n}`;
                  const data = cardOf(set.id, id);
                  if (hand.includes(id))
                    return (
                      <span key={id} className="qt-mini" title={data.name}>
                        <span className="qt-mini-emoji">{data.emoji}</span>
                        <span className="qt-mini-name">
                          {id} {data.name}
                        </span>
                      </span>
                    );
                  const pickable = askable.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`qt-mini qt-missing ${card === id ? 'qt-selected' : ''} ${hintMove?.card === id ? 'qt-hint' : ''}`}
                      disabled={!pickable}
                      aria-pressed={card === id}
                      onClick={() => setCard(id)}
                    >
                      <span className="qt-mini-emoji">{data.emoji}</span>
                      <span className="qt-mini-name">
                        {id} {data.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="qt-controls">
        {legalMoves.length > 0 && (
          <button type="button" className="qt-button qt-primary" disabled={!ready} onClick={() => target !== null && card !== null && ready && onMove({ type: 'ask', target, card })}>
            {ready && target !== null && card !== null ? `${nameOf(seatNames, target)}, hast du ${card} ${cardOf(set.id, card).name}?` : 'Fragen'}
          </button>
        )}
        {quartetsOf(viewer === 'spectator' ? -1 : viewer).length > 0 && (
          <p className="qt-help">
            Deine Quartette:{' '}
            <span className="qt-quartets">
              {quartetsOf(viewer as SeatId).map((q) => (
                <span key={q.group} className="qt-q" style={{ background: GROUP_COLORS[q.group] }}>
                  {q.group}
                </span>
              ))}
            </span>
          </p>
        )}
        {view.asks.length > 0 && (
          <details className="qt-log">
            <summary>Fragen bisher ({view.asks.length})</summary>
            <ol reversed>
              {view.asks
                .slice(-30)
                .reverse()
                .map((ask, i) => (
                  <li key={view.asks.length - i}>
                    <AskText ask={ask} set={set} names={seatNames} />
                  </li>
                ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}

function Board(props: BoardProps<QuartettState, QuartettMove>) {
  return props.view.mode === 'trump' ? <TrumpBoard {...props} /> : <CollectBoard {...props} />;
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`qt-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat + 1}
    </span>
  );
}

export const gameUi: GameUi<QuartettState, QuartettMove> = {
  Board,
  SeatSymbol,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    if (view.mode === 'trump') {
      const n = view.stacks[seat]?.length ?? 0;
      return n === 0 ? 'ausgeschieden' : `${n} ${n === 1 ? 'Karte' : 'Karten'}`;
    }
    const q = view.quartets.filter((entry) => entry.seat === seat).length;
    const n = view.hands[seat]?.length ?? 0;
    return q > 0 ? `${q} ${q === 1 ? 'Quartett' : 'Quartette'}` : `${n} ${n === 1 ? 'Karte' : 'Karten'}`;
  },
};
