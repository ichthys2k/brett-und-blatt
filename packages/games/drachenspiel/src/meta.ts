import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'drachenspiel',
  name: 'Drachenspiel',
  description: 'Sammelkarten-Duell mit Tierkarten, Knappen und 30 Wimpeln – allein gegen Bots oder online.',
  emoji: '🐲',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 13,
  // Karten ziehen und Zufall zeigen Neues: Ein Zurücknehmen ließe sich ausnutzen.
  noUndo: true,
  hints: true,
  howToPlay: [
    'Beide Turnierherren starten mit 30 Wimpeln an ihrer Tribüne. Wer zuerst alle Wimpel verliert, unterliegt im Duell.',
    'Zu Beginn jeder Runde eilt 1 Knappe mehr herbei (bis zu 10 Knappen) und alle Knappen stehen wieder bereit.',
    'Rufe Tiere aus deiner Hand aufs Feld. Neu gelegte Tiere müssen eine Runde warten, bevor sie ins Gefecht ziehen dürfen (außer Tiere mit ⚡ Ansturm).',
    'Greife gegnerische Tiere oder direkt den gegnerischen Turnierherrn an. Hat der Gegner Tiere im 🛡️ Schildwall, musst du sie zuerst angreifen.',
    'Wer als Zweiter beginnt, erhält eine Handkarte mehr, die ⭐ Sternschnuppe für +1 Knappe und 5 Rüstung.',
    'Kniffe (Option, Standard an): einmalige taktische Kniffe wie ⚡ Blitzschlag (3 Schaden), 🍯 Honigtopf (+2/+2), 🌊 Flutwelle (Tier zurück auf die Hand) oder 🍀 Glücksklee (2 Karten). Kniffe mit Ziel erst antippen, dann das Ziel wählen – oder die Karte aufs Ziel ziehen.',
    'Drachenei (Option): Neben jedem Turnierherrn liegt zu Beginn ein Drachenei, das nach drei Runden schlüpft. Der Jungdrache besitzt eine charakteristische Fähigkeit seines Wappenhauses.',
    'Karte groß ansehen: lange drücken, rechts klicken oder mit der Taste i. Unter „Verlauf“ steht, was zuletzt geschah.',
    'Hauskraft: Einmal je Zug kannst du mit 2 Knappen die Kraft deines Hauses nutzen (Knopf neben „Zug beenden“). Lange drücken zeigt, was sie tut.',
    'Rüstung 🛡️ fängt Schaden ab, bevor deine Wimpel fallen. Hat dein Turnierherr Angriff (⚔️), tippe ihn an und wähle ein Ziel, einmal je Zug. Greift er ein Tier an, schlägt es zurück.',
    'Karten mit 🔄 Tauschen kannst du mit 1 Knappe zurück ins Deck mischen und dafür neu ziehen. ⏳ Flüchtige Karten verschwinden am Ende deines Zugs. Was ein Abzeichen auf einer Karte bedeutet, zeigt langes Drücken.',
    'Manche Fanfaren fragen nach: Wähle ein Ziel, eine Karte (Fährte suchen) oder eine Verbesserung (Anpassen). 🐺 Rudeltaktik wirkt, wenn du im selben Zug schon eine Karte gerufen hast, 🦡 Einzelgänger, wenn die Karte ganz links oder rechts auf der Hand lag. 🔒 Erschöpfung sperrt im nächsten Zug Knappen.',
    'Besondere Karten: 🏗️ Bauten lassen sich einmal je Zug antippen und verlieren dabei 1 Festigkeit. 💤 Tiere im Winterschlaf und Eier sind unangreifbar, bis sie erwachen. 🪤 Fallen liegen verdeckt und lösen im Zug des Gegners aus. 📜 Aufgaben geben bei Erfolg eine starke Karte.',
    'Eigene Decks: 30 Karten aus einem Haus und neutrale, höchstens 2 Kopien, Sagentiere einmal. Alle Karten sind frei. Bauen, speichern und per Code teilen geht in der Deckwahl.',
    'Ist dein Deck leer, erleidet dein Turnierherr jede Runde zunehmenden Müdigkeits-Schaden. Auf die Hand passen 10 Karten, was darüber hinaus gezogen wird, verfällt.',
  ],
};
