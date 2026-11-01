# Wer bin ich?

*Ratespiel für 3–10 Spieler: Alle sehen den Begriff der anderen, nur den eigenen nicht – mit Ja-Nein-Fragen kommt man ihm auf die Spur.*

| Steckbrief | |
|---|---|
| Spieler | 3–10 |
| Modi | Allein gegen Bots (Katalog-Modus), Hot-Seat, online |
| Muster | verdeckt (der eigene Begriff), Antworten per Abstimmung |
| Bausteine | `vote.ts`, `WordInput`, `words.ts` (`findWord` für freie Rateversuche), `loadCatalog` |
| Ordner | `packages/games/who-am-i`, Kataloge in `content/wortspiele/wer-bin-ich.json` |

## Regeln

- Jeder bekommt einen anderen Begriff aus dem Paket (Tiere, Berufe, Bibel). Reihum stellt man bis zu **3 Fragen je Zug** über sich selbst oder rät.
- **Katalog-Modus** (Standard): Fragen aus einer festen Liste; die Antwort ergibt sich aus den Eigenschaften des Begriffs (`yes[]`). So können Bots mitspielen und antworten.
- **Freier Modus** (am Tisch, im Klassenzimmer): Man stellt die Frage laut; die anderen antworten mit Ja / Nein / Vielleicht, die Mehrheit zählt (Gleichstand → Vielleicht). Geraten wird mit freier Eingabe, die gegen Namen und Aliasse geprüft wird. Falsche Rateversuche werden ohne Text gespeichert – es gibt keinen freien Chat.
- Richtig geraten: Punkte = übrige Züge (bei 12 Zügen: im 3. Zug geraten → 9 Punkte). Falsch geraten beendet den Zug. Die Partie endet, wenn alle geraten haben oder die Züge aufgebraucht sind.

## Optionen

Paket (Tiere, Berufe, Bibel), Modus (Katalog/frei), Züge je Spieler (8/12/20).

## Spielmodell und Geheimnisse

Phasen `ask` → (`answer` im freien Modus) → `done`. Züge `ask`, `askAloud`, `guess`, `guessText`, `pass`, `answer`. Die Sicht verbirgt den eigenen Begriff (`terms[viewer] = null`), `sampleHidden` wählt einen der noch möglichen Begriffe (`candidates()`).

## Bot „Spürnase“

Hält die Menge der noch möglichen Begriffe und wählt die Frage, die sie am gleichmäßigsten teilt (schwer); mittel und leicht fragen weniger geschickt und raten früher. Als Antwortgeber sagt er die Wahrheit aus dem Katalog; laut gestellte Fragen kann er nicht hören und enthält sich. Der schwere Bot löst im Test jedes Tier.

## Oberfläche

Stirnkarten aller Spieler (eigene mit ❓), Fragenliste als Knöpfe in eigenem Rollbereich, Raten-Raster (vergebene und schon falsch geratene Begriffe gesperrt), Verlauf der eigenen Fragen und der Fragen des Spielers am Zug. Klassenpräfix `wbi-`.

## Umsetzung (1.11.2026)

Regeln, Bot, Oberfläche, Tests (`test/who-am-i.test.ts`), Prüfstand. Kataloge (Tiere 34, Berufe 27, Bibel 33 Begriffe) sind ein **Entwurf** und warten auf Cornelius' Durchsicht; sie kommen vom Spieleserver (`GET /wortspiele/wer-bin-ich`), Rückfall `wortspiele/wer-bin-ich.json`.

## Offene Punkte

- Begriffe und Eigenschaften durchsehen (Cornelius); jede Eigenschaft muss für jeden Begriff eindeutig Ja oder Nein sein.
