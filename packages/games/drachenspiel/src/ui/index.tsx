import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import type { DrachenspielMove, DrachenspielView } from '../types';
import { DeckSelection, MulliganPhase } from './phases';
import { PlayBoard } from './PlayBoard';
import './styles.css';

const LABELS = ['Blau', 'Rot'];

function Board(props: BoardProps<DrachenspielView, DrachenspielMove>) {
  const { view, viewer, onMove } = props;
  const me = view.players[typeof viewer === 'number' ? viewer : 0];
  if (view.phase === 'deckSelection') return <DeckSelection view={view} me={me} onMove={onMove} />;
  if (view.phase === 'mulligan') return <MulliganPhase me={me} onMove={onMove} />;
  return <PlayBoard {...props} />;
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={className}>{seat === 0 ? '🐉' : '🐲'}</span>;
}

export const gameUi: GameUi<DrachenspielView, DrachenspielMove> = {
  Board,
  SeatSymbol,
  sounds: {
    cardDrawn: 'drachen-karte-ziehen',
    cardPlayed: 'drachen-karte-legen',
    attack: 'drachen-angriff',
    heroAttack: 'drachen-angriff',
    heroPowerUsed: 'stapel-fertig',
    damage: (event) => ('targetType' in event && event.targetType === 'hero' ? 'drachen-schaden-held' : 'drachen-schaden-tier'),
    minionLeft: 'leben-weg',
    bubblePopped: 'stein-heraus',
    spellCast: 'stapel-fertig',
    mulliganDone: 'mischen',
    cardTraded: 'mischen',
    damageBlocked: 'stein-heraus',
  },
  phrases: ['hello', 'thanks', 'wellPlayed', 'wow', 'oops', 'grr'],
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return `❤️ ${p.health}${p.armor > 0 ? ` 🛡️ ${p.armor}` : ''} | 💧 ${p.mana}/${p.maxMana}`;
  },
};

