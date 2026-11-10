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

**Ergebnis von #153 (9.11.2026): [`konto-anmeldung.md`](konto-anmeldung.md)** (Ablauf, Schlüsselführung, Bedrohungen, Anbieter, Recht) und [`konto-anmeldung-einrichtung.md`](konto-anmeldung-einrichtung.md) (Anleitung für Cornelius). Kernpunkt: Es gibt keinen Weg stärker als Pfeffer allein, wenn das Konto der einzige Öffner ist; stärker ist „Konto + PIN“. Der folgende Text ist der ursprüngliche Vorschlag.

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

## Entscheidungen (Cornelius, 8.11.2026, Nachtrag)

- **PIN:** sechs Ziffern **oder** sechs Emoji, wählbar (Vorschlag „nur Ziffern“ und „nur Bilder“ fällt weg, beides bleibt).
- **Passwort:** mindestens **8 Zeichen**.
- **Klasse:** standardmäßig **keine Rangliste**, nur die Stempelwand.
- **Spielerwappen:** erscheint **auch im Raum neben dem Namen**.

## Stand der Umsetzung

- **#136** (Profil → Ausweis): `saveOwnProfile` in `apps/web/src/lib/playerPass.ts` ist der einzige Weg, das eigene Profil zu speichern.
- **#137** (Passschlüssel): `packages/ui/src/sync/pass.ts` (`randomPassKey`, `deriveBlockKeys`, `registerPassBlock`, `syncPassBlocks`), Schlüssel im Ausweis (`PlayerPass.passKey`, lokal `brett-und-blatt:passschluessel`), Abgleich über `passSyncSoon`. Erster Block: `einstellungen` (Lieblingsspiele, jüngere Änderung gewinnt) in `apps/web/src/lib/passBlocks.ts`. Die alten Blöcke (Narrenhof, Drachenspiel, Ausweis) leiten weiter aus dem Sicherungscode ab. Neue Blöcke: `registerPassBlock({ name, read, write, sanitize, merge, same })`; ein Block darf höchstens 64 KB groß werden.
- **#138** (PIN/Passwort, Notfallkarte): Logik `packages/online/src/lock.ts` (Zähler, Wartezeiten 1/5/15/60/60 min nach dem 5. bis 9. Fehler, ab 10 gesperrt, Pfeffer), Durable Object `PassLock` und Routen `GET /schloss/<Kennung>`, `POST /schloss/<Kennung>/anlegen|oeffnen|speichern|aendern|zuruecksetzen|loeschen` (Migration v6), Browser `packages/ui/src/sync/lock.ts` (PBKDF2 200 000 Runden → `auth` + `wrap`; Inhalt unter `HKDF(wrap ‖ Serveranteil)`), Oberfläche im `PlayerPassPanel`, Notfallkarte als Druckseite (`apps/web/src/lib/emergencyCard.ts`). Das Schloss ohne PIN gibt nie den Passschlüssel heraus (der liegt nur hinter Sicherungscode oder PIN). Mit gesetzter PIN wird der PIN-lose Ausweis unter dem Spielercode ungültig gemacht, ein neuer Spielercode ist dann nicht mehr möglich (er würde die PIN verlieren).
  - **Betrieb:** Das Secret `PASS_PEPPER` muss im Worker stehen (`corepack pnpm --filter @brett-und-blatt/server exec wrangler secret put PASS_PEPPER`, ein langer Zufallswert; lokal `apps/server/.dev.vars`). Ohne Secret antworten die Schloss-Endpunkte mit 503, der Rest läuft weiter. Geht der Pfeffer verloren, sind alle Schlösser unbrauchbar (die Notfallkarte setzt sie nicht zurück, denn auch ihr Prüfwert hängt am Pfeffer); er darf nie geändert werden.
  - **Prüfen:** `node apps/server/scripts/schloss.mjs` gegen den laufenden Server.
- **#139** (Familie an einem Gerät): `apps/web/src/lib/passes.ts` (`createPassBook`). Statt jeden Schlüssel mit Pass-Präfix zu versehen, liegen die Daten des **aktiven** Passes unter den gewohnten Schlüsseln (Liste `SCOPED_KEYS`); die anderen Pässe liegen unter `brett-und-blatt:pass:<Kennung>:<Schlüssel>`. Ein Wechsel räumt beiseite, holt hervor und lädt die Seite neu (trennt alle Online-Verbindungen). Das bisherige Profil wird beim ersten Start zum ersten Pass, mit derselben Raum-Kennung. Passwahl „Wer spielt?“ oben auf der Startseite (`PassPicker`): wechseln, ➕ neuer Pass, 👤 Gast (Daten verschwinden beim Wechsel), entfernen (Warnung, wenn der Pass keinen Code hat). Hot-Seat: In `Setup.tsx` wählt jeder menschliche Platz einen Pass des Geräts (`SeatConfig.passId`, bleibt lokal). Gerätedaten (Lautstärke, Aussehen, Kartenbild) bleiben ohne Pass.
  - **Noch offen in #139:** Geräte-PIN für den Wechsel, „Passwahl bei jedem Start“, Ergebnis je Pass im Partiebuch (kommt mit dem Partiebuch), Musik- und Hand-Ansicht-Einstellungen je Pass.
- **#140** (Einstellungen reisen mit): Der Block `einstellungen` (`apps/web/src/lib/settingsBlock.ts`, `passBlocks.ts`) beobachtet die Einstellungen dort, wo die Module sie ablegen, statt sie umzuschreiben: Beim Abgleich vergleicht er jeden Wert mit dem Stand des letzten Abgleichs (`brett-und-blatt:einstellungen-staende`), vergibt bei einer Änderung den Zeitstempel und führt je Eintrag nach der jüngsten Änderung zusammen; Zurücksetzen reist als Löschvermerk. Erfasst: Lieblingsspiele, Musik (Sterne, Ausschlüsse, Playlist je Spiel), Aussehen, Bildkarten, Kartenbild des Narrenhofs, Lupen in Go und Vierer-Schach, zuletzt gewählte Einrichtung je Spiel. **Am Gerät bleiben** Lautstärken und Klang an/aus (`ton`), Hand-Ansicht und der Kontrastwunsch des Systems. Je Pass getrennt (Familie) über `SCOPED_KEYS`. Der frühere Block (nur Lieblingsspiele) wird gelesen. Abgleich beim Start, bei Änderung der Lieblingsspiele und wenn die Seite in den Hintergrund geht. Übernommene Werte gelten, sobald die Seite neu geladen wird.
  - **Noch offen in #140:** die Hilfe `passSetting(key, default)` für Spiele (heute genügt die Beobachtung der Schlüssel); neue Einstellungen müssen in `SYNCED_KEYS` eingetragen werden.
- **#141** (Narrenhof und Drachenspiel): Beide Spiele melden ihren Stand beim Laden als Pass-Block an (`narrenhof` in `packages/games/color-sorter/src/ui/sync.ts`, `drachenspiel` in `packages/games/drachenspiel/src/ui/deckStore.ts`) und bitten bei Änderungen über `requestPassSync()` um Abgleich; die Web-App löst ihn über `passSyncSoon` aus (`onPassSyncRequest`). Je Pass getrennt: `farbensortierer`, `farbensortierer:sicherung` und `drachenspiel:decks` stehen in `SCOPED_KEYS` (#139). **Übergang ohne Verlust:** Der alte Weg über den Sicherungscode (`NARRENHOF_SALT`, `DRACHENSPIEL_SALT`) bleibt zunächst aktiv; beide Wege führen mit derselben Logik zusammen (Zählerbuch je Gerät, Löschvermerke), ein Stand geht bei keinem verloren. Der alte Weg kann später abgeschaltet werden, wenn alle Geräte einen Passschlüssel haben.
  - **Noch offen in #141:** Kurzansicht (Glöckchen, Album, bester Hoftag; Lieblingsdeck, Rang) – kommt mit #145; Prüfstand/Rauchtest und die Prüfung aus #60 mit dem neuen Weg.
