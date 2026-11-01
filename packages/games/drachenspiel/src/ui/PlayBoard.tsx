import type { SeatId } from '@brett-und-blatt/engine';
import { usePointerDrag, type BoardProps } from '@brett-und-blatt/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { CARDS_DB } from '../cards';
import { HOUSE_POWERS } from '../powers';
import { heroAttackValue } from '../rules';
import type { DrachenspielMove, DrachenspielView, HiddenPlayerView, Minion, SpellTarget } from '../types';
import { playCreatureAudio } from './audio';
import { attackClass, CardFace, CardZoom, Fuse, GameLog, healthClass, TargetArrow, TraitBadge, type ArrowPoints, type ZoomItem } from './parts';
import type { Float, ShownMinion } from './sequence';
import { getCardFullTitle, getCardTraits, getMinionFullTitle, getMinionTraits } from './traits';
import { useBeats } from './useBeats';
import { useLongPress } from './useLongPress';

const LABELS = ['Blau', 'Rot'];
/** Ab dieser Restzeit brennt die Lunte. */
const FUSE_FROM_MS = 15_000;
/** Steht für den eigenen Helden, wo sonst die Kennung des angreifenden Tiers steht. */
const HERO_ATTACKER = 'hero';

type Strike = Extract<DrachenspielMove, { type: 'attack' | 'heroAttack' }>;
const isStrike = (move: DrachenspielMove): move is Strike => move.type === 'attack' || move.type === 'heroAttack';
const strikerOf = (move: Strike) => (move.type === 'attack' ? move.attackerId : HERO_ATTACKER);

/** Auch der eigene Held wird wie ein Tier gezogen, mit der Kennung `HERO_ATTACKER`. */
type DrachenDragItem = { kind: 'card'; handIndex: number } | { kind: 'minion'; minionId: string };

const activate = (event: KeyboardEvent<HTMLElement>, onClick: () => void, onZoom: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onClick();
  } else if (event.key === 'i') {
    event.preventDefault();
    onZoom();
  }
};

function FloatBadges({ floats }: { floats: Float[] }) {
  return (
    <>
      {floats.map((float, index) => (
        <span key={index} className={`bub-floating-badge ${float.kind === 'damage' ? 'ds-damage-badge' : float.kind === 'heal' ? 'ds-heal-badge' : 'ds-fx-badge'}`}>
          {float.text}
        </span>
      ))}
    </>
  );
}

function MinionView({
  shown,
  isOwner,
  canAttack,
  isSelected,
  isTargetable,
  isHinted,
  attackVector,
  floats,
  isImpacted,
  onClick,
  onZoom,
  onPointerDown,
  onContextMenu,
  dropTarget,
  dropActive,
  elementRef,
}: {
  shown: ShownMinion;
  isOwner: boolean;
  canAttack: boolean;
  isSelected: boolean;
  isTargetable: boolean;
  isHinted: boolean;
  attackVector?: { dx: number; dy: number };
  floats: Float[];
  isImpacted: boolean;
  onClick: () => void;
  onZoom: () => void;
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
  dropTarget?: string;
  dropActive?: boolean;
  elementRef: (el: HTMLElement | null) => void;
}) {
  const { minion, dying, fresh } = shown;
  const traits = getMinionTraits(minion);
  const classes = [
    'ds-minion',
    canAttack && !attackVector && 'can-attack',
    isSelected && !attackVector && 'selected',
    isTargetable && 'targetable',
    isHinted && 'ds-hinted',
    attackVector && 'ds-attacking',
    !attackVector && isImpacted && 'bub-animate-shake ds-hit-impact',
    dying && 'ds-minion-dying',
    fresh && 'ds-minion-enter',
    minion.taunt && 'taunt',
    minion.bubble && 'bubble',
    minion.stealth && 'stealth',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elementRef}
      className={classes}
      onClick={dying ? undefined : onClick}
      onPointerDown={dying ? undefined : onPointerDown}
      onContextMenu={dying ? undefined : onContextMenu}
      onKeyDown={dying ? undefined : (event) => activate(event, onClick, onZoom)}
      style={{
        ...(attackVector ? ({ '--atk-dx': `${attackVector.dx}px`, '--atk-dy': `${attackVector.dy}px` } as CSSProperties) : {}),
        position: attackVector ? 'relative' : undefined,
        zIndex: attackVector ? 60 : undefined,
        touchAction: canAttack ? 'none' : undefined,
      }}
      data-drop-target={dying ? undefined : dropTarget}
      data-drop-active={dropActive ? 'true' : undefined}
      role={dying ? undefined : 'button'}
      tabIndex={dying ? undefined : 0}
      aria-label={`${minion.name}, Angriff ${minion.attack}, Leben ${minion.health}${traits.length > 0 ? ` [${traits.map((t) => t.name).join(', ')}]` : ''}`}
      title={getMinionFullTitle(minion)}
    >
      <FloatBadges floats={floats} />
      <div className="ds-minion-icons">
        {traits.map((trait) => (
          <TraitBadge key={trait.id} trait={trait} isOpponent={!isOwner} />
        ))}
      </div>
      <div className="ds-minion-emoji">{minion.emoji}</div>
      <div className="ds-minion-name">{minion.name}</div>
      <div className="ds-minion-stats">
        <span className={attackClass(minion)}>{minion.attack}</span>
        <span className={healthClass(minion)}>{minion.health}</span>
      </div>
    </div>
  );
}

