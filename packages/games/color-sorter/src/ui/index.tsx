import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { useElementSize, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { handLabel, HAND_TYPES, HANDS } from '../cards';
import { BOSS_REROLL_PRICE, BOSSES, creatureFor, DECKS, levelTarget, STAKES, TAGS, TOOL_PRICE } from '../content';
import type { DropLine } from '../drops';
import { modDef } from '../mods';
import { bossFor, effectiveHandSize, FINAL_LEVEL, freeModSlots, HIDDEN_SCORE, isDuelLevel, modCapacity, sellValue, tableInfo } from '../rules';
import { CARD_BACKS } from '../unlocks';
import { Atelier, SetupExtra } from './Atelier';
import { award, discover, useProgress, wasAwarded, withUnlocks } from './progress';
import { previewHand, type ScoreStep } from '../scoring';
import type { Card, HandType, Offer, RunState, SorterMove, SorterState, ViewCard } from '../types';
import { BackContext, CardView, cardDetails, isOpen, Tile } from './Card';
import { describeConsumable, describeMod, describeOffer, describePack, describeTag, describeTool, formatMult, formatNumber, handName } from './texts';
import './styles.css';

type Selected =
  | { kind: 'mod'; index: number }
  | { kind: 'cons'; index: number }
  | { kind: 'offer'; index: number }
  | { kind: 'pack'; index: number }
  | { kind: 'tool' }
  | { kind: 'item'; index: number }
  | null;

const SEAT_COLORS = ['#d6336c', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0c8599', '#e8590c', '#5c940d'];
const ROUND_NAMES = ['Vorhut', 'Wächter', 'Boss'];

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

// ---------------------------------------------------------------- Wertungs-Animation

interface ScoredEvent {
  type: 'scored';
  seat: SeatId;
  cards: Card[];
  scoring: number[];
  label: string;
  steps: ScoreStep[];
  score: number;
  notAllowed: boolean;
  total: number;
}

function useScoring(events: GameEvent[], seat: SeatId | 'spectator') {
  const [anim, setAnim] = useState<{ event: ScoredEvent; tick: number } | null>(null);
  const seen = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    if (seen.current === events) return;
    seen.current = events;
    const scored = events.find((e) => e.type === 'scored' && e.seat === seat) as unknown as ScoredEvent | undefined;
    if (scored) setAnim({ event: scored, tick: 0 });
  }, [events, seat]);
  useEffect(() => {
    if (!anim) return;
    if (anim.tick >= anim.event.steps.length + 4) {
      setAnim(null);
      return;
    }
    const id = window.setTimeout(() => setAnim((a) => (a ? { ...a, tick: a.tick + 1 } : a)), anim.tick < anim.event.steps.length ? 280 : 420);
    return () => window.clearTimeout(id);
  }, [anim]);
  return { anim, skip: () => setAnim(null) };
}

// ---------------------------------------------------------------- Lieferung auspacken

/** Bühne beim Öffnen: 0 Paket wackelt, 1 Klebeband reißt, ab 2 dreht sich eine Karte nach der anderen um. */
function usePackReveal(events: GameEvent[], seat: SeatId | 'spectator', count: number) {
  const [stage, setStage] = useState(99);
  const seen = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    if (seen.current === events) return;
    seen.current = events;
    if (events.some((e) => e.type === 'packOpened' && e.seat === seat)) setStage(0);
  }, [events, seat]);
  useEffect(() => {
    if (stage >= 2 + count) return;
    const id = window.setTimeout(() => setStage((s) => s + 1), stage === 0 ? 700 : stage === 1 ? 450 : 300);
    return () => window.clearTimeout(id);
  }, [stage, count]);
  return { stage, finish: () => setStage(99) };
}

// ---------------------------------------------------------------- Bausteine

function Lives({ lives }: { lives: number }) {
  return <span aria-label={`${lives} Leben`}>{'❤️'.repeat(Math.max(0, Math.min(lives, 8)))}</span>;
}

function enemyOf(state: SorterState, run: RunState): { emoji: string; name: string; text?: string } {
  const round = run.current;
  if (round?.duel || (run.round === 2 && isDuelLevel(state, run.level)))
    return {
      emoji: '⚔️',
      name: 'Duell',
      text: 'Wer weniger Punkte holt, verliert ein Leben.',
    };
  if (run.round === 2) {
    const boss = BOSSES[round?.boss ?? bossFor(state, run)]!;
    return { emoji: boss.emoji, name: boss.name, text: boss.text };
  }
  return creatureFor(run.level, run.round);
}

function targetFor(state: SorterState, run: RunState): number {
  if (run.current) return run.current.target;
  if (run.round === 2 && isDuelLevel(state, run.level)) return 0;
  const boss = run.round === 2 ? BOSSES[bossFor(state, run)] : undefined;
  return Math.round(levelTarget(run.level, state.stake) * [1, 1.5, 2][run.round]! * (boss?.targetFactor ?? 1));
}