- **#142** (Partiebuch): Reine Logik in `apps/web/src/lib/partiebuch.ts` (`recordGame`, `mergeBooks`, `sanitizeBook`, `totals`), Recorder `apps/web/src/lib/passRecorder.ts` (`usePassRecorder` im `GameTable` von `Play.tsx`, `rowsFor` macht aus einem Partieende die Zeilen), Pass-Block `partiebuch` in `passBlocks.ts`, Schlüssel `brett-und-blatt:partiebuch` (je Pass, `SCOPED_KEYS`). Eine Zeile je beteiligtem Pass: Plätze mit gewähltem Pass (`SeatConfig.passId`) schreiben ins Buch ihres Passes (`passBook.updateStored` auch für nicht aktive Pässe), der erste Platz mit freiem Namen gehört dem aktiven Pass, weitere freie Namen zählen nicht; online nur der eigene Platz, Turnierpartien als Modus `tournament`. Zähler je Gerät, Spiel und Eimer `<Modus>/<stärkste Bot-Stufe>`; sie wachsen nur und führen mit „je Zahl der größere Wert“ zusammen. Kopfzeilen der letzten 50 Partien, älteste fallen heraus. Gegen Doppelzählung: Kennung = Sitzung (lokal der Seed, online Raum/Runde). Die Dauer misst ab Öffnen des Tisches (nach einem Neuladen mitten in der Partie kürzer).
  - **Noch offen in #142:** Serienspiele (Skat-Serie) zählen heute das Ergebnis der Sitzung; Rauchtest/Prüfstand nicht gelaufen; Blick am Handy.
- **#143** (Chronik): Reine Logik `apps/web/src/lib/chronik.ts`, Speicher `chronikStore.ts`, Pass-Block `chronik` (`passBlocks.ts`), Seite `#/pass` (`screens/Pass.tsx`, erreichbar über „Wer spielt?“ → „🪪 Mein Pass“). Die Liste zeigt die letzten 50 Partien aus dem Partiebuch (Filter nach Spiel), **Anheften** (📌, höchstens 20) behält Kopfzeile und, bei lokalen Partien, Einstellungen mit Seed, Plätze und Zugliste. Der Recorder legt die Zugliste jeder lokalen Partie beim Ende in eine kleine **Ablage** (letzte 10, je Pass, höchstens 14 000 Zeichen), aus der das Anheften schöpft. Zusammenführen: je Partie gewinnt die jüngere Änderung, Lösen bleibt als Löschvermerk stehen; bei Überlänge (40 000 Zeichen) fallen zuerst die Zuglisten der ältesten Angehefteten ab, die Kopfzeilen bleiben. Online-Partien haben nur die Kopfzeile (Seed und Züge kennt der Browser nicht, siehe #99).
  - **Noch offen in #143:** Export als PGN/SGF aus der Chronik (die Funktionen `toPgn`/`toSgf` liegen in den Spielpaketen, die Web-App lädt sie nicht direkt); Nachspielen hängt an #99; Blick am Handy.
- **#144** (Bot-Wertung): Reine Berechnung `apps/web/src/lib/botRating.ts` allein aus den Zählern des Partiebuchs (`levelStats`, `ratingOf`, `formOf`, `suggest`); Bezugswerte leicht 800, mittel 1200, schwer 1600 (Elo-Rechnung mit Glättung, Grenzen 400–2000, Zahl erst ab 5 Partien, nach Partien gewichtet über die Stufen). **Nur Spiele zu zweit** bekommen eine Leistungszahl; bei mehr Plätzen gibt es nur die Siegquote je Stufe, weil das Partiebuch den Platz nicht speichert. Form: Punkte aus den letzten 20 Partien gegen Bots in diesem Spiel. Anzeige im Abschnitt „Bot-Wertung“ auf `#/pass`. **Vorschlag in der Einrichtung** (`Setup.tsx`): ab 5 Partien gegen die gewählte (stärkste) Stufe und mindestens 70 % Siegquote „versuch die nächste Stufe“, bei höchstens 25 % „mit der leichteren macht es vielleicht mehr Spaß“, mit Knopf zum Übernehmen; abschaltbar auf `#/pass` (Schlüssel `brett-und-blatt:botvorschlag`, reist mit den Einstellungen). Gewertet wird die stärkste Bot-Stufe am Tisch. Die Bezugswerte sind **nicht** an Prüfstand-Zahlen geeicht (offen).
  - **Noch offen in #144:** Bezugswerte je Spiel am Prüfstand prüfen (liegen die Stufen überall so weit auseinander?); Blick am Handy.
- **#145** (Pass-Seite mit Stempeln): `#/pass` ist jetzt ein Heft: Deckblatt (Bild, Name, Zahl der Stempel, Partien und Siege), je Rubrik eine Seite mit einem Stempelfeld je Spiel (`components/StampBook.tsx`), darunter Bot-Wertung (#144) und Chronik (#143). **Stempel** (`apps/web/src/lib/stamps.ts`, rein): Erste Partie, Erster Sieg, Sieg gegen leicht/mittel/schwer, online, im Turnier; je Rubrik „alle Spiele gespielt“ (Datum des zuletzt zum ersten Mal gespielten). Ob ein Stempel gilt, ergibt sich aus den Zählern; das Datum des ersten Mals steht neu im Partiebuch (`Book.stamps`, Name `<Spiel>/<Art>`, beim Zusammenführen gewinnt die früheste Zeit); ältere Bücher zeigen die Stempel ohne Datum. Motiv: das gemalte Spielwappen (`crest.ts`), sonst das Emoji; nicht Gespielte sind blass. Barrierefrei: je Spiel ein Text mit gewonnenen und offenen Stempeln, Symbole nur zur Zierde. Links: „🪪 Mein Pass“ auf der Startseite neben „Wer spielt?“ und im Ausweis. Der Rauchtest prüft die Seite (Handy-Hochformat, kein waagerechtes Rollen, keine Fehler).
  - **Noch offen in #145:** spieleigene Stempel über `GameUi.passStamps`; Kurzansichten Narrenhof und Drachenspiel (#141) im Heft; Abnahme am Handy.
- **#146** (Pokalschrank und Urkunden): Reine Logik `apps/web/src/lib/pokale.ts`, Anzeige `components/TrophyCabinet.tsx` auf `#/pass`, Urkunde `lib/certificate.ts` (Druckfenster wie die Notfallkarte). Der Recorder (`saveRows`) legt bei jedem Sieg einen Pokal ab (Spiel, Datum, Spielart, stärkste Bot-Stufe, Spitznamen der Mitspieler); gespeichert werden die letzten 60 Siege (Block `pokale`, je Pass, Vereinigung nach Partie-Kennung). Die **Zahl der Siege je Spiel** kommt verlustfrei aus den Zählern des Partiebuchs, so bleibt sie auch richtig, wenn ältere Pokale herausgefallen sind („verdichtet“ heißt hier: nur noch der Zähler). **Urkunde** für Turniersiege und für den ersten Sieg gegen „schwer“ je Spiel (am neu verdienten Stempel `win-hard` erkannt). Die Siegerehrung zeigt „In deinen Pokalschrank gelegt“, wenn der aktive Pass einen Pokal bekam. Der Name des Turniers steht nicht im Pokal (der Tisch kennt ihn nicht).
  - **Noch offen in #146:** Turniername in der Urkunde; Druckvorschau auf einem echten Drucker nicht geprüft.
