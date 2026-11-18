#!/usr/bin/env bash
# Holt und baut die Werkzeugkette für Brett & Blatt 16 (einmal je Rechner, danach aus dem Zwischenspeicher):
#   - PVSnesLib (C-Compiler 816-tcc, Assembler WLA-DX, Bibliothek, Wandler) in fester Version
#   - Snes9x als libretro-Kern und der Prüf-Emulator (werkzeuge/emu/emu.c) für die Tests
#   - bsnes als zweiter, sehr genauer Kern (Vergleich der Bilder)
#
#   apps/snes/werkzeuge/werkzeugkette.sh            # baut, gibt die Umgebungsvariablen aus
#   eval "$(apps/snes/werkzeuge/werkzeugkette.sh)"  # … und setzt sie in der Shell
#
# Ziel: $SNES_WERKZEUGE (Standard ~/.cache/brett-und-blatt-snes). Braucht git, make, gcc/g++.
set -euo pipefail

PVSNESLIB_VERSION=4.7.1
SNES9X_VERSION=1.63
# bsnes für libretro hat keine Versionsmarken; darum ein fester Commit.
BSNES_STAND=63ee22f7af8f5d1ada295c2c98fd7bf261fa62a7

ZIEL=${SNES_WERKZEUGE:-$HOME/.cache/brett-und-blatt-snes}
HIER=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
JOBS=$(nproc 2>/dev/null || echo 2)
mkdir -p "$ZIEL"
log() { echo "$*" >&2; }

if [ ! -f "$ZIEL/pvsneslib/.fertig-$PVSNESLIB_VERSION" ]; then
  log "PVSnesLib $PVSNESLIB_VERSION holen und bauen …"
  rm -rf "$ZIEL/pvsneslib"
  git -c advice.detachedHead=false clone -q --depth 1 --branch "$PVSNESLIB_VERSION" --recurse-submodules --shallow-submodules \
    https://github.com/alekmaul/pvsneslib "$ZIEL/pvsneslib" >&2
  (cd "$ZIEL/pvsneslib" && PVSNESLIB_HOME="$ZIEL/pvsneslib" make -j"$JOBS" compiler tools pvsneslib >"$ZIEL/pvsneslib-bau.log" 2>&1) ||
    { tail -30 "$ZIEL/pvsneslib-bau.log" >&2; exit 1; }
  touch "$ZIEL/pvsneslib/.fertig-$PVSNESLIB_VERSION"
fi

if [ ! -f "$ZIEL/snes9x/.fertig-$SNES9X_VERSION" ]; then
  log "Snes9x $SNES9X_VERSION (libretro-Kern) holen und bauen …"
  rm -rf "$ZIEL/snes9x"
  git -c advice.detachedHead=false clone -q --depth 1 --branch "$SNES9X_VERSION" https://github.com/snes9xgit/snes9x "$ZIEL/snes9x" >&2
  (cd "$ZIEL/snes9x/libretro" && make -j"$JOBS" >"$ZIEL/snes9x-bau.log" 2>&1) ||
    { tail -30 "$ZIEL/snes9x-bau.log" >&2; exit 1; }
  touch "$ZIEL/snes9x/.fertig-$SNES9X_VERSION"
fi

# Den Prüf-Emulator bei jeder Änderung an emu.c neu übersetzen (dauert unter einer Sekunde).
if [ ! -x "$ZIEL/emu" ] || [ "$HIER/emu/emu.c" -nt "$ZIEL/emu" ]; then
  log "Prüf-Emulator übersetzen …"
  gcc -O2 -Wall -o "$ZIEL/emu" "$HIER/emu/emu.c" -I "$ZIEL/snes9x/libretro" -ldl
fi

if [ ! -f "$ZIEL/bsnes/.fertig-$BSNES_STAND" ]; then
  log "bsnes (libretro-Kern) holen und bauen …"
  rm -rf "$ZIEL/bsnes"
  git init -q "$ZIEL/bsnes"
  git -C "$ZIEL/bsnes" fetch -q --depth 1 https://github.com/libretro/bsnes "$BSNES_STAND" >&2
  git -C "$ZIEL/bsnes" checkout -q FETCH_HEAD
  (cd "$ZIEL/bsnes" && make -j"$JOBS" target=libretro binary=library >"$ZIEL/bsnes-bau.log" 2>&1) ||
    { tail -30 "$ZIEL/bsnes-bau.log" >&2; exit 1; }
  touch "$ZIEL/bsnes/.fertig-$BSNES_STAND"
fi

echo "export PVSNESLIB_HOME=$ZIEL/pvsneslib"
echo "export SNES_EMU=$ZIEL/emu"
echo "export SNES_KERN=$ZIEL/snes9x/libretro/snes9x_libretro.so"
echo "export SNES_KERN_BSNES=$ZIEL/bsnes/bsnes_libretro.so"
