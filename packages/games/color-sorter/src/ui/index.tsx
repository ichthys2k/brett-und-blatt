import { DECK_STYLE_CHOICES, type GameEvent, type SeatId } from '@brett-und-blatt/engine';
import { useElementSize, usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { handLabel, HAND_TYPES, HANDS } from '../cards';
import { BOSS_REROLL_PRICE, BOSSES, courtierFor, DECKS, levelTarget, STAKES, TAGS, TOOL_PRICE } from '../content';
import type { DropLine } from '../drops';
import { modDef } from '../mods';
import { altTag, bonusCap, BONUS_STEP, bossFor, effectiveHandSize, FINAL_LEVEL, freeModSlots, HIDDEN_SCORE, isDuelLevel, modCapacity, ROUND_FACTORS, ROUND_REWARDS, sellValue, tableInfo } from '../rules';
import { CARD_BACKS } from '../unlocks';
import { Atelier, SetupExtra } from './Atelier';
import { award, discover, readCardLook, useProgress, wasAwarded, withUnlocks, writeCardLook, type CardLook } from './progress';
import { previewHand, type ScoreStep } from '../scoring';
import type { Card, HandType, Offer, RunState, SorterMove, SorterState, ViewCard } from '../types';
import { BackContext, CardView, cardDetails, cardTip, DeckStyleContext, isOpen, Tile } from './Card';
import { HoverProvider, tipFrom, type ExtraProps } from './Hover';
import { describeConsumable, describeMod, describeOffer, describePack, describeTag, describeTool, formatMult, formatNumber, handName } from './texts';
import { playBossSound, playEffect, playHandAnnouncement } from './audio';
import { hasMoods, portraitUrl, preloadPortrait, stageOf, type PortraitStage } from './portraits';
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
const ROUND_NAMES = ['Morgenaudienz', 'Festmahl', 'Thronsaal'];

/** Was gerade gezogen wird. Ziele tragen `data-drop-target`: hand:<i>, mod:<i>, bench, play, discard, use, sell, buy. */
type DragItem =
  | { kind: 'hand'; index: number }
  | { kind: 'mod'; index: number }
  | { kind: 'cons'; index: number }
  | { kind: 'offer'; index: number }
  | { kind: 'pack'; index: number }
  | { kind: 'tool' }
  | { kind: 'pick'; index: number };

type DragProps = (item: DragItem, target?: string) => ExtraProps;

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

// ---------------------------------------------------------------- Wertungs-Animation

interface ScoredEvent {
  type: 'scored';
  seat: SeatId;
  cards: Card[];
  scoring: number[];
  label: string;
  handType?: HandType;
  steps: ScoreStep[];
  score: number;
  notAllowed: boolean;
  total: number;
}

function useScoring(events: GameEvent[], seat: SeatId | 'spectator') {
  /** `won`: Runde der Audienz, die mit dieser Vorführung gewonnen ist (für den Jubel). */
  const [anim, setAnim] = useState<{ event: ScoredEvent; tick: number; won: number | null } | null>(null);
  const seen = useRef<GameEvent[] | null>(null);
  useEffect(() => {
    if (seen.current === events) return;
    seen.current = events;
    const scored = events.find((e) => e.type === 'scored' && e.seat === seat) as unknown as ScoredEvent | undefined;
    if (scored) {
      const won = events.find((e) => e.type === 'roundWon' && e.seat === seat) as { round?: number } | undefined;
      setAnim({ event: scored, tick: 0, won: won ? (won.round ?? 0) : null });
      if (scored.handType) playHandAnnouncement(scored.handType);
    }
  }, [events, seat]);
  useEffect(() => {
    if (!anim) return;
    if (anim.tick >= anim.event.steps.length + 4) {
      setAnim(null);
      return;
    }
    if (anim.tick < anim.event.steps.length) {
      const step = anim.event.steps[anim.tick];
      if (step?.mult || step?.xmult) {
        playEffect('fs-mult');
      } else {
        playEffect('fs-pop');
      }
    } else if (anim.tick === anim.event.steps.length) {
      playEffect('fs-treffer');
      playEffect('fs-angriff', { delay: 0.05 });
      playEffect('nh-schellen-kurz', { delay: 0.1 });
      // Applaus, wenn der Treffer ankommt; ist das Ziel erreicht, jubelt der Hof, nach dem Thronsaal mit Laute.
      if (anim.won === null) playEffect('nh-applaus', { delay: 0.2 });
      else {
        playEffect('nh-jubel', { delay: 0.2 });
        playEffect('nh-schellen-lang', { delay: 0.5 });
        if (anim.won === 2) playEffect('nh-hoftag', { delay: 1.4 });
      }
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
    if (stage >= 2) {
      playEffect('fs-karte-waehlen');
    }
    const id = window.setTimeout(() => setStage((s) => s + 1), stage === 0 ? 700 : stage === 1 ? 450 : 300);
    return () => window.clearTimeout(id);
  }, [stage, count]);
  return { stage, finish: () => setStage(99) };
}

// ---------------------------------------------------------------- Bausteine

function Lives({ lives }: { lives: number }) {
  return <span aria-label={`${lives} ${lives === 1 ? 'Herz' : 'Herzen'}`}>{'❤️'.repeat(Math.max(0, Math.min(lives, 8)))}</span>;
}

interface Enemy {
  emoji: string;
  name: string;
  text?: string;
  /** Schlüssel des Porträts (portraits.ts). */
  portrait?: string;
}

/** Porträt im Goldrahmen, sonst das Emoji. */
function Face({ enemy, className, stage = 1 }: { enemy: Enemy; className?: string; stage?: PortraitStage }) {
  const url = portraitUrl(enemy.portrait, stage);
  const [broken, setBroken] = useState(false);
  useEffect(() => preloadPortrait(enemy.portrait), [enemy.portrait]);
  if (!url || broken) return <>{enemy.emoji}</>;
  return (
    <img
      key={stage}
      className={`cs-portrait ${stage > 1 ? 'cs-portrait-laugh' : ''} ${className ?? ''}`}
      src={url}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

function enemyOf(state: SorterState, run: RunState): Enemy {
  const round = run.current;
  if (round?.duel || (run.round === 2 && isDuelLevel(state, run.level)))
    return {
      emoji: '⚔️',
      name: 'Wettstreit',
      text: 'Wer weniger Applaus bekommt, verliert ein Herz.',
    };
  if (run.round === 2) {
    if (round?.calm) {
      const calm = BOSSES[round.calm]!;
      return { emoji: calm.emoji, name: calm.name, text: 'Heute gut gelaunt – ohne Marotte.', portrait: `boss-${calm.key}` };
    }
    const boss = BOSSES[round?.boss ?? bossFor(state, run)]!;
    return { emoji: boss.emoji, name: boss.name, text: boss.text, portrait: `boss-${boss.key}` };
  }
  const courtier = courtierFor(state.key, run.level, run.round);
  return { emoji: courtier.emoji, name: courtier.name, text: `„${courtier.saying}“`, portrait: `court-${courtier.key}` };
}

/** Miene der Herrschaft: je mehr Applaus, desto fröhlicher. */
function moodOf(share: number): string {
  if (share >= 1) return '😂';
  if (share >= 0.6) return '😄';
  if (share >= 0.25) return '🙂';
  return '😐';
}

function targetFor(state: SorterState, run: RunState): number {
  if (run.current) return run.current.target;
  if (run.round === 2 && isDuelLevel(state, run.level)) return 0;
  const boss = run.round === 2 ? BOSSES[bossFor(state, run)] : undefined;
  return Math.round(levelTarget(run.level, state.stake) * ROUND_FACTORS[run.round]! * (boss?.targetFactor ?? 1));
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
  const [look, setLook] = useState<CardLook>(readCardLook);
  const toggleLook = () => {
    const order = DECK_STYLE_CHOICES.map((c) => c.value);
    const next = order[(order.indexOf(look) + 1) % order.length]!;
    writeCardLook(next);
    setLook(next);
  };
  const handKey = run ? `${run.phase}/${run.level}/${run.round}/${run.hand.map((c) => c.id).join(',')}/${run.pack?.items.length ?? ''}` : '';
  const [lastKey, setLastKey] = useState(handKey);
  const stale = lastKey !== handKey;
  // Beim Umsortieren der Hand wandert die Auswahl mit den Karten mit.
  const carry = useRef<number[] | null>(null);
  if (stale) {
    setLastKey(handKey);
    const keep = carry.current;
    carry.current = null;
    setPicked(keep && run ? keep.flatMap((id) => { const at = run.hand.findIndex((c) => isOpen(c) && c.id === id); return at < 0 ? [] : [at]; }) : []);
    if (selected?.kind !== 'mod') setSelected(null);
  }
  // Nach einem Zug gehört die alte Auswahl zu einer anderen Hand.
  const picked = stale ? [] : pickedState.filter((i) => i < (run?.pack ? run.pack.hand.length : (run?.hand.length ?? 0)));
  const { anim, skip } = useScoring(events, viewer);
  const reveal = usePackReveal(events, viewer, run?.pack?.items.length ?? 0);
  const can = (move: SorterMove) => legalMoves.some((m) => JSON.stringify(m) === JSON.stringify(move));
  const find = (pred: (m: SorterMove) => boolean) => legalMoves.find(pred);
  // Große Bildschirme: Bühnen-Layout mit Narrenbank oben, Bühne in der Mitte und der Hand unten.
  const big = size.width >= 900 && size.height >= 540;
  // Auf mittleren Bildschirmen stehen die Knöpfe unter der Hand, damit die Karten breiter werden.
  const tight = big && size.width < 1500;
  const wide = !big && size.width > size.height * 1.25 && size.width > 640;
  const sortedPickNow = [...picked].sort((a, b) => a - b);
  const drop = (item: DragItem, target: string | null): boolean => {
    if (!run || !target) return false;
    const [zone, rest] = target.split(':');
    const at = Number(rest);
    const handCards = (index: number) => (picked.includes(index) ? sortedPickNow : [index]);
    if (item.kind === 'hand') {
      if (run.phase !== 'play') return false;
      if (zone === 'hand') {
        if (at === item.index) return true;
        carry.current = picked.flatMap((i) => { const c = run.hand[i]; return c && isOpen(c) ? [c.id] : []; });
        playEffect('fs-karte-waehlen');
        onMove({ type: 'moveCard', from: item.index, to: at });
        return true;
      }
      if (zone === 'play' || zone === 'discard') {
        const cards = handCards(item.index);
        const move = find((m) => m.type === zone && same(m.cards, cards));
        if (!move) return false;
        playEffect(zone === 'play' ? 'fs-abschicken' : 'fs-verwerfen');
        onMove(move);
        return true;
      }
      return false;
    }
    if (item.kind === 'mod') {
      if (zone === 'mod') {
        if (at === item.index) return true;
        if (run.phase === 'pack') return false;
        onMove({ type: 'moveMod', from: item.index, to: at });
        return true;
      }
      if (zone === 'sell') {
        const sell = find((m) => m.type === 'sellMod' && m.index === item.index);
        if (!sell) return false;
        onMove(sell);
        setSelected(null);
        return true;
      }
      return false;
    }
    if (item.kind === 'cons') {
      if (zone === 'sell') {
        const sell = find((m) => m.type === 'sellConsumable' && m.index === item.index);
        if (!sell) return false;
        onMove(sell);
        setSelected(null);
        return true;
      }
      if (zone === 'use' || zone === 'hand' || zone === 'play') {
        const use = find((m) => m.type === 'use' && m.index === item.index && same(m.cards, sortedPickNow));
        if (!use) return false;
        onMove(use);
        setSelected(null);
        return true;
      }
      return false;
    }
    if (zone !== 'buy' && zone !== 'bench' && zone !== 'mod' && !(item.kind === 'pick' && (zone === 'hand' || zone === 'play'))) return false;
    if (item.kind === 'pick') {
      const pickMove = find((m) => m.type === 'pick' && m.index === item.index && same(m.cards, sortedPickNow));
      if (!pickMove) return false;
      onMove(pickMove);
      setSelected(null);
      return true;
    }
    const buy = item.kind === 'offer' ? find((m) => m.type === 'buy' && m.index === item.index) : item.kind === 'pack' ? find((m) => m.type === 'buyPack' && m.index === item.index) : find((m) => m.type === 'buyTool');
    if (!buy) return false;
    onMove(buy);
    setSelected(null);
    return true;
  };
  const { dragState, bindDrag } = usePointerDrag<DragItem>({ onDrop: drop });
  const dragging = dragState.isDragging ? dragState.item : null;
  const dragProps: DragProps = (item, target) => {
    const bound = bindDrag(item);
    const indexOf = (d: DragItem) => ('index' in d ? d.index : -1);
    const mine = !!dragging && dragging.kind === item.kind && indexOf(dragging) === indexOf(item);
    const over = !!dragging && !!target && dragState.targetId === target && !mine;
    return {
      onPointerDown: bound.onPointerDown,
      style: {
        ...bound.style,
        ...(mine ? { transform: `translate(${dragState.delta.x}px, ${dragState.delta.y}px) scale(1.08)`, transition: dragState.snapping ? 'transform 180ms ease' : 'none', zIndex: 200, pointerEvents: 'none' as const } : {}),
      },
      className: `${mine ? 'bub-dragging cs-dragging' : ''} ${over ? 'cs-drop-over' : ''}`,
      'data-drop-target': target,
    };
  };
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
  const back = CARD_BACKS.find((b) => b.key === progress.back)?.emoji ?? '🃏';

  if (!run)
    return (
      <>
        <Overview view={view} seatNames={seatNames} refEl={ref} />
        {atelierModal}
      </>
    );

  // Kartengröße: acht Karten (mit Überlappung) passen in die Breite, dazu genug Höhe.
  const handCount = Math.max(effectiveHandSize(run), run.hand.length, 5);
  const sideW = Math.min(352, Math.max(224, size.width * 0.18));
  const handAvail = big ? size.width - sideW - 12 - (tight ? 0 : 224) - 24 : (wide ? size.width * 0.58 : size.width) - 12;
  const cardW = big
    ? Math.max(56, Math.min(180, handAvail / (handCount * 0.86 + 0.14), (size.height - (tight ? 200 : 160)) / 2.7))
    : Math.max(40, Math.min(96, handAvail / (handCount * 0.86), size.height > 0 ? size.height / (wide ? 3.6 : 6.4) : 96));
  const tileW = Math.max(60, Math.min(150, cardW * 0.78));

  const hintCards = hint && (hint.type === 'play' || hint.type === 'discard') ? hint.cards : [];
  const togglePick = (i: number) => {
    playEffect('fs-karte-waehlen');
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
  const share = target > 0 ? Math.min(1, (round?.score ?? 0) / target) : 0;
  const mood = moodOf(share);
  const header = (
    <div className="cs-head">
      {run.phase === 'play' && round?.duel && <DuelStage view={view} run={run} seatNames={seatNames} />}
      {run.phase === 'play' && !round?.duel && (
        <div className={`cs-enemy ${run.round === 2 ? 'cs-throne' : ''} ${target > 0 && share >= 1 ? 'cs-laugh' : ''}`}>
          <span className="cs-enemy-emoji" aria-hidden="true">
            <Face enemy={enemy} stage={target > 0 ? stageOf(share) : 1} />
            {target > 0 && !hasMoods(enemy.portrait) && (
              <span key={mood} className="cs-mood">
                {mood}
              </span>
            )}
          </span>
          <div className="cs-enemy-text">
            <strong>{enemy.name}</strong>
            {enemy.text && <span className="cs-ribbon">{enemy.text}</span>}
            {target > 0 && (
              <div className="cs-applause" aria-label={`Applaus ${round?.score ?? 0} von ${target}`}>
                <span className="cs-applause-line">
                  <span style={{ width: `${share * 100}%` }} />
                </span>
                <span className="cs-applause-num">
                  👏 {formatNumber(round?.score ?? 0)} / {formatNumber(target)}
                </span>
              </div>
            )}
            {target === 0 && round && <span className="cs-duel-score">Dein Applaus: {formatNumber(round.score)}</span>}
          </div>
        </div>
      )}
      <div className="cs-stats">
        <span title="Hoftag und Audienz">
          🗺️ {view.endless && run.level > FINAL_LEVEL ? `${run.level} ∞` : `${run.level}/${FINAL_LEVEL}`} · {ROUND_NAMES[run.round]}
        </span>
        <span title="Brezeln">🥨 {run.tokens}</span>
        {round && (
          <span title="Vorführungen und Tauschen">
            ✋ {round.handsLeft} · 🗑️ {round.discardsLeft}
          </span>
        )}
        {multi && view.mode !== 'survival' && view.mode !== 'race' && <Lives lives={run.lives} />}
        <button type="button" className="cs-link" onClick={() => setShowLevels((v) => !v)}>
          📋 Kombis
        </button>
        <button type="button" className="cs-link" onClick={toggleLook} title={`Kartenbild: ${DECK_STYLE_CHOICES.find((c) => c.value === look)?.label ?? ''} – antippen zum Wechseln`}>
          🂠 Kartenbild
        </button>
      </div>
    </div>
  );

  // --- Mods und Verbrauchsgegenstände
  const modsRow = (
    <div className="cs-row cs-mods" aria-label="Narren" data-drop-target="bench">
      {run.mods.map((mod, index) => {
        const d = describeMod(mod);
        return (
          <Tile
            key={mod.uid}
            emoji={d.emoji}
            title={d.title}
            tip={tipFrom(d, [`Verkauf: ${sellValue(mod)} 🥨`])}
            extra={dragProps({ kind: 'mod', index }, `mod:${index}`)}
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
      {run.mods.length === 0 && <span className="cs-muted cs-empty-note">Noch keine Narren</span>}
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
            tip={tipFrom(d, ['Verkauf: 1 🥨'])}
            extra={dragProps({ kind: 'cons', index })}
            tone={d.tone}
            selected={selected?.kind === 'cons' && selected.index === index}
            onClick={() => setSelected(selected?.kind === 'cons' && selected.index === index ? null : { kind: 'cons', index })}
          />
        );
      })}
      <span className="cs-slots cs-muted" title="Narrentasche: Kunststücke, Übungen und Kuriositäten">
        👝 {run.consumables.length}/{run.consumableSlots}
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
              Verkaufen (+{sellValue(mod)} 🥨)
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
            {!use && run.phase !== 'play' && item.kind !== 'nail' && <span className="cs-muted"> – Karten lassen sich nur während einer Audienz auswählen.</span>}
          </>
        }
        onClose={() => setSelected(null)}
        actions={
          <>
            <Btn primary disabled={!use} onClick={() => use && (onMove(use), setSelected(null))}>
              Anwenden
            </Btn>
            <Btn disabled={!sell} onClick={() => sell && (onMove(sell), setSelected(null))}>
              Verkaufen (+1 🥨)
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
        <div className="cs-stagezone" data-drop-target="play">
        <div className="cs-score" aria-live="polite">
          <span className="cs-score-label">
            {preview
              ? handLabel(
                  preview.type,
                  pickedOpen.map((i) => run.hand[i] as Card),
                ) + ` · Stufe ${run.handLevels[preview.type]}`
              : picked.length
                ? 'Verdeckte Karte dabei'
                : 'Karten auswählen'}
          </span>
          <span className="cs-chips">{preview ? formatNumber(preview.chips) : '–'}</span>
          <span className="cs-times">×</span>
          <span className="cs-mult">{preview ? formatMult(preview.mult) : '–'}</span>
          {preview && <span className="cs-preview">= {formatNumber(preview.score)}</span>}
        </div>
        {big && !preview && <span className="cs-muted cs-stagehint">Karten hierher ziehen zum Vorführen</span>}
        </div>
        <div className="cs-hand" style={{ ['--cw' as string]: `${cardW}px` }}>
          {run.hand.map((card, i) => (
            <CardView key={isOpen(card) ? card.id : `h${i}`} card={card as ViewCard} selected={picked.includes(i)} hint={hintCards.includes(i)} onClick={() => togglePick(i)} style={{ zIndex: i }} extra={dragProps({ kind: 'hand', index: i }, `hand:${i}`)} />
          ))}
        </div>
        <div className="cs-actions">
          <Btn primary disabled={!playMove} hint={hint?.type === 'play'} onClick={() => playMove && (playEffect('fs-abschicken'), onMove(playMove))}>
            Vorführen
          </Btn>
          <Btn disabled={!discardMove} hint={hint?.type === 'discard'} onClick={() => discardMove && (playEffect('fs-verwerfen'), onMove(discardMove))}>
            Tauschen ({round.discardsLeft})
          </Btn>
          <span className="cs-sort">
            <button
              type="button"
              className="cs-link"
              onClick={() => can({ type: 'sortHand', by: 'rank' }) && (playEffect('fs-karte-waehlen'), onMove({ type: 'sortHand', by: 'rank' }))}
              aria-label="Nach Rang sortieren"
            >
              🔢
            </button>
            <button
              type="button"
              className="cs-link"
              onClick={() => can({ type: 'sortHand', by: 'color' }) && (playEffect('fs-karte-waehlen'), onMove({ type: 'sortHand', by: 'color' }))}
              aria-label="Nach Farbe sortieren"
            >
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
    main = <ShopPanel run={run} can={can} find={find} onMove={onMove} hint={hint} selected={selected} setSelected={setSelected} dragProps={dragProps} />;
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
        dragProps={dragProps}
      />
    );
  } else if (run.phase === 'wait') {
    main = (
      <div className="cs-panel cs-center">
        <p className="cs-big">⏳</p>
        <p>{view.duel ? 'Du bist fertig. Gleich wird abgerechnet …' : `Treffpunkt am ${run.level}. Hoftag: Warte auf die anderen, dann beginnt der Wettstreit.`}</p>
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
            ? 'Alle Hoftage geschafft – du bist Hofnarr!'
            : endlessRun
              ? `Endlos-Modus: bis Hoftag ${run.level} gekommen!`
              : run.phase === 'out'
                ? `Ausgeschieden an Hoftag ${run.level}.`
                : won
                  ? 'Gewonnen – alle anderen sind raus!'
                  : `Hoftag ${run.level}`}
        </p>
        <p className="cs-muted">
          {run.bossesBeaten} Herrschaften zum Lachen gebracht · beste Vorführung {formatNumber(run.bestHand)} Applaus
        </p>
        <DropsSummary lines={earned} pending={!view.winners} done={!!view.winners && wasAwarded(view, run.seat)} />
        <Btn onClick={() => setAtelier(true)}>🎓 Narrenschule öffnen (🔔 {progress.drops})</Btn>
      </div>
    );
  }

  // --- Ablagezonen: erscheinen nur während des Ziehens
  const sellFor = (item: DragItem) => (item.kind === 'mod' ? (run.mods[item.index] ? sellValue(run.mods[item.index]!) : 0) : 1);
  let zones: ReactNode = null;
  if (dragging) {
    const zone = (id: string, label: ReactNode, ok: boolean) => (
      <div key={id} className={`cs-zone ${ok ? '' : 'cs-zone-off'} ${dragState.targetId === id ? 'cs-drop-over' : ''}`} data-drop-target={id}>
        {label}
      </div>
    );
    if (dragging.kind === 'hand' && run.phase === 'play' && round) {
      const cards = picked.includes(dragging.index) ? sortedPick : [dragging.index];
      zones = (
        <>
          {zone('play', '▶ Vorführen', !!find((m) => m.type === 'play' && same(m.cards, cards)))}
          {zone('discard', `↻ Tauschen (${round.discardsLeft})`, !!find((m) => m.type === 'discard' && same(m.cards, cards)))}
        </>
      );
    } else if (dragging.kind === 'mod' || dragging.kind === 'cons') {
      const sellable = !!find((m) => (m.type === 'sellMod' || m.type === 'sellConsumable') && m.type === (dragging.kind === 'mod' ? 'sellMod' : 'sellConsumable') && m.index === dragging.index);
      const usable = dragging.kind === 'cons' && !!find((m) => m.type === 'use' && m.index === dragging.index && same(m.cards, sortedPick));
      zones = (
        <>
          {dragging.kind === 'cons' && run.phase === 'play' && zone('use', '✨ Anwenden', usable)}
          {zone('sell', `🥨 Verkaufen (+${sellFor(dragging)})`, sellable)}
        </>
      );
    } else if (dragging.kind === 'pick') {
      const taken = find((m) => m.type === 'pick' && m.index === dragging.index && same(m.cards, sortedPick));
      zones = zone('buy', '👝 Nehmen', !!taken);
    } else if (dragging.kind === 'offer' || dragging.kind === 'pack' || dragging.kind === 'tool') {
      const bought = find((m) => (dragging.kind === 'offer' ? m.type === 'buy' && m.index === dragging.index : dragging.kind === 'pack' ? m.type === 'buyPack' && m.index === dragging.index : m.type === 'buyTool'));
      zones = zone('buy', dragging.kind === 'pack' ? '📦 Öffnen' : '👝 Nehmen', !!bought);
    }
  }
  const dropbar = zones && <div className="cs-dropbar">{zones}</div>;

  const others = multi ? <OthersStrip view={view} me={run.seat} seatNames={seatNames} /> : null;

  return (
    <BackContext.Provider value={back}>
      <DeckStyleContext.Provider value={look}>
      <HoverProvider>
      <div ref={ref} className={`cs-board ${wide ? 'cs-wide' : ''} ${big ? 'cs-bigmode' : ''} ${tight ? 'cs-bigtight' : ''}`} style={{ ['--tw' as string]: `${tileW}px`, ['--side' as string]: `${sideW}px` }} data-theme={progress.theme} data-back={progress.back}>
        <div className="cs-side">
          {header}
          {others}
          {!big && modsRow}
          {info}
          {view.lastDuel && run.phase === 'shop' && <DuelResult view={view} seatNames={seatNames} />}
        </div>
        {big && <div className="cs-bench">{modsRow}</div>}
        <div className="cs-mainarea">
          {dropbar}
          {main}
        </div>
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
      </HoverProvider>
      </DeckStyleContext.Provider>
    </BackContext.Provider>
  );
}

function DropsSummary({ lines, pending, done }: { lines: DropLine[] | null; pending: boolean; done: boolean }) {
  if (pending) return <p className="cs-small-text">🔔 Glöckchen gibt es, sobald die Partie zu Ende ist.</p>;
  if (!lines) return done ? <p className="cs-small-text">🔔 Glöckchen für diese Partie sind schon gutgeschrieben.</p> : null;
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="cs-drops-box">
      <strong>🔔 +{sum} Glöckchen</strong>
      {lines.map((l, i) => (
        <span key={i} className="cs-small-text">
          {l.once ? '🎯 ' : ''}
          {l.label}: +{l.amount}
        </span>
      ))}
      {lines.length === 0 && <span className="cs-small-text">Diesmal keine – schaffe einen Hoftag, dann gibt es welche.</span>}
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
  if (step.mult) parts.push(`+${formatMult(step.mult)} Lachen`);
  if (step.xmult !== undefined) parts.push(`×${formatMult(step.xmult)}`);
  if (step.tokens) parts.push(`${step.tokens > 0 ? '+' : ''}${step.tokens} 🥨`);
  return parts.join(' ');
}

// ---------------------------------------------------------------- Vor der Runde

function ChoosePanel({ view, run, can, onMove, hint }: { view: SorterState; run: RunState; can: (m: SorterMove) => boolean; onMove: (m: SorterMove) => void; hint: SorterMove | null }) {
  const enemy = enemyOf(view, run);
  const target = targetFor(view, run);
  const tag = run.round < 2 ? (view.tags[(run.level - 1) * 2 + run.round] ?? null) : null;
  const tagInfo = tag ? describeTag(tag) : null;
  const reward = run.round === 0 && view.stake >= 2 ? 0 : ROUND_REWARDS[run.round];
  const alt = tag && can({ type: 'skip', alt: true }) ? describeTag(altTag(tag, run.level)) : null;

  useEffect(() => {
    if (run.round === 2) {
      const boss = run.current?.boss ?? bossFor(view, run);
      playBossSound(boss);
    }
  }, [view, run, run.level, run.round, run.current?.boss]);

  return (
    <div className="cs-panel cs-center">
      <p className="cs-muted">
        Hoftag {run.level} · {ROUND_NAMES[run.round]}
      </p>
      <p className="cs-big" aria-hidden="true">
        <Face enemy={enemy} className="cs-portrait-big" />
      </p>
      <p className="cs-title">{enemy.name}</p>
      {enemy.text && <p>{enemy.text}</p>}
      <p>
        Ziel: <strong>{formatNumber(target)}</strong> Applaus · Belohnung: {reward} 🥨
      </p>
      <div className="cs-actions">
        <Btn primary hint={hint?.type === 'start'} onClick={() => onMove({ type: 'start' })}>
          Los geht's
        </Btn>
        {tagInfo && (
          <Btn disabled={!can({ type: 'skip' })} hint={hint?.type === 'skip'} onClick={() => onMove({ type: 'skip' })}>
            Auslassen: {tagInfo.emoji} {tagInfo.title}
          </Btn>
        )}
        {alt && (
          <Btn hint={hint?.type === 'skip' && hint.alt} onClick={() => onMove({ type: 'skip', alt: true })}>
            Auslassen: {alt.emoji} {alt.title}
          </Btn>
        )}
      </div>
      {tagInfo && (
        <p className="cs-muted">
          Gefallen „{tagInfo.title}“: {tagInfo.text}
        </p>
      )}
      {alt && (
        <p className="cs-muted">
          Oder dank Wanderbühne „{alt.title}“: {alt.text}
        </p>
      )}
      {can({ type: 'rerollBoss' }) && (
        <Btn hint={hint?.type === 'rerollBoss'} onClick={() => (playEffect('fs-karte-waehlen'), onMove({ type: 'rerollBoss' }))}>
          📜 Andere Herrschaft bitten ({BOSS_REROLL_PRICE} 🥨)
        </Btn>
      )}
      {run.round === 0 && <BossPreview view={view} run={run} />}
    </div>
  );
}

function BossPreview({ view, run }: { view: SorterState; run: RunState }) {
  if (isDuelLevel(view, run.level)) return <p className="cs-muted">Am Ende dieses Hoftags wartet ein ⚔️ Wettstreit.</p>;
  const boss = BOSSES[bossFor(view, run)]!;
  return (
    <p className="cs-muted">
      Im Thronsaal wartet: {boss.emoji} {boss.name} – {boss.text}
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
  dragProps: DragProps;
}

function ShopPanel({ run, can, find, onMove, hint, selected, setSelected, dragProps }: ShopProps) {
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
            {buy ? `Kaufen (${offer.price} 🥨)` : offer.price > run.tokens ? 'Zu wenig Brezeln' : 'Kein Platz'}
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
            {buy ? `Öffnen (${pack.price} 🥨)` : 'Zu wenig Brezeln'}
          </Btn>
        }
      />
    );
  } else if (sel?.kind === 'tool' && shop.tool) {
    const d = describeTool(shop.tool);
    info = (
      <InfoBox
        emoji={d.emoji}
        title={`Privileg: ${d.title}`}
        text={d.text}
        onClose={() => setSelected(null)}
        actions={
          <Btn primary disabled={!can({ type: 'buyTool' })} onClick={() => (onMove({ type: 'buyTool' }), setSelected(null))}>
            Kaufen ({Math.max(1, Math.floor(TOOL_PRICE * (run.tools.includes('sale') ? 0.75 : 1)))} 🥨)
          </Btn>
        }
      />
    );
  }
  const isHint = (m: Partial<SorterMove>) => !!hint && Object.entries(m).every(([k, v]) => (hint as Record<string, unknown>)[k] === v);
  return (
    <div className="cs-panel cs-shop">
      <div className="cs-shop-head">
        <strong>🎪 Jahrmarkt</strong>
        {payout && (payout.reward || payout.hands || payout.bonus || payout.extra) ? (
          <span className="cs-payout">
            Geschafft! +{payout.reward} 🥨 Belohnung
            {payout.hands ? `, +${payout.hands} 🥨 übrige Vorführungen` : ''}
            {payout.bonus ? `, +${payout.bonus} 🥨 Vorratsbonus` : ''}
            {payout.extra ? `, ${payout.extra > 0 ? '+' : ''}${payout.extra} 🥨 Extras` : ''}
          </span>
        ) : payout ? (
          <span className="cs-payout cs-lost">Audienz verloren – ein Herz weniger.</span>
        ) : null}
      </div>
      <div className="cs-row cs-offers">
        {shop.offers.map((offer, index) =>
          offer ? (
            <OfferTile
              key={index}
              offer={offer}
              extra={dragProps({ kind: 'offer', index })}
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
              sub={`${pack.price} 🥨`}
              tip={tipFrom(d, [`Preis: ${pack.price} 🥨`])}
              extra={dragProps({ kind: 'pack', index })}
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
            sub={`👑 ${Math.max(1, Math.floor(TOOL_PRICE * (run.tools.includes('sale') ? 0.75 : 1)))} 🥨`}
            label={`Königlicher Stand: ${describeTool(shop.tool).title}`}
            tip={tipFrom(describeTool(shop.tool), ['Dauerhaftes Privileg für den ganzen Lauf'])}
            extra={dragProps({ kind: 'tool' })}
            tone="cs-t-tool cs-royal"
            selected={sel?.kind === 'tool'}
            hint={isHint({ type: 'buyTool' })}
            onClick={() => setSelected(sel?.kind === 'tool' ? null : { kind: 'tool' })}
          />
        )}
      </div>
      {info}
      <div className="cs-actions">
        <Btn disabled={!can({ type: 'reroll' })} hint={hint?.type === 'reroll'} onClick={() => onMove({ type: 'reroll' })}>
          🚶 Weiterschlendern ({shop.rerollCost} 🥨)
        </Btn>
        <Btn primary hint={hint?.type === 'next'} onClick={() => onMove({ type: 'next' })}>
          Weiter ▶
        </Btn>
      </div>
      <p className="cs-muted cs-small-text">
        Narrenplätze frei: {freeModSlots(run)} · Vorratsbonus: 1 🥨 je {BONUS_STEP} 🥨 (bis {bonusCap(run)} 🥨)
      </p>
    </div>
  );
}

function OfferTile({ offer, selected, hint, onClick, pop, className, extra }: { offer: Offer; selected?: boolean; hint?: boolean; onClick?: () => void; pop?: ReactNode; className?: string; extra?: ExtraProps }) {
  if (offer.type === 'card')
    return (
      <span className={`cs-offer-card ${className ?? ''}`}>
        <CardView card={offer.card} selected={selected} hint={hint} onClick={onClick ? () => onClick() : undefined} extra={extra} tip={offer.price > 0 ? { ...cardTip(offer.card), lines: [...cardTip(offer.card).lines, `Preis: ${offer.price} 🥨`] } : undefined} />
        {offer.price > 0 && <span className="cs-tile-sub">{offer.price} 🥨</span>}
      </span>
    );
  const d = describeOffer(offer);
  const foil = offer.type === 'mod' && offer.foil ? `cs-foil-${offer.foil}` : '';
  const sticker = offer.type === 'mod' && offer.sticker ? { eternal: '📌', perishable: '⏳', rental: '🔑' }[offer.sticker] : undefined;
  return (
    <Tile
      emoji={d.emoji}
      title={d.title}
      sub={offer.price > 0 ? `${offer.price} 🥨` : undefined}
      badge={sticker}
      tone={`${d.tone} ${foil} ${className ?? ''}`}
      tip={tipFrom(d, offer.price > 0 ? [`Preis: ${offer.price} 🥨`] : [])}
      extra={extra}
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
  dragProps: DragProps;
}

function isSpecial(offer: Offer): boolean {
  if (offer.type === 'mod') return ['rare', 'legendary'].includes(modDef(offer.key).rarity) || !!offer.foil;
  if (offer.type === 'consumable') return offer.item.kind === 'dream' && ['soul', 'blackHole'].includes(offer.item.key);
  return !!offer.card.foil;
}

function PackPanel({ run, find, onMove, hint, selected, setSelected, picked, togglePick, stage, finish, cardW, dragProps }: PackProps) {
  const pack = run.pack!;
  const d = describePack({ kind: pack.kind, size: 'normal', price: 0 });
  const sorted = [...picked].sort((a, b) => a - b);
  // Bühne: 0 Bündel wackelt, 1 Schnur geht auf, ab 2 werden die Karten einzeln umgedreht.
  if (stage < 2) {
    return (
      <button type="button" className="cs-panel cs-center cs-delivery" onClick={finish} aria-label="Bündel aufschnüren">
        <span className={`cs-bundle ${stage === 0 ? 'cs-wobble' : 'cs-untie'}`} aria-hidden="true">
          <span className="cs-bundle-cloth">{d.emoji}</span>
          <span className="cs-knot">🎀</span>
        </span>
        <span className="cs-title">{d.title} wird aufgeschnürt …</span>
        <span className="cs-muted">Tippen zum Aufschnüren</span>
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
              extra={dragProps({ kind: 'pick', index })}
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
              Tag {r.level} {ROUND_NAMES[r.round]?.[0]} · {phaseText(r)}
            </span>
            {(view.mode === 'duel' || view.mode === 'showdown') && <Lives lives={r.lives} />}
            {r.current?.duel && (
              <span title={r.current.score === HIDDEN_SCORE ? 'Geheim bis zur Abrechnung – außer mit dem Lauscher' : undefined}>
                ⚔️ {r.current.score === HIDDEN_SCORE ? '?' : formatNumber(r.current.score)}
              </span>
            )}
            <span className="cs-other-mods" aria-label="Narren">
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
    shop: 'auf dem Jahrmarkt',
    pack: 'packt aus',
    wait: 'wartet',
    out: 'raus',
    won: 'geschafft',
  }[run.phase];
}

/** Wettstreit: alle Narren nebeneinander vor demselben Thron, fremder Applaus bleibt bis zur Abrechnung geheim. */
function DuelStage({ view, run, seatNames }: { view: SorterState; run: RunState; seatNames: string[] }) {
  const rivals = view.runs.filter((r) => r.seat !== run.seat && r.phase !== 'out');
  return (
    <div className="cs-stage" aria-label="Wettstreit">
      <div className="cs-stage-throne">
        <span className="cs-stage-crown" aria-hidden="true">
          👑
        </span>
        <strong>Wettstreit vor dem Thron</strong>
        <span className="cs-muted">Wer weniger Applaus bekommt, verliert ein Herz.</span>
      </div>
      <div className="cs-stage-row">
        <div className="cs-stage-narr cs-me">
          <span className="cs-stage-face" aria-hidden="true">
            🃏
          </span>
          <strong>Du</strong>
          <span>👏 {formatNumber(run.current?.score ?? 0)}</span>
        </div>
        {rivals.map((r) => {
          const hidden = !r.current?.duel || r.current.score === HIDDEN_SCORE;
          return (
            <div key={r.seat} className="cs-stage-narr">
              <span className="cs-stage-face" aria-hidden="true" style={{ borderColor: SEAT_COLORS[r.seat % SEAT_COLORS.length] }}>
                🤹
              </span>
              <strong>{seatNames[r.seat] ?? `Platz ${r.seat + 1}`}</strong>
              <span title={hidden ? 'Geheim bis zur Abrechnung – außer mit dem Lauscher' : undefined}>👏 {hidden ? '?' : formatNumber(r.current!.score)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DuelResult({ view, seatNames }: { view: SorterState; seatNames: string[] }) {
  const duel = view.lastDuel!;
  return (
    <div className="cs-duel">
      <strong>⚔️ Wettstreit an Hoftag {duel.level}</strong>
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
      <p className="cs-title">🃏 Narrenhof</p>
      <p className="cs-muted">
        {DECKS.find((d) => d.key === view.deckKind)?.name} · Hofrang {STAKES[view.stake - 1]?.name}
      </p>
      {view.runs.map((r) => (
        <div key={r.seat} className="cs-other">
          <span className="cs-dot" style={{ background: SEAT_COLORS[r.seat % SEAT_COLORS.length] }} />
          <strong>{seatNames[r.seat] ?? `Platz ${r.seat + 1}`}</strong>
          <span className="cs-muted">
            Hoftag {r.level} · {ROUND_NAMES[r.round]} · {phaseText(r)}
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
            <th>Stufe</th>
            <th>Witz × Lachen</th>
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
        Deck: {run.deck.length} Karten · Privilegien: {run.tools.length ? run.tools.map((k) => describeTool(k).emoji + ' ' + describeTool(k).title).join(', ') : 'keine'}
        {run.stickers.length ? ` · Gefallen: ${run.stickers.map((k) => TAGS[k]?.emoji).join(' ')}` : ''}
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
  sounds: {
    bought: 'fs-kauf',
    toolBought: 'fs-kauf',
    sold: 'fs-verkauf',
    rerolled: 'fs-karte-waehlen',
    packOpened: 'fs-kauf',
    picked: 'fs-kauf',
    used: 'fs-kauf',
    drawn: 'fs-mischen',
    boarDiscard: 'fs-angriff',
    // Den Jubel spielt die Wertungsanimation, wenn der Treffer ankommt.
    roundStart: (e) => (e.duel ? null : e.round === 2 ? 'nh-thronsaal' : e.round === 0 ? 'nh-herold' : null),
    gameOver: (e) => ((e.winners as number[] | undefined)?.length ? 'nh-hofnarr' : null),
    roundLost: 'fs-game-over',
    out: 'fs-game-over',
    lifeLost: 'fs-game-over',
  },
  prepareOptions: withUnlocks,
  SetupExtra,
  seatLabel: (seat) => `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const run = view.runs[seat];
    if (!run) return null;
    const lives = view.mode === 'duel' || view.mode === 'showdown' ? ` · ${'❤️'.repeat(Math.max(0, run.lives))}` : '';
    if (run.phase === 'out') return `raus an Hoftag ${run.level}`;
    if (run.phase === 'won') return 'geschafft 🏆';
    return `Hoftag ${run.level} · ${ROUND_NAMES[run.round]}${lives}`;
  },
};
