import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'binokel',
  name: 'Binokel',
  description: 'Schwäbisches Kartenspiel für drei oder vier: reizen, den Dabb aufnehmen, melden und Stiche machen – zu viert auch als Kreuzbinokel mit Partner.',
  emoji: '🎴',
  players: { min: 3, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 3,
  hints: true,
  howToPlay: [
    'Gespielt wird mit doppeltem Blatt: Sau 11, Zehn 10, König 4, Ober 3, Unter 2 Augen; der letzte Stich bringt 10 dazu.',
    'Reizen: Wer am meisten bietet (in Zehnerschritten ab dem Mindestgebot), wird Spielmacher. Er nimmt den offenen Dabb auf, drückt ebenso viele Karten und sagt Trumpf an.',
    'Danach melden alle automatisch: Paar 20 (Trumpf 40), Familie 100 (Trumpf 150), Rundgang +100, vier Sauen 100, Könige 80, Ober 60, Unter 40, Binokel (Grün-Ober + Schellen-Unter) 40, doppelter Binokel 300.',
    'Meldungen zählen nur, wer mindestens einen Stich macht.',
    'Farbe bedienen und wenn möglich überstechen; wer nicht bedienen kann, muss trumpfen (und übertrumpfen, wenn möglich).',
    'Der Spielmacher braucht Meldungen plus Augen (samt gedrückter Karten) mindestens in Höhe seines Gebots, sonst verliert er das doppelte Gebot. Er kann vor dem Ausspielen abgehen und verliert dann nur das einfache.',
    'Durch: Ohne Trumpf und ohne Meldungen alle Stiche machen – 1000 Punkte, sonst minus 1000.',
    'Zu viert: Entweder setzt der Geber aus, oder ihr spielt Kreuzbinokel – die Gegenübersitzenden sind Partner, jeder bekommt 9 Karten (mit Siebenern 11), der Dabb hat 4. Partner zählen ihre Punkte zusammen, Meldungen zählen aber nur mit eigenem Stich.',
    'Gewonnen hat, wer zuerst das Ziel (1000 oder 1500 Punkte) erreicht – spätestens nach 24 Spielen zählt der beste Stand.',
  ],
};
