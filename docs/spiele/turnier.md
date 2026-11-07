# Turniere (W-053)

Stand: veröffentlicht am 2.11.2026. Offenes steht am Ende.

Aufgabenstatus und Abnahme: [GitHub Issue #62](https://github.com/ichthys2k/brett-und-blatt/issues/62). Dieser Plan enthält die fachlichen Anforderungen und Prüfpunkte, nicht den Freigabestatus.

## Ziel

Mehr als zwei Spieler tragen über Tage oder Wochen ein Turnier aus. Jede Partie wird am Stück gespielt, die Partien aber nach und nach, wann die beiden Gegner Zeit haben. Alle Eingeschriebenen können jederzeit nachsehen, wo das Turnier steht.

## Formen

Austauschbare, reine Logik in `packages/online` (wie `lobby.ts`), ohne Cloudflare testbar:

- **WM-Form:** Vierergruppen, jeder gegen jeden, 3/1/0 Punkte, die zwei Besten kommen in den K.-o.-Baum, Spiel um Platz 3 optional.
- **Schweizer System:** feste Rundenzahl, immer ähnlich Starke gegeneinander.
- **K.-o.:** Wer verliert, ist raus; Spiel um Platz 3 optional. Geht die Spielerzahl nicht in einer Zweierpotenz auf, gibt es in Runde 1 Freilose. Für n Spieler n − 1 Partien.
- **Doppel-K.-o.:** Raus erst nach zwei Niederlagen. Gewinnerrunde, Verliererrunde, Großes Finale; gewinnt dort der Herausforderer, folgt eine Entscheidungspartie (`gf2`). 2n − 2 Partien, mit Entscheidung 2n − 1. Beide Seiten teilen sich Stichtage: bei 8 Spielern 6 Phasen, mit Entscheidung 7.

| Spieler | Gruppen | Partien WM-Form | Runden |
|---|---|---|---|
| 8 | 2 | 15 | 5 |
| 16 | 4 | 31 | 6 |
| 32 | 8 | 63 | 7 |

Zuerst nur Spiele mit zwei Plätzen. Einstiegsgröße 8 oder 16.

## Ablauf

- Gruppenphase: Alle Paarungen stehen nach der Auslosung fest, die Reihenfolge ist frei.
- K.-o.-Phase: Eine Paarung ist spielbar, sobald beide Gegner feststehen. Die Hälften des Baums warten nicht aufeinander.
- Start: Beide tippen auf „Bereit“, dann legt der Turnierleiter einen normalen Spielraum an. Der Raum meldet das Ergebnis selbst zurück.
- Stichtag je Phase. Danach ist eine offene Partie kampflos verloren, wenn nur einer bereit war, sonst für beide. Die Leitung kann verlängern oder ein Ergebnis festlegen.

## Fortschritt für alle Eingeschriebenen

Jeder Eingeschriebene sieht die Turnierseite, auch nach dem Ausscheiden. Sie ist der zentrale Ort des Turniers, nicht nur eine Ergebnisliste.

- **Mein Stand zuerst:** oben „Du bist dran gegen …“, dann die eigenen offenen und gespielten Partien, die eigene Gruppe und der eigene Weg durch den Baum.
- **Gruppentabellen:** Platz, gespielte Partien, Siege, Remis, Niederlagen, Punkte. Die Weiterkommenden sind markiert. Weil nicht alle gleich weit sind, stehen die gespielten Partien immer dabei, und die Reihenfolge heißt bis zum Stichtag „vorläufig“.
- **Turnierbaum:** alle K.-o.-Runden mit Namen und Ergebnis; noch offene Plätze zeigen ihre Herkunft („Sieger Gruppe A“, „Sieger Halbfinale 1“). Der eigene Weg ist hervorgehoben. Schon während der Gruppenphase sichtbar.
- **Handy:** Ein breiter Baum passt nicht ins Hochformat. Dort je Runde eine Ansicht zum Wischen, dazu eine kleine Übersicht, wo man im Baum steht. Ab genug Breite der ganze Baum. Nie die ganze Seite waagerecht rollen.
- **Laufende Partien:** Markierung „läuft gerade“, Zuschauen über den vorhandenen Zuschauerplatz des Raums.
- **Verlauf und Fristen:** letzte Ergebnisse, Stichtag der Phase, wer noch offen ist. Kampflose Ergebnisse sind als solche gekennzeichnet.
- **Live und günstig:** Die Seite hält wie „Offene Runden“ eine schlafende WebSocket-Verbindung (Hibernation) und bekommt nur bei Änderungen einen neuen Stand. Sie funktioniert auch als reiner Abruf ohne Verbindung.
- **Am Smartboard:** Die Leitung kann den Baum als große Ansicht ohne eigene Daten anzeigen.
- **Zugang:** über Turnierlink oder QR-Code plus Spielerausweis. Gezeigt werden nur Spitznamen, Bilder und Ergebnisse, keine Geheimnisse aus den Partien. Fremde ohne Ausweis sehen nichts; ob die Leitung einen Zuschaulink freigeben darf, ist noch zu entscheiden.

## Wiedererkennung: Spielerausweis (W-052, fertig)

Räume erkennen Mitglieder an einer geheimen Kennung (`hello.token`). Der Ausweis macht sie übertragbar, ohne Konto:

- **Spielercode:** vier Wörter aus 256 (32 Bit), darunter liegt der Ausweis verschlüsselt in der vorhandenen Ablage `BackupVault`. Drei Wörter wären mit 24 Bit zu leicht zu erraten gewesen.
- **QR-Code:** Link `#/online?ausweis=…`; der Teil hinter `#` geht nicht an einen Server, und die Seite entfernt ihn sofort aus der Adresszeile.
- **Sicherungscode:** Der Ausweis ist ein weiterer Block der gemeinsamen Sicherung (`PLAYER_SALT`), ein Narrenhof- oder Drachenspiel-Code passt also auch. Der Spielercode kommt dabei mit.
- **Passkey:** liegt über dem Sicherungscode, wie im Narrenhof.
- **Abmelden auf geteilten Geräten:** vergisst Kennung, Spitznamen und Codes. Die Gerätekennung bleibt der Normalfall ohne Eingabe.

Beim Anlegen bleibt die Kennung gleich, begonnene Partien laufen also weiter. Zwei Geräte mit demselben Ausweis sind im Raum dasselbe Mitglied und beide verbunden. Code: `packages/ui/src/sync/player.ts`, `apps/web/src/lib/playerPass.ts`, `apps/web/src/components/PlayerPassPanel.tsx`.

Im Turnier kann die Leitung zusätzlich einen Einmal-Link ausstellen (`reissue`, `claim`, `#/turnier/<Code>?neu=…`): Das neue Gerät übernimmt den Turnierplatz, das alte verliert den Zugang. Eine schon laufende Partie bleibt beim alten Gerät.

## Umsetzung

- **Logik:** `packages/online/src/tournament.ts` (Klasse `Tournament`, ohne Cloudflare testbar, `test/tournament.test.ts`).
- **Server:** Durable Object `TournamentRoom` in `apps/server/src/index.ts`, `POST /turniere`, `GET /turniere/<Code>` als WebSocket mit Hibernation, Wecker für Stichtage, Migration `v4`.
- **Raum:** `Room.setupMatch` (`test/match-room.test.ts`): feste Plätze über die Kennungen, keine Raumleitung, Start, sobald beide verbunden sind. Das Ergebnis wird über `matchReport` zugestellt und bei einem Fehler nach 60 s erneut versucht.
- **Oberfläche:** `apps/web/src/screens/Tournament.tsx`, `components/TournamentsPanel.tsx`, `lib/tournament.ts`.
- **Rauchtest:** `node apps/server/scripts/turnier.mjs` spielt gegen den laufenden Server ein ganzes Turnier in echten Räumen.

## Entscheidungen (2.11.2026)

- **Gruppen:** die größte Zweierpotenz mit mindestens drei Spielern je Gruppe. WM-Form ab 6, Schweizer System ab 4, höchstens 32 Spieler.
- **Gleichstand:** Punkte, direkter Vergleich, Siege, Los über den Seed; im Schweizer System Buchholz statt direktem Vergleich.
- **Remis im K.-o.-Spiel:** Entscheidungsspiel mit getauschten Farben und schneller Zeit.
- **„Bereit“:** gilt 10 Minuten und nur für eine Partie. Wer je bereit war, gewinnt am Stichtag kampflos gegen jemanden, der es nie war; waren es beide oder keiner, verlieren beide.
- **Fehlen:** 5 Minuten Wartezeit beim Betreten; wer in der Partie 5 Minuten weg ist, verliert sie. Kommt keiner, ist die Partie wieder offen.
- **Fristen:** Eine Partie, die spät spielbar wird, hat mindestens 24 Stunden Zeit. Eine laufende Partie verfällt am Stichtag nicht.
- **Zuschaulink:** vorerst keiner. Nach dem Start sehen nur Eingeschriebene und Leitung die Seite; die Leitung hat eine große Ansicht für die Tafel.
- **Spieloptionen:** Die Leitung wählt sie beim Anlegen, sie gelten für alle Partien. Verborgene Optionen bleiben auf dem Standard.
- **Turnierliste:** Sie liegt im Spielerausweis (`tournaments`), ein neues Gerät findet die Turniere also ohne Link wieder.
- **Löschen:** 30 Tage nach Ende oder nach der letzten Aktivität.

## Noch offen

- **Ausbau zur Turniersoftware:** Gesamtkonzept mit Vor-Ort-Turnieren, Helfern, Zeitplan und weiteren Formen in [`turniersoftware.md`](turniersoftware.md) (W-058, #63).

- **Regelversion:** Der Regelstand wird beim Start festgehalten; ändert er sich, sehen alle einen Hinweis. Alte Regeln lassen sich aber nicht weiterspielen, denn der Server hat nur den aktuellen Code. Während eines Turniers also trotzdem keine Balance-Änderungen am gewählten Spiel veröffentlichen.
- **Benachrichtigung:** nur bei offener Seite im Hintergrund (Web Notifications). Hinweise bei geschlossener Seite bräuchten Web Push mit eigenen Schlüsseln und Speicherung der Empfänger, sind also eine eigene Entscheidung.
- **Kontingent:** Eine Testpartie messen und hochrechnen, bevor große Turniere laufen.
- **Datenschutz:** Der neue Absatz ist nicht rechtlich geprüft.
- **Regeln fest:** Doppel-K.-o. kennt noch kein Spiel um Platz 3 als eigene Partie, Dritter ist der Verlierer des Finales der Verliererrunde.
- **Ungeprüft:** echtes Turnier mit mehreren Menschen auf echten Geräten, Stichtage auf Cloudflare.
