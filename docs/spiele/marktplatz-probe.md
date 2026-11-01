# Marktplatz – Bericht zur Bot-Probe (1.11.2026)

Probe vor dem Bau (W-041). Das Skript `scripts/marktplatz-probe.mjs` spielt die Regeln aus [`marktplatz.md`](marktplatz.md) ohne Oberfläche durch: je Fall 3000 Partien, alle Spielerzahlen (2–6) und Dauern (2, 3, 4 Jahre). Gebaut wird erst nach Cornelius' Ja.

```bash
node scripts/marktplatz-probe.mjs                  # Zahlen des Plans
node scripts/marktplatz-probe.mjs --set=angepasst  # Vorschlag
node scripts/marktplatz-probe.mjs --compare        # Fassungen im Vergleich
```

## Ergebnis in Kürze

| Ziel oder Frage | Plan | Vorschlag |
| --- | --- | --- |
| Keine Zunft klar besser (gezielt verfolgt, fair 25 %) | ✅ 22–27 % | ✅ 23–26 % |
| Startplatz höchstens etwa 5 Prozentpunkte vom fairen Wert | 🟡 bis 5,2 | ✅ bis 3,3 |
| Partien mit Schuldschein (4 Spieler, 3 Jahre) | ❌ 44 % | 🟡 15 % |
| Partien mit Schuldschein (6 Spieler, 4 Jahre) | ❌ 94 % | ❌ 63 % |
| Vorsprung des Siegers auf den Zweiten (4 Spieler, 3 Jahre) | 41 Brezeln | 30 Brezeln |
| Handel je Partie (4 Spieler, 3 Jahre) | ❌ 0,0 | 🟡 0,6 |
| Krämer gegen drei Zufallsbots (fair 25 %) | 39 % | 56 % |

Das Spiel funktioniert und ist bei den Zünften fair. Mit den Zahlen des Plans ist aber zu wenig Geld im Umlauf: Der Durchschnitt der Kasse liegt bei 8 Brezeln, ein Zunfthaus kostet bis zu 14 Ware, und Schuldscheine werden vom Ausnahmefall zum Normalfall. Außerdem verdrängt die Zunftpartnerschaft den Handel fast vollständig.

## Die wichtigsten Befunde

### 1. Zu wenig Geld im Umlauf

Bei den Zahlen des Plans kommen Schuldscheine je nach Tischgröße und Dauer in bis zu 94 % der Partien vor. Der Grund ist die Höhe der Ware gegenüber dem Einkommen: Eine Runde ums Brett bringt nur 3 Brezeln, ein Zunfthaus der Steinmetze kostet den Besucher 14. Weil Betriebe und Bauten am Ende zum vollen Preis zählen, ist Anlegen außerdem fast verlustfrei, also liegt immer wenig in der Kasse.

### 2. Die Zunftpartnerschaft verdrängt den Handel

Sobald zwei Familien eine Zunft unter sich aufteilen, ist die Partnerschaft kostenlos und hat nur Vorteile, also schließt sie jeder sofort. Ergebnis: 3,1 Partnerschaften, aber 0,0 Handel je Partie, und nur 0,4 ganze Zünfte. Das ist nur teilweise eine Schwäche des Bots, denn auch für Menschen gibt es dann kaum einen Grund, zu kaufen oder zu tauschen.

Vergleich bei 4 Spielern und 3 Jahren:

| Fassung (Plan-Zahlen) | Handel | Partnerschaften | ganze Zünfte | Abstand 1.–2. | Schuldscheine |
| --- | --- | --- | --- | --- | --- |
| mit Partnerschaft | 0,0 | 3,1 | 0,4 | 41 | 45 % |
| ohne Partnerschaft | 1,0 | 0 | 1,6 | 32 | 22 % |

Partnerschaften treiben auch die Schuldscheine, denn sie bringen viel mehr Bauten aufs Brett (10,8 statt 4,8). Da die Partnerschaft bestätigt und ein Kern des Spiels ist, schlage ich vor, sie zu behalten, aber nur der Familie mit zwei Betrieben das Angebot zu erlauben. Dann versucht sie zuerst zu kaufen.

### 3. Die Zünfte sind fair, mit einem Vorbehalt

Verfolgt ein Platz in einer normalen Partie gezielt eine Zunft, gewinnt er 22–27 % (Plan) oder 23–26 % (Vorschlag), fair wären 25 %. Damit ist das Ziel erreicht.

