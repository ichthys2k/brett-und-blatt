/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { FIELD_NAMES, GUILDS } from './board';
import type { MarketMove, MarketView } from './rules';

const field = (f: number) => FIELD_NAMES[f] ?? `Feld ${f + 1}`;

export function describeMove(_view: MarketView, move: MarketMove): string {
  switch (move.type) {
    case 'roll':
      return 'Würfeln';
    case 'payBail':
      return 'Freikaufen';
    case 'usePardon':
      return 'Gnadenbrief einsetzen';
    case 'buy':
      return 'Kaufen';
    case 'decline':
      return 'Nicht kaufen';
    case 'bid':
      return 'Mitbieten';
    case 'fold':
      return 'Aussteigen';
    case 'sealedBid':
      return `Verdeckt bieten: ${move.amount}`;
    case 'errand':
      return move.choice === 'cash' ? 'Botengang: Geld nehmen' : `Botengang: Wahl ${move.choice}`;
    case 'audience':
      return move.build === null ? 'Audienz: nichts bauen' : `Audienz: bei ${field(move.build)} bauen`;
    case 'well':
      return move.field === null ? 'Brunnen: kein Feld' : `Brunnen: ${field(move.field)}`;
    case 'build':
      return `Bei ${field(move.field)} bauen`;
    case 'sellBuild':
      return `Bau bei ${field(move.field)} verkaufen`;
    case 'mortgage':
      return `${field(move.field)} beleihen`;
    case 'redeem':
      return `${field(move.field)} auslösen`;
    case 'offer':
      return `Angebot an Platz ${move.to + 1}: gibt ${move.give.map(field).join(', ') || 'nichts'}, nimmt ${move.take.map(field).join(', ') || 'nichts'}${move.pay ? `, ${move.pay > 0 ? 'zahlt' : 'bekommt'} ${Math.abs(move.pay)}` : ''}`;
    case 'pass':
      return 'Weiter';
    case 'accept':
      return 'Annehmen';
    case 'reject':
      return 'Ablehnen';
    case 'askPartner':
      return `Partner für ${GUILDS[move.guild]?.name ?? 'Zunft'} fragen`;
    case 'endTurn':
      return 'Zug beenden';
    case 'resign':
      return 'Aufgeben';
  }
}