- **#147** (Spielerwappen, Entwürfe: https://claude.ai/artifact/K72Urv8MA673nUvzjruwHR): Rein in der Engine `packages/engine/src/player-crest.ts` (`CrestSpec`, `parseCrest`/`serializeCrest`/`cleanCrest`, Palette, `unlockOf`, `clampCrest`); die Beschreibung ist ein kurzer Text (`schild:klassisch;teilung:quer;farben:rot-gold;tier:🦊;zier:krone,rahmen;raum:1`), unbekannte Teile werden beim Lesen verworfen, das Tier muss genau ein Emoji sein. Gezeichnet vom Baustein `PlayerCrest` in `packages/ui/src/crest/` (SVG, Linien in `currentColor`, ab 56 px mit Zier, darunter nur Schild, Farben und Tier). Web-App: Speicher und Fortschritt `lib/crestStore.ts`, Gestalter `components/CrestDesigner.tsx` auf `#/pass` („Wappen ändern“), Anzeige auf dem Deckblatt, in der Passwahl (`PassEntry.crest`) und in der Lobby neben dem Namen. Das Wappen reist als Eintrag `wappen` im Einstellungs-Block (jüngste Änderung gewinnt). **Freischalten** (Zahlen von Cornelius abgenommen): Geteilt 3 Stempel; Rund, Schräg 5 Stempel; Spitz 10 Stempel; Wappenrolle 20 Stempel; Rahmen 3 Pokale; Krone 5 Pokale; Lorbeer 1 Turniersieg; Band und Purpur/Silber eine komplette Rubrik; Schwarz/Gold 10 Siege; Orange/Blau 25 Partien. **Im Raum** (Entscheidung Cornelius): `hello` und `setName` tragen optional `crest`; `Room` prüft es über `cleanCrest` (`names.ts`: `crestField`, `setCrest`), speichert es am Mitglied (`MemberInfo.crest`, auch im Speicherstand) und zeigt es allen; wer „im Raum zeigen“ abwählt (`raum:0`), schickt keins. Bots haben kein Wappen. Datenschutzerklärung ergänzt.
  - **Noch offen in #147:** Wappen an den Sitzplätzen der laufenden Partie (heute nur in der Lobby), Kontrastprüfung als Test (nach `tests/look.test.ts`), Klassenansicht (#151).
- **#148** (Sammelalbum): Freiwilliger Haken `GameUi.album` (`AlbumSpec`: `title`, `catalog()`, `finds({ view, events, seat, result })`) in `packages/ui/src/types.ts`; Kapitelkennung = Spiel-ID. Funde dürfen nichts Geheimes verraten: Das Spiel sieht nur die eigene Sicht und die Ereignisse. Der Recorder (`passRecorder.ts`: `usePassRecorder` mit `album`, `albumSeat`, `saveFinds`) ruft `finds` einmal beim Öffnen des Tisches und nach jeder Änderung auf. Gespeichert wird nur **wann ein Eintrag zum ersten Mal gefunden wurde** (Block `album`, `lib/album.ts`: Eintrag → Zeitpunkt, dazu die Gesamtzahl des Katalogs; Zusammenführen: Vereinigung, früheste Zeit, größere Gesamtzahl); Namen und leere Plätze liefert der Katalog, der erst beim Aufklappen eines Kapitels (Spiel wird nachgeladen) gelesen wird. Anzeige: Abschnitt „Sammelalbum“ auf `#/pass` (`components/AlbumBook.tsx`, leere Plätze als gestrichelte „?“). **Kapitel:** Narrenhof (`color-sorter/src/ui/album.ts`, spiegelt die Hofchronik; Katalog aus `albumPages.ts`), Drachenspiel (Karten von Hand und Feld einer gewonnenen Partie, `drachenspiel/src/ui/album.ts`), Quartett (Karten des Stapels, der Hand und abgelegter Quartette in einem gewonnenen Spiel, je Kartensatz), Paare finden (selbst genommene Paare je Inhaltspaket, Brücke zu #103), Bibel-Quiz (richtig beantwortete Fragen, am Ereignis `answered`).
  - **Noch offen in #148:** Drachenspiel: Gegner der Wanderschaft und Turnierbuch als Funde (nur Karten); Prüfstand der fünf Spiele; Blick am Handy.

## Begriffe (Entscheidung Cornelius, 8.11.2026)