**Vorbehalt:** Startet ein Platz dagegen schon mit einer ganzen Zunft (zum Listenpreis, Startgeld 60), liegen die mittleren Zünfte vorn:

| Zunft | Bäcker | Weber | Imker | Schuster | Schmiede | Steinmetze |
| --- | --- | --- | --- | --- | --- | --- |
| Siegquote Plan | 41 % | 56 % | 65 % | 72 % | 56 % | 36 % |
| Siegquote Vorschlag | 39 % | 55 % | 55 % | 66 % | 57 % | 44 % |

Eine solche Startstellung kommt im Spiel nicht vor, deshalb werte ich das nicht als Fehler. Es zeigt aber, dass Schuster die beste Mischung aus bezahlbar und einträglich sind. Das sollte im Bau noch einmal geprüft werden. Auch „Sieg, wenn die Zunft ganz ist“ steigt mit dem Preis (Bäcker 35 %, Steinmetze 60–79 %). Das misst aber vor allem, dass nur Reiche sich teure Zünfte leisten können, und ist keine Ursache.

### 4. Der Startplatz wirkt erst an großen Tischen

Bis 4 Spieler bleibt alles innerhalb von 3,3 Prozentpunkten. Zu sechst gewinnt Platz 1 im Plan 21–22 % statt 16,7 %, weil er zuerst an die freien Betriebe kommt. Ein Ausgleich von +1 Brezel Startgeld je späterem Platz senkt die Abweichung auf höchstens 3,3 Prozentpunkte.

### 5. Hofnachrichten wirken kaum auf die Balance

Mit und ohne Hofnachrichten ändert sich fast nichts (Abstand 1.–2.: 41 gegen 40 Brezeln; Schuldscheine: 45 % gegen 40 %). Sie sind also für die Abwechslung da, stören aber auch nicht. Bleiben.

### 6. Dauer

Züge je Partie = Runden mal Spieler. Die Minuten sind eine **Schätzung** mit 20 Sekunden je Zug und nicht gemessen.

| Spieler | 2 Jahre | 3 Jahre | 4 Jahre |
| --- | --- | --- | --- |
| 2 | 32 Züge, etwa 11 min | 48, etwa 16 min | 64, etwa 21 min |
| 4 | 64, etwa 21 min | 96, etwa 32 min | 128, etwa 43 min |
| 6 | 96, etwa 32 min | 144, etwa 48 min | 192, etwa 64 min |

Das Ziel von 30–45 Minuten passt also zu 4 Spielern und 3 Jahren. Zu sechst sollte die Voreinstellung 2 Jahre sein. Dazu kommen die Schuldscheine: 6 Spieler über 4 Jahre haben sie auch im Vorschlag noch in 63 % der Partien.

## Vorschlag

| Zahl oder Regel | Plan | Vorschlag |
| --- | --- | --- |
| Startkapital | 30 | 40, dazu +1 je späterem Platz |
| Marktgeld am Stadttor | 3 | 5 |
| Partnerschaft anbieten | beide | nur wer zwei Betriebe der Zunft hat |
| Voreinstellung Dauer | 3 Jahre | 3 Jahre, ab 5 Spielern 2 Jahre |

Ware (ohne Bau / Werkstatt / Zunfthaus):

| Zunft | Plan | Vorschlag |
| --- | --- | --- |
| Bäcker | 1 / 2 / 4 | 1 / 2 / 3 |
| Weber | 1 / 3 / 6 | 1 / 3 / 5 |
| Imker | 2 / 4 / 8 | 2 / 4 / 6 |
| Schuster | 2 / 5 / 10 | 2 / 5 / 8 |
| Schmiede | 3 / 6 / 12 | 3 / 6 / 9 |
| Steinmetze | 3 / 7 / 14 | 3 / 7 / 11 |

Bei „Königsbesuch“ müsste das Marktgeld dann über 5 liegen (der Plan hat 6 statt 3); die Probe rechnet noch mit festen 6. Vor dem Bau auf 8 setzen oder auf „doppelt“ ändern.

## Was sich jede Anpassung bringt (4 Spieler, 3 Jahre)

Die Zeilen bauen aufeinander auf, je 2000 Partien.

