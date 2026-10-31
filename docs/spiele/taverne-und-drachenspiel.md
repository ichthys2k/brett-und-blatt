# Gestaltungskonzept Taverne (W-026) und Drachenspiel im Mittelalter (W-025)

Fassung 2 vom 31.10.2026, am Code geprüft. Die erste Fassung (Commit `958382d`) bleibt in der Git-Geschichte.

## Kurzfassung

Die Taverne ist umsetzbar, wenn sie **ein Kleid für den Rahmen der App** bleibt und nicht jedes Spiel umbaut. Die Taverne ist Standard (Entscheidung von Cornelius, 31.10.2026); das frühere Aussehen bleibt als „Schlicht“ wählbar. Fest eingebaute Farben der Spiele bleiben unberührt.

Das Drachenspiel wird unabhängig davon zum **Turnier der Wappentiere**. Wie der Narrenhof trägt es sein Thema immer selbst. Die Regeln bleiben; das Drachenei ist eine spätere, getrennte Option.

Beide Stränge lassen sich jederzeit anhalten, ohne dass etwas halbfertig zurückbleibt.

## Was am Code geprüft wurde

| Befund | Folge für das Konzept |
| --- | --- |
| Die App hat zehn Farb-Tokens in `apps/web/src/styles.css`, Dunkelmodus nur über `prefers-color-scheme` | Rahmen lässt sich mit wenig Code umfärben; `data-look` muss hell und dunkel je eigens überschreiben |
| 37 von 39 Spiel-Stylesheets setzen eigene Hintergründe, in den Spielen stehen rund 1240 feste Farbangaben | Spiele „erben“ die Taverne nicht von selbst; sie werden nicht umgefärbt |
| Oberflächentexte liegen in `apps/web/src/i18n.ts` hinter `t()` | Abweichende Wörter gehen als kleine Ergänzungsliste, ohne die Bildschirme umzubauen |
| Aussehen-Einstellung gibt es noch nicht, Ablage in `localStorage` schon (`lib/storage.ts`) | Neue kleine Einstellung, gilt je Gerät |
| WebP wird beim ersten Gebrauch gespeichert (`vite.config.ts`), nicht vorab | Bilder belasten den Vorabspeicher nicht; Schriftdateien (`woff2`) fehlen dagegen im Muster und müssen ergänzt werden |
| 135 Narrenhof-Porträts belegen zusammen 1,1 MB | 63 gemalte Karten kosten nur etwa 0,5 MB; der Engpass ist die Canva-Drosselung, nicht der Speicher |
| Der Rauchtest prüft keine Kontraste und macht keine Bilder | Kontrast-Test und Bildvergleich müssen dazukommen |

## Was sich gegenüber Fassung 1 ändert

| Fassung 1 | Fassung 2 | Grund |
| --- | --- | --- |
| Jedes Spiel bekommt eine Tischoberfläche | Eine gemeinsame Fläche um das Spielfeld, je Rubrik | Spiele haben fast alle eigene Hintergründe |
| Bedienwörter werden umbenannt (Tischzeichen, Hinterzimmer, Gaffer) | Sachliche Wörter bleiben; Thema nur in Überschriften und Begrüßung | Kinder, Lehrkräfte und Anleitungen sagen „Raumcode“; „Gaffer“ wertet ab |
| Wirtshausschilder als hängende Kacheln | Kacheln mit Holzkante und Wappen | Über 40 Kacheln, auf dem Handy zählt jeder Platz |
| Burg mit Mauersteinen auf dem Turnierplatz | Turnierherr mit 30 Wimpeln | Auf einem Turnier greift niemand eine Burg an |
| Zauberkristalle, Bannfluch, Schutzzauber | Knappen, Meisterstoß, Prunkschild | Trägt das Thema ohne Magie-Wortschatz; Entscheidung bei Cornelius |
| Siegerkelch | Pokal bleibt | Ein Kelch weckt die Wein-Assoziation, die das Konzept vermeiden will |
| Drachenei in Schritt 4 zusammen mit anderem | Eigener Schritt, einfachere Regel, Option | Einziger Teil, der Regeln, Bot und Balance berührt |
| Wirtin, Richter, Stühle um den Tisch früh | Später oder bei W-020 | Schön, aber nicht tragend |

