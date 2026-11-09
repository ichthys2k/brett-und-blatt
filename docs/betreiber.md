# Betreiber-Schlüssel

Für den Betreiber (Cornelius) gibt es kein Konto, sondern einen **Schlüssel**: ein langes Geheimwort, das als Secret im Spieleserver liegt. Er erlaubt zwei Aufräumbefehle per Kommandozeile und sonst nichts.

- **Einrichten (einmal):** `corepack pnpm --filter @brett-und-blatt/server exec wrangler secret put OPERATOR_KEY` und ein langes Zufallswort (mindestens 16 Zeichen, besser 40) eingeben – oder in Cloudflare unter Workers → Einstellungen → Variablen und Secrets. Lokal in `apps/server/.dev.vars`. **Nie** ins Repo, in einen Chat oder in einen Commit. Ohne das Secret gibt es die Endpunkte nicht (`404`).
- **Im Browser (9.11.2026):** Seite `https://spiele.lipponer.de/#/betreiber` (nirgends verlinkt). Schlüssel eingeben, „Anmelden und Turniere laden“ zeigt alle öffentlichen Turniere mit 🗑️ Löschen; darunter „Per Code löschen“ für Turniere (auch nicht öffentliche) und Klassen. Der Schlüssel bleibt nur im Speicher der Seite. Der Server liefert die Liste unter `GET /betreiber/liste`.
- **Turnier löschen (Kommandozeile):** `OPERATOR_KEY=… node apps/server/scripts/betreiber.mjs https://brett-und-blatt.lipponer.workers.dev turnier <Code>` (der Code steht in der Adresse der Turnierseite `#/turnier/<Code>`). Das Turnier verschwindet auch aus „Offene Runden“.
- **Klasse auflösen:** dasselbe mit `klasse` und dem Klassencode (sechs Emoji).
- **Was er nicht kann:** Ausweise, Sicherungen, Schlösser, geteilte Pässe oder Partien lesen oder ändern.
- **Schutz:** Falsche Schlüssel zählt der Server wie Fehlversuche beim Spielercode (Sperre je Absender). Jeder Löschbefehl steht ohne den Schlüssel im Protokoll des Workers (Art, Ziel, Zeit).
- **Schlüssel getauscht oder verloren:** neues Secret setzen, der alte gilt sofort nicht mehr.