| Fassung | Abstand 1.–2. | Schuldscheine | Handel | ganze Zünfte | Bauten | größte Platz-Abweichung bei 2 / 4 / 6 Spielern |
| --- | --- | --- | --- | --- | --- | --- |
| Plan | 41 | 44 % | 0,0 | 0,4 | 11,0 | 2,6 / 3,2 / 4,4 |
| Partnerschaft nur vom Zweier-Halter (und vorsichtigerer Bot) | 39 | 41 % | 0,2 | 0,6 | 10,3 | 2,8 / 3,6 / 4,4 |
| dazu Start 40, Marktgeld 5 | 35 | 22 % | 0,6 | 1,1 | 14,7 | 1,2 / 4,5 / 5,6 |
| dazu Platz-Ausgleich +1 | 33 | 20 % | 0,6 | 1,1 | 15,0 | 1,9 / 3,1 / 2,4 |
| dazu Zunfthaus milder (= Vorschlag) | 30 | 16 % | 0,6 | 1,1 | 15,3 | 2,0 / 3,1 / 2,1 |
| Vorschlag, aber ohne Partnerschaft und ohne die Ware-Änderung | 28 | 7 % | 2,0 | 2,6 | 10,2 | 3,0 / 1,8 / 2,0 |

Die letzte Zeile ist nur zum Vergleich da: Ohne Partnerschaft wäre das Spiel ruhiger, und es würde mehr gehandelt. Sie würde aber einen der fünf Punkte streichen, die das Spiel von Monopoly unterscheiden, also schlage ich das nicht vor.

## Was die Probe nicht zeigt

- **Die Bots sind einfach.** Der Krämer folgt festen Faustregeln. Menschen verhandeln, bluffen und drohen. Besonders der Handel ist deshalb nur eine Untergrenze und kann mit Menschen ganz anders aussehen.
- **Spielspaß wird nicht gemessen,** nur Zahlen. Ob sich der große Vorsprung des Siegers schlecht anfühlt, zeigt erst eine echte Partie.
- **Messgenauigkeit:** Bei 3000 Partien schwankt eine Siegquote von 25 % um etwa ±1,6 Prozentpunkte. Kleine Unterschiede zwischen den Zeilen sind also Zufall. Die „größte Abweichung“ fällt dadurch auch etwas zu hoch aus.
- **Bot-Änderung im Vorschlag:** Im Vorschlag hält der Krämer zusätzlich mehr Rücklage. Allein bewirkte das in der Vergleichsmessung fast nichts, die Verbesserung kommt also von den Zahlen.

## Festlegungen, die der Plan offen ließ

Diese Auslegungen stecken im Skript und gelten, bis Cornelius anders entscheidet:

- Schuldscheine bei der Stadt (Steuern, Karten) gehen bei der Wertung nur vom Vermögen des Schuldners ab.
- In einer Zunft mit verpfändetem eigenen Betrieb darf man nicht bauen.
- Doppelte Ware durch Hofnachricht und durch ganze Zunft wird multipliziert.
- Thronsaal: Der Bau zum halben Preis zählt bei der Wertung voll.
- Partnerschaften sind nicht mehr handelbar, ihre Betriebe auch nicht.
- Versteigerung wird nur reihum in Schritten von 1 Brezel gespielt, das verdeckte Einmalgebot ist nicht geprüft.

## Entscheidung (1.11.2026)

Cornelius hat den Vorschlag angenommen, gebaut in `packages/games/marketplace`.

**Nachtrag aus dem Bau:** Beim Einstellen der Bot-Stufen zeigte sich eine Lücke, die diese Probe nicht sehen konnte, weil ihre Bots kauften, wann immer sie konnten: Wer gezielt ablehnt, ersteigert Betriebe billig (im Schnitt 54 Brezeln für 94 Listenwert), und sie zählten voll. Deshalb zählen ersteigerte Betriebe jetzt mit dem gezahlten Preis. Das Skript hier bildet das nicht ab; seine Zahlen stammen von vor dieser Änderung. Außerdem: Königsbesuch gibt doppeltes Marktgeld (10), nicht mehr feste 6.

**Bot-Stufen im fertigen Spiel** (je 400 Partien, nicht aus diesem Skript): Zu viert gewinnt „mittel“ gegen drei „leicht“ 72 % und „schwer“ 72 % (fair 25 %). Zu zweit sind es nur 52 % und 55 %. „Schwer“ ist gegen „mittel“ nicht messbar stärker (zu zweit 47 %, zu viert 22 %).
