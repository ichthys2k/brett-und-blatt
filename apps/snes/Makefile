# Brett & Blatt 16 – SNES-ROM. Werkzeugkette: werkzeuge/werkzeugkette.sh (setzt PVSNESLIB_HOME).
PVSNESLIB_HOME ?= $(HOME)/.cache/brett-und-blatt-snes/pvsneslib
export PVSNESLIB_HOME

export ROMNAME := brett-und-blatt-16
export ROMTITLE := BRETT UND BLATT 16
# ROM mit SRAM und Batterie, 2 KB SRAM für die Statistik
export CARTRIDGETYPE := 02
export SRAMSIZE := 01

include $(PVSNESLIB_HOME)/devkitsnes/snes_rules

GRAFIK := res/kacheln_a.bin res/kacheln_b.bin res/karten.bin res/spielfarben.bin res/palette.bin res/grafik.h
KLAENGE := res/klick.brr res/setzen.brr res/start.brr res/sieg.brr res/ende.brr

.PHONY: all clean ressourcen
.DEFAULT_GOAL := all

all: ressourcen $(ROMNAME).sfc

ressourcen: $(GRAFIK) $(KLAENGE)

$(GRAFIK) &: werkzeuge/grafik.mjs werkzeuge/schrift8x8.mjs
	node werkzeuge/grafik.mjs res

res/%.wav: werkzeuge/klang.mjs
	node werkzeuge/klang.mjs res

# Alle Objekte hängen von den erzeugten Dateien ab (Kachelnummern in grafik.h, Daten in data.asm).
$(OFILES): $(GRAFIK) $(KLAENGE) $(wildcard src/*.h)

clean: cleanBuildRes cleanRom
	rm -rf res
