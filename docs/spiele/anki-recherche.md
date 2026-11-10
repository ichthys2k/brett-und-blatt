# Anki-Kompatibilität für Brett & Blatt – Recherche und Rahmen

Stand: 10.11.2026. Bericht zu Issue [#103](https://github.com/ichthys2k/brett-und-blatt/issues/103) (Recherche), Vorhaben [#135](https://github.com/ichthys2k/brett-und-blatt/issues/135) (Spielerpass). Grundlage für den neuen Zuschnitt von #101 und #155 bis #159.

## 0. Entscheidung vorweg (Cornelius, 10.11.2026)

> „Ich will volle Kompatibilität mit Anki: Sowohl zum Import, Export, als auch beim Bearbeiten aller Lernpakete.“

Das legt den Rahmen fest: Brett & Blatt bekommt kein eigenes Kartenformat mit einem Übersetzer zu Anki, sondern **ein Datenmodell, das das von Anki ist** (Notizen, Notiztypen, Karten, Stapel, Tags, Medien, Wiederholungsverlauf). Ein Anki-Paket muss hineingehen und wieder herauskommen können, **ohne dass etwas verloren geht, das Brett & Blatt nicht versteht**. Die heutigen Pakete in `content/paare/*.json` werden zu Anki-Paketen (Notiztyp „Einfach“) umgestellt.

Die Entscheidung hat Folgen, die in Abschnitt 8 und 9 stehen. Die größten:
- Der Editor muss **Notiztypen mit Vorlagen und Cloze** können, nicht nur zwei Felder A und B.
- Der Speicher passt nicht mehr in einen 64-KB-Block des Passes (Medien). Der Pass trägt den Lernstand, der Inhalt liegt in IndexedDB.
- Fremde Pakete bringen HTML, CSS und JavaScript mit. Das muss sicher behandelt werden.

## 1. Quellen und was nicht geprüft werden konnte

Geprüft an der Quelle (GitHub, 10.11.2026):
- Anki-Handbuch (`ankitects/anki-manual`): Pakete, Textimport, Export, Karten, Felder, Bearbeiten, Wiederholen, Deck-Optionen, FSRS.
- Anki-Quellcode (`ankitects/anki`, Rust, AGPL-3.0): Tabellen (`schema11.sql`, `schema18_upgrade.sql`), Paketversionen (`import_export.proto`, `meta.rs`), Mediendatei, Notiztyp (`notetypes.proto`, `schema11.rs`), Kartendaten (`storage/card/data.rs`), Notizen (`notes/mod.rs`).
- npm-Registry: `sql.js`, `fzstd`, `fflate`, `ts-fsrs`.

**Nicht erreichbar:** `docs.ankiweb.net` (die Umgebung sperrt den Host). Gelesen wurden die gleichen Seiten als Markdown aus dem GitHub-Repository des Handbuchs. Nicht geprüft und deshalb mit „zu prüfen“ markiert ist alles, was nur in der Doku von Drittprojekten steht (z. B. Wiki von FSRS, Beschreibungen von Add-ons).

Lizenz: Anki steht unter AGPL-3.0, Brett & Blatt ebenfalls. Das Format ist beschrieben und mit Dritt-Implementierungen belegt; wir brauchen keinen Anki-Code zu übernehmen. Falls doch Code übernommen wird, ist die Lizenz verträglich (AGPL-3.0 beidseitig), die Herkunft gehört dann in `THIRD_PARTY.md`.

## 2. Was Anki ist

Anki ist ein Karteikasten mit Wiederholung in wachsenden Abständen. Das Datenmodell (verifiziert an `schema11.sql` und den Protobuf-Dateien):

| Begriff | Bedeutung | Anmerkung |
|---|---|---|
| **Notiz** (`notes`) | Ein Datensatz mit Feldern. `id` (Zeit in ms), `guid` (Basis-91-Zufallszeichen, stabile Kennung über Geräte), `mid` (Notiztyp), `tags`, `flds` (Felder, getrennt durch das Zeichen 0x1F), `sfld` (Sortierfeld), `csum` (erste 4 Byte von SHA-1 des ersten Feldes ohne HTML, für Duplikate) | Anki prüft Duplikate am ersten Feld |
| **Notiztyp** (Modell) | Felder (Name, Reihenfolge, Optionen), Vorlagen (Vorderseite `qfmt`, Rückseite `afmt`, Browser-Varianten), CSS, Art (normal oder Cloze), Sortierfeld, LaTeX-Rahmen | Im alten Schema als JSON in `col.models`, im neuen in eigenen Tabellen als Protobuf |
| **Karte** (`cards`) | Aus einer Notiz und einer Vorlage (`ord`) erzeugt, in einem Stapel (`did`). Zustand: `type`, `queue`, `due`, `ivl`, `factor`, `reps`, `lapses`, `left`, `odue`, `odid`, `flags`, `data` | Eine Notiz kann mehrere Karten haben (z. B. „Einfach und umgekehrt“) |
| **Stapel** (`decks`) | Hierarchie mit `::` (Eltern::Kind), Optionsvorlage (`dconf`) | Gefilterte Stapel sind eine Sonderform |
| **Wiederholungsprotokoll** (`revlog`) | Je Antwort: Zeit (id), Karte, Antwort 1 bis 4 (Nochmal, Schwer, Gut, Leicht), neues und altes Intervall, Faktor, Dauer, Art | Grundlage für Statistik und FSRS-Training |
| **Medien** | Dateien im Ordner `collection.media`, in Feldern als `<img src="…">` und `[sound:…]` | Keine Unterordner |
| **Tags** | Wörter je Notiz | `marked` und `leech` sind besondere Tags |

## 3. Dateiformate

### 3.1 Pakete (`.apkg`, `.colpkg`)

Ein Paket ist eine **ZIP-Datei** (verifiziert an `meta.rs`, `import_export.proto`):

| Version | Erkennung | Sammlung | Medienliste | Kompression |
|---|---|---|---|---|
| Legacy 1 | keine Datei `meta`, `collection.anki2` | SQLite, Schema 11 | `media` als JSON-Objekt (Nummer → Dateiname) | keine |
| Legacy 2 | keine Datei `meta`, `collection.anki21` | SQLite, Schema 11 | wie oben | keine |
| Neu (Latest) | Datei `meta` (Protobuf, Version 3) | `collection.anki21b`, SQLite, **Schema 18** | `media` als Protobuf (`MediaEntries`: Name, Größe, SHA-1) | **zstd** für Sammlung, Medienliste und Medien |

- Medien liegen im ZIP unter ihrer Nummer (`0`, `1`, …). Die Zuordnung Nummer → Dateiname steht in `media`.
- Eine `.apkg` mit dem Namen `collection.apkg` gilt als Sammlung. Sonst ist es ein Stapelpaket (ein Stapel mit Unterstapeln).
- Beim Export bietet Anki „Ältere Anki-Versionen unterstützen“: dann Legacy 2. Beide Wege lesen aktuelle Anki-Versionen weiterhin.
- **Import in Anki:** Notizen werden über die GUID wiedererkannt; die neuere Änderungszeit gewinnt. Wird der Notiztyp geändert (z. B. ein Feld ergänzt), lassen sich ältere Notizen nicht mehr aktualisieren. Seit Anki 23.10 kann man Notiztypen zusammenführen (nutzt Feld- und Vorlagen-Kennungen aus Anki 2.1.67; fehlen sie, vergleicht Anki Namen).
- **Lernfortschritt:** Ein Stapelpaket enthält ihn optional („Lernfortschritt importieren“). Beim Weitergeben fremder Stapel entfernt Anki ihn, samt `leech` und `marked`.

Schema 18 gegenüber Schema 11 (verifiziert an `schema18_upgrade.sql` und `notetypes.proto`): Notiztypen, Felder, Vorlagen, Stapel, Stapeloptionen, Konfiguration und Tags liegen in eigenen Tabellen, mit Protobuf-Inhalt statt JSON. Das ist der aufwendigste Teil beim Lesen (Abschnitt 6).

### 3.2 Text (`.txt`, `.csv`)

Verifiziert am Handbuch „Text Files“ und „Exporting“:
- Reiner UTF-8-Text, Trennzeichen Komma, Semikolon, Tab, Leerzeichen, Senkrechtstrich oder Doppelpunkt. Anki rät das Trennzeichen aus der ersten Zeile.
- Felder in Anführungszeichen erlauben Zeilenumbrüche und das Trennzeichen; Anführungszeichen werden verdoppelt.
- **Kopfzeilen** (seit 2.1.54): `#separator:`, `#html:`, `#tags:`, `#columns:`, `#notetype:`, `#deck:`, `#notetype column:`, `#deck column:`, `#tags column:`, `#guid column:`.
- Zeilen mit `#` am Anfang sind Kommentare.
- Duplikate: erstes Feld; Verhalten wählbar (aktualisieren, ignorieren, als neu importieren), Geltungsbereich Notiztyp oder Notiztyp und Stapel.
- Export „Notizen als Text“: Felder mit Tab getrennt, HTML bleibt erhalten; mit GUID-Spalte lässt sich ein Rundlauf (Export, Bearbeiten, Import) machen.
- Medien: nur als Verweis im Feld (`<img src="x.jpg">`, `[sound:x.mp3]`); die Dateien müssen separat im Medienordner liegen.

### 3.3 JSON

Anki kennt außerdem einen JSON-Import (`ImportJsonFile`, `ImportJsonString` in `import_export.proto`). Das Format ist im Handbuch nicht beschrieben und für diesen Auftrag nicht nötig (**zu prüfen**, falls KI-Werkzeuge es ausgeben).

## 4. Karten erzeugen und darstellen (Bearbeiten und Vorlagen)

Volle Kompatibilität beim Bearbeiten heißt, dass ein Anki-Notiztyp in Brett & Blatt **dieselben Karten ergibt wie in Anki**. Verifiziert am Handbuch „Card Generation“, „Field Replacements“, „Adding/Editing“:

- **Vorlagen** sind eine Mustache-artige Sprache: `{{Feld}}`, `{{FrontSide}}`, bedingte Abschnitte `{{#Feld}}…{{/Feld}}` und `{{^Feld}}…{{/Feld}}`.
- Anki erzeugt **keine Karte mit leerer Vorderseite**. Die Prüfung beruht auf den Feldern der Vorderseite (nicht auf Sonderfeldern oder Fließtext). Leere Karten werden nicht automatisch gelöscht, sondern über „Leere Karten“.
- **Filter:** `text:` (HTML entfernen), `cloze:`, `hint:`, `type:` (Antwort eintippen und vergleichen, mit Diakritika-Option), `furigana:`, `kanji:`, `kana:`, `ruby`-Filter, `tts` (Sprachausgabe), `Ruby characters`. Besondere Felder: `Tags`, `Type`, `Deck`, `Subdeck`, `Card`, `CardFlag`, `FrontSide`.
- **Cloze (Lückentext):** Syntax `{{c1::Text::Hinweis}}`; eine Notiz ergibt eine Karte je Lückennummer. Verschachtelte Lücken und mehrzeilige Lücken sind möglich.
- **Bilder verdecken (Image Occlusion):** Notiztyp seit Anki 23.10; Bild plus Masken; besondere Felder.
- **Notiztypen ändern, Stapel verschieben, Duplikate, Tags, Markieren, Flaggen, Suche** (eigene Suchsyntax), **Felder** mit Optionen (Schrift, Größe, rechts-nach-links, „einrasten“, Beschreibung, reiner Text, einklappen).
- **Medien in Feldern:** Bilder, Audio, Video; **LaTeX** (`[latex]…[/latex]`, braucht ein LaTeX-Programm auf dem Rechner) und **MathJax** (`\(…\)`, im Browser).
- **JavaScript** in Vorlagen ist in Anki erlaubt. Das ist für uns ein Sicherheitsthema (Abschnitt 7).

Vollständige Kompatibilität in der Darstellung heißt also: **ein Vorlagen-Renderer** (Mustache-Teilmenge samt Filtern und Cloze), **ein HTML-Bereiniger**, **eine CSS-Isolierung** und **ein Medienspeicher**. Das ist keine Bibliothek, die man einfach einbindet; Anki selbst hat ihn in Rust und TypeScript (Quelle, die wir als Maßstab lesen; Dateien **zu prüfen**). Wir schreiben ihn als reine Logik in `packages/engine`, testen ihn mit Vorlagen aus echten Anki-Paketen und nehmen die Handbuch-Beispiele als Testfälle.

## 5. Wiederholen (Lernstand)

Verifiziert an `deck-options.md`, `studying.md`, `storage/card/data.rs`:

- **Antworttasten:** Nochmal, Schwer, Gut, Leicht (1 bis 4). Vor jeder Taste steht das nächste Intervall.
- **Verfahren:** Das ältere SM-2-ähnliche Verfahren (Lernschritte, Abschluss-Intervall, Leicht-Bonus, Intervall-Modifikator, Faktor) und seit 23.10 **FSRS** (Free Spaced Repetition Scheduler). FSRS kann nur global an- oder ausgeschaltet werden; Parameter und gewünschte Behaltensquote (Standard 90 %) gehören zur Optionsvorlage.
- **Karte speichert den Zustand:** `type` (neu, lernen, wiederholen, wiederlernen), `queue`, `due`, `ivl`, `factor`, `reps`, `lapses`, `left`, dazu im Feld `data` (JSON) bei FSRS: `s` (Stabilität), `d` (Schwierigkeit), `dr` (gewünschte Behaltensquote), `decay`, `lrt` (letzte Wiederholung), außerdem `pos` (ursprüngliche Stelle). Das ist **verifiziert** in `storage/card/data.rs`.
- **Protokoll:** `revlog` mit Zeitstempel als Kennung, `ease`, `ivl`, `lastIvl`, `factor`, `time`, `type`.
- **Weitere Mechanik:** Geschwisterkarten zurückstellen (Burying), Egel (Leeches), Tageslimits, Lernreihenfolge, Zufallsschwankung (Fuzz), gefilterte Stapel, Easy Days. Das meiste davon ist **Deck-Option** (Konfiguration) und lässt sich als Daten durchreichen, ohne dass Brett & Blatt jede Option versteht.

**Empfehlung zum Verfahren:** FSRS mit `ts-fsrs` (MIT, Version 6.0.0 vom 28.10.2026, Abhängigkeit `@open-spaced-repetition/srs-kit`; die Seite gibt als FSRS-Versionen 3, 4.5, 5, 6 und 7 an, **zu prüfen** an der Paketdokumentation; die Node-Anforderung ≥ 24 betrifft laut Seite das optionale Binding für das Training, nicht den Browser, auch **zu prüfen** beim Einbinden). Begründung:
1. Anki nutzt FSRS ebenfalls, der Zustand liegt in denselben Feldern (`s`, `d`, …); Brett & Blatt und Anki können den Stand je Karte austauschen.
2. Der Lernstand muss pro Karte klein sein (Block im Pass). Vier Zahlen und ein Datum reichen.
3. Für importierte Karten **ohne** FSRS-Zustand (alte SM-2-Daten) rechnet Anki selbst auf FSRS um (Neuberechnung aus dem Protokoll; so beschreibt es mein Wissen, **zu prüfen** am Handbuch „Deck Options“, Abschnitt FSRS); wir behalten die Anki-Felder (`ivl`, `due`, `factor`) unverändert und starten FSRS beim ersten Antworten aus dem Protokoll bzw. neu. Wie genau, entscheiden wir beim Bau (Abschnitt 9, Frage 4).

Das Anki-eigene Planungsverfahren (Lernschritte, „v3-Scheduler“) nachzubauen, ist **nicht** nötig, um Pakete zu lesen, zu bearbeiten und zurückzugeben: Wir bewahren die Felder. Es wäre nur nötig, wenn jemand in Brett & Blatt mit SM-2-Verhalten lernen will (Stufe E in Abschnitt 8).

## 6. Bausteine, Größe und Aufwand

| Aufgabe | Baustein | Lizenz | Größe | Bemerkung |
|---|---|---|---|---|
| ZIP lesen und schreiben | `fflate` 0.8.3 | MIT | gemessen: 796 KB entpackt im Paket, im Browser nur der benutzte Teil | `jszip` ist MIT oder GPL, größer und träger |
| SQLite im Browser | `sql.js` 1.15.2 (WASM) | MIT | WASM **685 KB (336 KB gzip)**, Loader 47 KB (17 KB gzip), gemessen | Nur bei Import und Export laden (nicht vorab speichern) |
| zstd entpacken (Paket Latest) | `fzstd` 0.1.1 | MIT | **8,4 KB** (3,9 KB gzip), nur Entpacken | zstd **packen** (für Export Latest) braucht ein anderes Paket; nicht nötig, wenn der Export Legacy 2 schreibt |
| Protobuf lesen (Paketmeta, Medienliste, Notiztypen, Stapel in Schema 18) | handgeschriebener kleiner Leser oder `@bufbuild/protobuf` 2.17.0 | Apache-2.0 und BSD-3 | 2 MB unpacked | Die Nachrichten sind klein und fest; ein eigener Leser für etwa fünf Nachrichten ist wenig Code |
| FSRS | `ts-fsrs` 6.0.0 | MIT | 860 KB unpacked, im Browser nur der Kern | Parameter-Training als Zusatz (später) |
| HTML bereinigen | eigene Erlaubnisliste oder `DOMPurify` | Apache-2.0 oder MPL-2.0 | klein | Entscheidung im Bau (Abschnitt 7); nie ungeprüftes HTML anzeigen |
| Formeln | `KaTeX` (MIT) | MIT | etwa 300 KB mit Schriften | für `\(…\)` und `\[…\]`; **zu prüfen**, ob Schriften und CSS ohne Fremdhosts laufen |
| Vorlagen (Mustache-Teilmenge, Filter, Cloze) | **selbst schreiben** (reine Logik) | – | klein | der eigentliche Aufwand, siehe Abschnitt 4 |

Alle Bibliotheken müssen die Lieferketten-Wartefrist von pnpm überstehen (`minimumReleaseAge`). `sql.js` 1.15.2 ist vom 26.10.2026, `ts-fsrs` 6.0.0 vom 28.10.2026 – **beide bald zwei Wochen alt, die Frist vorher prüfen**; sonst eine ältere Version nehmen (keine Ausnahmen eintragen).

PWA: `sql.js`-WASM, KaTeX und das Training nicht vorab in den Service Worker legen, sondern beim ersten Gebrauch laden (Muster wie bei den Tierstimmen und der Enten-Rallye).

## 7. Sicherheit, Recht, Kinder

Anki-Pakete sind **fremde Daten mit Programmcode**:

1. **JavaScript in Vorlagen** wird in Anki ausgeführt. Brett & Blatt führt **nie** fremden Code aus. Vorlagen mit `<script>` werden dargestellt, das Skript wird entfernt, und der Import meldet es („Dieses Paket enthält Skripte, die hier nicht laufen“). Die Daten bleiben unverändert im Paket und gehen beim Export zurück (Abschnitt 8, Durchreichen).
2. **HTML** in Feldern und Vorlagen: Erlaubnisliste (Text, Listen, Tabellen, Bilder, Audio/Video, einfache Formatierung). Kein `script`, kein `iframe`, keine Ereignis-Attribute (`onclick`), keine `javascript:`-Adressen.
3. **CSS** der Notiztypen: nötig für das Aussehen, aber gefährlich (`url()` zu fremden Servern verrät, wer wann lernt). Regeln auf die Karte begrenzen (Name-Raum), `url()` nur auf Medien des Pakets, keine `@import`.
4. **Medien:** nur Typen aus einer Liste (Bilder, MP3/Ogg/M4A/WAV/Opus, MP4/WebM); SVG besonders prüfen (kann Skripte enthalten). Größen: Obergrenze für das ganze Paket und je Datei, damit kein „Zip-Bomben“-Paket den Speicher füllt (Entpackte Größe vor dem Entpacken prüfen).
5. **Speicher:** IndexedDB kann vom Browser geleert werden (besonders auf Safari/iOS bei Nichtbenutzung). Darum bleibt der Export (`.apkg`) der Sicherungsweg, und die App fragt `navigator.storage.persist()` an.
6. **Freitext von Kindern und Fremden:** `isBlockedText` (Engine `words.ts`) gilt für **Eigenes**. Fremde Pakete aus Anki sind in ihrem Inhalt nicht geprüft; das bleibt so (Teilen nur per Code, keine öffentliche Liste, siehe #101). Beim **Teilen in der Klasse** und beim Spielen im Raum nennt die Oberfläche, dass der Inhalt aus einem Paket stammt, und die Leitung entscheidet.
7. **Urheberrecht:** Viele Anki-Stapel (AnkiWeb) sind urheberrechtlich geschützt (Bilder, Lehrbuchtexte). Brett & Blatt verteilt keine fremden Pakete; es gibt keine öffentliche Bibliothek. Der Teilen-Dialog weist darauf hin, dass man nur teilen darf, was man teilen darf. Eigene Pakete des Projekts bleiben CC BY-SA 4.0.
8. **Datenschutz:** Pakete und Lernstand liegen auf dem Gerät und im Pass (Ende-zu-Ende verschlüsselt). Der Server sieht nichts; die Datenschutzerklärung nennt das (wie bei #142, #149).

## 8. Kompatibilitätsstufen und Architektur

Die Stufen sind **Schnitte durch die Funktionen**, nicht durch die Dateiformate. Jede Stufe liefert etwas Brauchbares und erhält, was sie nicht versteht.

| Stufe | Inhalt | Anki-Kompatibilität nach der Stufe |
|---|---|---|
| **A Fundament** | Anki-nahes Datenmodell (Notizen, Notiztypen, Karten, Stapel, Tags, Medien, Protokoll) in IndexedDB; die festen Pakete aus `content/paare` als Anki-Notizen („Einfach“); Spiele lesen Notizen statt `pairs`; feste Kennungen (GUID) | Intern kompatibel; noch kein Austausch |
| **B Text** | Import und Export im Anki-Textformat mit allen Kopfzeilen; Spalten zuordnen; Duplikate wie Anki; Vorschau | Vollständig für Text, ohne Medien-Dateien |
| **C Pakete** | `.apkg` lesen (alle drei Versionen) und schreiben (Legacy 2); Medien; Notiztypen; Stapelbaum; Lernfortschritt wählbar; Durchreichen aller unbekannten Teile | Rundlauf mit Anki für Notizen, Notiztypen, Medien, Stapel, Tags, Lernstand |
| **D Bearbeiten** | Editor für Notizen (Rich-Text-Felder, HTML-Ansicht, Bilder, Audio, Cloze-Knopf), Notiztyp-Editor (Felder, Vorlagen, CSS, Vorschau), Stapel verwalten, Tags, Suche (Teilmenge der Anki-Suche), Duplikate, leere Karten, Notiztyp wechseln | Bearbeiten ersetzt den Anki-Desktop für Alltagsarbeit |
| **E Lernen** | Karteikasten mit FSRS (`ts-fsrs`), Protokoll, Tagesziel, Stempel; Lernen beim Spielen; fällige Karten bevorzugen; Optionsvorlagen (Behaltensquote, Limits) | Lernstand und Protokoll wandern in beide Richtungen |
| **F Klasse** | Stapel der Lehrkraft in der Klasse; „Fällige Karten der Klasse“; Lernbericht | – |
| **G Erweiterungen** | Bilder verdecken, TTS-Filter, `type:`-Antwort, Ruby/Furigana, MathJax/KaTeX, gefilterte Stapel, Anki-Planer (Lernschritte), FSRS-Training | Schließt die Lücken zur vollen Kompatibilität |

### 8.1 Datenmodell

Wir übernehmen die Anki-Felder **unverändert**, damit der Rundlauf trivial ist. Kern (reine Typen in `packages/engine/src/anki/`):

```ts
interface AnkiNote { id: number; guid: string; mid: number; mod: number; tags: string[]; fields: string[]; /* + unbekannte Teile */ }
interface AnkiCard { id: number; nid: number; did: number; ord: number; mod: number; type: number; queue: number; due: number; ivl: number; factor: number; reps: number; lapses: number; left: number; odue: number; odid: number; flags: number; data: string /* JSON, s/d/dr/decay/lrt/pos */ }
interface AnkiRevlog { id: number; cid: number; ease: number; ivl: number; lastIvl: number; factor: number; time: number; type: number }
```

Notiztypen, Stapel und Optionsvorlagen bleiben als JSON in Anki-Form (Schema 11) mit **allen** Schlüsseln, auch den unbekannten (`other`). So geht beim Bearbeiten nichts verloren, was Brett & Blatt nicht versteht (z. B. Schriftarten, LaTeX-Rahmen, Feld-Optionen). Beim Lesen aus Schema 18 werden die Protobuf-Nachrichten in dieselbe JSON-Form übersetzt; beim Schreiben in Schema 11 zurück.

### 8.2 Speicher und Pass

- **Inhalt (Notizen, Notiztypen, Karten, Medien):** IndexedDB auf dem Gerät, je Pass getrennt (Familie, #139).
- **Lernstand (Zustand je Karte und Protokoll):** im Pass-Block `lernen` (64 KB). Je Karte reichen Kennung (GUID plus Vorlage), `due`, `s`, `d`, Datum der letzten Wiederholung, Zähler; das ergibt grob 25 bis 30 Byte je Karte, also einige tausend Karten je Block; darüber teilt der Block in Gruppen je Paket (Plan Abschnitt 5). Das Protokoll wird verdichtet (alle Antworten der letzten 30 Tage, ältere nur als Zähler und Retention je Monat), **außer** der Nutzer bittet um den vollen Export.
- **Inhalt über Geräte:** Das ist die offene Frage 3 unten. Pass-Blöcke sind für Pakete mit Medien zu klein.

### 8.3 Abbildung der bestehenden Spiele

- **Paare finden, Schwarzer Peter, Bingo:** nehmen eine Notiz mit zwei Feldern (Feld 1 und 2 des Notiztyps „Einfach“ oder beliebige zwei ausgewählte Felder) und zeigen den Text in `ContentCard`; Notizen mit Bildern zeigen das Bild (HTML-Bereiniger). Spiele nehmen nur Notizen, die als Paar taugen (kurz genug, nicht Cloze); das Einrichtungsfenster zeigt, wie viele von einem Stapel taugen („12 von 50 Karten“).
- **Quartett:** braucht Gruppen und Werte; in Anki gibt es dafür keinen Notiztyp. Vorschlag: eigener Notiztyp „Quartett“ (Felder Gruppe, Karte, Werte), der in Anki als normaler Notiztyp lesbar ist. Fest eingebaute Sets werden Pakete.
- **Wortspiele und Klassenspiele:** später (wie in #101 beschrieben), nach Stufe E.
- Die bestehenden `content/…/*.json` bleiben als Quelle im Repository; ein Skript erzeugt daraus Anki-Pakete (`.apkg`) und prüft, dass der Rundlauf stimmt.

## 9. Was nicht oder anders gehen wird – und gestellte Fragen (beantwortet in 9a)

**Nicht kompatibel (und warum):**
- **AnkiWeb-Sync und Anki-Server:** Das Protokoll ist nicht dokumentiert und der Dienst hängt an einem Konto. Austausch geht über Pakete.
- **Add-ons und Skripte in Vorlagen:** laufen nie (Abschnitt 7). Die Daten bleiben im Rundlauf erhalten.
- **LaTeX mit externem Programm:** läuft im Browser nicht; Formeln über KaTeX/MathJax. `[latex]`-Blöcke bleiben unverändert und werden als Text dargestellt.
- **Gefilterte Stapel und Planer-Feinheiten** (Fuzz, Easy Days, Burying): Stufe G; bis dahin werden sie durchgereicht, aber nicht angewendet.

**Offene Fragen an Cornelius:**
1. **Reihenfolge der Stufen (A bis G).** Mein Vorschlag steht in Abschnitt 10. Soll das Bearbeiten (D) vor dem Lernen (E) kommen oder danach? Ohne Bearbeiten kann man fremde Pakete lernen, aber nicht ändern.
2. **Exportform:** Legacy 2 schreiben (alle Anki-Versionen lesen es, einfachere Technik) oder auch Latest (zstd-Packen nötig, Medien komprimiert, kleinere Dateien)? Vorschlag: Legacy 2 zuerst, Latest später falls gewünscht.
3. **Geräteübergreifender Inhalt:** Wohin mit Paketen samt Medien? Optionen: (a) nur auf dem Gerät, Wechsel per `.apkg`-Austausch; (b) verschlüsselte Ablage auf dem Spieleserver mit größerem Limit als 64 KB (Durable Object, nach Muster `BackupVault`, grobe Größenschranken **zu prüfen**); (c) Cloudflare R2 (Medien); die Voraussetzungen der kostenlosen Stufe **zu prüfen**. Das entscheidet auch, wie #101 das Teilen per Code umsetzt.
4. **Bestehender SM-2-Zustand:** Karten aus Anki ohne FSRS-Zustand: (a) FSRS aus dem Protokoll neu berechnen (genau, aber das Protokoll muss im Paket sein), (b) Zustand aus `ivl` und `factor` abschätzen, (c) wie neu starten. Vorschlag: (a) wenn das Protokoll da ist, sonst (b).
5. **Rich-Text-Editor:** eigenes Feld mit `contenteditable` (klein, Handy-tauglich, volle Kontrolle) oder eine Bibliothek (z. B. TipTap, ProseMirror)? Vorschlag: eigenes, kleines Feld mit HTML-Ansicht; Entscheidung bei Stufe D.
6. **Bilder und Audio:** Anki-Pakete enthalten Medien; die Beschränkung „keine Bilder“ in #101 fällt damit. Größenlimit je Paket (Vorschlag: 50 MB) und Medienarten (Abschnitt 7) bitte bestätigen.
7. **Name und Ort im Menü:** „Lernen“ als eigener Bereich auf der Startseite oder nur im Pass?
8. **Datenschutz und Klasse (Stufe F):** Soll die Lehrkraft Lernberichte sehen? Vorschlag aus Plan Abschnitt 8 bleibt: nur freiwillig geteilt.

## 9a. Entscheidungen (Cornelius, 10.11.2026)

| # | Frage | Entscheidung | Folge |
|---|---|---|---|
| 1 | Reihenfolge | **Bearbeiten (D) vor Lernen (E)** | L4 vor L5 |
| 2 | Exportform | **Legacy 2 und das neue Format (zstd)** | zusätzlich ein zstd-**Packer** nötig (`fzstd` kann nur entpacken); Bibliothek und Größe noch zu prüfen, Tests mit beiden Formaten |
| 3 | Ablage über Geräte | **Cloudflare R2 für Medien** | Neuer Speicher im Cloudflare-Konto: Bucket, Bindung im Worker, Verschlüsselung im Browser (Server sieht nur Bytes). Voraussetzungen der kostenlosen Stufe (z. B. hinterlegte Zahlungsmethode, Grenzen für Speicher und Anfragen) **vor dem Bau prüfen**; Einrichtung macht Cornelius selbst, Geheimnisse nie in den Chat |
| 4 | SM-2-Zustand importierter Karten | **Aus dem Protokoll berechnen, sonst aus Intervall und Faktor schätzen** | Rechenweg in L5; Protokoll muss beim Import gelesen werden (L3) |
| 5 | Größe je Paket | **50 MB** | Prüfung vor dem Entpacken (Abschnitt 7), Hinweis beim Überschreiten |
| 6 | Feld-Editor | **Eigenes kleines Feld** (`contenteditable` mit HTML-Ansicht) | Kein TipTap/ProseMirror |
| 7 | Platz in der App | **Beides**: Kachel „Lernen“ auf der Startseite, Pakete und Lernstand im Pass | Startseite und `#/pass` bekommen Einstiege |
| 8 | Lernberichte | **Pro Schüler sichtbar** für die Leitung | Weicht vom bisherigen Plan („nur freiwillig geteilt“) ab; siehe Hinweis unten |

**Hinweis zu Entscheidung 8:** Der Plan (Spielerpass, Abschnitt 8) und die Datenschutzerklärung gehen bisher davon aus, dass der Server keine Lernstände einzelner Personen sieht. Der Lernstand je Schüler für die Leitung braucht daher einen eigenen, **für die Schüler sichtbaren** Weg: Beim Beitritt zur Klasse erfährt jedes Mitglied (und bei Kindern die Eltern), dass die Leitung den Lernstand sieht; der Stand reist verschlüsselt an die Leitung (nur die Leitung kann ihn öffnen), und die Datenschutzerklärung wird ergänzt. Das ist Teil von L7 und wird dort noch einmal entworfen und mit Cornelius abgestimmt, bevor es gebaut wird.

## 10. Vorschlag für den neuen Zuschnitt der Issues

Die fünf Unter-Issues passen nicht mehr (sie gingen von „Pakete aus zwei Feldern“ aus). Vorschlag, nach deiner Entscheidung umzusetzen:

| Neu | Inhalt | ersetzt |
|---|---|---|
| **L1** (#218) Datenmodell und Speicher (Stufe A) | Anki-nahe Typen, IndexedDB, feste Kennungen, `content/…` als Notizen, Spiele lesen Notizen | #101 (Teil), #155 (Teil) |
| **L2** (#219) Text-Import und -Export (Stufe B) | alle Kopfzeilen, Spaltenzuordnung, Duplikate, Hilfeseite mit KI-Vorlage | #158 |
| **L3** (#220) Pakete lesen und schreiben (Stufe C) | `.apkg` alle Versionen, Medien, Stapelbaum, Rundlauftests mit echten Paketen | #101 (Teil), #158 (Teil) |
| **L4** (#221) Notizen und Notiztypen bearbeiten (Stufe D) | Editor, Notiztyp-Editor, Vorlagen-Renderer, Cloze, Stapel, Tags, Suche | #101 (Teil) |
| **L5** (#222) Karteikasten mit FSRS (Stufe E, Teil 1) | `ts-fsrs`, Protokoll, Block `lernen`, Tagesziel, Stempel | #155, #157 |
| **L6** (#223) Lernen beim Spielen (Stufe E, Teil 2) | Paare finden, Schwarzer Peter, Bingo, Quartett melden Ergebnisse; fällige Karten bevorzugen | #156 |
| **L7** (#224) Teilen, R2 und Klasse (Stufe F) | Teilen per Code, Stapel in der Klasse, fällige Karten der Klasse | #101 (Teil), #159 |
| **L8** (#225) Erweiterungen (Stufe G) | Bilder verdecken, TTS, `type:`, Ruby, Formeln, gefilterte Stapel, Anki-Planer, FSRS-Training | neu |

Jeder Schritt ist für sich prüfbar (Rundlauftests mit echten Paketen aus Anki, Rauchtest, Blick am Handy). Die echten Pakete zum Testen (von dir aus Anki exportiert, mindestens: Einfach, Einfach und umgekehrt, Cloze, mit Bild und Ton, mit Lernfortschritt, ein Stapel mit Unterstapeln) brauche ich ab L3.

## 11. Was sich an #101 ändert (umgesetzt am 10.11.2026)

#101 ist jetzt das Vorhaben mit den Unter-Issues #218 bis #225; #155 bis #159 sind geschlossen (nicht geplant, Inhalt übernommen).

- **Ziel:** nicht mehr „Editor mit Feld A und B“, sondern Anki-Notizen und -Notiztypen bearbeiten, mit Paketen als Austauschformat.
- **Bilder und Ton:** gehören dazu (Anki-Pakete haben sie).
- **Teilen per Code:** bleibt, aber als Stufe F; der Inhalt ist ein Anki-Paket, verschlüsselt (Entscheidung offen, Abschnitt 9, Frage 3).
- **Feste Kennungen:** GUID und Vorlagennummer, wie in Anki, statt eigener Kennungen.
- **Pakete im Pass:** `bibliothek` trägt nur die Verzeichnisliste (Name, GUID, Stand), nicht den Inhalt (Abschnitt 8.2).
- **Kurz:** #101 wird zum Vorhaben mit den Schritten L1 bis L4 und L7; #155 bis #159 werden an L5, L6, L7 angepasst.