## Leitidee

Brett & Blatt ist das Gasthaus eines Fabeltier-Königreichs. Die Rubriken sind seine Räume; der Narrenhof ist die Burg nebenan, das Drachenspiel der Turnierplatz davor.

| Rubrik heute | Raum (als Überschrift) | Fläche um das Spielfeld |
| --- | --- | --- |
| Strategie- & Brettspiele | Spielstube | Eichenholz |
| Karten- & Stichspiele | Kartentisch | grüner Filz |
| Familien-, Lege- & Gesellschaftsspiele | Festsaal | helles Holz |
| Mathe- & Rechenspiele Kl. 5/6 | Schreibstube | Pergament |

Die sachliche Rubrik bleibt als Unterzeile sichtbar, auch die Filter behalten ihre Namen.

## Taverne (W-026)

### Umfang

- **Aussehen-Wahl:** „Schlicht“ oder „Taverne“ auf derselben Einstellungsseite wie Ton und Musik, gesetzt als `data-look` auf `<html>`. Die Taverne überschreibt nur Tokens und ergänzt Rahmenklassen. Bei `prefers-contrast: more` gilt immer Schlicht.
- **Farben:** Hell = Tag (Pergament `#f3e9d2`, Eiche `#5a3b22`, Waldgrün, Kupfer). Dunkel = Kaminabend (Rußbraun, Kerzengelb). Ein Test rechnet die Kontraste der Token-Paare nach WCAG AA aus und schlägt sonst fehl.
- **Oberflächen:** Holz, Filz und Pergament nur mit CSS (wie die Harlekin-Rauten des Narrenhofs), keine Bilddateien. Die Fläche ums Spielfeld bleibt hell und gedämpft, weil viele Spiele direkt darauf schreiben; auch diese Kontraste prüft der Test.
- **Schrift:** Almendra Bold (OFL) für große Überschriften, selbst ausgeliefert (`@fontsource/almendra`), Quelle in `THIRD_PARTY.md`. Alles andere bleibt Systemschrift.
- **Startseite:** Räume als Überschriften, Kacheln mit Holzkante und Spiel-Emoji als Wappen, ein Begrüßungssatz.
- **Lobby und Siegerehrung:** Nur Optik über `data-look`: Holz und Filz in der Lobby; Wimpel und Blüten statt Konfetti, Ehrenbank als Treppchen. Wörter und Abläufe bleiben.
- **Spiele:** Nur die gemeinsame Fläche um das Spielfeld in `Play.tsx`. Sieht ein Spiel davor schlecht aus, wird es einzeln korrigiert.

### Nicht im ersten Durchgang

Wirtin als Figur, Atmosphäre-Klänge, Playlist „Taverne“ (zu W-014, Auswahl durch Cornelius; Klänge nie von selbst an), Tavernen-Bretter für Schach und Go, runder Tisch in der Lobby (gehört zu W-020).

## Drachenspiel: Turnier der Wappentiere (W-025)

Zwei Turnierherren schicken ihre Tiere auf den Platz. Das Thema gilt immer, unabhängig von der Aussehen-Wahl. Die englischen Bezeichner im Code (`hero`, `mana` …) bleiben, geändert werden Texte, Kurzanleitung und Oberfläche. Die 368 Tierstimmen bleiben.

### Begriffe (Vorschlag)

