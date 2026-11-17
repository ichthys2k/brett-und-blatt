import type { SeatId } from '@brett-und-blatt/engine';
import { dragTilt, GameCard, getNoteField, useCardCosmetics, useCardOverride, useInspect, usePointerDrag, type BoardProps, type InspectContent, type InspectExtraProps, type InspectOptions } from '@brett-und-blatt/ui';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CARDS_DB } from '../cards';
import { HOUSE_POWERS } from '../powers';
import { heroAttackValue } from '../rules';
import type { CardDefinition, DeckThemeId, HousePower, KeywordId, DrachenspielMove, DrachenspielView, HiddenPlayerView, Minion, SpellTarget } from '../types';
import { playCreatureAudio } from './audio';
import { BILD_FIELD, CardFace, Fuse, GameLog, TargetArrow, TraitBadge, zoomContent, type ArrowPoints, type ZoomItem } from './parts';
import type { Float, ShownMinion } from './sequence';
import { getCardFullTitle, getCardTraits, getMinionTraits } from './traits';
import { currentCrest, ScenarioTip, useCosmetics } from './SoloHub';
import { championImage, HOUSE_CHAMPIONS, HOUSE_ICONS, HOUSE_NAMES } from './champions';
import { HeroZoomCard, KnappenRow, WimpelGem } from './held';
import { useBeats } from './useBeats';
import { DeckPile } from './pile';
import { PowerIcon } from './hauskraefte';
import { KEYWORD_SYMBOLS, KeywordEdges, KeywordMark, StatGem } from './symbole';
import { cardArtUrl } from './cardArt';

/** Höchstens so viele Statuszeichen unter dem Bild eines Tiers; der Rest steht als „+n“ da. */
const FIELD_MARKS = 3;
import { uiCard } from './cardLookup';

const LABELS = ['Blau', 'Rot'];
/** Ab dieser Restzeit brennt die Lunte. */
const FUSE_FROM_MS = 15_000;
/** Steht für den eigenen Helden, wo sonst die Kennung des angreifenden Tiers steht. */
const HERO_ATTACKER = 'hero';

type Strike = Extract<DrachenspielMove, { type: 'attack' | 'heroAttack' }>;
const isStrike = (move: DrachenspielMove): move is Strike => move.type === 'attack' || move.type === 'heroAttack';
const strikerOf = (move: Strike) => (move.type === 'attack' ? move.attackerId : HERO_ATTACKER);

/** Auch der eigene Held wird wie ein Tier gezogen, mit der Kennung `HERO_ATTACKER`. */
type DrachenDragItem = { kind: 'card'; handIndex: number; uid: string } | { kind: 'minion'; minionId: string };

