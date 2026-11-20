import type { SaladCategory, StemEntry } from './words';

/**
 * Weitere Stammwörter (9–16 Buchstaben) je Wortpaket. Die gültigen Teilwörter kommen aus dem
 * Prüf-Wörterbuch (`dictionary.ts`), deshalb brauchen diese Einträge keine eigene Teilwortliste.
 * Jedes Stammwort muss mindestens 15 Teilwörter ergeben (prüft `test/word-salad.test.ts`).
 *
 * Format je Zeile: `Stammwort | Hinweis`
 */
const RAW: Record<SaladCategory, string> = {
  mix: `
    Geburtstag | Ein Tag mit Kuchen und Kerzen
    Klassenzimmer | Hier findet Unterricht statt
    Spielplatz | Mit Rutsche, Schaukel und Sandkasten
    Zahnbürste | Morgens und abends im Bad
    Achterbahn | Rasante Fahrt auf dem Rummelplatz
    Turnschuhe | Für den Sportunterricht
    Schatzkiste | Voll mit Gold und Edelsteinen
    Fahrradhelm | Schützt den Kopf beim Radfahren
    Pausenhof | Hier wird in der Pause gespielt
    Schulranzen | Trägt man morgens auf dem Rücken
    Hausaufgaben | Erledigt man nachmittags am Schreibtisch
    Sporthalle | Hier wird geturnt und Ball gespielt
    Feuerwehrauto | Rot, mit Leiter und Blaulicht
    Schwimmbad | Mit Becken und Sprungturm
    Kinderzimmer | Hier schläft und spielt man
    Weihnachtsbaum | Wird im Dezember geschmückt
    Osterhase | Versteckt bunte Eier
    Adventskranz | Vier Kerzen bis Weihnachten
    Fernbedienung | Damit schaltet man den Fernseher um
    Kartoffelsalat | Beliebt beim Grillfest
    Pfannkuchen | Aus Mehl, Milch und Eiern
    Marmelade | Süßer Aufstrich aus Früchten
    Gummibärchen | Bunte, weiche Süßigkeit
    Ritterburg | Mit Türmen, Zinnen und Burggraben
    Zauberstab | Werkzeug für Zaubertricks
    Piratenschiff | Mit Totenkopfflagge auf dem Meer
    Raumstation | Kreist um die Erde
    Astronautin | Fliegt ins Weltall
    Trampolin | Darauf springt man hoch
    Schneemann | Hat eine Karottennase
    Reisekoffer | Wird für den Urlaub gepackt
    Lieblingsbuch | Das liest man am liebsten
    Bilderrahmen | Hält ein Foto an der Wand
    Sonnenbrille | Schützt die Augen vor grellem Licht
    Kuscheltier | Weich und zum Knuddeln
    Briefmarke | Klebt man auf einen Umschlag
    Strandkorb | Sitzplatz am Meer
    Tischtennis | Mit Schläger, Ball und Netz
    Musikinstrument | Damit macht man Musik
    Leuchtturm | Zeigt Schiffen nachts den Weg
  `,
  natur: `
    Regenwurm | Lebt in der Erde und lockert sie auf
    Löwenzahn | Gelbe Wiesenblume, später Pusteblume
    Marienkäfer | Rot mit schwarzen Punkten
    Schneeflocke | Weiß und kalt, fällt im Winter
    Sternschnuppe | Leuchtet kurz am Nachthimmel auf
    Gewitterwolke | Dunkel, mit Blitz und Donner
    Tannenzapfen | Hängt an Nadelbäumen
    Regenbogen | Bunter Bogen nach dem Regen
    Wasserfall | Hier stürzt ein Fluss in die Tiefe
    Sonnenuntergang | Am Abend färbt sich der Himmel rot
    Blumenwiese | Bunt und voller Bienen
    Kastanienbaum | Seine Früchte sammelt man im Herbst
    Maulwurfshügel | Erdhaufen auf der Wiese
    Honigbiene | Sammelt Nektar und macht Honig
    Ameisenhaufen | Zuhause von vielen Krabbeltieren
    Fledermaus | Fliegt nachts und hängt kopfüber
    Seepferdchen | Kleiner Fisch mit Pferdekopf
    Schildkröte | Trägt ihr Haus auf dem Rücken
    Gänseblümchen | Kleine weiße Blume auf dem Rasen
    Brennnessel | Diese Pflanze brennt auf der Haut
    Sonnenstrahl | Wärmt und macht hell
    Laubfrosch | Kleiner grüner Kletterer
    Kaulquappe | Daraus wird ein Frosch
    Waldameise | Krabbelt über den Waldboden
    Apfelbaum | Trägt im Herbst rote Früchte
    Kirschblüte | Rosa Blüten im Frühling
    Herbstlaub | Bunte Blätter im Oktober
    Gletscher | Riesiger Eisstrom im Gebirge
    Nachtigall | Singvogel mit schöner Stimme
    Sonnenblumenkern | Leckerer Snack für Vögel
    Regenwald | Tropischer Wald voller Tiere
    Meeresstrand | Sand, Wellen und Muscheln
    Wiesenblume | Wächst wild auf der Weide
    Rotkehlchen | Vogel mit orangeroter Brust
    Vulkaninsel | Entstanden aus Lava
    Pusteblume | Ihre Samen fliegen im Wind
  `,
  mathe: `
    Geodreieck | Lineal und Winkelmesser in einem
    Dezimalzahl | Eine Zahl mit Komma
    Primzahlen | Nur durch 1 und sich selbst teilbar
    Winkelmesser | Misst Winkel in Grad
    Kreisfläche | Wird mit Pi und Radius berechnet
    Quadratzahl | Eine Zahl mal sich selbst
    Rechenschieber | Altes Rechenwerkzeug
    Parallelogramm | Viereck mit zwei Paar parallelen Seiten
    Achsenspiegelung | Spiegelt eine Figur an einer Geraden
    Mittelpunkt | Liegt genau in der Mitte
    Flächeninhalt | Wird in Quadratzentimetern gemessen
    Grundrechenarten | Plus, minus, mal und geteilt
    Taschenrechner | Rechnet auf Knopfdruck
    Zahlenstrahl | Darauf sind Zahlen der Reihe nach angeordnet
    Kommazahlen | Zum Beispiel 3,75
    Teilbarkeit | Geht die Division ohne Rest auf?
    Einmaleins | Muss man auswendig können
    Halbkreis | Die Hälfte eines Kreises
    Rechenaufgabe | Steht im Mathebuch
    Textaufgabe | Rechnen mit einer kleinen Geschichte
    Längeneinheit | Zum Beispiel Meter oder Kilometer
    Bruchteil | Ein Stück vom Ganzen
    Würfelnetz | Daraus kann man einen Würfel falten
    Quadratmeter | Maß für Flächen
    Zentimeter | Hundertstel eines Meters
    Millimeter | Tausendstel eines Meters
    Symmetrieachse | Teilt eine Figur in zwei gleiche Hälften
    Spiegelachse | An ihr wird gespiegelt
    Prozentsatz | Anteil in Hundertsteln
    Stellenwerttafel | Einer, Zehner, Hunderter …
    Rauminhalt | Volumen eines Körpers
  `,
};

function parse(raw: string): StemEntry[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [display = '', hint = ''] = line.split('|').map((part) => part.trim());
      return { display, hint, subwords: [] };
    });
}

export const EXTRA_STEMS: Record<SaladCategory, readonly StemEntry[]> = {
  mix: parse(RAW.mix),
  natur: parse(RAW.natur),
  mathe: parse(RAW.mathe),
};