| heute | neu | Bild |
| --- | --- | --- |
| Held mit 30 Leben | Turnierherr mit 30 Wimpeln | Wimpel an der Tribüne fallen sichtbar |
| Mana, Kristalle | Knappen (1 bis 10) | Eine Karte ruft man mit Knappen aufs Feld |
| Sternschnuppe | bleibt | passt schon, ohne Magie |
| Beschützer | Schildwall | Schild mit Wappen |
| Flink | Ansturm | Lanze |
| Schutzblase | Prunkschild | fängt den ersten Treffer ab |
| Giftig | Meisterstoß | Wer getroffen wird, verlässt den Platz |
| Versteckt | Verkleidet | Maske |
| Auftritt | Fanfare | Trompete |
| Abschied | Vermächtnis | Schriftrolle |
| Müdigkeit bei leerem Deck | bleibt | |

Tiere sterben nicht, sie verbeugen sich und treten ab. Waffen sind stumpfe Turnierlanzen.

### Wappenhäuser

Wald = Haus Eichenhain, Meer = Seefahrergilde, Bauernhof = Dorfgemeinschaft Hahnfeld, Wildnis = Fernländer Karawane, Krabbeltiere = Schwarm vom Moorbach. Die neun Zauberkarten heißen „Kniffe“ und bekommen einen Pergamentrahmen.

### Bilder

Zuerst bleiben die Emojis, gerahmt von Wappen und Banner des Hauses; das reicht für ein geschlossenes Bild. Gemalte Karten folgen nur, wenn das gefällt: etwa 8 KB je Bild, 63 Karten rund fünf Stunden wegen der Drosselung, Kennzeichnung in `THIRD_PARTY.md`.

### Drachenei (später, als Option)

Neben jedem Herrn liegt ein Ei, das nach einer festen Zahl Runden schlüpft; der Jungdrache hat je Haus eine eigene Fähigkeit. Anders als in Fassung 1 beschleunigen Fanfaren das Schlüpfen zunächst nicht, damit nicht Decks mit vielen Fanfaren im Vorteil sind. Erfordert neue `ruleVersion`, Bot-Bewertung und Prüfstand; bleibt nur, wenn die Balance dort hält.

## Jugendschutz und Barrierefreiheit

- **Kein Alkohol:** Keine Krüge und kein Met im Bild; die Taverne schenkt Kakao und Kräutertee aus.
- **Kein Glücksspiel-Bild:** Keine Münzstapel als Gewinn, Poker bleibt bei Bohnen und Streichhölzern.
- **Keine Kaufanreize:** Weder Kartenpäckchen noch Zufallsbelohnungen. Die Knappen sind Spielregel, keine Währung.
- **Schlicht bleibt vollwertig:** Es ist das heutige Aussehen und wird nie abgeschafft.

## Schritte

Jeder Schritt auf eigenem Zweig mit `corepack pnpm check`, Blick im Browser und veröffentlicht erst auf „deploy“.

1. ✅ **Probe (31.10.2026):** Aussehen-Wahl, Tokens hell und dunkel, Kontrast-Test, Startseite; Taverne als Standard.
2. ✅ **Rahmen fertig (31.10.2026):** Schrift, Lobby, Siegerehrung, Fläche um das Spielfeld, Korrekturen einzelner Spiele. Test am Handy und am Beamer.
3. **Drachenspiel-Thema:** Begriffe, Wimpel, Knappen, Wappenrahmen, Turnierplatz. Keine Regeländerung, unabhängig von 1 und 2.
4. **Nach Wunsch einzeln:** Wirtin, Klänge und Playlist, gemalte Karten, Drachenei.

## Offene Fragen an Cornelius

- [ ] Wortschatz: Passen Knappen, Meisterstoß und Prunkschild, oder soll die Magie aus Fassung 1 bleiben?
- [ ] Wimpel statt Burgmauer im Drachenspiel: einverstanden?
- [ ] Name im Spiel: „Gasthaus“ oder „Taverne“, und soll es „Zum Brett & Blatt“ heißen?
- [ ] Welcher Strang zuerst: Probe der Taverne oder Drachenspiel-Thema?