/** Enter und Leertaste lösen aus; „i“ (groß ansehen) übernimmt die Großansicht (#418). */
const activate = (event: KeyboardEvent<HTMLElement>, onClick: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onClick();
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
  inspectProps,
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
  /** Großansicht (#418) samt Ziehen und Tastatur, zusammengeführt von `useInspect().props`. */
  inspectProps: InspectExtraProps;
  dropTarget?: string;
  dropActive?: boolean;
  elementRef: (el: HTMLElement | null) => void;
}) {
  const { minion, dying, fresh } = shown;
  const traits = getMinionTraits(minion);
  const def: CardDefinition = uiCard(minion.cardId) ?? {
    id: minion.cardId,
    name: minion.name,
    cost: 0,
    attack: minion.attack,
    health: minion.health,
    emoji: minion.emoji,
    quote: '',
  };
  const cosmetics = useCardCosmetics();
  const overrideNote = useCardOverride(def.id);
  const art = useMemo(() => cardArtUrl(def.id, getNoteField(overrideNote, BILD_FIELD), cosmetics.mediaUrlMap), [def.id, overrideNote, cosmetics.mediaUrlMap]);
  const keywords = traits.map((t) => t.id).filter((id): id is KeywordId => id in KEYWORD_SYMBOLS);
  // Schildwall, Prunkschild, Verkleidet und Kältestarre zeigt der Rand ums Bild; alles Übrige die Zeichenreihe.
  const marks = traits.filter((t) => !(t.id in KEYWORD_SYMBOLS) || !KEYWORD_SYMBOLS[t.id as KeywordId].edge);
  const shownMarks = marks.length > FIELD_MARKS ? marks.slice(0, FIELD_MARKS - 1) : marks;
  const hiddenMarks = marks.slice(shownMarks.length);

  const cardHouse = def.house && def.house !== 'neutral' ? def.house : undefined;
  const classes = [
    'ds-minion',
    'ds-field',
    cardHouse && `ds-minion-house-${cardHouse}`,
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
    minion.frozen && 'frozen',
    minion.dormant && 'dormant',
    minion.building && 'building',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elementRef}
      className={classes}
      {...(dying ? {} : inspectProps)}
      onClick={dying ? undefined : onClick}
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
    >
      <div className="ds-field-oval">
        {art ? (
          <img className="ds-field-img" src={art} alt="" draggable={false} />
        ) : (
          <span className="ds-field-emoji" aria-hidden="true">
            {minion.emoji}
          </span>
        )}
        <KeywordEdges keywords={keywords} />
      </div>
      <StatGem kind="attack" value={minion.attack} state={minion.attack > minion.baseAttack ? 'buffed' : minion.attack < minion.baseAttack ? 'hurt' : 'base'} size="feld" className="ds-field-atk" />
      <StatGem
        kind="health"
        value={minion.health}
        state={minion.health < minion.maxHealth ? 'hurt' : minion.maxHealth > minion.baseHealth ? 'buffed' : 'base'}
        size="feld"
        className="ds-field-hp"
      />
      {marks.length > 0 && (
        <div className="ds-field-marks">
          {shownMarks.map((trait) =>
            trait.id in KEYWORD_SYMBOLS ? (
              <KeywordMark key={trait.id} keyword={trait.id as KeywordId} size="feld" />
            ) : (
              <TraitBadge key={trait.id} trait={trait} isOpponent={!isOwner} />
            ),
          )}
          {hiddenMarks.length > 0 && (
            <span className="ds-field-more" title={hiddenMarks.map((t) => t.fullTitle).join('\n')} aria-label={`und ${hiddenMarks.length} weitere: ${hiddenMarks.map((t) => t.name).join(', ')}`}>
              +{hiddenMarks.length}
            </span>
          )}
        </div>
      )}
      <FloatBadges floats={floats} />
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
  onInfo,
  crest,
  power,
  inspectOptions,
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
  onInfo: (text: string) => void;
  crest?: string | undefined;
  /** Medaillon der Hauskraft, rechts neben dem Porträt. */
  power?: ReactNode;
  inspectOptions?: InspectOptions;
  elementRef: (el: HTMLElement | null) => void;
}) {
  const inspect = useInspect();
  const quest = player.quest ? uiCard(player.quest.cardId) : undefined;
  const info = (text: string) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onInfo(text);
  };
  const trapText = player.traps ? player.traps.map((card) => uiCard(card.defId)?.text ?? '').join(' ') : `${player.trapCount} verdeckte ${player.trapCount === 1 ? 'Falle' : 'Fallen'}.`;
  const house: DeckThemeId =
    player.power ?? (player.deckTheme && player.deckTheme !== 'mixed' ? player.deckTheme : null) ?? (seat === 0 ? 'forest' : 'sea');
  const houseName = HOUSE_NAMES[house];
  const houseIcon = HOUSE_ICONS[house];
  const strength = heroAttackValue(player);
  const interactive = targetable || canAttack;
  const champion = HOUSE_CHAMPIONS[house];
  const image = championImage(house);
  const housePower: HousePower | null = player.power ? HOUSE_POWERS[player.power] : null;
  // Großansicht des Turnierherrn (#464, als Karte #472): nur, was die Sicht ohnehin zeigt.
  const zoomLines = [
    housePower ? `Hauskraft ${housePower.name} (${housePower.cost} Knappen): ${housePower.text}` : '',
    player.gear ? `${player.gear.name}: Angriff ${player.gear.attack}, hält noch ${player.gear.durability} Angriffe.` : '',
    player.quest && quest?.quest ? `Auftrag ${quest.name} (${player.quest.progress}/${quest.quest.count}): ${quest.text}` : '',
    player.trapCount > 0 ? `Fallen: ${trapText}` : '',
  ].filter(Boolean);
  const zoom = (): InspectContent => ({
    title: name,
    subtitle: `${champion.title} · ${houseName}`,
    ...(image ? { image: { src: image, aspect: 358 / 480 } } : {}),
    emoji: houseIcon,
    stats: [
      { label: 'Wimpel', value: `${health}/30`, tone: 'health', ...(health < 30 ? { change: 'down' as const } : {}) },
      ...(armor > 0 ? [{ label: 'Rüstung', value: String(armor) }] : []),
      ...(strength > 0 ? [{ label: 'Angriff', value: String(strength), tone: 'attack' as const }] : []),
      { label: 'Knappen', value: `${player.mana}/${player.maxMana}`, tone: 'cost' },
    ],
    lines: zoomLines,
    // Als Karte im Stil der Zoomkarte, ohne Fensterrahmen (#472).
    bare: true,
    body: (
      <HeroZoomCard
        name={name}
        origin={champion.title}
        image={image}
        emoji={houseIcon}
        health={health}
        armor={armor}
        strength={strength}
        mana={player.mana}
        lines={zoomLines}
      />
    ),
  });
  const ownProps: InspectExtraProps = {
    ...(onPointerDown ? { onPointerDown } : {}),
    ...(interactive && onClick ? { onKeyDown: (event: KeyboardEvent<HTMLElement>) => activate(event, onClick) } : {}),
  };
  return (
    <div
      ref={elementRef}
      className={`ds-hero-card ds-held ds-hero-${house} ${targetable ? 'targetable' : ''} ${canAttack && !attackVector ? 'can-attack' : ''} ${selected && !attackVector ? 'selected' : ''} ${attackVector ? 'ds-attacking' : ''} ${hinted ? 'ds-hinted' : ''} ${impacted ? 'bub-animate-shake ds-hit-impact' : ''}`}
      {...inspect.props(zoom, ownProps, inspectOptions)}
      onClick={onClick}
      role={interactive ? 'button' : 'group'}
      aria-label={`${name}, ${houseName}: ${health} Wimpel${armor > 0 ? `, Rüstung ${armor}` : ''}${strength > 0 ? `, Angriff ${strength}` : ''}, Knappen ${player.mana} von ${player.maxMana}`}
      tabIndex={0}
      title={targetable ? 'Gegnerischen Turnierherrn angreifen!' : canAttack ? 'Mit deinem Turnierherrn angreifen' : undefined}
      style={{
        touchAction: canAttack ? 'none' : undefined,
        ...(attackVector ? ({ '--atk-dx': `${attackVector.dx}px`, '--atk-dy': `${attackVector.dy}px` } as CSSProperties) : {}),
      }}
      data-drop-target={dropTarget}
      data-drop-active={dropActive ? 'true' : undefined}
      data-hero-seat={seat}
    >
      <FloatBadges floats={floats} />
      <div className="ds-held-row">
        <div className="ds-held-side ds-held-left">
          {strength > 0 && (
            <span className="ds-held-gear" title={player.gear ? `${player.gear.name}: hält noch ${player.gear.durability} Angriffe` : 'Angriff des Turnierherrn in diesem Zug'}>
              <StatGem kind="attack" value={strength} size="hand" />
              {player.gear && <span className="ds-held-uses">{player.gear.durability}×</span>}
            </span>
          )}
        </div>
        <div className="ds-held-portrait">
          <div className="ds-held-pic" data-low={health <= 10 ? 'true' : undefined}>
            <span className="ds-held-frame">{image ? <img src={image} alt="" draggable={false} /> : <span aria-hidden="true">{houseIcon}</span>}</span>
            {(player.trapCount > 0 || (player.quest && quest?.quest)) && (
              <div className="ds-held-seals">
                {player.trapCount > 0 && (
                  <button type="button" className="ds-held-seal ds-held-seal-trap" aria-label={trapText} title={trapText} onClick={info(trapText)}>
                    🪤{player.trapCount > 1 ? player.trapCount : ''}
                  </button>
                )}
                {player.quest && quest?.quest && (
                  <button type="button" className="ds-held-seal ds-held-seal-quest" aria-label={quest.text} title={quest.text} onClick={info(`${quest.name}: ${quest.text}`)}>
                    📜 {player.quest.progress}/{quest.quest.count}
                  </button>
                )}
              </div>
            )}
            {armor > 0 && <StatGem kind="armor" value={armor} size="feld" className="ds-held-armor" />}
            <WimpelGem health={health} />
          </div>
          <div className="ds-held-band">
            <span className="ds-held-name">
              {crest && <span aria-hidden="true">{crest} </span>}
              {name}
            </span>
            <span className="ds-held-house">
              <span aria-hidden="true">{houseIcon} </span>
              {houseName}
            </span>
          </div>
        </div>
        <div className="ds-held-side ds-held-right">{power}</div>
      </div>
      <KnappenRow mana={player.mana} maxMana={player.maxMana} locked={player.locked} overloadNext={player.overloadNext} />
    </div>
  );
}