function InfoBox({ title, emoji, text, actions, onClose }: { title: string; emoji: string; text: ReactNode; actions?: ReactNode; onClose: () => void }) {
  return (
    <div className="cs-info" role="dialog" aria-label={title}>
      <div className="cs-info-head">
        <span className="cs-info-emoji" aria-hidden="true">
          {emoji}
        </span>
        <strong>{title}</strong>
        <button type="button" className="cs-x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="cs-info-text">{text}</div>
      {actions && <div className="cs-info-actions">{actions}</div>}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, hint, label }: { children: ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean; hint?: boolean; label?: string }) {
  return (
    <button type="button" className={`cs-btn ${primary ? 'cs-btn-primary' : ''} ${hint ? 'cs-hint' : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Brett

function Board({ view, legalMoves, onMove, events, hint, viewer, seatNames }: BoardProps<SorterState, SorterMove>) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const seat = viewer === 'spectator' ? null : viewer;
  const run = seat === null ? null : (view.runs[seat] ?? null);
  const [pickedState, setPicked] = useState<number[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [showLevels, setShowLevels] = useState(false);
  const handKey = run ? `${run.phase}/${run.level}/${run.round}/${run.hand.map((c) => c.id).join(',')}/${run.pack?.items.length ?? ''}` : '';
  const [lastKey, setLastKey] = useState(handKey);
  const stale = lastKey !== handKey;
  if (stale) {
    setLastKey(handKey);
    setPicked([]);
    if (selected?.kind !== 'mod') setSelected(null);
  }
  // Nach einem Zug gehört die alte Auswahl zu einer anderen Hand.
  const picked = stale ? [] : pickedState.filter((i) => i < (run?.pack ? run.pack.hand.length : (run?.hand.length ?? 0)));
  const { anim, skip } = useScoring(events, viewer);
  const reveal = usePackReveal(events, viewer, run?.pack?.items.length ?? 0);
  const can = (move: SorterMove) => legalMoves.some((m) => JSON.stringify(m) === JSON.stringify(move));
  const find = (pred: (m: SorterMove) => boolean) => legalMoves.find(pred);
  const wide = size.width > size.height * 1.25 && size.width > 640;
  const multi = view.runs.length > 1;
  const progress = useProgress();
  const [atelier, setAtelier] = useState(false);
  const [earned, setEarned] = useState<DropLine[] | null>(null);
  // Plätze, die auf diesem Gerät gespielt wurden – nur sie bekommen Farbtropfen.
  const localSeats = useRef(new Set<number>());
  if (seat !== null) localSeats.current.add(seat);
  useEffect(() => {
    if (seat !== null) discover(view, seat);
  }, [view, seat]);
  useEffect(() => {
    if (!view.winners) return;
    const fresh = award(view, [...localSeats.current]);
    const mine = fresh.find((f) => f.seat === seat) ?? fresh[0];
    if (mine) setEarned(mine.lines);
  }, [view, seat]);
  const atelierModal = atelier && <Atelier onClose={() => setAtelier(false)} />;
  const back = CARD_BACKS.find((b) => b.key === progress.back)?.emoji ?? '🎨';

  if (!run)
    return (
      <>
        <Overview view={view} seatNames={seatNames} refEl={ref} />
        {atelierModal}
      </>
    );

  // Kartengröße: acht Karten (mit Überlappung) passen in die Breite, dazu genug Höhe.
  const handCount = Math.max(effectiveHandSize(run), run.hand.length, 5);
  const areaW = wide ? size.width * 0.58 : size.width;
  const cardW = Math.max(40, Math.min(96, (areaW - 12) / (handCount * 0.86), size.height > 0 ? size.height / (wide ? 3.6 : 6.4) : 96));

  const hintCards = hint && (hint.type === 'play' || hint.type === 'discard') ? hint.cards : [];
  const togglePick = (i: number) => {
    setSelected((s) => (s?.kind === 'cons' ? s : null));
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= 5 ? p : [...p, i]));
  };

  const pickedOpen = picked.filter((i) => isOpen(run.hand[i]!));
  const held = run.hand.filter((c, i) => !picked.includes(i) && isOpen(c)) as Card[];
  const preview =
    run.phase === 'play' && pickedOpen.length > 0 && pickedOpen.length === picked.length
      ? previewHand(
          run,
          pickedOpen.map((i) => run.hand[i] as Card),
          held,
          tableInfo(view, run.seat),
        )
      : null;
  const sortedPick = [...picked].sort((a, b) => a - b);

  // --- Kopf: Gegner, Ziel, Punkte, Token
  const enemy = enemyOf(view, run);
  const target = targetFor(view, run);
  const round = run.current;
  const header = (
    <div className="cs-head">
      {run.phase === 'play' && (
        <div className={`cs-enemy ${round?.boss ? 'cs-boss' : ''}`}>
          <span className="cs-enemy-emoji" aria-hidden="true">
            {enemy.emoji}
          </span>
          <div className="cs-enemy-text">
            <strong>{enemy.name}</strong>
            {enemy.text && <span className="cs-muted">{enemy.text}</span>}
            {target > 0 && (
              <div className="cs-bar" aria-label={`Ziel ${target}, erreicht ${round?.score ?? 0}`}>
                <div
                  className="cs-bar-fill"
                  style={{
                    width: `${Math.min(100, ((round?.score ?? 0) / target) * 100)}%`,
                  }}
                />
                <span>
                  {formatNumber(round?.score ?? 0)} / {formatNumber(target)}
                </span>
              </div>
            )}
            {target === 0 && round && <span className="cs-duel-score">Deine Punkte: {formatNumber(round.score)}</span>}
          </div>
        </div>
      )}
      <div className="cs-stats">
        <span title="Level und Runde">
          🗺️ {view.endless && run.level > FINAL_LEVEL ? `${run.level} ∞` : `${run.level}/${FINAL_LEVEL}`} · {ROUND_NAMES[run.round]}
        </span>
        <span title="Token">🔩 {run.tokens} T</span>
        {round && (
          <span title="Hände und Verwerfen">
            ✋ {round.handsLeft} · 🗑️ {round.discardsLeft}
          </span>
        )}
        {multi && view.mode !== 'survival' && view.mode !== 'race' && <Lives lives={run.lives} />}
        <button type="button" className="cs-link" onClick={() => setShowLevels((v) => !v)}>
          📋 Kombis
        </button>
      </div>
    </div>
  );

  // --- Mods und Verbrauchsgegenstände
  const modsRow = (
    <div className="cs-row cs-mods" aria-label="Mods">
      {run.mods.map((mod, index) => {
        const d = describeMod(mod);
        return (
          <Tile
            key={mod.uid}
            emoji={d.emoji}
            title={d.title}
            tone={`${d.tone} ${mod.foil ? `cs-foil-${mod.foil}` : ''} ${mod.spent ? 'cs-dim' : ''}`}
            badge={mod.sticker ? { eternal: '📌', perishable: '⏳', rental: '🔑' }[mod.sticker] : mod.value !== undefined && modDef(mod.key).initial !== undefined ? formatMult(mod.value) : undefined}
            selected={selected?.kind === 'mod' && selected.index === index}
            onClick={() => setSelected(selected?.kind === 'mod' && selected.index === index ? null : { kind: 'mod', index })}
            pop={
              anim && anim.tick < anim.event.steps.length && anim.event.steps[anim.tick]?.src === 'mod' && anim.event.steps[anim.tick]?.id === mod.uid
                ? stepText(anim.event.steps[anim.tick]!)
                : undefined
            }
          />
        );
      })}
      {run.mods.length === 0 && <span className="cs-muted cs-empty-note">Noch keine Mods</span>}
      <span className="cs-slots cs-muted">
        {run.mods.length}/{modCapacity(run)}
      </span>
      <span className="cs-sep" aria-hidden="true" />
      {run.consumables.map((item, index) => {
        const d = describeConsumable(item);
        return (
          <Tile
            key={`c-${index}`}
            emoji={d.emoji}
            title={d.title}
            tone={d.tone}
            selected={selected?.kind === 'cons' && selected.index === index}
            onClick={() => setSelected(selected?.kind === 'cons' && selected.index === index ? null : { kind: 'cons', index })}
          />
        );
      })}
      <span className="cs-slots cs-muted" title="Zauber-, Nagel- und Traumkarten">
        🧺 {run.consumables.length}/{run.consumableSlots}
      </span>
    </div>
  );

  // --- Info zur Auswahl
  let info: ReactNode = null;
  if (selected?.kind === 'mod' && run.mods[selected.index]) {
    const mod = run.mods[selected.index]!;
    const d = describeMod(mod);
    const index = selected.index;
    const sell = find((m) => m.type === 'sellMod' && m.index === index);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={d.title}
        text={d.text}
        onClose={() => setSelected(null)}
        actions={
          <>
            <Btn
              disabled={index === 0 || !can({ type: 'moveMod', from: index, to: index - 1 })}
              onClick={() => (onMove({ type: 'moveMod', from: index, to: index - 1 }), setSelected({ kind: 'mod', index: index - 1 }))}
              label="nach links"
            >
              ◀
            </Btn>
            <Btn
              disabled={index >= run.mods.length - 1 || !can({ type: 'moveMod', from: index + 1, to: index })}
              onClick={() => (onMove({ type: 'moveMod', from: index, to: index + 1 }), setSelected({ kind: 'mod', index: index + 1 }))}
              label="nach rechts"
            >
              ▶
            </Btn>
            <Btn disabled={!sell} onClick={() => sell && (onMove(sell), setSelected(null))}>
              Verkaufen (+{sellValue(mod)} T)
            </Btn>
          </>
        }
      />
    );
  } else if (selected?.kind === 'cons' && run.consumables[selected.index]) {
    const item = run.consumables[selected.index]!;
    const d = describeConsumable(item);
    const index = selected.index;
    const use = find((m) => m.type === 'use' && m.index === index && same(m.cards, sortedPick));
    const sell = find((m) => m.type === 'sellConsumable' && m.index === index);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={d.title}
        text={
          <>
            {d.text}
            {!use && run.phase === 'play' && <span className="cs-muted"> – wähle dafür passende Karten aus.</span>}
            {!use && run.phase !== 'play' && item.kind !== 'nail' && <span className="cs-muted"> – Karten lassen sich nur während einer Runde auswählen.</span>}
          </>
        }
        onClose={() => setSelected(null)}
        actions={
          <>
            <Btn primary disabled={!use} onClick={() => use && (onMove(use), setSelected(null))}>
              Anwenden
            </Btn>
            <Btn disabled={!sell} onClick={() => sell && (onMove(sell), setSelected(null))}>
              Verkaufen (+1 T)
            </Btn>
          </>
        }
      />
    );
  } else if (picked.length === 1 && run.phase === 'play' && isOpen(run.hand[picked[0]!]!)) {
    const lines = cardDetails(run.hand[picked[0]!] as Card);
    if (lines.length > 1) info = <p className="cs-cardinfo">{lines.join(' · ')}</p>;
  }

  // --- Phasen
  let main: ReactNode = null;
  if (run.phase === 'play' && round) {
    const playMove = find((m) => m.type === 'play' && same(m.cards, sortedPick));
    const discardMove = find((m) => m.type === 'discard' && same(m.cards, sortedPick));
    main = (
      <div className="cs-play">
        <div className="cs-score" aria-live="polite">
          <span className="cs-score-label">
            {preview
              ? handLabel(
                  preview.type,
                  pickedOpen.map((i) => run.hand[i] as Card),
                ) + ` · Lvl ${run.handLevels[preview.type]}`
              : picked.length
                ? 'Verdeckte Karte dabei'
                : 'Karten auswählen'}
          </span>
          <span className="cs-chips">{preview ? formatNumber(preview.chips) : '–'}</span>
          <span className="cs-times">×</span>
          <span className="cs-mult">{preview ? formatMult(preview.mult) : '–'}</span>
          {preview && <span className="cs-preview">= {formatNumber(preview.score)}</span>}
        </div>
        <div className="cs-hand" style={{ ['--cw' as string]: `${cardW}px` }}>
          {run.hand.map((card, i) => (
            <CardView key={isOpen(card) ? card.id : `h${i}`} card={card as ViewCard} selected={picked.includes(i)} hint={hintCards.includes(i)} onClick={() => togglePick(i)} style={{ zIndex: i }} />
          ))}
        </div>
        <div className="cs-actions">
          <Btn primary disabled={!playMove} hint={hint?.type === 'play'} onClick={() => playMove && onMove(playMove)}>
            Abschicken
          </Btn>
          <Btn disabled={!discardMove} hint={hint?.type === 'discard'} onClick={() => discardMove && onMove(discardMove)}>
            Verwerfen ({round.discardsLeft})
          </Btn>
          <span className="cs-sort">
            <button type="button" className="cs-link" onClick={() => can({ type: 'sortHand', by: 'rank' }) && onMove({ type: 'sortHand', by: 'rank' })} aria-label="Nach Rang sortieren">
              🔢
            </button>
            <button type="button" className="cs-link" onClick={() => can({ type: 'sortHand', by: 'color' }) && onMove({ type: 'sortHand', by: 'color' })} aria-label="Nach Farbe sortieren">
              🌈
            </button>
            <span className="cs-muted" title="Karten im Stapel">
              🂠 {run.pileCount ?? run.pile.length}
            </span>
          </span>
        </div>
      </div>
    );
  } else if (run.phase === 'choose') {
    main = <ChoosePanel view={view} run={run} can={can} onMove={onMove} hint={hint} />;
  } else if (run.phase === 'shop' && run.shop) {
    main = <ShopPanel run={run} can={can} find={find} onMove={onMove} hint={hint} selected={selected} setSelected={setSelected} />;
  } else if (run.phase === 'pack' && run.pack) {
    main = (
      <PackPanel
        run={run}
        find={find}
        onMove={onMove}
        hint={hint}
        selected={selected}
        setSelected={setSelected}
        picked={picked}
        togglePick={togglePick}
        stage={reveal.stage}
        finish={reveal.finish}
        cardW={cardW}
      />
    );
  } else if (run.phase === 'wait') {
    main = (
      <div className="cs-panel cs-center">
        <p className="cs-big">⏳</p>
        <p>{view.duel ? 'Du bist fertig. Gleich wird abgerechnet …' : `Treffpunkt Level ${run.level}: Warte auf die anderen, dann beginnt das Duell.`}</p>
      </div>
    );
  }
  if (view.winners || run.phase === 'out' || run.phase === 'won') {
    const won = view.winners?.includes(run.seat) ?? run.phase === 'won';
    const endlessRun = view.endless && run.level > FINAL_LEVEL;
    main = (
      <div className="cs-panel cs-center">
        <p className="cs-big">{won ? '🏆' : '🫠'}</p>
        <p>
          {run.phase === 'won'
            ? 'Alle Level geschafft!'
            : endlessRun
              ? `Endlos-Modus: bis Level ${run.level} gekommen!`
              : run.phase === 'out'
                ? `Ausgeschieden in Level ${run.level}.`
                : won
                  ? 'Gewonnen – alle anderen sind raus!'
                  : `Level ${run.level}`}
        </p>
        <p className="cs-muted">
          {run.bossesBeaten} Bosse besiegt · beste Hand {formatNumber(run.bestHand)} Punkte
        </p>
        <DropsSummary lines={earned} pending={!view.winners} done={!!view.winners && wasAwarded(view, run.seat)} />
        <Btn onClick={() => setAtelier(true)}>🎨 Atelier öffnen (💧 {progress.drops})</Btn>
      </div>
    );
  }

  const others = multi ? <OthersStrip view={view} me={run.seat} seatNames={seatNames} /> : null;

  return (
    <BackContext.Provider value={back}>
      <div ref={ref} className={`cs-board ${wide ? 'cs-wide' : ''}`} data-theme={progress.theme} data-back={progress.back}>
        <div className="cs-side">
          {header}
          {others}
          {modsRow}
          {info}
          {view.lastDuel && run.phase === 'shop' && <DuelResult view={view} seatNames={seatNames} />}
        </div>
        <div className="cs-mainarea">{main}</div>
        {showLevels && <LevelsTable run={run} onClose={() => setShowLevels(false)} />}
        {anim && (
          <button type="button" className="cs-anim" onClick={skip} aria-label="Wertung überspringen">
            <span className="cs-anim-label">{anim.event.notAllowed ? `${anim.event.label} – nicht erlaubt!` : anim.event.label}</span>
            <span className="cs-anim-cards" style={{ ['--cw' as string]: `${Math.min(cardW, 84)}px` }}>
              {anim.event.cards.map((card) => {
                const step = anim.event.steps[anim.tick];
                const active = step && step.src === 'card' && step.id === card.id;
                return <CardView key={card.id} card={card} dim={!anim.event.scoring.includes(card.id)} className={active ? 'cs-active' : ''} pop={active ? stepText(step) : undefined} />;
              })}
            </span>
            <span className="cs-score cs-score-anim">
              <span className="cs-chips">{formatNumber(currentTotals(anim.event, anim.tick).chips)}</span>
              <span className="cs-times">×</span>
              <span className="cs-mult">{formatMult(currentTotals(anim.event, anim.tick).mult)}</span>
            </span>
            {anim.tick >= anim.event.steps.length && <span className="cs-anim-total">+{formatNumber(anim.event.score)}</span>}
            <span className="cs-muted">Tippen zum Überspringen</span>
          </button>
        )}
        {atelierModal}
      </div>
    </BackContext.Provider>
  );
}

function DropsSummary({ lines, pending, done }: { lines: DropLine[] | null; pending: boolean; done: boolean }) {
  if (pending) return <p className="cs-small-text">💧 Farbtropfen gibt es, sobald die Partie zu Ende ist.</p>;
  if (!lines) return done ? <p className="cs-small-text">💧 Farbtropfen für diese Partie sind schon gutgeschrieben.</p> : null;
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="cs-drops-box">
      <strong>💧 +{sum} Farbtropfen</strong>
      {lines.map((l, i) => (
        <span key={i} className="cs-small-text">
          {l.once ? '🎯 ' : ''}
          {l.label}: +{l.amount}
        </span>
      ))}
      {lines.length === 0 && <span className="cs-small-text">Diesmal keine – schaffe ein Level, dann gibt es welche.</span>}
    </div>
  );
}

function previewParts(run: RunState, type: HandType) {
  return {
    chips: HANDS[type].chips + HANDS[type].chipsPerLevel * (run.handLevels[type] - 1),
    mult: HANDS[type].mult + HANDS[type].multPerLevel * (run.handLevels[type] - 1),
  };
}

function currentTotals(event: ScoredEvent, tick: number) {
  const step = event.steps[Math.min(tick, event.steps.length - 1)];
  return step?.total ?? { chips: 0, mult: 0 };
}

function stepText(step: ScoreStep): string {
  if (step.debuffed) return '🚫';
  const parts: string[] = [];
  if (step.chips) parts.push(`${step.chips > 0 ? '+' : ''}${step.chips}`);
  if (step.mult) parts.push(`+${formatMult(step.mult)} Mult`);
  if (step.xmult !== undefined) parts.push(`×${formatMult(step.xmult)}`);
  if (step.tokens) parts.push(`${step.tokens > 0 ? '+' : ''}${step.tokens} T`);
  return parts.join(' ');
}

// ---------------------------------------------------------------- Vor der Runde

function ChoosePanel({ view, run, can, onMove, hint }: { view: SorterState; run: RunState; can: (m: SorterMove) => boolean; onMove: (m: SorterMove) => void; hint: SorterMove | null }) {
  const enemy = enemyOf(view, run);
  const target = targetFor(view, run);
  const tag = run.round < 2 ? (view.tags[(run.level - 1) * 2 + run.round] ?? null) : null;
  const tagInfo = tag ? describeTag(tag) : null;
  const reward = run.round === 0 && view.stake >= 2 ? 0 : [3, 4, 5][run.round];
  return (
    <div className="cs-panel cs-center">
      <p className="cs-muted">
        Level {run.level} · {ROUND_NAMES[run.round]}
      </p>
      <p className="cs-big" aria-hidden="true">
        {enemy.emoji}
      </p>
      <p className="cs-title">{enemy.name}</p>
      {enemy.text && <p>{enemy.text}</p>}
      <p>
        Ziel: <strong>{formatNumber(target)}</strong> Punkte · Belohnung: {reward} T
      </p>
      <div className="cs-actions">
        <Btn primary hint={hint?.type === 'start'} onClick={() => onMove({ type: 'start' })}>
          Los geht's
        </Btn>
        {tagInfo && (
          <Btn disabled={!can({ type: 'skip' })} hint={hint?.type === 'skip'} onClick={() => onMove({ type: 'skip' })}>
            Überspringen: {tagInfo.emoji} {tagInfo.title}
          </Btn>
        )}
      </div>
      {tagInfo && (
        <p className="cs-muted">
          Sticker „{tagInfo.title}“: {tagInfo.text}
        </p>
      )}
      {can({ type: 'rerollBoss' }) && (
        <Btn hint={hint?.type === 'rerollBoss'} onClick={() => onMove({ type: 'rerollBoss' })}>
          {run.tools.includes('scope2') ? '🛰️' : '🔭'} Anderen Boss wählen ({BOSS_REROLL_PRICE} T)
        </Btn>
      )}
      {run.round === 0 && <BossPreview view={view} run={run} />}
    </div>
  );
}

function BossPreview({ view, run }: { view: SorterState; run: RunState }) {
  if (isDuelLevel(view, run.level)) return <p className="cs-muted">Am Ende dieses Levels wartet ein ⚔️ Duell.</p>;
  const boss = BOSSES[bossFor(view, run)]!;
  return (
    <p className="cs-muted">
      Boss dieses Levels: {boss.emoji} {boss.name} – {boss.text}
    </p>
  );
}

// ---------------------------------------------------------------- Sortier-Zentrale

interface ShopProps {
  run: RunState;
  can: (m: SorterMove) => boolean;
  find: (pred: (m: SorterMove) => boolean) => SorterMove | undefined;
  onMove: (m: SorterMove) => void;
  hint: SorterMove | null;
  selected: Selected;
  setSelected: (s: Selected) => void;
}

function ShopPanel({ run, can, find, onMove, hint, selected, setSelected }: ShopProps) {
  const shop = run.shop!;
  const payout = run.lastPayout;
  const sel = selected;
  let info: ReactNode = null;
  if (sel?.kind === 'offer' && shop.offers[sel.index]) {
    const offer = shop.offers[sel.index]!;
    const d = describeOffer(offer);
    const buy = find((m) => m.type === 'buy' && m.index === sel.index);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={d.title}
        text={d.text}
        onClose={() => setSelected(null)}
        actions={
          <Btn primary disabled={!buy} onClick={() => buy && (onMove(buy), setSelected(null))}>
            {buy ? `Kaufen (${offer.price} T)` : offer.price > run.tokens ? 'Zu wenig Token' : 'Kein Platz'}
          </Btn>
        }
      />
    );
  } else if (sel?.kind === 'pack' && shop.packs[sel.index]) {
    const pack = shop.packs[sel.index]!;
    const d = describePack(pack);
    const buy = find((m) => m.type === 'buyPack' && m.index === sel.index);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={d.title}
        text={d.text}
        onClose={() => setSelected(null)}
        actions={
          <Btn primary disabled={!buy} onClick={() => buy && (onMove(buy), setSelected(null))}>
            {buy ? `Öffnen (${pack.price} T)` : 'Zu wenig Token'}
          </Btn>
        }
      />
    );
  } else if (sel?.kind === 'tool' && shop.tool) {
    const d = describeTool(shop.tool);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={`Werkzeug: ${d.title}`}
        text={d.text}
        onClose={() => setSelected(null)}
        actions={
          <Btn primary disabled={!can({ type: 'buyTool' })} onClick={() => (onMove({ type: 'buyTool' }), setSelected(null))}>
            Kaufen ({Math.max(1, Math.floor(TOOL_PRICE * (run.tools.includes('bigSale') ? 0.5 : run.tools.includes('sale') ? 0.75 : 1)))} T)
          </Btn>
        }
      />
    );
  }
  const isHint = (m: Partial<SorterMove>) => !!hint && Object.entries(m).every(([k, v]) => (hint as Record<string, unknown>)[k] === v);
  return (
    <div className="cs-panel cs-shop">
      <div className="cs-shop-head">
        <strong>🏭 Sortier-Zentrale</strong>
        {payout && (payout.reward || payout.hands || payout.bonus || payout.extra) ? (
          <span className="cs-payout">
            Geschafft! +{payout.reward} T Belohnung
            {payout.hands ? `, +${payout.hands} T übrige Hände` : ''}
            {payout.bonus ? `, +${payout.bonus} T Ordnungsbonus` : ''}
            {payout.extra ? `, ${payout.extra > 0 ? '+' : ''}${payout.extra} T Extras` : ''}
          </span>
        ) : payout ? (
          <span className="cs-payout cs-lost">Runde verloren – ein Leben weniger.</span>
        ) : null}
      </div>
      <div className="cs-row cs-offers">
        {shop.offers.map((offer, index) =>
          offer ? (
            <OfferTile
              key={index}
              offer={offer}
              selected={sel?.kind === 'offer' && sel.index === index}
              hint={isHint({ type: 'buy', index })}
              onClick={() => setSelected(sel?.kind === 'offer' && sel.index === index ? null : { kind: 'offer', index })}
            />
          ) : (
            <span key={index} className="cs-tile cs-empty" aria-label="verkauft" />
          ),
        )}
      </div>
      <div className="cs-row cs-offers">
        {shop.packs.map((pack, index) => {
          if (!pack) return <span key={index} className="cs-tile cs-empty" aria-label="verkauft" />;
          const d = describePack(pack);
          return (
            <Tile
              key={index}
              emoji={d.emoji}
              title={d.title}
              sub={`${pack.price} T`}
              tone={`${d.tone} cs-pack-${pack.size}`}
              selected={sel?.kind === 'pack' && sel.index === index}
              hint={isHint({ type: 'buyPack', index })}
              onClick={() => setSelected(sel?.kind === 'pack' && sel.index === index ? null : { kind: 'pack', index })}
            />
          );
        })}
        {shop.tool && (
          <Tile
            emoji={describeTool(shop.tool).emoji}
            title={describeTool(shop.tool).title}
            sub="Werkzeug"
            tone="cs-t-tool"
            selected={sel?.kind === 'tool'}
            hint={isHint({ type: 'buyTool' })}
            onClick={() => setSelected(sel?.kind === 'tool' ? null : { kind: 'tool' })}
          />
        )}
      </div>
      {info}
      <div className="cs-actions">
        <Btn disabled={!can({ type: 'reroll' })} hint={hint?.type === 'reroll'} onClick={() => onMove({ type: 'reroll' })}>
          🔄 Neu sortieren ({shop.rerollCost} T)
        </Btn>
        <Btn primary hint={hint?.type === 'next'} onClick={() => onMove({ type: 'next' })}>
          Weiter ▶
        </Btn>
      </div>
      <p className="cs-muted cs-small-text">
        Mod-Plätze frei: {freeModSlots(run)} · Ordnungsbonus: 1 T je 5 T (bis {run.tools.includes('book2') ? 20 : run.tools.includes('book') ? 10 : 5} T)
      </p>
    </div>
  );
}

function OfferTile({ offer, selected, hint, onClick, pop, className }: { offer: Offer; selected?: boolean; hint?: boolean; onClick?: () => void; pop?: ReactNode; className?: string }) {
  if (offer.type === 'card')
    return (
      <span className={`cs-offer-card ${className ?? ''}`}>
        <CardView card={offer.card} selected={selected} hint={hint} onClick={onClick ? () => onClick() : undefined} />
        {offer.price > 0 && <span className="cs-tile-sub">{offer.price} T</span>}
      </span>
    );
  const d = describeOffer(offer);
  const foil = offer.type === 'mod' && offer.foil ? `cs-foil-${offer.foil}` : '';
  const sticker = offer.type === 'mod' && offer.sticker ? { eternal: '📌', perishable: '⏳', rental: '🔑' }[offer.sticker] : undefined;
  return (
    <Tile
      emoji={d.emoji}
      title={d.title}
      sub={offer.price > 0 ? `${offer.price} T` : undefined}
      badge={sticker}
      tone={`${d.tone} ${foil} ${className ?? ''}`}
      selected={selected}
      hint={hint}
      onClick={onClick}
      pop={pop}
    />
  );
}

// ---------------------------------------------------------------- Lieferung

interface PackProps {
  run: RunState;
  find: (pred: (m: SorterMove) => boolean) => SorterMove | undefined;
  onMove: (m: SorterMove) => void;
  hint: SorterMove | null;
  selected: Selected;
  setSelected: (s: Selected) => void;
  picked: number[];
  togglePick: (i: number) => void;
  stage: number;
  finish: () => void;
  cardW: number;
}

function isSpecial(offer: Offer): boolean {
  if (offer.type === 'mod') return ['rare', 'legendary'].includes(modDef(offer.key).rarity) || !!offer.foil;
  if (offer.type === 'consumable') return offer.item.kind === 'dream' && ['soul', 'blackHole'].includes(offer.item.key);
  return !!offer.card.foil;
}

function PackPanel({ run, find, onMove, hint, selected, setSelected, picked, togglePick, stage, finish, cardW }: PackProps) {
  const pack = run.pack!;
  const d = describePack({ kind: pack.kind, size: 'normal', price: 0 });
  const sorted = [...picked].sort((a, b) => a - b);
  // Bühne: 0 Paket wackelt, 1 Klebeband reißt, ab 2 werden die Karten einzeln umgedreht.
  if (stage < 2) {
    return (
      <button type="button" className="cs-panel cs-center cs-delivery" onClick={finish} aria-label="Lieferung öffnen">
        <span className={`cs-box ${stage === 0 ? 'cs-wobble' : 'cs-tear'}`} aria-hidden="true">
          📦
        </span>
        <span className="cs-title">{d.title} kommt an …</span>
        <span className="cs-muted">Tippen zum Auspacken</span>
      </button>
    );
  }
  const shown = stage - 2;
  const sel = selected?.kind === 'item' ? selected.index : null;
  const offer = sel !== null ? pack.items[sel] : undefined;
  const pick = sel !== null ? find((m) => m.type === 'pick' && m.index === sel && same(m.cards, sorted)) : undefined;
  return (
    <div className="cs-panel cs-pack" onClick={shown < pack.items.length ? finish : undefined}>
      <div className="cs-shop-head">
        <strong>
          {d.emoji} {d.title}
        </strong>
        <span className="cs-muted">Noch {pack.picksLeft} aussuchen</span>
      </div>
      <div className="cs-row cs-offers cs-pack-items">
        {pack.items.map((item, index) =>
          index < shown || stage >= 99 ? (
            <OfferTile
              key={index}
              offer={item}
              className={`cs-flip ${isSpecial(item) ? 'cs-special' : ''}`}
              selected={sel === index}
              hint={hint?.type === 'pick' && hint.index === index}
              onClick={() => setSelected(sel === index ? null : { kind: 'item', index })}
            />
          ) : (
            <span key={index} className="cs-tile cs-facedown" aria-label="noch verdeckt">
              ❔
            </span>
          ),
        )}
      </div>
      {offer && (
        <InfoBox
          emoji={describeOffer(offer).emoji}
          title={describeOffer(offer).title}
          text={
            <>
              {describeOffer(offer).text}
              {offer.type === 'consumable' && pack.hand.length > 0 && offer.item.kind !== 'nail' && !pick && <span className="cs-muted"> – wähle unten passende Karten aus.</span>}
            </>
          }
          onClose={() => setSelected(null)}
          actions={
            <Btn primary disabled={!pick} onClick={() => pick && (onMove(pick), setSelected(null))}>
              {offer.type === 'consumable' && offer.item.kind !== 'nail' ? 'Anwenden' : 'Nehmen'}
            </Btn>
          }
        />
      )}
      {pack.hand.length > 0 && (
        <div className="cs-hand cs-hand-small" style={{ ['--cw' as string]: `${Math.min(cardW, 70)}px` }}>
          {pack.hand.map((card, i) => (
            <CardView key={card.id} card={card} selected={picked.includes(i)} hint={hint?.type === 'pick' && hint.cards.includes(i)} onClick={() => togglePick(i)} />
          ))}
        </div>
      )}
      <div className="cs-actions">
        <Btn hint={hint?.type === 'skipPack'} onClick={() => onMove({ type: 'skipPack' })}>
          Fertig
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Mehrspieler

function OthersStrip({ view, me, seatNames }: { view: SorterState; me: SeatId; seatNames: string[] }) {
  return (
    <div className="cs-others" aria-label="Mitspieler">
      {view.runs
        .filter((r) => r.seat !== me)
        .map((r) => (
          <div key={r.seat} className={`cs-other ${r.phase === 'out' ? 'cs-dim' : ''}`}>
            <span className="cs-dot" style={{ background: SEAT_COLORS[r.seat % SEAT_COLORS.length] }} />
            <strong>{seatNames[r.seat] ?? `Platz ${r.seat + 1}`}</strong>
            <span className="cs-muted">
              L{r.level} {ROUND_NAMES[r.round]?.[0]} · {phaseText(r)}
            </span>
            {(view.mode === 'duel' || view.mode === 'showdown') && <Lives lives={r.lives} />}
            {r.current?.duel && (
              <span title={r.current.score === HIDDEN_SCORE ? 'Geheim bis zur Abrechnung – außer mit dem Spion' : undefined}>
                ⚔️ {r.current.score === HIDDEN_SCORE ? '?' : formatNumber(r.current.score)}
              </span>
            )}
            <span className="cs-other-mods" aria-label="Mods">
              {r.mods.map((m) => modDef(m.key).emoji).join('')}
            </span>
          </div>
        ))}
    </div>
  );
}

function phaseText(run: RunState): string {
  return {
    choose: 'wählt',
    play: 'spielt',
    shop: 'in der Zentrale',
    pack: 'packt aus',
    wait: 'wartet',
    out: 'raus',
    won: 'geschafft',
  }[run.phase];
}

function DuelResult({ view, seatNames }: { view: SorterState; seatNames: string[] }) {
  const duel = view.lastDuel!;
  return (
    <div className="cs-duel">
      <strong>⚔️ Duell Level {duel.level}</strong>
      {duel.scores.map((score, seat) =>
        score === null ? null : (
          <span key={seat} className={duel.losers.includes(seat) ? 'cs-lost' : ''}>
            {seatNames[seat] ?? `Platz ${seat + 1}`}: {formatNumber(score)}
            {duel.losers.includes(seat) ? ' 💔' : ''}
          </span>
        ),
      )}
    </div>
  );
}

function Overview({ view, seatNames, refEl }: { view: SorterState; seatNames: string[]; refEl: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={refEl} className="cs-board cs-overview">
      <p className="cs-title">🎨 Farbensortierer</p>
      <p className="cs-muted">
        {DECKS.find((d) => d.key === view.deckKind)?.name} · Sortierstufe {STAKES[view.stake - 1]?.name}
      </p>
      {view.runs.map((r) => (
        <div key={r.seat} className="cs-other">
          <span className="cs-dot" style={{ background: SEAT_COLORS[r.seat % SEAT_COLORS.length] }} />
          <strong>{seatNames[r.seat] ?? `Platz ${r.seat + 1}`}</strong>
          <span className="cs-muted">
            Level {r.level} · {ROUND_NAMES[r.round]} · {phaseText(r)}
          </span>
          {view.runs.length > 1 && <Lives lives={r.lives} />}
          <span>{r.mods.map((m) => modDef(m.key).emoji).join('')}</span>
        </div>
      ))}
    </div>
  );
}

function LevelsTable({ run, onClose }: { run: RunState; onClose: () => void }) {
  const rows = HAND_TYPES.filter((t) => !HANDS[t].secret || run.handPlays[t] > 0);
  return (
    <div className="cs-levels" role="dialog" aria-label="Kombis">
      <div className="cs-info-head">
        <strong>📋 Kombis</strong>
        <button type="button" className="cs-x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Kombi</th>
            <th>Lvl</th>
            <th>Chips × Mult</th>
            <th>gespielt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t}>
              <td>{handName(t)}</td>
              <td>{run.handLevels[t]}</td>
              <td>
                {previewParts(run, t).chips} × {previewParts(run, t).mult}
              </td>
              <td>{run.handPlays[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cs-muted cs-small-text">
        Deck: {run.deck.length} Karten · Werkzeuge: {run.tools.length ? run.tools.map((k) => describeTool(k).emoji + ' ' + describeTool(k).title).join(', ') : 'keine'}
        {run.stickers.length ? ` · Sticker: ${run.stickers.map((k) => TAGS[k]?.emoji).join(' ')}` : ''}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Platzsymbol

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`cs-symbol ${className}`} style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}>
      {seat + 1}
    </span>
  );
}

export const gameUi: GameUi<SorterState, SorterMove> = {
  Board,
  SeatSymbol,
  prepareOptions: withUnlocks,
  SetupExtra,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const run = view.runs[seat];
    if (!run) return null;
    const lives = view.mode === 'duel' || view.mode === 'showdown' ? ` · ${'❤️'.repeat(Math.max(0, run.lives))}` : '';
    if (run.phase === 'out') return `raus in Level ${run.level}`;
    if (run.phase === 'won') return 'geschafft 🏆';
    return `Level ${run.level} · ${ROUND_NAMES[run.round]}${lives}`;
  },
};
