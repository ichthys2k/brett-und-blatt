import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels Grafschaft (W-039).
 */
export const meta: GameInfo = {
  id: 'grafschaft',
  name: 'Grafschaft',
  description:
    'Sechseck-Legespiel im Narrenhof-Königreich: Errichtet gemeinsam eine bunte Grafschaft, baut ertragreiche Dörfer und erfüllt geheime Aufträge der Höflinge.',
  emoji: '🏰',
  players: { min: 2, max: 5 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  takeBack: false,
  ruleVersion: 1,
  howToPlay: [
    'Reihum wählt jeder ein Sechseck-Plättchen vom offenen Jahrmarkt und legt es an die gemeinsame Grafschaft an.',
    'Jedes Plättchen darf an jede Kante eines beliebigen bereits liegenden Plättchens gelegt werden – Kanten müssen nicht zusammenpassen.',
    'Dörfer bringen sofort Vielfalt-Punkte: Wer ein Dorf legt, erhält 1 Punkt für jede verschiedene Landschaftsart in der direkten Nachbarschaft (bis zu 6 Punkte).',
    'Jeder Spieler hat geheime Aufträge von Höflingen (z. B. drei Teiche zusammenhängend, eine Mühle am Fluss, ein Berg am Weg). Werden die Bedingungen erfüllt, gibt es Bonuspunkte und neue Aufträge kommen nach.',
    'Sobald alle Plättchen gelegt sind, gewinnt die höchste Gesamtpunktzahl.',
  ],
};
