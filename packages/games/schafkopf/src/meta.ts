import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'schafkopf',
  name: 'Schafkopf',
  description:
    'Das traditionelle bayerische Kartenspiel für vier Spieler mit bayerischem Blatt: Sauspiel mit geheimem Partner, Wenz und Farbsolo nach den Regeln der Schafkopfschule.',
  emoji: '🎴',
  players: { min: 4, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 2,
  howToPlay: [
    'Schafkopf wird zu viert mit 32 Karten (langes Blatt) oder 24 Karten (kurzes Blatt) im bayerischen Bild gespielt: Eichel, Gras, Herz und Schellen. Jeder erhält 8 Karten (kurz: 6 Karten).',
    'Spielansage: Reihum ab Vorhand sagt jeder „weiter“ oder „ich würde spielen“. Wollen mehrere spielen, gilt die Rangfolge Sauspiel < Wenz < Farbsolo < Tout.',
    'Sauspiel (Rufspiel): Der Spieler ruft eine Sau (Eichel, Gras oder Schellen), die er nicht selbst besitzt, aber von deren Farbe er mindestens eine Karte hat. Wer die gerufene Sau hält, ist sein geheimer Partner!',
    'Trumpf: Im Sauspiel und Farbsolo sind die vier Ober (Eichel > Gras > Herz > Schellen), die vier Unter und die Trumpffarbe (im Sauspiel Herz) Trumpf. Im Wenz nur die vier Unter.',
    'Bedienpflicht & Rufsau: Die angespielte Farbe muss bedient werden (Ober und Unter zählen als Trumpf). Wird die Ruffarbe angespielt, muss die Rufsau zugegeben werden. Davonlaufen ist ab 4 Karten der Ruffarbe erlaubt.',
    'Ziel: Die spielende Partei gewinnt mit mindestens 61 Augen (zusammen 120 Augen). Zusätzliche Punkte gibt es für Schneider (≤ 30 Augen), Schwarz und Laufende ab 3 (Wenz ab 2).',
  ],
};
