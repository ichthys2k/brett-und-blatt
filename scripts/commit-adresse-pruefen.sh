#!/usr/bin/env bash
# Prüft, dass jeder neue Commit Cornelius' Noreply-Adresse als Autor und Committer trägt.
# Aufruf: scripts/commit-adresse-pruefen.sh <von> <bis>  (prüft die Commits von..bis)
# Ohne gültiges <von> (z. B. lauter Nullen bei einem neuen Zweig) wird nur <bis> geprüft.
# Erlaubt ist als Committer zusätzlich GitHub selbst (Merge- und Squash-Commits aus der Weboberfläche).
set -euo pipefail

ADRESSE='855814+ichthys2k@users.noreply.github.com'
GITHUB_ADRESSE='noreply@github.com'

von="${1:-}"
bis="${2:-HEAD}"

if [[ -n "$von" && ! "$von" =~ ^0+$ ]] && git cat-file -e "${von}^{commit}" 2>/dev/null; then
  bereich="${von}..${bis}"
else
  bereich="-1 ${bis}"
fi

fehler=0
# shellcheck disable=SC2086 # $bereich enthält absichtlich mehrere Argumente
while IFS='|' read -r sha autor committer; do
  if [[ "$autor" != "$ADRESSE" ]]; then
    echo "::error::Commit ${sha:0:7}: Autor-Adresse ist <$autor>, erwartet <$ADRESSE>."
    fehler=1
  fi
  if [[ "$committer" != "$ADRESSE" && "$committer" != "$GITHUB_ADRESSE" ]]; then
    echo "::error::Commit ${sha:0:7}: Committer-Adresse ist <$committer>, erwartet <$ADRESSE>."
    fehler=1
  fi
done < <(git log --format='%H|%ae|%ce' $bereich)

if [[ $fehler -ne 0 ]]; then
  echo "Abhilfe: git config user.email $ADRESSE, dann die betroffenen Commits auf dem eigenen Zweig neu schreiben (z. B. git commit --amend --reset-author --no-edit)."
  exit 1
fi
echo "Alle Commit-Adressen in Ordnung ($bereich)."