export function PlayBoard({ view, legalMoves, onMove, viewer, seatNames, events, hint, clock }: BoardProps<DrachenspielView, DrachenspielMove>) {
  const cardCosmetics = useCardCosmetics();
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  /** Handkarte eines Zaubers mit Ziel, der gerade auf sein Ziel wartet. */
  const [selectedSpell, setSelectedSpell] = useState<number | null>(null);
  const [attackVector, setAttackVector] = useState<{ id: string; dx: number; dy: number } | null>(null);
  /** Kurzer Hinweis auf Regeln, die sonst unbemerkt zuschlagen (Hand voll, leeres Deck). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Maus über der Arena, solange ein Ziel gesucht wird; so folgt der Pfeil auch ohne Ziehen. */
  const [aimPoint, setAimPoint] = useState<{ x: number; y: number } | null>(null);

  const arenaRef = useRef<HTMLDivElement>(null);
  const minionElsRef = useRef(new Map<string, HTMLElement>());
  const heroElsRef = useRef(new Map<SeatId, HTMLElement>());
  const handElsRef = useRef(new Map<number, HTMLElement>());

  const mySeat: SeatId = typeof viewer === 'number' ? viewer : 0;
  const oppSeat: SeatId = (1 - mySeat) as SeatId;
  const me = view.players[mySeat];
  /** Eigene Reihenfolge der Handkarten (nur Anzeige, nicht im Spielstand): Karten-uids, vorn = links. */
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const shownHand = useMemo(() => {
    const cards = (me.hand ?? []).map((card, idx) => ({ card, idx }));
    const rank = (uid: string) => {
      const at = handOrder.indexOf(uid);
      return at < 0 ? Number.MAX_SAFE_INTEGER : at;
    };
    // Bekannte Karten nach eigener Ordnung, neue (noch nicht einsortierte) hinten in Spielreihenfolge (stabil).
    return [...cards].sort((a, b) => rank(a.card.uid) - rank(b.card.uid));
  }, [me.hand, handOrder]);
  const moveHandCard = (uid: string, beforeUid: string) => {
    if (uid === beforeUid) return;
    const ids = shownHand.map((entry) => entry.card.uid);
    const from = ids.indexOf(uid);
    const to = ids.indexOf(beforeUid);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    setHandOrder(ids);
  };
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  // Ziel der gezogenen Karte: die letzte Handkarte, aus dem DOM gelesen (die Refs hängen beim Ziehen noch nicht wieder).
  const lastHandCard = useCallback(() => arenaRef.current?.querySelector<HTMLElement>('.ds-hand > .ds-card:last-child') ?? null, []);
  const opp = view.players[oppSeat];
  const isMyTurn = view.phase === 'play' && view.activeSeat === mySeat;

  const cosmetics = useCosmetics();
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
      if (item.kind === 'card' && targetId.startsWith('hand:')) {
        moveHandCard(item.uid, targetId.slice(5));
        return true;
      }
      if (item.kind === 'card') {
        if (legalMoves.some((m) => m.type === 'playCard' && m.handIndex === item.handIndex && m.target !== undefined)) {
          // Karte mit Ziel: aufs Ziel ziehen.
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
        if (targetId === 'battlefield' && legalMoves.some((m) => m.type === 'playCard' && m.handIndex === item.handIndex)) {
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

  // Großansicht (#418): Inhalt erst beim Ansehen bauen; ein begonnenes Ziehen bricht ab, wenn sie aufgeht.
  const inspect = useInspect();
  const zoomOf = (item: ZoomItem) => () => zoomContent(item, cardCosmetics);
  const inspectOptions = { onOpen: cancelDrag };

  const draggedMinionId = dragState.isDragging && dragState.item?.kind === 'minion' ? dragState.item.minionId : null;
  const effectiveAttackerId = draggedMinionId ?? selectedAttackerId;

  const validAttacks = effectiveAttackerId ? legalMoves.filter(isStrike).filter((m) => strikerOf(m) === effectiveAttackerId) : [];

  // Zauber mit Ziel: ausgewählt oder gerade gezogen.
  const draggedCardIdx = dragState.isDragging && dragState.item?.kind === 'card' ? dragState.item.handIndex : null;
  const activeSpellIdx = draggedCardIdx ?? selectedSpell;
  const activeSpellDef = activeSpellIdx !== null ? CARDS_DB[me.hand?.[activeSpellIdx]?.defId ?? ''] : undefined;
  const spellMoves =
    activeSpellIdx !== null
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
  const usableBuildings = new Set(legalMoves.flatMap((m) => (m.type === 'useBuilding' ? [m.minionId] : [])));
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
  } else if (hint?.type === 'useBuilding') {
    hintedIds.add(hint.minionId);
  } else if (hint?.type === 'heroAttack') {
    hintedIds.add(`hero-${mySeat}`);
    hintedIds.add(hint.target.kind === 'minion' ? hint.target.id : `hero-${oppSeat}`);
  } else if (hint?.type === 'playCard' && hint.target) {
    hintedIds.add(hint.target.kind === 'minion' ? hint.target.id : `hero-${oppSeat}`);
  }
  const hintedCard = hint?.type === 'playCard' || hint?.type === 'tradeCard' ? hint.handIndex : null;

  const handleMinionClick = (minion: Minion, isOwner: boolean) => {
    if (isOwner && usableBuildings.has(minion.id) && selectedSpell === null) {
      onMove({ type: 'useBuilding', minionId: minion.id });
      return;
    }
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
  const arenaEl = aiming ? arenaRef.current : null;
  const arenaRect = arenaEl?.getBoundingClientRect();
  // Die Arena kann auf kleinen Bildschirmen rollen; der Pfeil liegt im gerollten Inhalt.
  const arenaBox = arenaEl && arenaRect ? { left: arenaRect.left - arenaEl.scrollLeft, top: arenaRect.top - arenaEl.scrollTop } : undefined;
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

  const myBoard = boardOf(mySeat);
  const oppBoard = boardOf(oppSeat);
  const oppTheme = opp?.deckTheme;

  return (
    <div
      ref={arenaRef}
      className={`ds-arena ${beat?.heavy ? 'ds-heavy' : ''}`}
      data-theme={oppTheme && oppTheme !== 'mixed' ? oppTheme : undefined}
      onPointerMove={aiming && !dragState.isDragging ? (event) => setAimPoint({ x: event.clientX, y: event.clientY }) : undefined}
    >
      <div className="ds-opponent-zone">
        <HeroBar
          seat={oppSeat}
          player={opp}
          name={nameOf(oppSeat)}
          health={beat?.heroes[oppSeat] ?? opp.health}
          armor={beat?.armor[oppSeat] ?? opp.armor}
          onInfo={setNotice}
          attackVector={attackVector?.id === `hero-${oppSeat}` ? attackVector : undefined}
          dropTarget="enemy-hero"
          floats={floatsOf(`hero-${oppSeat}`)}
          impacted={isImpacted(`hero-${oppSeat}`)}
          targetable={canTargetHero}
          hinted={hintedIds.has(`hero-${oppSeat}`)}
          dropActive={dragState.isDragging && dragState.targetId === 'enemy-hero' && canTargetHero}
          onClick={handleHeroClick}
          inspectOptions={inspectOptions}
          power={
            oppPower && (
              <button
                type="button"
                className={`ds-power ds-power-opp ${opp.powerUsed ? 'used' : 'ready'}`}
                aria-label={`Hauskraft des Gegners: ${oppPower.name}${opp.powerUsed ? ' (in diesem Zug benutzt)' : ''}. ${oppPower.text}`}
                {...inspect.props(zoomOf({ kind: 'power', power: oppPower }), {}, inspectOptions)}
                onClick={(event) => {
                  event.stopPropagation();
                  const content = zoomContent({ kind: 'power', power: oppPower }, cardCosmetics);
                  if (content) inspect.open(content, event.currentTarget);
                }}
              >
                <PowerIcon power={oppPower} />
                <StatGem kind="cost" value={oppPower.cost} size="feld" className="ds-power-gem" />
              </button>
            )
          }
          elementRef={heroRef(oppSeat)}
        />
        <div className="ds-opponent-info">
          <span className="ds-badge ds-badge-deck ds-deck-with-back" title={`Gegnerische Hand: ${opp.handCount} Karten`}>
            <GameCard faceDown size="xs" cardBackProps={{ design: 'dragon-scale' }} />
            <span>🎴 {opp.handCount}</span>
          </span>
          <span className="ds-badge ds-badge-deck ds-deck-with-back" title={`Gegnerisches Deck: ${opp.deckCount} Karten`}>
            <GameCard faceDown size="xs" cardBackProps={{ design: 'dragon-scale' }} />
            <span>📚 {opp.deckCount}</span>
          </span>
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
                  inspectProps={inspect.props(zoomOf({ kind: 'minion', minion: m }), { onKeyDown: (event) => activate(event, () => handleMinionClick(m, false)) }, inspectOptions)}
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
              const canAttack = !shown.dying && (attackersReady.has(m.id) || usableBuildings.has(m.id));
              const dragBind = !shown.dying && attackersReady.has(m.id) ? bindDrag({ kind: 'minion', minionId: m.id }) : undefined;
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
                  inspectProps={inspect.props(
                    zoomOf({ kind: 'minion', minion: m }),
                    { onPointerDown: dragBind?.onPointerDown, onKeyDown: (event) => activate(event, () => handleMinionClick(m, true)) },
                    inspectOptions,
                  )}
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
          onInfo={setNotice}
          crest={currentCrest(cosmetics.crest)}
          canAttack={heroCanAttack}
          selected={effectiveAttackerId === HERO_ATTACKER}
          attackVector={attackVector?.id === `hero-${mySeat}` ? attackVector : undefined}
          hinted={hintedIds.has(`hero-${mySeat}`)}
          onClick={handleOwnHeroClick}
          onPointerDown={heroCanAttack ? bindDrag({ kind: 'minion', minionId: HERO_ATTACKER }).onPointerDown : undefined}
          floats={floatsOf(`hero-${mySeat}`)}
          impacted={isImpacted(`hero-${mySeat}`)}
          inspectOptions={inspectOptions}
          power={
            myPower && (
              <button
                type="button"
                className={`ds-power ${canUsePower ? 'playable' : ''} ${me.powerUsed ? 'used' : ''} ${hint?.type === 'heroPower' ? 'ds-hinted' : ''}`}
                aria-disabled={!canUsePower}
                aria-label={`Hauskraft ${myPower.name}, Kosten ${myPower.cost}. ${myPower.text}`}
                {...inspect.props(zoomOf({ kind: 'power', power: myPower }), { onPointerDown: (event) => event.stopPropagation() }, inspectOptions)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canUsePower) onMove({ type: 'heroPower' });
                }}
              >
                <PowerIcon power={myPower} />
                <StatGem kind="cost" value={myPower.cost} size="feld" className="ds-power-gem" />
              </button>
            )
          }
          elementRef={heroRef(mySeat)}
        />
        <div className="ds-actions">
          <DeckPile count={me.deckCount} handTarget={lastHandCard} reducedMotion={reducedMotion} />
          <span className="ds-badge ds-badge-deck ds-pile-badge" title={`Dein Nachziehstapel: ${me.deckCount} Karten`}>
            <span>📚 {me.deckCount}</span>
          </span>
          <div className="ds-endturn-wrap">
            <button
              className={`ds-btn ds-btn-endturn ${isMyTurn && nothingLeft ? 'sparkle' : ''}`}
              disabled={!isMyTurn || Boolean(view.pending)}
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

      {view.pending?.seat === mySeat && view.pending.options.length > 0 && (
        <div className="ds-choice" role="dialog" aria-modal="true" aria-label="Wähle eine Möglichkeit">
          <h3 className="ds-phase-title">Wähle eins</h3>
          <div className="ds-choice-row">
            {view.pending.options.map((option, index) => {
              const def = option.cardId ? uiCard(option.cardId) : undefined;
              const hinted = hint?.type === 'choose' && hint.index === index;
              return (
                <button
                  key={index}
                  type="button"
                  className={`ds-choice-option ${def ? 'ds-card' : ''} ${def?.isSpell ? 'ds-card-spell' : ''} ${hinted ? 'ds-hinted' : ''}`}
                  title={def ? getCardFullTitle(def) : option.label}
                  aria-label={def ? getCardFullTitle(def) : option.label}
                  onClick={() => onMove({ type: 'choose', index })}
                >
                  {def ? (
                    <CardFace def={def} />
                  ) : (
                    <>
                      <span className="ds-choice-emoji">{option.emoji}</span>
                      <span>{option.label}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view.pending && view.pending.seat !== mySeat && (
        <div className="ds-spell-hint" role="status">
          🤔 {nameOf(view.pending.seat)} wählt …
        </div>
      )}

      {selectedSpell !== null && activeSpellDef && (
        <div className="ds-spell-hint" role="status">
          {activeSpellDef.emoji} {activeSpellDef.name}: Wähle ein Ziel – {activeSpellDef.text ?? getCardTraits(activeSpellDef).find((trait) => trait.id.startsWith('battlecry'))?.description}
          <button type="button" className="ds-btn" onClick={() => setSelectedSpell(null)}>
            Abbrechen
          </button>
        </div>
      )}

      <ScenarioTip options={view.options} />

      <div className="ds-hand" data-frame={cosmetics.frame ?? undefined} style={{ '--ds-hand-gaps': Math.max(1, (me.hand?.length ?? 1) - 1) } as CSSProperties}>
        {shownHand.map(({ card, idx }) => {
          const def = uiCard(card.defId);
          if (!def) return null;
          const isPlayable = isMyTurn && playableCardIndices.has(idx);
          const needsTarget = legalMoves.some((m) => m.type === 'playCard' && m.handIndex === idx && m.target !== undefined);
          // Karten mit Ziel bleiben liegen, der Pfeil zeigt das Ziel; alles andere folgt dem Finger.
          const followsFinger = !needsTarget && (dragState.isDragging || dragState.snapping) && dragState.item?.kind === 'card' && dragState.item.handIndex === idx;
          const dragBind = bindDrag({ kind: 'card', handIndex: idx, uid: card.uid });
          const traits = getCardTraits(def);
          const play = () => {
            if (!isPlayable) return;
            if (needsTarget) {
              // Karte mit Ziel: erst auswählen, dann Ziel antippen.
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
              data-rarity={def.rarity}
              data-drop-target={`hand:${card.uid}`}
              className={`ds-card bub-animate-deal ${def.isSpell ? 'ds-card-spell' : ''} ${selectedSpell === idx || draggedCardIdx === idx ? 'ds-card-selected' : ''} ${isPlayable ? 'playable' : ''} ${hintedCard === idx ? 'ds-hinted' : ''} ${dragState.isDragging && dragState.item?.kind === 'card' && dragState.targetId === `hand:${card.uid}` && !followsFinger ? 'ds-hand-over' : ''} ${followsFinger ? 'bub-dragging' : ''} ${dragState.snapping && followsFinger ? 'bub-snapping' : ''}`}
              style={{
                animationDelay: `${idx * 40}ms`,
                transform: followsFinger ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0) rotate(${dragTilt(dragState.velocity)}deg)` : undefined,
                position: followsFinger ? 'relative' : undefined,
                zIndex: followsFinger ? 1000 : undefined,
                touchAction: 'none',
              }}
              {...inspect.props(zoomOf(zoomItem), { onPointerDown: dragBind?.onPointerDown, onKeyDown: (event) => activate(event, play) }, inspectOptions)}
              onClick={play}
              role="button"
              tabIndex={0}
              aria-label={`${def.name}, Kosten ${def.cost}${traits.length > 0 ? ` [${traits.map((t) => t.name).join(', ')}]` : ''}`}
              aria-disabled={!isPlayable}
            >
              <CardFace def={def} />
              {card.fleeting && (
                <span className="ds-card-fleeting" title="Flüchtig: Verschwindet am Ende deines Zugs." aria-label="Flüchtig">
                  ⏳
                </span>
              )}
              {legalMoves.some((m) => m.type === 'tradeCard' && m.handIndex === idx) && (
                <button
                  type="button"
                  className="ds-card-trade"
                  title="Mit 1 Knappe zurück ins Deck mischen und neu ziehen"
                  aria-label={`${def.name} mit 1 Knappe tauschen`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove({ type: 'tradeCard', handIndex: idx });
                  }}
                >
                  🔄
                </button>
              )}
            </div>
          );
        })}
      </div>

      {arrow && <TargetArrow {...arrow} />}
    </div>
  );
}
