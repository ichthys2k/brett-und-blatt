import type { SeatId } from '@brett-und-blatt/engine';
import { CardInspectProvider, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import type { DrachenspielMove, DrachenspielView } from '../types';
import { SetupExtra } from './DeckBuilder';
import { endAction, markCustomDeck, prepareOptions } from './SoloHub';
import { DeckSelection, MulliganPhase } from './phases';
import { PlayBoard } from './PlayBoard';
import './styles.css';
import './feldkarte.css';
import './handkarte.css';
import './zoomkarte.css';
import './tisch.css';
import { albumSpec } from './album';
import { setPartyCards } from './cardLookup';
import type { CustomCard } from '../carddefs';

const LABELS = ['Blau', 'Rot'];

function Board(props: BoardProps<DrachenspielView, DrachenspielMove>) {
  const { view, viewer, onMove } = props;
  setPartyCards(view.customCards as Record<string, CustomCard> | undefined);
  const mySeat: SeatId = typeof viewer === 'number' ? viewer : 0;
  const oppSeat: SeatId = (1 - mySeat) as SeatId;
  const me = view.players[mySeat];
  const opp = view.players[oppSeat];
  if (me.customDeck) markCustomDeck(view.options.playId);
  // Großansicht der Karten (#418) für Deckwahl, Kartentausch und Partie.
  return (
    <CardInspectProvider>
      {view.phase === 'deckSelection' ? (
        <DeckSelection view={view} me={me} oppTheme={opp?.deckTheme} onMove={onMove} timed={Boolean(props.clock?.running)} />
      ) : view.phase === 'mulligan' ? (
        <MulliganPhase me={me} oppTheme={opp?.deckTheme} onMove={onMove} />
      ) : (
        <PlayBoard {...props} />
      )}
    </CardInspectProvider>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={className}>{seat === 0 ? '🐉' : '🐲'}</span>;
}

export const gameUi: GameUi<DrachenspielView, DrachenspielMove> = {
  Board,
  album: albumSpec,
  SeatSymbol,
  SetupExtra,
  prepareOptions,
  // Der gemalte Tisch bekommt die ganze Fläche; Spieler, Status und Knöpfe liegen im Menü ☰ (#430).
  fullBleed: true,
  endAction,
  sounds: {
    cardDrawn: 'drachen-karte-ziehen',
    cardPlayed: 'drachen-karte-legen',
    attack: 'drachen-angriff',
    heroAttack: 'drachen-angriff',
    heroPowerUsed: 'stapel-fertig',
    trapSprung: 'stein-heraus',
    questDone: 'stapel-fertig',
    buildingUsed: 'drachen-karte-legen',
    damage: (event) => ('targetType' in event && event.targetType === 'hero' ? 'drachen-schaden-held' : 'drachen-schaden-tier'),
    minionLeft: 'leben-weg',
    bubblePopped: 'stein-heraus',
    spellCast: 'ds-zauber',
    mulliganDone: 'mischen',
    cardTraded: 'mischen',
    damageBlocked: 'stein-heraus',
  },
  phrases: ['hello', 'thanks', 'wellPlayed', 'wow', 'oops', 'grr'],
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return `🚩 ${p.health}${p.armor > 0 ? ` 🛡️ ${p.armor}` : ''} | 🏇 ${p.mana}/${p.maxMana}`;
  },
};

