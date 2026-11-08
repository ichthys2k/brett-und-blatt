# Spielerpass – Fortschritt, Familie und Sammlung hinter dem Spielerausweis

Stand: 8.11.2026, Plan (noch nichts gebaut). Vorhaben-Issue [#135](https://github.com/ichthys2k/brett-und-blatt/issues/135), Schritte in Abschnitt 9.

## 1. Ziel

Alles, was ein Mensch in Brett & Blatt erspielt und einstellt, hängt an seinem **Spielerausweis** (W-052) und kommt mit auf jedes Gerät: Ergebnisse, Chronik, Bot-Wertung, Stempel, Pokale, Wappen, Sammelalbum, Einstellungen, eigene Inhaltspakete, Decks und Lernstände. Mehrere Menschen teilen sich ein Gerät (Familie, Klassen-Tablet), ohne sich in die Quere zu kommen. Den Pass kann man **teilen**, als Bild oder Link. In **Klassen** (Beitritt per Emoji-Code oder QR-Code) sehen sich die Mitglieder gegenseitig mit Profil und Erfolgen; Lehrkräfte können Klassenausweise ausgeben.

Was bleibt:

- **Kein Konto:** keine E-Mail, kein echter Name, kein Passwort-vergessen-Ablauf. Der Ausweis ist ein Besitz (Code, PIN, Passkey, Notfallkarte), keine Registrierung.
- **Erst das Gerät:** Alles funktioniert ohne Netz und ohne Ausweis-Code. Die Sicherung gleicht nur ab.
- **Der Server sieht nichts:** Er speichert verschlüsselte Blöcke. Bestenlisten über alle Spieler gibt es deshalb nicht; was im Pass steht, meldet das eigene Gerät. Wettbewerb bleibt Räumen und Turnieren überlassen.
- **Kinder und Schule:** Spitznamen und Emoji-Bilder, nichts Öffentliches, Teilen nur ausdrücklich.

## 2. Begriffe

| Begriff | Bedeutung |
|---|---|
| **Spielerausweis** | Identität: Kennung (`hello.token`), Spitzname, Bild, Spielercode. Gibt es seit W-052. |
| **Spielerpass** | Alles, was am Ausweis hängt, und die Seite `#/pass`, die es zeigt. |
| **Passschlüssel** | Zufälliger 256-Bit-Schlüssel je Pass. Aus ihm werden Kennung und Schlüssel jedes Blocks abgeleitet. |
| **Block** | Ein verschlüsselter Datensatz der Sicherung (`BackupVault`, je höchstens 64 KB), z. B. `einstellungen`, `partiebuch`. |
| **Öffner** | Was den Passschlüssel freigibt: Spielercode + PIN oder Passwort, Sicherungscode (Notfallkarte), Passkey, Google- oder Microsoft-Konto, bei Klassenausweisen die Leitung. |
| **Klasse** | Dauerhafte Gruppe von Pässen mit Leitung; Beitritt per Emoji-Code oder QR-Code, Profile der Mitglieder sichtbar. |
| **Pass auf dem Gerät** | Ein Eintrag in der Passliste des Geräts. Ein Gerät kann mehrere tragen (Familie). |

## 3. Schlüssel und Schloss

### Heute

- Der Spielercode (4 Emoji aus 16, 65 536 Codes) leitet per HKDF Kennung und Schlüssel des Schlosses ab (`packages/ui/src/sync/player.ts`, `crypto.ts`). Darin liegt der Ausweis.
- Der Sicherungscode (16 Zeichen) öffnet je Bereich einen eigenen Block (`KNOWN_SALTS` in `vault.ts`: Narrenhof, Drachenspiel, Ausweis). Passkeys liegen darüber.
- Fehlversuche zählt der Server **je IP-Adresse** (`packages/online/src/attempts.ts`, 60 pro Stunde).

Für Name und Bild reicht das. Für Fortschritt nicht: Wer eine Kopie der Serverdaten hat, probiert alle 65 536 Spielercodes in Sekunden durch, und die IP-Sperre lässt sich mit vielen Adressen umgehen.

### Künftig

```
Spielercode + PIN ──► Schloss (Server, Zähler je Ausweis) ─┐
Sicherungscode (Notfallkarte) ──► Ausweis-Block ───────────┼─► Passschlüssel ─► alle Blöcke
Passkey (PRF) ──► Sicherungscode ──────────────────────────┘
```

1. **Passschlüssel:** Beim Anlegen eines Passes erzeugt der Browser einen zufälligen Passschlüssel. Jeder Block bekommt Kennung und Schlüssel per HKDF aus ihm (`info` = Blockname, eigenes Salt `brett-und-blatt/pass/<block>/v1`). Wer den Passschlüssel hat, hat alles; ein Block verrät nichts über die anderen.
2. **Schloss mit PIN oder Passwort** (Spielercode als „Benutzername“; unten steht nur „PIN“, gemeint ist beides):
   - Der Browser leitet aus dem Spielercode die Schloss-Kennung ab (wie heute) und aus Spielercode + PIN mit **PBKDF2** (WebCrypto, SHA-256, hohe Rundenzahl, etwa 0,3 s auf einem schwachen Handy messen) zwei Werte: `auth` (geht an den Server) und `wrap` (bleibt im Browser).
   - Der Server speichert je Schloss: einen Prüfwert `HMAC(Pfeffer, auth)`, einen **Serveranteil** (zufällig, mit dem Pfeffer verschlüsselt gespeichert), den mit `HKDF(wrap ‖ Serveranteil)` verschlüsselten Inhalt (Ausweis + Passschlüssel) und einen **Fehlversuchszähler**.
   - Stimmt `auth`, gibt der Server Serveranteil und Inhalt heraus. Falsche PIN: Zähler +1; ab 5 wachsende Wartezeit (1, 5, 15, 60 min), ab 10 gesperrt, bis ein anderer Öffner (Notfallkarte, Passkey) ein neues Schloss schreibt.
   - Der **Pfeffer** ist ein Wrangler-Secret (`PASS_PEPPER`). Eine Kopie der Datenbank allein reicht so nicht zum Durchprobieren. Wer Datenbank und Pfeffer zugleich hat (Betreiber, Cloudflare), könnte mit großem Rechenaufwand Ausweise mit kurzer PIN öffnen. Das steht so in der Datenschutzerklärung.
   - Die IP-Sperre bleibt zusätzlich.
3. **Notfallkarte:** Der Sicherungscode bleibt der Weg, wenn PIN oder Code fehlen. Der Pass bietet ihn als Karte zum Drucken an (QR-Code, Code, Hinweis „sicher aufbewahren“). Er öffnet den Ausweis-Block, darin steht der Passschlüssel; damit lässt sich ein neues Schloss mit neuer PIN schreiben.
4. **Passkey:** wie heute über dem Sicherungscode. Auf eigenen Geräten der bequeme Normalfall: einmal einrichten, danach Fingerabdruck statt PIN.
5. **Übergang:** Bestehende Schlösser ohne PIN öffnen weiterhin nur den Ausweis (Kennung, Name, Bild, Turniere), nie den Passschlüssel. Beim nächsten Öffnen von `#/online` oder `#/pass` fragt die Seite „PIN festlegen“. Erst dann liegt der Passschlüssel hinter dem Spielercode.

### Entscheidungen (Cornelius, 8.11.2026)

- **PIN und Passwort:** Beides wird angeboten; jeder Pass wählt eins. Die PIN ist der einfache Weg (für Kinder), das Passwort der stärkere. Der Ablauf (PBKDF2, Prüfwert, Serveranteil, Zähler) ist für beide gleich.
- **Server-Pfeffer:** ja, mit der beschriebenen Einschränkung.
- **Google und Microsoft:** werden jetzt mitgeplant (Abschnitt 8.3).
- **Klassenausweise:** ja (Abschnitt 8.2).

### Noch offen

- PIN aus **6 Ziffern**, aus **6 Bildern aus 16** (16,7 Millionen, für Kinder leichter) oder beides wählbar? Mindestlänge des Passworts (Vorschlag: 10 Zeichen)?
- Wie lange sollen Schlösser ohne PIN noch den Ausweis öffnen (Vorschlag: unbegrenzt, sie öffnen ja nur die Identität)?

## 4. Familie an einem Gerät

Ein Gerät trägt eine **Passliste**. Genau ein Pass ist aktiv; online spielt das Gerät als dieser Pass.

- **Speicher:** `brett-und-blatt:paesse` (Liste mit Pass-Kennung, Spitzname, Bild, Wappen-Kurzform, ob ein Code verbunden ist), `brett-und-blatt:pass-aktiv`. Alle Pass-Daten liegen unter `brett-und-blatt:pass:<Pass-Kennung>:<block>`. Gerätedaten (Lautstärke, Geräte-Kennung für Zähler, Kontrastwunsch) bleiben ohne Pass-Präfix.
- **Übergang:** Das heutige Profil (`brett-und-blatt:profil`, `geraet`, `spielercode`, `turniere`, Lieblingsspiele, Einstellungen, Narrenhof, Drachenspiel) wird beim ersten Start der neuen Fassung zum ersten Pass. Nichts geht verloren, die Kennung bleibt gleich, laufende Online-Partien laufen weiter.
- **Wer spielt?** Oben auf der Startseite sitzt das Bild des aktiven Passes. Antippen öffnet die Passwahl: Kacheln mit Bild und Name, „➕ Neuer Pass“, „👤 Gast“ (zeichnet nichts auf). Optional je Gerät: Passwahl bei jedem Start zeigen.
- **Eigene Kennung je Pass:** Jeder Pass hat seine eigene Raum-Kennung. Beim Wechsel trennt das Gerät laufende Online-Verbindungen und verbindet als neuer Pass.
- **Pass ohne Code:** Ein neuer Pass lebt zuerst nur auf dem Gerät (gut für kleine Kinder). Spielercode, PIN und Sicherung lassen sich jederzeit nachrüsten.
- **Sperre je Pass (wahlweise):** Wer nicht will, dass Geschwister in seinem Pass spielen, legt eine Geräte-PIN für den Wechsel in seinen Pass fest. Sie schützt nur vor Neugier am Gerät (lokal geprüft), nicht vor Angreifern.
- **Hot-Seat:** In der Einrichtung bekommt jeder menschliche Platz statt des Namensfelds eine Auswahl aus den Pässen des Geräts, „Gast“ oder freiem Namen. Am Ende schreibt jede beteiligte Pass-Zeile ihr eigenes Ergebnis ins Partiebuch. Der aktive Pass sitzt standardmäßig auf Platz 1.
- **Abmelden:** „Pass von diesem Gerät entfernen“ löscht nur diesen Pass vom Gerät (mit Warnung, wenn er keinen Code hat und damit verloren wäre).
- **Sicherung:** Jeder Pass gleicht unabhängig ab. Ein Gerät kann so mehrere Codes kennen.

## 5. Blöcke und Zusammenführen

| Block | Inhalt | Zusammenführen | Grenze |
|---|---|---|---|
| `ausweis` | Kennung, Name, Bild, Wappen, Spielercode, Turniere, Passschlüssel | jüngste Änderung je Feld, Turniere vereinigt | klein |
| `einstellungen` | Lieblingsspiele, Musik (Playlists, Sterne, Ausschlüsse), Aussehen, Kartenbild, Bildkarten, Spieleinstellungen je Spiel, Lupen | jüngste Änderung je Schlüssel (`updatedAt`) | klein |
| `partiebuch` | Zähler je Spiel, Stufe und Gerät; Stempel; Pokale; letzte Partien (Kopfzeilen) | Zähler: je Gerät der größere Wert (wie `ledger` im Narrenhof); Stempel: früheste Zeit; Pokale und Partien: Vereinigung nach Kennung, älteste fallen heraus | 64 KB |
| `chronik` | Züge angehefteter Partien zum Nachspielen | Vereinigung, Löschvermerke | 64 KB, sonst weiterer Block `chronik-2` |
| `album` | Gesammelte Einträge aller Spiele mit erstem Fund | Vereinigung, früheste Zeit | 64 KB |
| `bibliothek` | Eigene und empfangene Inhaltspakete (#101), Verweise auf Drachenspiel-Decks | wie Drachenspiel-Decks: jüngste Änderung, Löschvermerke | 64 KB je Teilblock |
| `lernen` | Lernstand je Karte (#103) | je Karte die jüngste Wiederholung | 64 KB je Paketgruppe |
| `narrenhof`, `drachenspiel` | bleiben eigene Blöcke, jetzt mit Schlüssel aus dem Passschlüssel | wie heute | wie heute |

Regeln für alle Blöcke: `sanitize` macht aus fremden Daten einen gültigen Stand (wie heute `SyncBlock`), jeder Block hat `version`, Grenzen werden beim Schreiben eingehalten (älteste Einträge fallen heraus oder werden zu Zählern verdichtet). Abgleich bei Spielstart, Partieende, Verlassen der Pass-Seite und Schließen des Tabs (wie heute `scheduleSync`).

## 6. Erfassen

### Partiebuch

Eine Stelle in der Web-App zeichnet jedes Partieende auf (`Play.tsx` bzw. ein Haken `usePassRecorder`, ausgelöst beim ersten `result`). Für alle 55 Spiele ohne Arbeit im Spiel:

```ts
interface PlayedGame {
  id: string;            // aus Spiel, Seed bzw. Raumcode und Startzeit, verhindert Doppelzählung
  gameId: string;
  endedAt: number;
  durationMs: number;
  mode: 'solo' | 'bots' | 'hotseat' | 'online' | 'tournament';
  /** Mitspieler zum Zeitpunkt der Partie, nur Spitzname, Bild, Art und Bot-Stufe. Keine Kennungen. */
  seats: { name: string; avatar?: string; kind: 'human' | 'bot'; level?: BotLevel; you?: boolean }[];
  outcome: 'win' | 'draw' | 'loss';
  place?: number;        // Platz bei mehreren Spielern
  score?: number;        // aus GameUi.seatScore, falls vorhanden
  options?: string;      // kurze Beschreibung der wichtigsten Optionen
}
```

- **Lokal und Hot-Seat:** eine Zeile je beteiligtem Pass.
- **Online:** nur der eigene Platz. Online kennt der Browser den Seed nicht, Nachspielen hängt an #99.
- **Aufgeben** zählt als Niederlage, **abgebrochene** Partien ohne Ergebnis zählen nicht.
- **Zähler je Spiel** (`played`, `won`, `drawn`, `lost`, je Bot-Stufe und Modus, Bestwert, Serie) liegen je Gerät, damit das Zusammenführen nichts doppelt zählt.

### Chronik

Die letzten 50 Partien als Kopfzeilen. **Anheften** (höchstens 20) behält zusätzlich Seed, Optionen, Plätze und Zugliste im Block `chronik`, sodass sich die Partie mit dem Abspieler aus #99 nachspielen lässt. Ohne #99 zeigt die Chronik nur die Kopfzeile und, wo vorhanden, PGN/SGF.

### Bot-Wertung

Je Spiel eine **Leistungszahl gegen die Bots**: Die Stufen haben feste Bezugswerte (Vorschlag: leicht 800, mittel 1200, schwer 1600). Aus den Zählern je Stufe wird die Leistungszahl berechnet (verlustfrei zusammenführbar, weil sie nur aus Zählern entsteht); dazu eine **Form** aus den letzten 20 Partien der Chronik. Bei mehr als zwei Plätzen zählt jede Platzierung vor oder hinter einem Bot als Einzelergebnis. Die Einrichtung schlägt danach eine Stufe vor („Du gewinnst 80 % gegen Mittel – versuch Schwer“). Gegen Menschen gibt es keine Wertung.

## 7. Zeigen

### Pass-Seite `#/pass` mit Stempeln

Ein Heft im Taverne-Aussehen: Deckblatt mit Wappen, Name und Bild; je Rubrik eine Doppelseite mit einem **Stempelfeld je Spiel**. Das Stempelmotiv ist das gemalte Spielwappen der Startseite (`apps/web/src/lib/crest.ts`), sonst das Emoji.

Stempel ergeben sich aus den Zählern, ohne eigene Speicherung außer dem Datum des ersten Mals:

- je Spiel: erste Partie, erster Sieg, Sieg gegen leicht, mittel, schwer, online gespielt, im Turnier gespielt;
- je Rubrik: alle Spiele der Rubrik gespielt;
- später je Spiel eigene Stempel über einen freiwilligen Haken `GameUi.passStamps` (z. B. Schach „Matt in unter 20 Zügen“, Solitaire „FreeCell gelöst“).

### Pokalschrank und Urkunden

Jeder Sieg legt in der Siegerehrung (`Ceremony.tsx`) einen Pokal ab: Spiel, Datum, Gegner (Spitznamen), Modus, Bot-Stufe, Turniername. Je Spiel ein Regalfach; viele gleiche Pokale stapeln sich mit Zahl. Turniersiege und besondere Siege (erster Sieg gegen schwer) bekommen eine **Urkunde zum Drucken** (Druckansicht wie `PrintView` in `Tournament.tsx`).

### Spielerwappen

Neu (die Wappen in `crest.ts` gehören den Spielen, nicht den Spielern): ein Wappen aus Schildform, Teilung, Farben, Wappentier (aus dem Emoji-Bild oder frei wählbar) und Zier (Rahmen, Krone, Bänder). **Teile werden freigeschaltet** über Stempel und Pokale (z. B. 10 Stempel: neue Schildform, 5 Pokale: Krone, ein Turniersieg: Lorbeer). Gezeichnet als SVG in `packages/ui`, gespeichert als kurze Beschreibung (`"schild:spitz;teilung:quer;farben:rot,gold;tier:🦊;zier:krone"`). Erscheint im Pass, in der Passwahl und auf Wunsch im Raum neben dem Namen (dann geht die Kurzform mit `hello` an den Raum und wird dort geprüft).

### Sammelalbum über alle Spiele

Ein Album mit einem Kapitel je Spiel, das mitmacht. Jedes Spiel meldet über einen freiwilligen Haken in `GameUi` einen Katalog (`album: { id, title, items }`) und, aus Ereignissen am Partieende, gefundene Einträge (`albumFinds(events, seat)`). Leere Plätze zeigen Umrisse („3 von 81 Narren“).

Erste Kapitel:

- **Narrenhof:** das vorhandene Album (Narren, Kunststücke, Kuriositäten, Herrschaften, Höflinge) wird ins Plattform-Album gespiegelt.
- **Drachenspiel:** Karten, mit denen man gewonnen hat, Gegner der Wanderschaft, Turnierbuch.
- **Quartett:** jede Karte, die man in einem gewonnenen Spiel besaß, je Set.
- **Paare finden:** gefundene Paare je Inhaltspaket (Brücke zum Lernen, #103).
- **Bibel-Quiz:** richtig beantwortete Fragen je Themenbereich.

### Pass teilen

„Pass teilen“ öffnet eine Auswahl: Wappen, Stempel, Pokalschrank, Lieblingsspiele, Bot-Wertungen, Album-Fortschritt. Daraus entsteht ein **Schnappschuss**, kein Live-Zugriff:

- **Als Bild:** Passkarte als PNG (aus SVG gezeichnet), über `navigator.share` oder zum Speichern.
- **Als Link:** Der Schnappschuss wird mit einem Zufallsschlüssel verschlüsselt und unter einer Zufallskennung auf dem Server abgelegt; Kennung und Schlüssel stehen nur im Teil hinter `#` (`#/pass/ansehen?k=…`). Der Server sieht nichts, ein neuer Schnappschuss ersetzt den alten, „Teilen beenden“ löscht ihn. Gelöscht wird auch nach einem Jahr ohne Abruf (wie geteilte Pakete in #101).
- Gezeigt werden nur Spitzname, Bild und Wappen, keine Kennung und kein Code.

## 8. Inhalte und Lernen

### Eigene Inhaltspakete (#101) im Pass

- Eigene und empfangene Pakete liegen im Block `bibliothek` und reisen damit auf alle Geräte des Passes.
- **Bibliothek im Pass:** eine Ansicht für eigene Pakete, empfangene Pakete, Drachenspiel-Decks und angeheftete Partien, jeweils mit Teilen (Code und QR), Umbenennen, Löschen.
- **Feste Kennungen:** Jedes Paket hat eine Kennung, jede Zeile (Karte) eine eigene, die sich beim Bearbeiten nicht ändert. Darauf baut der Lernstand auf (#103).
- **Teilen** wie beim Pass: verschlüsselt, Schlüssel im Teil hinter `#`; so muss der Server auch geteilte Pakete nicht lesen. (Die Filterung mit `isBlockedText` geschieht beim Anlegen und beim Öffnen.)
- **Einfügen aus einer Tabelle** nimmt dasselbe Textformat wie der Text-Import von Anki (Tab- oder Semikolon-getrennt, eine Karte je Zeile). Das ist die Brücke zu KI-erzeugten Karten (#103).

### Lernen (#103)

Die Recherche in #103 bleibt der erste Schritt und entscheidet, ob die folgenden Schritte so kommen:

1. **Lernstand je Karte** im Block `lernen`: Fälligkeit, Stabilität, Schwierigkeit, letzte Wiederholung, Anzahl, nach FSRS (Vorschlag; Ergebnis der Recherche). Schlüssel: Paket-Kennung und Karten-Kennung. Zusammenführen: je Karte die jüngste Wiederholung.
2. **Lernen beim Spielen:** Paare finden, Schwarzer Peter, Bingo und Quartett melden je Karte, ob sie sicher (sofort gefunden) oder unsicher (mehrfach aufgedeckt, falsch) war. Das zählt als Wiederholung mit niedrigem Gewicht. Eine Option „Fällige Karten bevorzugen“ mischt sie in die nächste Partie.
3. **Karteikasten-Modus:** eigener Lernmodus mit „Nochmal / Schwer / Gut / Leicht“ auf denselben Paketen, mit Tagesziel und Stempel für Lerntage in Folge.
4. **Import und Export** als Text/CSV im Anki-Format; `.apkg` nur, wenn die Recherche es empfiehlt.
5. **Stapel der Lehrkraft:** Die Lehrkraft legt ein Paket in ihre Klasse (Abschnitt 8.2). Die Schüler lernen allein in ihrem Pass. In der Klassen-Lobby kann ein Spiel „Fällige Karten der Klasse“ wählen: Jedes Gerät meldet dem Raum nur die Kennungen seiner fälligen Karten, ohne Namen, der Raum mischt daraus. Einen **Lernbericht** an die Lehrkraft gibt es nur als freiwillig geteilten Schnappschuss.

## 8.2 Klassen

Eine **Klasse** ist eine dauerhafte Gruppe von Pässen: eine Schulklasse, eine AG, ein Verein, eine Familie über mehrere Haushalte. Sie lebt länger als ein Raum (24 h) und braucht kein laufendes Spiel.

### Anlegen und Beitreten

- **Anlegen:** Jeder Pass kann auf `#/klassen` eine Klasse anlegen und wird ihre **Leitung** (Lehrkraft). Weitere Leitungen lassen sich per Helferlink ernennen (wie bei Turnieren, `addHelper`).
- **Beitreten per Emoji-Code:** Der Klassencode besteht aus **6 Emoji aus 16** (16,7 Millionen Codes; der Raumcode hat 4, aber eine Klasse lebt monatelang und darf nicht erratbar sein). Eingabe über die vorhandene Emoji-Tastatur.
- **Beitreten per QR-Code:** Link `#/klasse/<Code>`; der Teil hinter `#` geht nicht an den Server, die Seite entfernt ihn aus der Adresszeile (wie beim Ausweis). Die Leitung zeigt den QR-Code groß für die Tafel.
- **Beitritt steuern:** Die Leitung öffnet oder schließt den Beitritt und kann wählen, ob Beitritte bestätigt werden müssen („Mia 🦊 möchte beitreten – zulassen?“). Fehlversuche zählt der Server wie beim Spielercode.
- **Voraussetzung:** Beitreten kann nur ein Pass. Ein Pass ohne Code (nur auf dem Gerät) bekommt beim Beitritt den Hinweis, einen Spielercode anzulegen, damit die Klassenzugehörigkeit nicht mit dem Gerät verloren geht.
- **Verlassen und Entfernen:** Jedes Mitglied kann gehen; die Leitung kann entfernen. Ein Pass kann in mehreren Klassen sein; die Liste der Klassen steht im Block `ausweis` (wie die Turniere).

### Profile und Erfolge der anderen

Innerhalb der Klasse sieht jedes Mitglied die anderen:

- **Klassenseite:** Kacheln mit Wappen, Bild und Spitzname; Antippen öffnet das **Profil**: die Pass-Ansicht im Lesemodus mit Stempeln, Pokalschrank, Album-Fortschritt und Lieblingsspielen.
- **Klassenkarte statt Live-Zugriff:** Jedes Gerät legt nach Änderungen am Pass (Partieende, neuer Stempel, neuer Pokal) einen **Schnappschuss** seines Profils in die Klasse. Die anderen sehen diesen Schnappschuss, nie den Pass selbst. Was hineingeht, regelt die Klasse (Vorgabe der Leitung) und jedes Mitglied für sich (nur weglassen, nicht hinzufügen).
- **Speicherung:** Ein Durable Object je Klasse (`ClassRoom`, nach dem Muster von `TournamentRoom`) hält Mitglieder und Klassenkarten. Die Klassenkarten liegen dort lesbar wie die Teilnehmernamen eines Turniers, sichtbar nur für Mitglieder (Kennung beim Verbinden). Inhalt sind nur Spitzname, Bild, Wappen und Spielfortschritt, keine Kennungen, keine Codes, keine Lernstände einzelner Karten.
- **Ohne Rangliste als Vorgabe:** Die Klassenseite zeigt eine **Stempelwand** (wer hat welchen Stempel), keine Rangliste. Eine Rangliste je Spiel (Bot-Wertung, Pokale) kann die Leitung einschalten.
- **Gemeinsames:** Klassen-Stempel (z. B. „Die ganze Klasse hat Schach gespielt“), offene Räume der Klasse oben auf der Klassenseite, Stapel der Lehrkraft (Lernen), später Klassenturnier (W-058).
- **Leitung:** sieht dieselben Profile wie alle (keine geheimen Zusatzdaten), kann die Klasse umbenennen, Beitritt steuern, Mitglieder entfernen, Namen festlegen (wie `renameMember` im Raum) und die Klasse auflösen. Klassen ohne Aktivität werden nach einem Jahr gelöscht.

### Klassenausweise

Für Klassen, in denen Kinder keinen eigenen Ausweis mitbringen:

- Die Leitung trägt eine Namensliste ein (Spitznamen, optional Bild) und legt damit auf einmal **Pässe für die ganze Klasse** an. Jeder bekommt Spielercode und Start-PIN und ist schon Mitglied der Klasse.
- **Druckkarten:** je Kind eine Karte mit Bild, Spitzname, QR-Code (Spielercode) und Start-PIN; Druckansicht wie bei Turnieren.
- **PIN zurücksetzen:** Bei Klassenausweisen liegt der Passschlüssel zusätzlich in einem **Lehrkraft-Schloss**, verschlüsselt mit einem Schlüssel aus dem Pass der Leitung (Block `klassen`). Vergisst ein Kind die PIN, schreibt die Leitung ein neues Schloss mit neuer Start-PIN. So ersetzt die Lehrkraft „Passwort vergessen“, ganz ohne E-Mail.
- **Selbstständig werden:** Ein Kind kann den Klassenausweis später „lösen“ (eigene PIN oder eigenes Passwort, Lehrkraft-Schloss gelöscht), etwa beim Schulwechsel. Das wird angezeigt, damit die Leitung weiß, dass sie nicht mehr zurücksetzen kann.
- **Rechtliches:** Bei Schulklassen ist die Schule verantwortlich. Die Datenschutzerklärung beschreibt Klassen und Klassenausweise eigens.

## 8.3 Anmeldung mit Google- oder Microsoft-Konto

Ein weiterer **Öffner** neben PIN, Passwort, Passkey und Notfallkarte, kein Ersatz für den Ausweis:

- **Ablauf:** „Mit Google anmelden“ bzw. „Mit Microsoft anmelden“ (OpenID Connect mit PKCE). Der Worker bekommt die feste Kennung des Kontos (`sub` bei Google, `oid` + `tid` bei Microsoft) und sucht damit ein **Konto-Schloss**: Kennung `HMAC(Pfeffer, Anbieter + Kontokennung)`, darin der Passschlüssel, verschlüsselt mit einem Serveranteil, der selbst mit dem Pfeffer verschlüsselt liegt. Nach erfolgreicher Anmeldung gibt der Server Serveranteil und Inhalt heraus.
- **Ehrlich:** Anders als bei PIN oder Passwort gibt es hier kein Geheimnis, das nur im Kopf des Menschen liegt. Der Schutz beruht auf der Anmeldung beim Anbieter und auf dem Pfeffer; der Betreiber könnte Konto-Schlösser öffnen. Wer das nicht will, wählt **Konto + PIN** (beides nötig) oder verzichtet auf die Verknüpfung. Das Konzept-Issue prüft, ob es einen besseren Weg gibt.
- **Was der Server speichert:** nur den Prüfwert, keine E-Mail-Adresse, keinen Namen, kein Token über die Anmeldung hinaus.
- **Schulkonten:** Microsoft-365- und Google-Workspace-Konten von Schulen funktionieren genauso. Später denkbar: Eine Klasse übernimmt Mitglieder aus einer Microsoft-Teams- oder Google-Classroom-Klasse (eigener Schritt, nicht Teil dieses Plans).
- **Einrichtung:** Eine App in der Google Cloud Console und eine in Microsoft Entra (Privat- und Schul-/Arbeitskonten), Rückruf-Adressen auf dem Spieleserver, Client-Geheimnisse als Wrangler-Secrets. Das legt Cornelius selbst an.
- **Datenschutz:** Google und Microsoft werden Empfänger (Anmeldung), mit Drittlandübermittlung; Einwilligung bei Kindern unter 16 durch die Eltern bzw. bei Schulkonten über die Schule. Die README-Zeile „ganz ohne Konto“ wird zu „ohne eigenes Konto; Anmeldung mit Google oder Microsoft ist freiwillig“.

## 9. Issues und Reihenfolge

Vorhaben-Issue: [#135](https://github.com/ichthys2k/brett-und-blatt/issues/135). Alle Schritte sind Unter-Issues mit `status: Idee`; Cornelius gibt jeden Schritt einzeln frei. Die Abhängigkeiten stehen in jedem Issue unter „Wartet auf“ und als „blocked by“.

| Stufe | Issue | Schritt | Wartet auf |
|---|---|---|---|
| 1 Fundament | #136 | Name und Bild aus Lobby und Turnier erreichen den Ausweis (Fehler) | – |
| | #137 | Passschlüssel und Blöcke hinter dem Ausweis | – |
| | #138 | PIN oder Passwort, Schloss je Ausweis, Notfallkarte | #137 |
| | #139 | Familie: mehrere Pässe an einem Gerät | #137 |
| | #140 | Einstellungen reisen mit | #139 |
| | #141 | Narrenhof und Drachenspiel ziehen in den Pass | #139 |
| 2 Erfassen | #142 | Partiebuch | #139 |
| | #143 | Chronik mit angehefteten Partien | #142 (#99 fürs Nachspielen) |
| | #144 | Bot-Wertung | #142 |
| 3 Zeigen | #145 | Pass-Seite mit Stempeln | #142 |
| | #146 | Pokalschrank und Urkunden | #142 |
| | #147 | Spielerwappen | #145, #146 |
| | #148 | Sammelalbum | #141, #145 |
| | #149 | Pass teilen | #145–#147 |
| 4 Inhalte und Lernen | #101 | Eigene Inhaltspakete, Bibliothek im Pass | #137 |
| | #103 | Recherche Karteikarten (umgeplant, mit Unter-Issues) | – |
| | #155 | Lernstand je Karte | #103, #137, #101 |
| | #156 | Lernen beim Spielen (Paare finden, Schwarzer Peter, Bingo, Quartett) | #155 |
| | #157 | Karteikasten-Modus | #155 |
| | #158 | Import und Export im Anki-Textformat | #155, #101 |
| | #159 | Stapel der Lehrkraft für die Klasse | #155, #150 |
| 5 Klassen | #150 | Klasse anlegen und per Emoji-Code oder QR-Code beitreten | #139 |
| | #151 | Profile und Erfolge der Mitglieder einsehen | #150, #145–#147 |
| | #152 | Klassenausweise für Lehrkräfte | #138, #150 |
| 6 Anmeldung | #153 | Google und Microsoft: Konzept und Einrichtung | #138 |
| | #154 | Google und Microsoft: Umsetzung | #153 |

Parallel möglich: nach dem Passschlüssel PIN und Familie; nach dem Partiebuch Chronik, Bot-Wertung, Stempel und Pokale; #101 unabhängig von Stufe 2 und 3; die Klasse (Anlegen und Beitreten) schon nach der Familie, die Profile erst nach Stufe 3.

## 10. Was jede Stufe beachten muss

- **Tests:** Zusammenführen und `sanitize` jedes Blocks als reine Funktionen in `tests/` bzw. bei den Paketen; Schloss und Zähler in `packages/online/test/`.
- **Größe:** Kein Block über 64 KB (`BACKUP_MAX_BYTES`), auch verschlüsselt und als Base64.
- **Datenschutz:** Jede Stufe, die neue Daten an den Server gibt (Schloss, geteilte Schnappschüsse, Wappen im Raum), ergänzt `apps/web/src/screens/Legal.tsx`.
- **Barrierefreiheit:** Stempel, Pokale und Album sind auch als Liste mit Text lesbar, nicht nur als Bild.
- **Doku:** Stand in `CLAUDE.md`, `docs/KONZEPT.md` (Grundsatz „keine Konten“ mit Spielerpass erklären), README-Zeile „ohne Konto“ ergänzen.