- **Rettungscode** (früher „Sicherungscode“, 16 Zeichen, `syncCode` im Code) und **Rettungskarte** (früher „Notfallkarte“) heißen so, weil der Zweck im Namen steht und Kinder „retten“ verstehen; „Sicherung“ klingt nach Stromsicherung. Nur die **sichtbaren Texte** sind umbenannt (App, Rettungskarte, Datenschutzerklärung, Narrenhof und Drachenspiel); Bezeichner und Kommentare im Code heißen weiter Sicherungscode bzw. `syncCode`, `emergencyCard`.
- Der **Spielercode** (vier Bilder) bleibt das Namensschild; der Rettungscode ist der Geheimschlüssel, den man nur Mama oder Papa zeigt.
- **Hinweis „Rettungskarte sichern“** (`components/RescueHint.tsx`, Logik `lib/rescue.ts`): erscheint auf `#/pass` und im Ausweis, solange es einen Spielercode, aber noch keinen Rettungscode gibt („anlegen“), oder einen Rettungscode, dessen Karte noch nicht gedruckt und als sicher weggelegt abgehakt ist (Schlüssel `brett-und-blatt:rettung`, je Pass). Drucken allein beendet den Hinweis nicht.
- **Noch offen:** PIN → „Geheimzahl“ und Passkey → „Fingerabdruck-Schlüssel“ für Kinder; Sammelkarten für Klassen (#152).

### Stand #149 Pass teilen (8.11.2026)

- Server: `PassShare` (Durable Object), Routen `GET/PUT /teilen/<Kennung>` und `POST /teilen/<Kennung>/loeschen`, Logik `packages/online/src/share.ts` (Schreibgeheimnis als Hash, ein Jahr ohne Abruf).
- Browser: Kern `apps/web/src/lib/passShareCore.ts` (AES-GCM, Schlüssel per HKDF aus dem Linkschlüssel, Kennung per SHA-256, Prüfung), `passShare.ts` (Schnappschuss bauen, ablegen, beenden, abrufen; Schlüssel und Schreibgeheimnis je Pass in `brett-und-blatt:teilen`), Dialog `components/ShareDialog.tsx` im Profil (Teile: Wappen, Stempel, Pokalschrank, Lieblingsspiele; als Link oder PNG-Karte), Ansicht `#/pass/ansehen?k=…` (`screens/PassView.tsx`).
- Offen: Bot-Wertungen und Album-Fortschritt als Teile; Wappen im PNG; Gegenprobe gegen den echten Server (Sandbox ohne Netz); Telefonprüfung.

### Stand #150 Klassen: Anlegen und Beitreten (8.11.2026)

- Logik rein in `packages/online/src/classroom.ts` (Klassencode aus sechs Emoji, Mitglieder, Warteliste, Leitung, Sicht ohne Geräte-Kennungen); Tests `packages/online/test/classroom.test.ts`.
- Server: Durable Object `ClassRoom` (Migration v8, Bindung `CLASSES`), `POST /klassen` legt an, `POST /klassen/<Code>` nimmt Aktionen (view, join, update, leave, accept, reject, remove, lead, configure, dissolve); Fehlversuche (unbekannter Code) zählt der `AttemptLimiter`; ein Jahr ohne Aktivität löscht die Klasse.
- Browser: `lib/classes.ts` (Aufrufe, Merkliste je Pass in `brett-und-blatt:klassen`), Seiten `#/klassen` und `#/klasse/<Code>` (`screens/Classes.tsx`) mit Emoji-Tastatur, QR-Code und Link, Mitgliedern mit Wappen, Beitritt offen/geschlossen und mit Bestätigung, Leitung ernennen und entfernen, Auflösen; Einstieg über „Klassen“ auf der Mehrspieler-Seite. Die Klasse fragt den Stand alle 10 Sekunden ab (kein WebSocket).
- Offen: Merkliste der Klassen im Block `ausweis` (reist noch nicht auf andere Geräte; die Mitgliedschaft liegt beim Server unter der Geräte-Kennung und reist mit dem Ausweis); Fragment `#` aus der Adresszeile entfernen; Hinweis, einen Spielercode anzulegen, wenn der Pass keinen hat; Wappen-Aktualisierung (`update`) nach Wappenänderung auslösen; Gegenprobe gegen den echten Server.
- **Nachtrag 10.11.2026:** Der Kern liegt auf `main` (`b99b77e`). Restarbeiten in #150 neu gefasst: `#` aus der Adresszeile nehmen, Hinweis ohne Spielercode, Wappen aktualisieren, Merkliste im Block `ausweis`, Gegenprobe mit `apps/server/scripts/klasse.mjs`. #150–#152 stehen auf `status: Ready`.

### Stand #151 Klassen: Profile und Erfolge (10.11.2026)

- Klassenkarte (`packages/online/src/classcard.ts`): Abschnitte `stamps`, `trophies`, `favorites`, neu: `album` (Fundzahl je Spiel) und `botRating` (aggregierte Zahlen: Elo-Leistungszahl, Partien, Siege). `sanitizeCard` filtert und begrenzt beides; alte Karten ohne neue Teile bleiben gültig. Die Leitung wählt `sections` der Klasse, jedes Mitglied blendet für sich Teile aus (`brett-und-blatt:klassen-ausblenden`).
- Automatisches Nachführen (`apps/web/src/lib/classes.ts`, `passRecorder.ts`): `updateClassCardsSoon` führt nach Partieende, neuem Stempel, Pokal oder Fund die Klassenkarte für alle Klassen der Merkliste nach (`classAct(code, 'card', …)`), wenn sich der Inhalt geändert hat (`markCardSent`).
- **Rangliste je Spiel** (Bot-Wertung, Pokale): neue Leitungs-Option in der Klassenkonfiguration (`ClassState.leaderboard`, Vorgabe aus). Ist sie eingeschaltet, zeigt die Klassenseite eine Rangliste je Spiel sortiert nach Elo-Wertung, Pokalen, Siegen und Partien.
- **Klassen-Stempel** (`classStamps`): Gemeinschaftserfolge (Spiele, für die alle aktuellen Mitglieder den Stempel `first` haben) oben auf der Stempelwand und mit Stern-Symbol an den Spielen markiert.
- Barrierefreiheit als Liste; Datenschutzerklärung in `Legal.tsx` um Album-Fortschritt, Bot-Wertung und Rangliste ergänzt.
- Offen: Offene Räume der Klasse (separates Vorhaben/Abstimmung im Issue).

### Stand #152 Klassenausweise (8.11.2026)

- Die Leitung trägt auf der Klassenseite Namen ein (eine Zeile je Kind). Für jedes Kind legt der Browser einen Ausweis an: Passschlüssel, Spielercode, Rettungscode (der Ausweis als Block der gemeinsamen Sicherung), Schloss mit zufälliger Start-PIN (`createPassLock`), dann trägt der Server das Kind mit der Aktion `enroll` in die Klasse ein (Beitrittssperre und Bestätigung gelten nicht). Danach öffnet sich eine **Druckansicht** (Bild, Name, QR-Code mit dem Spielercode, Spielercode, Start-PIN).
- **Lehrkraft-Schloss:** Die Liste mit Rettungscode und Passschlüssel der Kinder liegt im Pass-Block `klassen` der Leitung (mit dem Passschlüssel der Leitung verschlüsselt, `lib/classPasses.ts`, Kern `classPassesCore.ts`, Tests `tests/classpasses.test.ts`). „PIN zurücksetzen“ nutzt den Rettungscode des Kindes (`resetPassLock`) und schreibt eine neue Start-PIN.
- Das Kind öffnet den Ausweis auf seinem Gerät über Profil → Sicherheit mit Spielercode und PIN.
- Offen: **„Selbstständig werden“** (Kind löst den Klassenausweis; dafür braucht es einen neuen Rettungscode, den es heute nicht zu erneuern gibt, und eine Anzeige für die Leitung); Spielercode vorab auf Dubletten gegen vorhandene Schlösser prüfen; Namensliste aus Zwischenablage mit Bildern; Gegenprobe gegen den echten Server.
- **Nachtrag 10.11.2026:** Restarbeiten (Dubletten-Prüfung, Namensliste mit Bildern, Probeklasse messen, Gegenprobe) stehen weiter in #152. „Selbstständig werden“ ist als eigenes Issue #259 ausgelagert (sicherheitsrelevant: braucht erst einen freigegebenen Entwurf zur Erneuerung des Rettungscodes).

### Stand #101 Eigene Pakete, erste Scheibe (9.11.2026)

- Format und Prüfung rein in `packages/engine/src/packs.ts` (Paare aus Feld A und B, feste Kennungen je Paket und Zeile, Einlesen aus Tabellentext mit Tab oder Semikolon, `cleanEntry`/`isBlockedText`, Zusammenführen mit Löschvermerken, Option `pack` mit höchstens 18 zufällig gewählten Paaren); Tests `packages/engine/test/packs.test.ts`.
- **Bibliothek** im Pass-Block `bibliothek` (`apps/web/src/lib/library.ts`, Seite `#/bibliothek` „Meine Pakete“, Einstieg im Profil): anlegen, bearbeiten (Zeilen behalten ihre Kennung), löschen, Vorschau, Zählung „n von mindestens 6 Paaren“.
- **Paare finden** spielt ein eigenes Paket (verborgene Option `pack` reist mit der Partie, also auch online; `PairsState.custom`); Auswahl in der Einrichtung über `PackPicker` (`packages/ui/src/packs/`). Reicht das Paket nicht für das gewählte Raster, nimmt die Partie das größte, das passt.
- Offen in #101: Schwarzer Peter und Bingo mit eigenen Paketen, Quartett und Wortspiele später; Teilen per Code/QR und Link (verschlüsselt, Server-Ablage `/paket/…`, ein Jahr nach letztem Abruf), Datenschutztext dazu; Pakete in der Klasse (#159); Rauchtest/Prüfstand der betroffenen Spiele und Blick am Handy.

- **#101 zweite Scheibe (9.11.2026):** Schwarzer Peter und Bingo spielen eigene Pakete über dieselbe verborgene Option `pack` (`PackPicker` in der Einrichtung). Bingo sagt `a` an und zeigt `b` auf der Karte, entfernt doppelte Lösungen und wählt die Kantenlänge nach der Paketgröße (12 Paare: 3×3, ab 18: 4×4). Prüfstand und Rauchtest für Paare finden, Schwarzer Peter und Bingo grün.
- **#101 dritte Scheibe (9.11.2026): Teilen.** Wie „Pass teilen“ (#149) nutzt das Teilen von Paketen die vorhandene Ablage `/teilen/<Kennung>` (verschlüsselt mit Zufallsschlüssel, Schlüssel nur im Link hinter `#`, Schreibgeheimnis je Paket auf dem Gerät in `brett-und-blatt:paketteilen`, ein Jahr nach letztem Abruf gelöscht, keine öffentliche Liste). `lib/packShare.ts`, Link `#/paket?k=…` (`screens/PackView.tsx`: ansehen, „In meine Pakete übernehmen“ mit neuer Kennung; `cleanEntry`/Filter beim Öffnen), 🔗 in „Meine Pakete“ mit Link, QR-Code, Aktualisieren und „Teilen beenden“. Datenschutztext ergänzt. Offen: Emoji-Code zum Abtippen, `#/neu/<id>?paket=…`, Pakete in der Klasse (#159), Quartett und Wortspiele mit eigenen Paketen, Blick am Handy.

### Stand #101 L1: Anki-Datenmodell (#218, 10.11.2026)

Vorhaben #101 ist auf Anki-Kompatibilität umgestellt (Bericht [`anki-recherche.md`](anki-recherche.md)). Schritt L1 legt das Datenmodell:
- **Engine** `packages/engine/src/anki/`: `types.ts` (Notiz, Notiztyp, Stapel, Löschvermerk, Sammlung `AnkiCollection` v2; Notiztypen und Stapel bleiben als JSON im Anki-Schema 11 mit **allen** Schlüsseln, auch unbekannten), `sha1.ts` (SHA-1 synchron), `text.ts` (Feldtrenner 0x1F, HTML entfernen mit Medien-Dateinamen, Prüfsumme `csum`, leeres Feld), `ids.ts` (Basis-91-`guid` wie Anki, feste Kennungen aus einem Text), `stock.ts` (Einfach, Einfach und umgekehrt, Einfach mit optionaler Umkehrkarte, Antwort eintippen, Lückentext, mit festen Kennungen), `collection.ts` (Notizen, Stapel, Karten aus Notiz und Notiztyp über `req` bzw. Lückennummern, Löschvermerke, Prüfen, Zusammenführen, `compactCollection`), `pairs.ts` (Sicht „Paket = Stapel“ für die Spiele, Umstellung der bisherigen Bibliothek, Text-Editor-Hilfen).
- **Spiele unverändert:** Paare finden, Schwarzer Peter und Bingo bekommen weiter die verborgene Option `pack`; `packsOf(sammlung)` macht aus Stapeln Pakete (Notizen mit zwei Feldern, ohne Bild, Ton und Lücken). Neue Kennungen der Sicht: Stapel `d-<hex>`, Zeile `n-<hex>`.
- **Speicher:** Die Sammlung liegt unter dem bisherigen Schlüssel `brett-und-blatt:bibliothek` (je Pass, Block `bibliothek`, jüngere Änderung je Notiz gewinnt, Löschvermerke). Eingebaute Notiztypen und der Standardstapel werden nicht gespeichert, solange sie unverändert sind. Die frühere Liste von Paketen wird beim ersten Lesen umgestellt (Kennungen aus den alten, damit alle Geräte dasselbe ergeben); geteilte Pakete behalten ihren Link (`moveShare`).
- **Abweichung vom Zuschnitt in #218:** IndexedDB und Medien kommen **mit L3** (Paketimport). Bis dahin ist die Sammlung reiner Text und passt in `localStorage` und in den Pass-Block (64 KB); die Mechanik der Pässe (Wechsel, Abgleich) hängt an diesen Schlüsseln.
- Grenzen heute: Der Text-Editor in „Meine Pakete“ (bis 200 Paare) ist für größere Stapel gesperrt (sonst gingen Notizen darüber verloren); der Editor für Notizen und Notiztypen kommt mit L4.
- Tests: `packages/engine/test/anki.test.ts`, `tests/library.test.ts`.

### Stand #101 L2: Text-Import und -Export im Anki-Format (#219, 10.11.2026)

- **Engine** `packages/engine/src/anki/textfile.ts`: `parseTextFile` (UTF-8 mit oder ohne BOM; Trennzeichen aus `#separator:` oder in Ankis Reihenfolge geraten: Tab, Senkrechtstrich, Semikolon, Doppelpunkt, Komma, sonst Leerzeichen; Anführungszeichen mit Verdopplung, Zeilenumbrüche und Trennzeichen in Feldern, `#`-Zeilen sind Kommentare; Kopfzeilen `separator`, `html`, `tags`, `columns`, `notetype`, `deck`, `notetype column`, `deck column`, `tags column`, `guid column`; HTML wird geraten, wenn `#html:` fehlt), `suggestImport` (Zuordnung der Spalten wie Anki: erste normale Spalten sind die Felder, die folgende Spalte die Tags), `importTextFile` (Duplikate am ersten Feld ohne HTML im selben Notiztyp, wahlweise zusätzlich im selben Stapel, oder über die `guid`-Spalte; aktualisieren, auslassen oder als neu; ohne HTML wird Text maskiert und Zeilenumbruch wird `<br>`; fehlende Stapel werden angelegt; Notiztyp-Spalte mit gleicher Reihenfolge für jeden Notiztyp), `exportTextFile` (Kopfzeilen `#separator:tab`, `#html:`, Spalten in Ankis Reihenfolge guid, Notiztyp, Stapel, Felder, Tags; Felder mit Tab, Zeilenumbruch oder Anführungszeichen und ein erstes Feld mit `#` werden in Anführungszeichen gesetzt; mit oder ohne HTML).
- **Oberfläche** auf „Meine Pakete“ (`apps/web/src/screens/AnkiText.tsx`): „📥 Aus Anki-Text importieren“ (Datei bis 5 MB oder Text einfügen, Vorschau, Zuordnung der Felder, Tags, Notiztyp, Stapel oder neuer Stapel, Duplikate, Vergleichsbereich, Ergebnis), „📤 Als Anki-Text exportieren“ (Stapel, Spalten, Kopieren, als Datei speichern) und „Karten mit einer KI erzeugen“ (Vorlage zum Kopieren).
- Tests `packages/engine/test/anki-text.test.ts` (22), im Browser (Handy-Hochformat) Import, Liste und Export geprüft.
- **Noch nicht geprüft:** Dateien aus echtem Anki (Cornelius). Anki rät das Trennzeichen aus den ersten 8 KB, wir tun dasselbe (ein Doppelpunkt oder Komma im Text kann zu einem falschen Trennzeichen führen; die Zuordnung ist deshalb nicht änderbar, nur `#separator:` hilft). Nur Textdateien; Medien kommen mit dem Paketimport (L3).

### Stand #101 L3: Anki-Pakete (.apkg) lesen und schreiben (#220, 10.11.2026)

- **Engine** `packages/engine/src/anki/apkg/`: `read.ts` (`readApkg`: alle drei Fassungen – Legacy 1 `collection.anki2`, Legacy 2 `collection.anki21` mit oder ohne `meta`, neu `collection.anki21b` mit zstd und Schema 18; Schema 11 über das JSON in `col`, Schema 18 über die Tabellen `notetypes`, `fields`, `templates`, `decks` mit Protobuf (`proto.ts`); Notiztypen als Schema-11-JSON mit allen Schlüsseln; Karten mit Lernstand und Protokoll bleiben erhalten; Medien nur mit sicherem Namen, Größen aus dem zstd-Kopf geprüft; Warnungen bei Skripten in Vorlagen und CSS mit Netz-Adressen), `write.ts` (`buildApkg` im Format Legacy 2: `meta` Version 2, `collection.anki21`, Platzhalter `collection.anki2`, `media`; nur benutzte Medien und Notiztypen; ohne Lernfortschritt alle Karten neu und ohne `leech`/`marked`; `subsetCollection` für einen Stapel samt Unterstapeln; neue Notizen bekommen neue Karten), `types.ts` (`ApkgDeps`: SQLite, zstd von außen), `zstd.ts`.
- **Web** `apps/web/src/lib/`: `ankiSql.ts` (Anbindung an sql.js), `ankiPackage.ts` (lädt sql.js, fflate und fzstd erst beim Gebrauch; höchstens 50 MB je Paket, entpackt höchstens 250 MB), `ankiStore.ts` (IndexedDB, je Pass eine Datenbank; ein importiertes Paket bleibt als Ganzes unverändert gespeichert und reist **nicht** über den Pass, siehe L7), `download.ts`. Oberfläche `screens/AnkiPackages.tsx` auf „Meine Pakete“: „📦 Anki-Paket (.apkg) importieren“ (Zusammenfassung, Hinweise, Lernfortschritt übernehmen ja/nein), Liste „Anki-Pakete“ mit „📤 Exportieren“ (mit oder ohne Lernfortschritt und Medien), „🧩 Paare übernehmen“ (kopiert Notizen mit zwei Textfeldern nach „Meine Pakete“, damit Paare finden, Schwarzer Peter und Bingo sie spielen) und Löschen; der Export „Als Anki-Paket (.apkg)“ der eigenen Pakete steht neben dem Text-Export.
- **Gefunden und behoben:** `::` in Stapelnamen (Unterstapel) wurde zu `:` verkürzt (L1).
- **Geprüft:** Tests `tests/apkg.test.ts` (11, mit sql.js in Node); fünf echte Pakete von AnkiWeb (Legacy 1; mit Bildern und Ton, 2 bis 869 Dateien) lassen sich lesen und zurückschreiben, das geschriebene Paket ist für Python-SQLite gültig (`integrity_check` ok); Import, Liste, Export im Browser (Handy-Hochformat). Die echten Pakete liegen nicht im Repository (Lizenz); mit `ANKI_TESTPAKET=<Datei> corepack pnpm exec vitest run tests/apkg.test.ts` prüft man ein eigenes.
- **Neues Paketformat (zstd) beim Schreiben (10.11.2026):** `buildApkg` mit `format: 'latest'` schreibt `meta` (Version 3), `collection.anki21b` (zstd) und `media` als Protobuf-Liste (Name, Größe, SHA-1), die Mediendateien einzeln zstd-gepackt. **Der Inhalt der Sammlung ist dabei Schema 11, nicht Schema 18:** Anki öffnet Sammlungen mit älterem Schema beim Import ohnehin über denselben Weg und aktualisiert sie; Schema 18 selbst zu schreiben (eigene Tabellen mit Protobuf, `unicase`-Sortierung, Stapeloptionen als Protobuf) wäre ohne Prüfung gegen echtes Anki ein Risiko ohne Nutzen. Der Packer ist `@bokuweb/zstd-wasm` (MIT, WASM 250 KB, wird erst beim Export in diesem Format geladen); in der Oberfläche steht der Haken „Neues Paketformat (kleiner)“ beim Exportieren, der Standard bleibt Legacy 2. **Lesen von Schema 18** ist an einer selbst gebauten Datenbank geprüft (Tests mit Protobuf-Bytes nach `notetypes.proto` und `decks.proto`), **nicht an einer echten Datei aus Anki.**
- **Noch offen in #220:** (1) eine echte Datei im neuen Format aus Anki lesen (Cornelius liefert), (2) Anki selbst importiert unsere Ausgabe in beiden Formaten (Cornelius), (3) Stapeloptionen aus neuen Paketen werden beim Schreiben durch Standardwerte ersetzt.

### Stand #101 L4: Notizen und Notiztypen bearbeiten (#221, 10.11.2026, erster Teil)

- **Engine** `packages/engine/src/anki/`: `render.ts` (Vorlagen-Renderer: `{{Feld}}`, `{{#Feld}}`, `{{^Feld}}`, Kommentare, `FrontSide`, `Tags`/`Type`/`Deck`/`Subdeck`/`Card`/`CardFlag`, Filter `text:`, `cloze:`, `hint:` (aufklappbarer Abschnitt statt Skriptlink), `type:` (Eingabefeld und Vergleich mit `typeGood`/`typeBad`/`typeMissed`), `furigana:`/`kanji:`/`kana:`, `tts` ohne Wirkung; Lückentext mit Hinweis, Verschachtelung und mehreren Nummern `{{c1,2::…}}`), `sanitize.ts` (`sanitizeHtml` ohne Browser: Erlaubnisliste für Tags und Attribute, Medien nur aus dem Paket, Verweise nur http, https, mailto, Ids mit Präfix `bub-`, Stil nur bekannter Eigenschaften; `scopeCss`: das CSS des Notiztyps wird auf `.bub-card` beschränkt, `@import`, Schriften, Netz-Adressen und `position: fixed` fallen weg), `edit.ts` (Felder hinzufügen, umbenennen mit Nachziehen der Vorlagen, verschieben, löschen; Vorlagen hinzufügen, ändern, löschen; Notiztyp umbenennen, kopieren, löschen, Notiz-Notiztyp wechseln mit Feldzuordnung; `computeReq` berechnet wie Anki, welche Felder eine Vorlage braucht; Suche `searchNotes` mit freien Wörtern, `"Satz"`, `-nicht`, `or`, `tag:`, `deck:`, `note:`, `Feld:Wert`, `*` und `_`; Duplikate, Notizen ohne Karte, Stapelbaum). Der Lückentext kennt jetzt auch `{{c1,2::…}}` bei der Kartenerzeugung.
- **Oberfläche:** Seite `#/sammlung/<meine | Paketkennung>` (`screens/Collection.tsx`) mit Suche, Stapelauswahl, Notizliste, Notiz-Editor (`NoteEditor.tsx`, Felder als kleines Textfeld `components/RichField.tsx` mit Fett, Kursiv, Unterstrichen, Listen, hoch und tief, Lückenknopf, HTML-Ansicht; Einfügen nur als Text; Ton bleibt `[sound:datei]`; Vorschau aller Karten `components/CardPreview.tsx`), Notiztyp-Editor (`NotetypeEditor.tsx`), Stapelverwaltung und „Aufräumen“ (Duplikate, Notizen ohne Karte). Einstiege: „✏️ Notizen und Notiztypen bearbeiten“ auf „Meine Pakete“ (eigene Sammlung) und „✏️ Bearbeiten“ bei jedem importierten Paket (Speicher IndexedDB, Karten werden mit den Notizen abgeglichen, Lernstand bleibt). Bilder und Ton des Pakets erscheinen in der Vorschau (Adressen werden erst beim Gebrauch erzeugt).
- **Zweiter Teil (10.11.2026):** Bilder und Ton **hinzufügen** (📎 im Feld, `packages/engine/src/anki/media.ts`: erlaubte Endungen, Größen 5 MB je Bild, 10 MB je Ton, 50 MB gesamt, kein SVG, Namen ohne Sonderzeichen, gleiche Datei wird wiederverwendet; Speicher IndexedDB `media` unter der Kennung `meine` oder der des Pakets, `useSource().addMedia`); der `.apkg`-Export der eigenen Sammlung nimmt die Medien mit. Sammelaktionen für angekreuzte Notizen (`BulkBar`: `moveNotes`, `tagNotes`, `changeNotetypeMany` mit `defaultFieldMap`, Löschen). Stapel verschieben: `moveDeck` (Unterstapel ziehen mit, `renameDeck` benennt sie jetzt ebenfalls mit um), in der Stapelverwaltung per Auswahlfeld „Unter …“ (Handy, Tastatur) oder Ziehen (Computer). Im Browser auf Handy- und Desktop-Breite geprüft (kein Querscrollen, keine Konsolenfehler, Fokus erreicht die Felder).
- **Noch offen:** Suche nach Kartenzustand (`is:due` u. ä., kommt mit L5), Medien eines importierten Pakets beim Löschen von Notizen aufräumen (nicht benutzte Dateien bleiben im Paket, schaden nicht).

### Stand #101 L5: Karteikasten mit FSRS (#222, 10.11.2026)

- **Verfahren:** `ts-fsrs` 5.4.2 (FSRS-6, MIT; 6.0.0 ist erst vom 28.10. und verlangt Node 24, 5.4.2 genügt und hat keine Abhängigkeit), ohne Zufall (Fuzz aus). Der Lernstand bleibt im **Anki-Format** (`ApkgCard`, `ApkgRevlog`): `type`/`queue`/`due`/`ivl`/`left`, FSRS in `cards.data` als `{"s","d","dr","lrt"}`; Wiederholungskarten sind nach Tageszahl ab `crt` fällig, Lernkarten nach Sekunden. `crt` (Tag 0 der Sammlung) bleibt beim Lesen und Schreiben erhalten (`ApkgData.crt`), sonst verschöben sich alle Termine.
- **Importierte Karten ohne FSRS-Zustand:** aus dem Protokoll nachgerechnet, wenn es im Paket ist (`replayHistory`), sonst geschätzt: Stabilität ≈ Intervall, Schwierigkeit linear aus dem Faktor (130 % → 10, 350 % → 1). Pakete, die vor L5 importiert wurden, kennen ihr `crt` nicht; die Seite weist darauf hin.
- **Warteschlange** (`buildQueue`): fällige Lernkarten, Wiederholungen, neue Karten, dann Lernkarten, die erst in 20 Minuten fällig werden (wie Anki, nur wenn sonst nichts ansteht); Tageslimits (Vorgabe 20 neue, 200 Wiederholungen) zählen aus dem Protokoll des Tages. Lerntage in Folge (`streakOf`) aus den Tagen mit Antworten. Tageswechsel um Mitternacht der Geräteuhr beim Anlegen des Lernbuchs (Sommerzeit verschiebt die Grenze um eine Stunde).
- **Lernbuch der eigenen Sammlung** (`learnbook.ts`, Pass-Block `lernen`): je Karte ein Zahlenfeld, Protokoll 30 Tage (Älteres als Zähler), 400 Lerntage, höchstens 60 000 Zeichen (Sicherungsgrenze 64 KB; zu groß → ältestes Protokoll fällt weg, Karten bleiben). Zusammenführen: je Karte die jüngste Antwort, Protokoll und Tage vereinigt, verschiedener Tag 0 wird umgerechnet (der ältere gilt), Vergessen bleibt über Geräte vergessen (Eintrag „neu“ mit neuer Zeit). Importierte Pakete führen ihren Lernstand in IndexedDB (Karten und Protokoll in der Anki-Form) und reisen nicht über den Pass (kommt mit L7).
- **Oberfläche:** Eintrag „Lernen“ im Hauptmenü, `#/lernen` (Quellen mit Zählern), `#/lernen/<meine|Paketkennung>` (Stapelwahl, Zähler Neu/Lernen/Fällig, Einstellungen: Neue je Tag, Wiederholungen je Tag, Behaltensquote, längstes Intervall, Lernschritte; Karteikasten mit Leertaste = Antwort zeigen, 1 bis 4 = Nochmal/Schwer/Gut/Leicht, Termin-Vorschau unter den Knöpfen). Der Export (Pakete und eigene Notizen) gibt Lernstand, Protokoll und `crt` nach Anki mit.
- **Noch offen in #222:** Lerntage-Stempel im Stempelheft (#145), Karte zurückstellen/zurücksetzen und Zurücknehmen im Karteikasten, Suche nach Kartenzustand, Statistik; für die eigene Sammlung enthält der Export nur das Protokoll der letzten 30 Tage.

### Stand #101 L6: Lernen beim Spielen (#223, 10.11.2026)

- **Fällige Karten bevorzugen:** Die Paketwahl in der Einrichtung (`PackPicker` in `packages/ui`, genutzt von Paare finden, Schwarzer Peter und Bingo) hat den Schalter „Fällige Karten bevorzugen“ (an, wenn schon etwas gelernt wurde; zeigt, wie viele Karten fällig sind). Die Auswahl der bis zu 18 Paare nimmt dann zuerst die heute fälligen Zeilen (`dueRowIds`: Lern- und Wiederholungskarten, nicht neue) und füllt zufällig auf. Der Optionswert `pack` trägt die Kennung jeder Zeile mit (`[A, B, Kennung]`, `encodePairsOption`/`decodePairsOption`), online also die Wahl der Raumleitung. Der Wert bleibt unter 6000 Zeichen.
- **Ergebnis als Wiederholung (nur Paare finden):** `GameUi.learning.report(view, seat)` liefert je Paar mit Kennung „sicher“ oder „unsicher“; Paare finden merkt Fehlgriffe je Paar und Platz (`state.slips`): ohne Fehlgriff genommen = sicher, sonst unsicher. `usePassRecorder` wertet das am Partieende für den eigenen Platz aus (wie das Album; nicht in Turnierpartien) und ruft `recordGameLearning` (`lib/learnStore.ts`) → `applyGameResults` (Engine). **Gewicht niedriger als im Karteikasten:** sicher zählt als Gut, unsicher als Schwer (nie als Nochmal, weil im Spiel Glück mitspielt); eine Karte, die noch nicht fällig ist, bleibt unberührt (zu frühes Wiederholen verfälscht FSRS); neue Karten beginnen damit zu lernen. Gezählt wird die erste Karte der Notiz (Vorderseite → Rückseite).
- **Schwarzer Peter und Bingo melden nichts:** Bei Schwarzer Peter werden Paare automatisch abgelegt, bei Bingo kann man nur Gezogenes markieren; beide Spiele sagen nichts darüber, ob jemand die Karte wusste. Ein „sicher“ für alles würde den Plan verfälschen. Sie nutzen nur „Fällige Karten bevorzugen“. **Quartett** hat noch keine Anbindung an die Bibliothek (eigene Quartett-Sätze, keine Paare), also auch kein Lernen beim Spielen; das wäre ein eigener Schritt (Quartett-Sätze aus Notizen).
- **Noch offen:** online gilt die Wahl der Raumleitung (ihre fälligen Karten), das Ergebnis lernt jeder Mensch für den eigenen Pass nur, wenn er dieselbe Bibliothek hat (die Kennungen `n-…` stammen aus der Sammlung der Raumleitung); in der Klasse die Klassenliste (L7).

### Stand #101 L7, erster Teil: Anki-Pakete mit Medien teilen über R2 (#224, 10.11.2026)

- **Ablauf:** Auf „Meine Pakete“ hat jedes importierte Anki-Paket „🔗 Teilen“: das Paket wird ohne Lernstand, mit allen benutzten Medien als `.apkg` gebaut (`exportApkg`), im Browser mit AES-GCM verschlüsselt (Schlüssel nur im Link hinter dem `#`, `sealBytes`/`openBytes` in `lib/passShareCore.ts`, Kennung aus dem Schlüssel wie bei „Pass teilen“) und als **eine** Datei unter `PUT /pakete/<Kennung>` abgelegt. Link: `#/paket?t=apkg&k=<Schlüssel>` (`lib/archiveShare.ts`, Schreibgeheimnis und Schlüssel in `brett-und-blatt:paketarchive`, je Pass). Der Empfänger sieht Name, Zahlen und Hinweise und übernimmt das Paket mit „In meine Anki-Pakete übernehmen“ (`screens/PackView.tsx`, `ArchiveView`); sein Lernstand beginnt neu. QR-Code und „Teilen beenden“ wie bei den Text-Paketen.
- **Server:** Bindung `PACKAGES` (R2-Bucket `anki-brett-blatt`, Rechtsraum `eu`, in `wrangler.jsonc`), Durable Object `PackageShare` (**Wrangler-Migration v12**) je Kennung mit Prüfwert des Schreibgeheimnisses, Größe und letztem Abruf; Alarm löscht das R2-Objekt und den Eintrag **ein Jahr nach dem letzten Abruf** (jeder Abruf rückt die Frist vor). Endpunkte `GET`/`PUT /pakete/<Kennung>` (Kopfzeile `X-Geheimnis`, Größe 29 Byte bis 52 MB, nur erlaubte Herkunft, Fehlversuche je Absender begrenzt) und `POST /pakete/<Kennung>/loeschen`. Logik ohne Anbieterbindung in `packages/online/src/package-share.ts`, Tests `packages/online/test/package-share.test.ts`. **Nicht geprüft:** das Löschen per Alarm gegen einen echten R2-Bucket und die Rechte des `CLOUDFLARE_API_TOKEN` für R2 (nach dem ersten Deploy ausprobieren).
- **Datenschutzerklärung** um „Anki-Pakete teilen“ ergänzt. **Noch offen in #224:** Stapel der Leitung in der Klasse, „Fällige Karten der Klasse“, Lernstand je Schüler für die Leitung samt Hinweis beim Beitritt (Wortlaut steht aus), Paket-Verzeichnis im Pass-Block (Verweis statt Inhalt, damit andere Geräte teilen/öffnen können), Teilen der eigenen Sammlung (Stapel) als Paket, Rauchtest `apps/server/scripts` mit mehreren Browsern.

### Stand #101 L7, zweiter Teil: Pakete und Lernstand in der Klasse (#224, 10.11.2026)

- **Pakete der Klasse:** Die Leitung legt eines ihrer importierten Anki-Pakete in die Klasse (`ClassState.packs`, höchstens 12; Aktionen `addPack`/`removePack`). Dazu wird das Paket wie bei „Teilen“ (erster Teil) verschlüsselt in R2 abgelegt; der **Linkschlüssel steht in der Klasse und geht nur an Mitglieder** (`ClassView.packs`). Ehrliche Folge: Der Server könnte das Paket damit lesen, anders als bei einem Link, dessen Schlüssel nur hinter dem `#` steht; steht in der Oberfläche und in der Datenschutzerklärung. Mitglieder übernehmen das Paket mit „Übernehmen“ (`adoptClassPack`, ihr Lernstand beginnt neu); die Zuordnung Klassenpaket ↔ Paket auf dem Gerät steht in `brett-und-blatt:klassenpakete`.
- **Lernstand je Mitglied für die Leitung** (Entscheidung Cornelius 10.11.2026; Wortlaut des Hinweises von ihm bestätigt, `LEARNING_NOTICE` in `lib/classLearning.ts`): Die Leitung schaltet „Lernstand“ ein (`ClassState.learning`, Standard aus). Der Hinweis steht beim Beitritt (wenn eingeschaltet) und in der Klasse; **gesendet wird erst nach der ausdrücklichen Zustimmung des Mitglieds** (je Gerät in `brett-und-blatt:klassenlernen`, Widerruf löscht den Stand beim Server). Jede Leitung hat ein ECDH-Schlüsselpaar (P-256); der öffentliche Schlüssel steht in der Klasse (`ClassMember.key`, Aktion `leadKey`), der private bleibt im Pass (Block `klassenschluessel`, das älteste Paar gilt auf allen Geräten). Das Mitglied komprimiert den Stand, verschlüsselt ihn mit einem Zufallsschlüssel (AES-GCM) und verpackt diesen je Leitung (ECDH mit Einmalschlüssel, HKDF); `lib/classCrypto.ts`, Test `tests/class-crypto.test.ts`. Der Server speichert je Mitglied einen Blob (`progress:<Kennung>`, höchstens 60 000 Zeichen, Aktion `progress`) und gibt ihn nur der Leitung heraus (`getProgress`); beim Austritt, Entfernen, Ausschalten und Auflösen wird er gelöscht.
- **Was im Stand steht** (`buildProgress`): je Klassenpaket Zahl der Karten, gelernt, in Wiederholung, fällig, Zahl des Vergessens, Antworten der letzten 7 Tage, Lerntage in Folge und die bis zu 150 schwächsten Karten (Notiz-Kennung, Art, Wiederholungen, Vergessen, Intervall). Die Leitung sieht die Vorderseite aus ihrer eigenen Kopie des Pakets. Gesendet wird alle fünf Minuten und 15 s nach dem Lernen (`startClassProgressSync`), nur mit Zustimmung.
- **Fällige Karten der Klasse (10.11.2026):** Die Leitung schaltet „Fällige Karten der Klasse“ ein (`ClassState.dueCards`, Standard aus); jedes Mitglied stimmt selbst zu (`brett-und-blatt:klassenfaellig`, Text `DUE_NOTICE` in `ClassLearning.tsx` – **Wortlaut noch von Cornelius zu bestätigen**). Das Gerät meldet nur die Kennungen (guid der Notiz) seiner fälligen Karten der Klassenpakete (Aktion `due`, höchstens 300, keine Namen, keine Zahlen; alle fünf Minuten und kurz nach dem Lernen). Der Server speichert die Meldung je Gerät (`due:<Kennung>`, ersetzt die alte, nie herausgegeben) und zeigt der Leitung nur die Auswertung (`aggregateDue`): erst ab **drei** Meldungen, nur Meldungen der letzten 14 Tage, die 100 häufigsten Karten; Widerruf, Austritt, Entfernen und Ausschalten löschen die Meldung. Die Leitung sieht die häufigsten Karten mit Vorderseite und erzeugt ein **Klassenspiel**: einen Link/QR-Code `#/neu/pairs?pack=…&autostart=1` mit den Paaren des Klassenpakets (`packsOf`, mindestens 6 Paare), die fälligen zuerst (`encodePairsOption` mit `prefer`, höchstens 18); jeder spielt allein am eigenen Gerät. Test `packages/online/test/classroom.test.ts`, vier Browser gegen den lokalen Server.
- **Gefundener Fehler (L3):** Pakete, die vor dem ersten Pass des Geräts importiert wurden, lagen in der Datenbank `…-standard` und waren danach unsichtbar, sobald das Profil zum ersten Pass wurde (andere Datenbank). `ankiStore.ts` zieht den Bestand jetzt beim ersten Öffnen der Datenbank des Passes um (`adoptStandard`).
- **Noch offen in #224:** Paket-Verzeichnis im Pass-Block `bibliothek`, Teilen der eigenen Sammlung, Rauchtest-Skript mit mehreren Browsern unter `apps/server/scripts/`, Hinweis für Eltern bei Klassenausweisen (die Kinder-Pässe der Leitung stimmen selbst zu, siehe Hinweistext).

### Stand #101 L8: Anki-Erweiterungen (#225, 10.11.2026)

Reihenfolge und Umfang entschied Cornelius am 10.11.2026: Formeln, Sprachausgabe, Bilder verdecken, gefilterte Stapel/Planer/Egel; FSRS-Parameter trainieren **später**. Alles bleibt im Paket erhalten und geht unverändert zurück nach Anki (Felder und Vorlagen werden nie umgeschrieben).

- **Formeln** (`anki/math.ts`, `lib/math.ts`, `components/CardHtml.tsx`): `\(…\)` und `\[…\]` werden mit KaTeX (MIT, 0.16.47) gesetzt, erst geladen, wenn eine Karte eine Formel hat (Schriften und Stil kommen aus dem Paket, kein Fremdhost); `trust` aus, abgelehnte Formeln bleiben als Text. `[latex]…[/latex]` und `[$]…[/$]` bleiben unverändert und erscheinen als Text, mit Hinweis.
- **Sprachausgabe** (`{{tts en_US:Feld}}`): wie in Anki steht nur das Vorlesezeichen 🔊 auf der Karte; Antippen oder Eingabetaste liest den Text mit der Stimme des Browsers vor (Web Speech). Stimme und Tempo aus der Vorlage werden nicht ausgewertet (Hinweis). Der Renderer erzeugt `span.bub-tts` mit `data-bub-tts` und `data-bub-lang`; der Bereiniger lässt nur diese Form zu (kein Skript).
- **Bilder verdecken** (`anki/occlusion.ts`): Masken stehen im Feld als `{{c1::image-occlusion:rect|ellipse|polygon:…}}`; die Web-App zeichnet sie selbst als SVG über dem Bild (Vorlage von Anki läuft nie). Aktive Maske zugedeckt, auf der Rückseite nur Umriss; „alle verdecken“ (`oi=1`) lässt die anderen zu. Kopfzeile, Zusatz und Kommentare werden gezeigt. **Nicht unterstützt:** Textmasken, gedrehte Masken (Hinweis); Masken bearbeiten gibt es nicht (das Feld bleibt, wie es ist).
- **Planer SM-2, Fuzz, Egel, Geschwister** (`anki/learn.ts`, Einstellungen im Karteikasten): Schalter „Planer“ (FSRS oder klassisch SM-2 mit Lernschritten, Faktor 250 %, Schwer ×1,2, Leicht ×1,3, Verspätung zählt halb), „Intervalle streuen“ (Fuzz, nur FSRS), Egel (Standard: nach 8 Mal Vergessen, dann alle 4: Karte zurückgestellt `queue = −1`, Notiz bekommt `leech`), „Geschwisterkarten am selben Tag zurückhalten“. Die Karten bleiben im Anki-Format; man kann zwischen den Planern wechseln.
- **Auswahl üben** (gefilterter Stapel ohne Planänderung): im Karteikasten „Auswahl üben (ohne Plan)“ mit der Suche aus der Sammlung (`tag:`, `deck:`, Wörter, `-nicht`): feste zufällige Reihenfolge, höchstens 200 Karten, die Antworten stehen nur als Protokoll (Art 3, „Filterstapel“), Termine und Faktor bleiben. Echte Anki-Filterstapel aus Paketen (Karten mit `odid`) bleiben unverändert erhalten und werden nicht neu gebildet.
- **Nicht unterstützt (mit Hinweis in der Oberfläche):** „Easy Days“, Anki-Planer v3 mit Tageslernen und die Skripte fremder Vorlagen; `unsupportedHints` (`anki/hints.ts`) nennt im Notiz-Editor und im Karteikasten, was bei der Karte gerade nicht ausgeführt oder gesetzt wird. FSRS-Parameter trainieren: später.

## Wappenfarben (#201, 9.11.2026)

Ein Wappen hat jetzt eine **Farbkombination aus 2 bis 4 Farben**, gewählt per Kennung aus `packages/engine/src/crest-colors.ts` (die sechs alten Kennungen gelten unverändert und behalten ihre Freischaltung). Gruppen: Klassisch, Städte und Orte (Reutlingen, Tübingen, Friedrichshafen, Metzingen, Pfullingen), Länder (EU und Ukraine, Zypern fehlt bis zur Bestätigung), 1. Bundesliga 2026/27 (18 Vereine), Sport aus Reutlingen (SSV Reutlingen 05, Young Boys Reutlingen, Reutlingen Eagles). Alle neuen Kombinationen sind **freizuspielen** (Cornelius, 9.11.2026): Städte nach Partien (3, 6, 9 …), Länder nach Stempeln (1, 2, 3 …), Bundesliga nach Siegen (2, 4, 6 …), Sport nach Turniersiegen (1, 2 …), jeweils nach der Stelle in der Liste (Regel `GROUP_NEED` in `player-crest.ts`); der Editor hat Gruppen und ein Suchfeld und weist darauf hin, dass es nur Farben sind, keine offiziellen Zeichen. Quellen und offene Punkte (Orte im Umkreis ohne belegte Flagge, Stadtteile, Basketball, Reutlingen Eagles) stehen in `wappenfarben-recherche.md`; neue Einträge nur mit Quelle, Kennungen nie ändern. Die Teilung zeichnet bei drei und mehr Farben gleich breite Streifen (quer, geteilt, schräg). Datei als TypeScript statt `content/wappen/farben.json`, damit Server und Browser dieselbe Prüfung ohne Netz nutzen.
