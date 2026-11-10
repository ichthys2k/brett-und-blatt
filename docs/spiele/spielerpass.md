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

### Stand #151 Klassen: Profile und Erfolge (8.11.2026)

- Klassenkarte rein in `packages/online/src/classcard.ts` (Prüfung `sanitizeCard`, Teile Stempel, Pokale als Zahl je Spiel, Lieblingsspiele); die Leitung wählt `sections` der Klasse, jedes Mitglied blendet für sich Teile aus (`brett-und-blatt:klassen-ausblenden`). Server: Aktion `card`; wird ein Teil ausgeschaltet, fällt er auch aus vorhandenen Karten.
- Klassenseite: Antippen eines Mitglieds zeigt Stempel, Pokale und Lieblingsspiele; **Stempelwand** (je Spiel, wer welchen Stempel hat), keine Rangliste (Entscheidung Cornelius). Die Karte wird beim Öffnen der Klassenseite und bei jeder Abfrage (10 s) nachgeführt, wenn sie sich geändert hat.
- Offen: Karte auch ohne offene Klassenseite nachführen (nach Partieende), Album-Fortschritt und Bot-Wertung als Teile, Rangliste je Spiel als Leitungs-Option, Klassen-Stempel („Die ganze Klasse hat Schach gespielt“), offene Räume der Klasse.

### Stand #152 Klassenausweise (8.11.2026)

- Die Leitung trägt auf der Klassenseite Namen ein (eine Zeile je Kind). Für jedes Kind legt der Browser einen Ausweis an: Passschlüssel, Spielercode, Rettungscode (der Ausweis als Block der gemeinsamen Sicherung), Schloss mit zufälliger Start-PIN (`createPassLock`), dann trägt der Server das Kind mit der Aktion `enroll` in die Klasse ein (Beitrittssperre und Bestätigung gelten nicht). Danach öffnet sich eine **Druckansicht** (Bild, Name, QR-Code mit dem Spielercode, Spielercode, Start-PIN).
- **Lehrkraft-Schloss:** Die Liste mit Rettungscode und Passschlüssel der Kinder liegt im Pass-Block `klassen` der Leitung (mit dem Passschlüssel der Leitung verschlüsselt, `lib/classPasses.ts`, Kern `classPassesCore.ts`, Tests `tests/classpasses.test.ts`). „PIN zurücksetzen“ nutzt den Rettungscode des Kindes (`resetPassLock`) und schreibt eine neue Start-PIN.
- Das Kind öffnet den Ausweis auf seinem Gerät über Profil → Sicherheit mit Spielercode und PIN.
- Offen: **„Selbstständig werden“** (Kind löst den Klassenausweis; dafür braucht es einen neuen Rettungscode, den es heute nicht zu erneuern gibt, und eine Anzeige für die Leitung); Spielercode vorab auf Dubletten gegen vorhandene Schlösser prüfen; Namensliste aus Zwischenablage mit Bildern; Gegenprobe gegen den echten Server.

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

## Wappenfarben (#201, 9.11.2026)

Ein Wappen hat jetzt eine **Farbkombination aus 2 bis 4 Farben**, gewählt per Kennung aus `packages/engine/src/crest-colors.ts` (die sechs alten Kennungen gelten unverändert und behalten ihre Freischaltung). Gruppen: Klassisch, Städte und Orte (Reutlingen, Tübingen, Friedrichshafen, Metzingen, Pfullingen), Länder (EU und Ukraine, Zypern fehlt bis zur Bestätigung), 1. Bundesliga 2026/27 (18 Vereine), Sport aus Reutlingen (SSV Reutlingen 05, Young Boys Reutlingen, Reutlingen Eagles). Alle neuen Kombinationen sind **freizuspielen** (Cornelius, 9.11.2026): Städte nach Partien (3, 6, 9 …), Länder nach Stempeln (1, 2, 3 …), Bundesliga nach Siegen (2, 4, 6 …), Sport nach Turniersiegen (1, 2 …), jeweils nach der Stelle in der Liste (Regel `GROUP_NEED` in `player-crest.ts`); der Editor hat Gruppen und ein Suchfeld und weist darauf hin, dass es nur Farben sind, keine offiziellen Zeichen. Quellen und offene Punkte (Orte im Umkreis ohne belegte Flagge, Stadtteile, Basketball, Reutlingen Eagles) stehen in `wappenfarben-recherche.md`; neue Einträge nur mit Quelle, Kennungen nie ändern. Die Teilung zeichnet bei drei und mehr Farben gleich breite Streifen (quer, geteilt, schräg). Datei als TypeScript statt `content/wappen/farben.json`, damit Server und Browser dieselbe Prüfung ohne Netz nutzen.