function HeroBar({
  seat,
  player,
  name,
  health,
  armor,
  floats,
  impacted,
  targetable,
  canAttack,
  selected,
  attackVector,
  hinted,
  dropActive,
  onClick,
  onPointerDown,
  dropTarget,
  elementRef,
}: {
  seat: SeatId;
  player: HiddenPlayerView;
  name: string;
  health: number;
  armor: number;
  floats: Float[];
  impacted: boolean;
  targetable?: boolean;
  canAttack?: boolean;
  selected?: boolean;
  attackVector?: { dx: number; dy: number };
  hinted?: boolean;
  dropActive?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  dropTarget?: string;
  elementRef: (el: HTMLElement | null) => void;
}) {
  const strength = heroAttackValue(player);
  const interactive = targetable || canAttack;
  return (
    <div
      ref={elementRef}
      className={`ds-hero-card ${targetable ? 'targetable' : ''} ${canAttack && !attackVector ? 'can-attack' : ''} ${selected && !attackVector ? 'selected' : ''} ${attackVector ? 'ds-attacking' : ''} ${hinted ? 'ds-hinted' : ''} ${impacted ? 'bub-animate-shake ds-hit-impact' : ''}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onKeyDown={interactive && onClick ? (event) => activate(event, onClick, () => undefined) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={targetable ? 'Gegnerischen Helden angreifen!' : canAttack ? 'Mit deinem Helden angreifen' : undefined}
      style={{
        position: 'relative',
        touchAction: canAttack ? 'none' : undefined,
        ...(attackVector ? ({ '--atk-dx': `${attackVector.dx}px`, '--atk-dy': `${attackVector.dy}px` } as CSSProperties) : {}),
      }}
      data-drop-target={dropTarget}
      data-drop-active={dropActive ? 'true' : undefined}
      data-hero-seat={seat}
    >
      <FloatBadges floats={floats} />
      <span className="ds-hero-avatar">{seat === 0 ? '🐉' : '🐲'}</span>
      <div>
        <div className="ds-hero-name" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{name}</div>
        <div className="ds-hero-badges">
          <span className="ds-badge ds-badge-hp">❤️ {health}</span>
          {armor > 0 && (
            <span className="ds-badge ds-badge-armor" title="Rüstung fängt Schaden vor den Leben ab">
              🛡️ {armor}
            </span>
          )}
          {strength > 0 && (
            <span className="ds-badge ds-badge-gear" title={player.gear ? `${player.gear.name}: hält noch ${player.gear.durability} Angriffe` : 'Angriff des Helden in diesem Zug'}>
              ⚔️ {strength}
              {player.gear ? ` · ${player.gear.durability}×` : ''}
            </span>
          )}
          <span className="ds-badge ds-badge-mana">
            💧 {player.mana}/{player.maxMana}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PlayBoard({ view, legalMoves, onMove, viewer, seatNames, events, hint, clock }: BoardProps<DrachenspielView, DrachenspielMove>) {
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  /** Handkarte eines Zaubers mit Ziel, der gerade auf sein Ziel wartet. */
  const [selectedSpell, setSelectedSpell] = useState<number | null>(null);
  const [attackVector, setAttackVector] = useState<{ id: string; dx: number; dy: number } | null>(null);
  /** Kurzer Hinweis auf Regeln, die sonst unbemerkt zuschlagen (Hand voll, leeres Deck). */
  const [notice, setNotice] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomItem | null>(null);
  /** Maus über der Arena, solange ein Ziel gesucht wird; so folgt der Pfeil auch ohne Ziehen. */
  const [aimPoint, setAimPoint] = useState<{ x: number; y: number } | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const minionElsRef = useRef(new Map<string, HTMLElement>());
  const heroElsRef = useRef(new Map<SeatId, HTMLElement>());
  const handElsRef = useRef(new Map<number, HTMLElement>());

  const mySeat: SeatId = typeof viewer === 'number' ? viewer : 0;
  const oppSeat: SeatId = (1 - mySeat) as SeatId;
  const me = view.players[mySeat];
  const opp = view.players[oppSeat];
  const isMyTurn = view.phase === 'play' && view.activeSeat === mySeat;

  const nameOf = (seat: SeatId) => seatNames[seat] ?? LABELS[seat] ?? '';
  const { beat, log } = useBeats(view, events, nameOf);

  // Was der Schritt zeigt, bis die Reihe durch ist; danach gilt die echte Sicht.
  const boardOf = (seat: SeatId): ShownMinion[] => beat?.boards[seat] ?? view.players[seat].board.map((minion) => ({ minion, dying: false, fresh: false }));
  const floatsOf = (target: string) => beat?.floats.filter((float) => float.target === target) ?? [];
  const isImpacted = (target: string) => beat?.impacted.includes(target) ?? false;

  const elementOf = (key: string): HTMLElement | undefined =>
    key.startsWith('hero-') ? heroElsRef.current.get(Number(key.slice(5)) as SeatId) : minionElsRef.current.get(key);

  useLayoutEffect(() => {
    const attack = beat?.attack;
    if (!attack) {
      setAttackVector(null);
      return;
    }
    const from = elementOf(attack.attackerId)?.getBoundingClientRect();
    const to = elementOf(attack.target)?.getBoundingClientRect();
    if (!from || !to) return;
    const dx = Math.round(to.left + to.width / 2 - (from.left + from.width / 2));
    const dy = Math.round(to.top + to.height / 2 - (from.top + from.height / 2));
    setAttackVector({ id: attack.attackerId, dx, dy });
  }, [beat]);

  useEffect(() => {
    if (!beat) return;
    for (const call of beat.calls) playCreatureAudio(call.name, call.kind, call.sound);
    if (beat.notices.length > 0) setNotice(beat.notices.join(' · '));
  }, [beat]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const { dragState, bindDrag, cancelDrag } = usePointerDrag<DrachenDragItem>({
    threshold: 6,
    onDrop: (item, targetId) => {
      if (!targetId) return false;
      if (item.kind === 'card') {
        const def = CARDS_DB[me.hand?.[item.handIndex]?.defId ?? ''];
        if (def?.isSpell && (def.targeting ?? 'none') !== 'none') {
          // Zauber mit Ziel: aufs Ziel ziehen.
          const move = legalMoves.find(
            (m) =>
              m.type === 'playCard' &&
              m.handIndex === item.handIndex &&
              m.target !== undefined &&
              (targetId === 'enemy-hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && `minion-${m.target.id}` === targetId),
          );
          if (move) {
            onMove(move);
            setSelectedSpell(null);
            return true;
          }
          return false;
        }
        if (targetId === 'battlefield') {
          onMove({ type: 'playCard', handIndex: item.handIndex });
          return true;
        }
      } else {
        const move = legalMoves
          .filter(isStrike)
          .find(
            (m) =>
              strikerOf(m) === item.minionId &&
              (targetId === 'enemy-hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && `minion-${m.target.id}` === targetId),
          );
        if (move) {
          onMove(move);
          return true;
        }
      }
      return false;
    },
  });

  const openZoom = useCallback(
    (item: ZoomItem) => {
      cancelDrag();
      setZoom(item);
    },
    [cancelDrag],
  );
  const closeZoom = useCallback(() => setZoom(null), []);
  const longPress = useLongPress<ZoomItem>(openZoom);

  const draggedMinionId = dragState.isDragging && dragState.item?.kind === 'minion' ? dragState.item.minionId : null;
  const effectiveAttackerId = draggedMinionId ?? selectedAttackerId;

  const validAttacks = effectiveAttackerId ? legalMoves.filter(isStrike).filter((m) => strikerOf(m) === effectiveAttackerId) : [];

  // Zauber mit Ziel: ausgewählt oder gerade gezogen.
  const draggedCardIdx = dragState.isDragging && dragState.item?.kind === 'card' ? dragState.item.handIndex : null;
  const activeSpellIdx = draggedCardIdx ?? selectedSpell;
  const activeSpellDef = activeSpellIdx !== null ? CARDS_DB[me.hand?.[activeSpellIdx]?.defId ?? ''] : undefined;
  const spellMoves =
    activeSpellIdx !== null && activeSpellDef?.isSpell
      ? legalMoves.filter((m) => m.type === 'playCard' && m.handIndex === activeSpellIdx && m.target !== undefined)
      : [];
  const spellTargetsHero = spellMoves.some((m) => m.type === 'playCard' && m.target?.kind === 'hero');
  const spellTargetIds = new Set(spellMoves.flatMap((m) => (m.type === 'playCard' && m.target?.kind === 'minion' ? [m.target.id] : [])));
  const castOn = (target: SpellTarget) => {
    const move = spellMoves.find(
      (m) => m.type === 'playCard' && m.target && (target.kind === 'hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && m.target.id === target.id),
    );
    if (!move) return false;
    onMove(move);
    setSelectedSpell(null);
    return true;
  };

  const canTargetHero = validAttacks.some((m) => m.target.kind === 'hero') || spellTargetsHero;
  const targetableMinionIds = new Set(validAttacks.flatMap((m) => (m.target.kind === 'minion' ? [m.target.id] : [])));
  const playableCardIndices = new Set(legalMoves.flatMap((m) => (m.type === 'playCard' ? [m.handIndex] : [])));
  const attackersReady = new Set(legalMoves.filter(isStrike).map(strikerOf));
  const heroCanAttack = attackersReady.has(HERO_ATTACKER);
  const canUsePower = legalMoves.some((m) => m.type === 'heroPower');
  const myPower = me.power ? HOUSE_POWERS[me.power] : null;
  const oppPower = opp.power ? HOUSE_POWERS[opp.power] : null;
  const strike = (target: Strike['target']) => {
    const move = validAttacks.find((m) => (target.kind === 'hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && m.target.id === target.id));
    if (move) onMove(move);
    setSelectedAttackerId(null);
  };

  // Tipp-Knopf: den vorgeschlagenen Zug auf dem Feld zeigen.
  const hintedIds = new Set<string>();
  if (hint?.type === 'attack') {
    hintedIds.add(hint.attackerId);
    hintedIds.add(hint.target.kind === 'minion' ? hint.target.id : `hero-${oppSeat}`);
  } else if (hint?.type === 'heroAttack') {
    hintedIds.add(`hero-${mySeat}`);
    hintedIds.add(hint.target.kind === 'minion' ? hint.target.id : `hero-${oppSeat}`);
  } else if (hint?.type === 'playCard' && hint.target) {
    hintedIds.add(hint.target.kind === 'minion' ? hint.target.id : `hero-${oppSeat}`);
  }
  const hintedCard = hint?.type === 'playCard' ? hint.handIndex : null;

  const handleMinionClick = (minion: Minion, isOwner: boolean) => {
    if (selectedSpell !== null && spellTargetIds.has(minion.id)) {
      castOn({ kind: 'minion', id: minion.id });
      return;
    }
    if (isOwner) {
      if (attackersReady.has(minion.id)) {
        setSelectedSpell(null);
        setSelectedAttackerId((prev) => (prev === minion.id ? null : minion.id));
      }
      playCreatureAudio(minion.name, 'easterEgg', minion.sound);
    } else if (selectedAttackerId && targetableMinionIds.has(minion.id)) {
      strike({ kind: 'minion', id: minion.id });
    } else {
      playCreatureAudio(minion.name, 'easterEgg', minion.sound);
    }
  };

  const handleHeroClick = () => {
    if (selectedSpell !== null && spellTargetsHero) {
      castOn({ kind: 'hero' });
      return;
    }
    if (selectedAttackerId && canTargetHero) {
      strike({ kind: 'hero' });
    }
  };

  const handleOwnHeroClick = () => {
    if (!heroCanAttack) return;
    setSelectedSpell(null);
    setSelectedAttackerId((prev) => (prev === HERO_ATTACKER ? null : HERO_ATTACKER));
  };

  // Der Zugknopf leuchtet, sobald nichts anderes mehr geht.
  const nothingLeft = !legalMoves.some((m) => m.type !== 'endTurn');

  const fuseLeftMs = isMyTurn && clock?.running && clock.kind === 'perMove' ? (clock.leftMs ?? 0) + (clock.bankLeftMs ?? 0) : null;

  // Zielpfeil: beim Ziehen zum Finger, sonst zur Maus; über einem erlaubten Ziel rastet er ein.
  const aiming = draggedMinionId !== null || (draggedCardIdx !== null && spellMoves.length > 0) || selectedAttackerId !== null || selectedSpell !== null;
  let arrow: ArrowPoints | null = null;
  const arenaBox = aiming ? arenaRef.current?.getBoundingClientRect() : undefined;
  if (arenaBox) {
    const sourceEl = effectiveAttackerId === HERO_ATTACKER ? heroElsRef.current.get(mySeat) : effectiveAttackerId ? minionElsRef.current.get(effectiveAttackerId) : activeSpellIdx !== null ? handElsRef.current.get(activeSpellIdx) : undefined;
    const pointer = dragState.isDragging ? dragState.currentPoint : aimPoint;
    if (sourceEl && pointer) {
      const box = sourceEl.getBoundingClientRect();
      const dropId = dragState.isDragging ? dragState.targetId : null;
      const validDrop =
        dropId === 'enemy-hero' ? canTargetHero : Boolean(dropId?.startsWith('minion-') && (targetableMinionIds.has(dropId.slice(7)) || spellTargetIds.has(dropId.slice(7))));
      const dropBox = validDrop && dropId ? elementOf(dropId === 'enemy-hero' ? `hero-${oppSeat}` : dropId.slice(7))?.getBoundingClientRect() : undefined;
      arrow = {
        from: { x: box.left + box.width / 2 - arenaBox.left, y: box.top + box.height / 2 - arenaBox.top },
        to: dropBox
          ? { x: dropBox.left + dropBox.width / 2 - arenaBox.left, y: dropBox.top + dropBox.height / 2 - arenaBox.top }
          : { x: pointer.x - arenaBox.left, y: pointer.y - arenaBox.top },
        onTarget: validDrop,
      };
    }
  }

  const minionRef = (id: string) => (el: HTMLElement | null) => {
    if (el) minionElsRef.current.set(id, el);
    else minionElsRef.current.delete(id);
  };
  const heroRef = (seat: SeatId) => (el: HTMLElement | null) => {
    if (el) heroElsRef.current.set(seat, el);
    else heroElsRef.current.delete(seat);
  };
  const zoomMinion = (minion: Minion) => ({
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => longPress.contextMenu(event, { kind: 'minion', minion }),
    onZoom: () => openZoom({ kind: 'minion', minion }),
  });

  const myBoard = boardOf(mySeat);
  const oppBoard = boardOf(oppSeat);

  return (
    <div
      ref={arenaRef}
      className="ds-arena"
      onPointerMove={aiming && !dragState.isDragging ? (event) => setAimPoint({ x: event.clientX, y: event.clientY }) : undefined}
    >
      <div className="ds-opponent-zone">
        <HeroBar
          seat={oppSeat}
          player={opp}
          name={nameOf(oppSeat)}
          health={beat?.heroes[oppSeat] ?? opp.health}
          armor={beat?.armor[oppSeat] ?? opp.armor}
          attackVector={attackVector?.id === `hero-${oppSeat}` ? attackVector : undefined}
          dropTarget="enemy-hero"
          floats={floatsOf(`hero-${oppSeat}`)}
          impacted={isImpacted(`hero-${oppSeat}`)}
          targetable={canTargetHero}
          hinted={hintedIds.has(`hero-${oppSeat}`)}
          dropActive={dragState.isDragging && dragState.targetId === 'enemy-hero' && canTargetHero}
          onClick={handleHeroClick}
          elementRef={heroRef(oppSeat)}
        />
        <div className="ds-opponent-info">
          {oppPower && (
            <button
              type="button"
              className={`ds-badge ds-power-badge ${opp.powerUsed ? 'used' : ''}`}
              aria-label={`Hauskraft des Gegners: ${oppPower.name}. ${oppPower.text}`}
              title={`${oppPower.name}: ${oppPower.text}`}
              onClick={() => openZoom({ kind: 'power', power: oppPower })}
            >
              {oppPower.emoji}
            </button>
          )}
          <span className="ds-badge ds-badge-deck">🎴 {opp.handCount}</span>
          <span className="ds-badge ds-badge-deck">📚 {opp.deckCount}</span>
          <GameLog entries={log} />
        </div>
      </div>

      <div className="ds-board-container">
        <div className={`ds-board-row ${oppBoard.length === 0 ? 'empty-hint' : ''}`}>
          {oppBoard.length === 0 ? (
            <span>Keine gegnerischen Tiere auf dem Feld</span>
          ) : (
            oppBoard.map((shown) => {
              const m = shown.minion;
              const isTargetable = !shown.dying && (targetableMinionIds.has(m.id) || spellTargetIds.has(m.id));
              const zoomBinds = zoomMinion(m);
              return (
                <MinionView
                  key={m.id}
                  shown={shown}
                  isOwner={false}
                  canAttack={false}
                  isSelected={false}
                  isTargetable={isTargetable}
                  isHinted={hintedIds.has(m.id)}
                  attackVector={attackVector?.id === m.id ? attackVector : undefined}
                  floats={floatsOf(m.id)}
                  isImpacted={isImpacted(m.id)}
                  onClick={() => handleMinionClick(m, false)}
                  onZoom={zoomBinds.onZoom}
                  onContextMenu={zoomBinds.onContextMenu}
                  onPointerDown={(event) => longPress.start(event, { kind: 'minion', minion: m })}
                  dropTarget={`minion-${m.id}`}
                  dropActive={!shown.dying && dragState.isDragging && dragState.targetId === `minion-${m.id}` && isTargetable}
                  elementRef={minionRef(m.id)}
                />
              );
            })
          )}
        </div>

        <div
          className={`ds-board-row ${myBoard.length === 0 ? 'empty-hint' : ''}`}
          data-drop-target="battlefield"
          data-drop-active={dragState.isDragging && dragState.targetId === 'battlefield' && dragState.item?.kind === 'card' && spellMoves.length === 0 ? 'true' : undefined}
        >
          {myBoard.length === 0 ? (
            <span>Spiele Tiere aus deiner Hand aus</span>
          ) : (
            myBoard.map((shown) => {
              const m = shown.minion;
              const canAttack = !shown.dying && attackersReady.has(m.id);
              const dragBind = canAttack ? bindDrag({ kind: 'minion', minionId: m.id }) : undefined;
              const zoomBinds = zoomMinion(m);
              return (
                <MinionView
                  key={m.id}
                  shown={shown}
                  isOwner={true}
                  canAttack={canAttack}
                  isSelected={!shown.dying && effectiveAttackerId === m.id}
                  isTargetable={!shown.dying && spellTargetIds.has(m.id)}
                  isHinted={hintedIds.has(m.id)}
                  attackVector={attackVector?.id === m.id ? attackVector : undefined}
                  floats={floatsOf(m.id)}
                  isImpacted={isImpacted(m.id)}
                  onClick={() => handleMinionClick(m, true)}
                  onZoom={zoomBinds.onZoom}
                  onContextMenu={zoomBinds.onContextMenu}
                  onPointerDown={(event) => {
                    dragBind?.onPointerDown(event);
                    longPress.start(event, { kind: 'minion', minion: m });
                  }}
                  dropTarget={spellTargetIds.has(m.id) ? `minion-${m.id}` : undefined}
                  dropActive={!shown.dying && dragState.isDragging && dragState.targetId === `minion-${m.id}` && spellTargetIds.has(m.id)}
                  elementRef={minionRef(m.id)}
                />
              );
            })
          )}
        </div>
      </div>

      <div className="ds-player-zone">
        <HeroBar
          seat={mySeat}
          player={me}
          name={nameOf(mySeat)}
          health={beat?.heroes[mySeat] ?? me.health}
          armor={beat?.armor[mySeat] ?? me.armor}
          canAttack={heroCanAttack}
          selected={effectiveAttackerId === HERO_ATTACKER}
          attackVector={attackVector?.id === `hero-${mySeat}` ? attackVector : undefined}
          hinted={hintedIds.has(`hero-${mySeat}`)}
          onClick={handleOwnHeroClick}
          onPointerDown={heroCanAttack ? bindDrag({ kind: 'minion', minionId: HERO_ATTACKER }).onPointerDown : undefined}
          floats={floatsOf(`hero-${mySeat}`)}
          impacted={isImpacted(`hero-${mySeat}`)}
          elementRef={heroRef(mySeat)}
        />
        <div className="ds-actions">
          <span className="ds-badge ds-badge-deck">📚 {me.deckCount}</span>
          {myPower && (
            <button
              type="button"
              className={`ds-power ${canUsePower ? 'playable' : ''} ${hint?.type === 'heroPower' ? 'ds-hinted' : ''}`}
              aria-disabled={!canUsePower}
              aria-label={`Hauskraft ${myPower.name}, Kosten ${myPower.cost}. ${myPower.text}`}
              title={`${myPower.name}: ${myPower.text}`}
              onClick={() => {
                if (canUsePower) onMove({ type: 'heroPower' });
              }}
              onKeyDown={(event) => {
                if (event.key === 'i') openZoom({ kind: 'power', power: myPower });
              }}
              onContextMenu={(event) => longPress.contextMenu(event, { kind: 'power', power: myPower })}
              onPointerDown={(event) => longPress.start(event, { kind: 'power', power: myPower })}
            >
              <span aria-hidden="true">{myPower.emoji}</span>
              <span className="ds-power-cost" aria-hidden="true">
                {myPower.cost}
              </span>
            </button>
          )}
          <div className="ds-endturn-wrap">
            <button
              className={`ds-btn ds-btn-endturn ${isMyTurn && nothingLeft ? 'sparkle' : ''}`}
              disabled={!isMyTurn}
              onClick={() => {
                onMove({ type: 'endTurn' });
                setSelectedAttackerId(null);
                setSelectedSpell(null);
              }}
            >
              {isMyTurn ? 'Zug beenden' : 'Warten...'}
            </button>
            {fuseLeftMs !== null && fuseLeftMs <= FUSE_FROM_MS && <Fuse leftMs={fuseLeftMs} fromMs={FUSE_FROM_MS} />}
          </div>
        </div>
      </div>

      {notice && (
        <div className="ds-notice" role="status">
          {notice}
        </div>
      )}

      {selectedSpell !== null && activeSpellDef?.isSpell && (
        <div className="ds-spell-hint" role="status">
          {activeSpellDef.emoji} {activeSpellDef.name}: Wähle ein Ziel – {activeSpellDef.text}
          <button type="button" className="ds-btn" onClick={() => setSelectedSpell(null)}>
            Abbrechen
          </button>
        </div>
      )}

      <div className="ds-hand" style={{ '--ds-hand-gaps': Math.max(1, (me.hand?.length ?? 1) - 1) } as CSSProperties}>
        {me.hand?.map((card, idx) => {
          const def = CARDS_DB[card.defId];
          if (!def) return null;
          const isPlayable = isMyTurn && playableCardIndices.has(idx);
          const needsTarget = def.isSpell && (def.targeting ?? 'none') !== 'none';
          // Zauber mit Ziel bleiben liegen, der Pfeil zeigt das Ziel; alles andere folgt dem Finger.
          const followsFinger = !needsTarget && (dragState.isDragging || dragState.snapping) && dragState.item?.kind === 'card' && dragState.item.handIndex === idx;
          const dragBind = isPlayable ? bindDrag({ kind: 'card', handIndex: idx }) : undefined;
          const traits = getCardTraits(def);
          const play = () => {
            if (!isPlayable) return;
            if (needsTarget) {
              // Zauber mit Ziel: erst auswählen, dann Ziel antippen.
              setSelectedAttackerId(null);
              setSelectedSpell((prev) => (prev === idx ? null : idx));
              return;
            }
            onMove({ type: 'playCard', handIndex: idx });
          };
          const zoomItem: ZoomItem = { kind: 'card', defId: card.defId };

          return (
            <div
              key={card.uid}
              ref={(el) => {
                if (el) handElsRef.current.set(idx, el);
                else handElsRef.current.delete(idx);
              }}
              className={`ds-card bub-animate-deal ${def.isSpell ? 'ds-card-spell' : ''} ${selectedSpell === idx || draggedCardIdx === idx ? 'ds-card-selected' : ''} ${isPlayable ? 'playable' : ''} ${hintedCard === idx ? 'ds-hinted' : ''} ${followsFinger ? 'bub-dragging' : ''} ${dragState.snapping && followsFinger ? 'bub-snapping' : ''}`}
              style={{
                animationDelay: `${idx * 40}ms`,
                transform: followsFinger ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined,
                position: followsFinger ? 'relative' : undefined,
                zIndex: followsFinger ? 1000 : undefined,
                touchAction: isPlayable ? 'none' : undefined,
              }}
              onClick={play}
              onKeyDown={(event) => activate(event, play, () => openZoom(zoomItem))}
              onContextMenu={(event) => longPress.contextMenu(event, zoomItem)}
              onPointerDown={(event) => {
                dragBind?.onPointerDown(event);
                longPress.start(event, zoomItem);
              }}
              role="button"
              tabIndex={0}
              aria-label={`${def.name}, Kosten ${def.cost}${traits.length > 0 ? ` [${traits.map((t) => t.name).join(', ')}]` : ''}`}
              aria-disabled={!isPlayable}
              title={getCardFullTitle(def)}
            >
              <CardFace def={def} />
            </div>
          );
        })}
      </div>

      {arrow && <TargetArrow {...arrow} />}
      {zoom && <CardZoom item={zoom} onClose={closeZoom} />}
    </div>
  );
}
