# Brett & Blatt

Eine freie Sammlung von Karten- und Brettspielen für den Browser, für Handy und Desktop.

- **Allein** gegen Bots in mehreren Stärkestufen
- **Zu mehreren an einem Gerät** (Hot-Seat)
- **Online** mit Freunden, der Familie oder der Klasse, ganz ohne Konto

Geplant sind unter anderem Skat, Doppelkopf, Schafkopf, Quartett, Paare finden, Mühle, Vier in einer Reihe, Reversi, Go, Ultimate Tic-Tac-Toe, Schiffe versenken und Mäxle. Weitere Spiele lassen sich als Module ergänzen.

## Stand

**Online spielen:** https://spiele.lipponer.de

**Etappe 2 ist umgesetzt.** Spielbar sind Tic-Tac-Toe, Vier in einer Reihe, Ultimate Tic-Tac-Toe, Reversi, Mühle, Paare finden, Schwarzer Peter, Solitaire (Klondike, FreeCell, Spider, Pyramide) und Vierer-Schach – allein gegen den Computer in drei Stärken oder zu mehreren an einem Gerät, wahlweise mit Zeitlimit. Jedes Spiel hat eine kurze Anleitung. Die App lässt sich auf dem Handy installieren und funktioniert danach auch ohne Internet.

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

- [Konzept](docs/KONZEPT.md): Entscheidungen, Aufbau, Spielmodul-Schnittstelle, Bots, Zeitlimits, Datenschutz, Fahrplan
- [Spielpläne](docs/spiele/README.md): ein Plan pro Spiel mit Regeln, Bot, Oberfläche und Tests
- [Mitmachen](CONTRIBUTING.md): Aufbau des Codes und wie man ein neues Spiel hinzufügt

## Grundsätze

- Kostenlos, ohne Werbung und ohne Tracker
- Datensparsam: keine Konten, kein freier Chat, Daten in der EU
- Jedes Spiel ist gegen Bots spielbar
- Offen: Code und Inhalte stehen unter freien Lizenzen

## Lizenz

- **Code:** [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0)
- **Inhalte** (Grafiken, Sounds, Kartenmotive, Kartensets, Wortlisten), soweit nicht anders angegeben: [Creative Commons Namensnennung – Weitergabe unter gleichen Bedingungen 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) (CC BY-SA 4.0)
