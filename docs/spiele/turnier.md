# Turniere (W-053)

Stand: Plan, noch nicht gebaut. Fertig ist nur der Spielerausweis (W-052), siehe unten.

## Ziel

Mehr als zwei Spieler tragen über Tage oder Wochen ein Turnier aus. Jede Partie wird am Stück gespielt, die Partien aber nach und nach, wann die beiden Gegner Zeit haben. Alle Eingeschriebenen können jederzeit nachsehen, wo das Turnier steht.

## Formen

Austauschbare, reine Logik in `packages/online` (wie `lobby.ts`), ohne Cloudflare testbar:

- **WM-Form:** Vierergruppen, jeder gegen jeden, 3/1/0 Punkte, die zwei Besten kommen in den K.-o.-Baum, Spiel um Platz 3 optional.
- **Schweizer System:** feste Rundenzahl, immer ähnlich Starke gegeneinander.

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

Noch offen für das Turnier: Die Leitung kann heute keinen neuen Code ausstellen. Ein neuer Code sperrt zudem nur den alten Code, nicht schon angemeldete Geräte, denn die Kennung bleibt gleich. Für das Turnier braucht es dazu eine Zuordnung Turnierspieler → Kennung im Turnierleiter, die die Leitung neu vergeben kann.

## Bauteile

1. Reine Logik: Auslosung, Tabelle, Gleichstand, Baum, Schweizer Paarungen.
2. Durable Object `TournamentRoom` (EU, Wecker für Stichtage, Löschfrist nach Turnierende, Vorschlag 30 Tage). Neue Klasse in `wrangler.jsonc` als Migration.
3. Raum-Anbindung: Der Turnierleiter legt Räume an, teilt Plätze zu und erhält das Ergebnis. Dafür braucht `Room` eine Kennung des Turniers und feste Plätze, und die Bot-Vertretung entfällt zugunsten einer Wartefrist von einigen Minuten.
4. Turnierseite mit Tabellen, Baum und „Mein Stand“.
5. Werkzeuge der Leitung: Frist, Ergebnis, Rückzug, Code neu ausstellen.
6. Datenschutzerklärung ergänzen, von jemandem mit Rechtskenntnis prüfen lassen.

## Offene Fragen

- **Gleichstand:** direkter Vergleich, dann Siege, dann Los über den Seed. Tordifferenz nur mit neuer freiwilliger Angabe im Spielmodul.
- **Remis im K.-o.-Spiel:** Entscheidungsspiel mit getauschten Farben und kürzerer Zeit.
- **Regelversion:** Beim Turnierstart festhalten oder in der Turnierzeit keine Balance-Änderungen veröffentlichen. Prüfen, wie sich das umsetzen lässt.
- **Kontingent:** Eine Testpartie messen und hochrechnen, bevor große Turniere laufen.
