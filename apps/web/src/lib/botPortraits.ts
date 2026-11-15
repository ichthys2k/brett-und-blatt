/**
 * Bot-Porträts (#311): Jeder Computergegner ist ein gemaltes Fabeltier mit Namen. Die Zuordnung Spiel → Porträt
 * folgt dem Manifest `scripts/grafik/manifeste/bots.json`; Spiele ohne eigenen Bot (und die allgemeinen Bots der
 * Engine) bekommen „Zufall“. Im Spiel steht der Wert `bot:<kennung>` als Avatar; der Avatar-Baustein macht daraus das Bild.
 */
export const BOT_NAMES: Readonly<Record<string, string>> = {
  'adlerauge': 'Adlerauge',
  'admiral': 'Admiral',
  'bibelkenner': 'Bibelkenner',
  'buchstabenfuchs': 'Buchstabenfuchs',
  'drachenhueter': 'Drachenhüter',
  'flinke-hand': 'Flinke Hand',
  'flinker-finger': 'Flinker Finger',
  'frau-dulle': 'Frau Dulle',
  'fuenferpanda': 'Fünferpanda',
  'geduldsschnecke': 'Geduldsschnecke',
  'huetehelfer': 'Hütehelfer',
  'kartenkanzler': 'Kartenkanzler',
  'kartenkenner': 'Kartenkenner',
  'kartenmischer': 'Kartenmischer',
  'kartenprofi': 'Kartenprofi',
  'kraemer': 'Krämer',
  'kreidekaetzchen': 'Kreidekätzchen',
  'kugelrufer': 'Kugelrufer',
  'landvogt': 'Landvogt',
  'langohr': 'Langohr',
  'marktschreier': 'Marktschreier',
  'mau-mau-meister': 'Mau-Mau-Meister',
  'mauerbaumeister': 'Mauerbaumeister',
  'merkfant': 'Merkfant',
  'musterelster': 'Musterelster',
  'pokerface': 'Pokerface',
  'rechenfuchs': 'Rechenfuchs',
  'reizkeiler': 'Reizkeiler',
  'renn-ente': 'Renn-Ente',
  'sauspieler': 'Sauspieler',
  'schwaben-ass': 'Schwaben-Ass',
  'spuernase': 'Spürnase',
  'steinleger': 'Steinleger',
  'steinmeister': 'Steinmeister',
  'sternspringer': 'Sternspringer',
  'vorausrechner': 'Vorausrechner',
  'weitblick': 'Weitblick',
  'wolkenspringer': 'Wolkenspringer',
  'wortakrobat': 'Wortakrobat',
  'wortflitzer': 'Wortflitzer',
  'wortmeister': 'Wortmeister',
  'wuerfelfuchs': 'Würfelfuchs',
  'wuerfelkoenig': 'Würfelkönig',
  'wuerfelmeister': 'Würfelmeister',
  'zahlengenie': 'Zahlengenie',
  'zahlenzwerg': 'Zahlenzwerg',
  'zufall': 'allgemeine Bots der Engine',
};

const BOT_BY_GAME: Readonly<Record<string, string>> = {
  'battleship': 'admiral',
  'bible-quiz': 'bibelkenner',
  'binokel': 'schwaben-ass',
  'black-peter': 'kartenmischer',
  'category-sprint': 'wortflitzer',
  'chess': 'vorausrechner',
  'checkers': 'vorausrechner',
  'mill': 'vorausrechner',
  'reversi': 'vorausrechner',
  'four-in-a-row': 'vorausrechner',
  'four-player-chess': 'weitblick',
  'chinese-checkers': 'sternspringer',
  'color-and-shape': 'musterelster',
  'describe-duel': 'wortakrobat',
  'word-salad': 'wortakrobat',
  'drachenspiel': 'drachenhueter',
  'duck-rally': 'renn-ente',
  'elevens': 'zahlenzwerg',
  'factor-grid': 'zahlengenie',
  'grafschaft': 'landvogt',
  'hangman': 'buchstabenfuchs',
  'kniffel': 'wuerfelkoenig',
  'ligretto': 'flinke-hand',
  'low-flight': 'wolkenspringer',
  'ludo': 'wuerfelmeister',
  'maexle': 'wuerfelfuchs',
  'market-stalls': 'marktschreier',
  'marketplace': 'kraemer',
  'mau-mau': 'mau-mau-meister',
  'number-wall': 'mauerbaumeister',
  'pairs': 'merkfant',
  'poker': 'pokerface',
  'president': 'kartenkanzler',
  'quartett': 'kartenkenner',
  'scrabble': 'wortmeister',
  'speed': 'flinker-finger',
  'symbol-match': 'adlerauge',
  'target-number': 'rechenfuchs',
  'who-am-i': 'spuernase',
  'wolves-sheep': 'huetehelfer',
  'uno': 'kartenprofi',
  'turnip-patch': 'langohr',
  'skat': 'reizkeiler',
  'doppelkopf': 'frau-dulle',
  'schafkopf': 'sauspieler',
  'go': 'steinmeister',
  'dominoes': 'steinleger',
  'bingo': 'kugelrufer',
  'solitaire': 'geduldsschnecke',
  'tic-tac-toe': 'kreidekaetzchen',
  'ultimate-tic-tac-toe': 'kreidekaetzchen',
  'gomoku': 'fuenferpanda',
  'majority': 'zufall',
  'estimate': 'zufall',
  'timeline': 'zufall',
  'color-sorter': 'zufall',
};

const FILES = import.meta.glob<string>('../../../../packages/ui/src/bots/portraits/*.webp', { eager: true, query: '?url', import: 'default' });

/** Kennung des Bot-Porträts eines Spiels (immer eine, notfalls „zufall“). */
export const botPortraitId = (gameId: string | null | undefined): string => (gameId && BOT_BY_GAME[gameId]) || 'zufall';

/** Name des Bots eines Spiels, z. B. „Admiral“. */
export const botName = (gameId: string | null | undefined): string => BOT_NAMES[botPortraitId(gameId)] ?? 'Computer';

/** Avatar-Wert für einen Bot-Sitz: `bot:<kennung>`. */
export const botAvatar = (gameId: string | null | undefined): string => `bot:${botPortraitId(gameId)}`;

/** Bild zu einem `bot:`-Wert; ohne Bild `undefined` (dann bleibt das Roboter-Emoji). */
export function botPortraitUrl(value: string): string | undefined {
  return value.startsWith('bot:') ? FILES[`../../../../packages/ui/src/bots/portraits/bot-${value.slice(4)}.webp`] : undefined;
}

export const BOT_GAMES: readonly string[] = Object.keys(BOT_BY_GAME);
