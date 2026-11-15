import type { HapticMap, HapticPattern } from '@brett-und-blatt/ui';

/**
 * Einzigartige Vibrationsmuster (in ms) für mächtige Kreaturen und Zauber im Drachenspiel.
 * Alle Muster bleiben insgesamt unter 300 ms, damit sie auf Mobilgeräten knackig wirken.
 */
export const CREATURE_HAPTICS: Record<string, HapticPattern> = {
  // Mythische Tiere
  c54: [75, 35, 110], // Drache: Flügelschlag + Feuerstoß
  sea_serpent: [35, 25, 55, 25, 70], // Seeschlange: anschwellende Tiefseewelle
  wild_oda: [80, 45, 80], // Elefantin Oda: majestätischer Doppelschritt
  f_grimbart: [25, 30, 35, 30, 55], // Grimbart der Alte: aufsteigender Waldsegen
  n_dragonmother: [50, 35, 25, 25, 25], // Drachenmutter: Landung + zwei Jungdrachen
  bug_mira: [15, 25, 15, 25, 60], // Spinnfrau Mira: Krabbeln + Frost-Ruck
  farm_musicians: [25, 25, 25, 25, 45], // Stadtmusikanten: vier Taktschläge
  n_phoenix: [30, 30, 45, 30, 75], // Phönix: aufflammend aus der Asche
  n_lindworm: [65, 30, 45], // Lindwurm: Anlauf + Biss
  n_basilisk: [30, 40, 50], // Basilisk: versteinernder Blick
  farm_goldgoose: [35, 30, 55], // Goldene Gans: goldenes Glänzen
  c53: [20, 20, 45], // Fuchs: flinker Sprung
  n_unicorn: [20, 30, 40, 30, 20], // Einhorn: symmetrischer Heil-Impuls
  n_hippogriff: [20, 20, 45], // Hippogryph: Sturzflug

  // Große Riesen & seltene 6+-Mana-Tiere
  wild_mammoth: [70, 40, 70], // Mammut: schweres Stampfen
  sea_whale: [120, 50, 60], // Blauwal: tiefes Eintauchen
  c48: [70, 40, 70], // Elefant: schweres Stampfen
  c49: [25, 20, 75], // Nashorn: Anlauf + Aufprall
  c50: [75], // Nilpferd: massiver Aufschlag
  f_moose: [75], // Elch: wuchtiger Auftritt
  f_oakgiant: [75], // Eichenriese: schwerer Wurzeltritt
  n_giant: [75], // Waldriese: schwerer Tritt
  sea_narwhal: [45, 30, 20, 20], // Narwal: Eisstoß + Klirren

  // Geschlüpfte Drachen & Aufgaben-Belohnungen
  token_eggdragon: [20, 40, 30, 40, 80], // Eidrache: Schale knackt -> Ausbruch
  dragon_forest: [20, 35, 50], // Grüner Jungdrache
  dragon_sea: [20, 35, 50], // Blauer Jungdrache
  dragon_farm: [20, 35, 50], // Goldener Jungdrache
  dragon_wild: [20, 35, 50], // Roter Jungdrache
  dragon_bugs: [20, 35, 50], // Violetter Jungdrache
  token_elder: [75], // Wächter des Hains
  token_krake: [30, 25, 30, 25, 60], // Riesenkrake: Tentakelschläge
  token_prize: [25, 20, 75], // Preisbulle: Ansturm
  token_warlord: [35, 30, 55], // Herrin der Steppe
  token_swarmqueen: [15, 20, 15, 20, 15, 20, 40], // Schwarmkönigin: Bienenschwarm + Königin
};

export const SPELL_HAPTICS: Record<string, HapticPattern> = {
  s_lightning: [15, 20, 65, 20, 20], // Blitzschlag: Zucken – Einschlag – Nachgrollen
  n_ballbolt: [20, 25, 35, 25, 35], // Kugelblitz: zwei hüpfende Einschläge
  n_dragonbreath: [85, 30, 55], // Drachenatem: breiter Feuerstoß
  wild_grassfire: [30, 20, 45, 20, 60], // Steppenwind: hinwegfegende Böe
  s_whirlwind: [25, 20, 35, 20, 45, 20, 25], // Wirbelsturm: kreisender Wirbel
  sea_maelstrom: [25, 20, 35, 20, 45, 20, 25], // Strudel: kreisender Sog
  s_flood: [45, 25, 75], // Flutwelle: anrollende, brechende Welle
  bug_fog: [20, 35, 20, 35, 25], // Giftnebel: schleichendes Prickeln
  s_frost: [15, 25, 15], // Raureif: kurzes Eisklirren
  f_call: [35, 30, 35, 30, 35], // Waldruf: drei Hornstöße
  farm_harvest: [15, 25, 20, 25, 30], // Erntedank: sanftes Wachsen
  s_summerRain: [15, 25, 20, 25, 30], // Sommerregen: sanftes Prasseln
};

function cardIdOf(event: unknown, key: 'card' | 'minion'): string | null {
  if (!event || typeof event !== 'object') return null;
  const obj = (event as Record<string, unknown>)[key];
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.cardId === 'string') return record.cardId;
  if (typeof record.id === 'string') return record.id;
  return null;
}

export const DRACHENSPIEL_HAPTICS: HapticMap = {
  cardPlayed: (event) => {
    const id = cardIdOf(event, 'card');
    return id ? (CREATURE_HAPTICS[id] ?? null) : null;
  },
  minionSummoned: (event) => {
    const id = cardIdOf(event, 'minion');
    return id ? (CREATURE_HAPTICS[id] ?? null) : null;
  },
  minionAwoke: (event) => {
    const id = cardIdOf(event, 'minion');
    return id ? (CREATURE_HAPTICS[id] ?? null) : null;
  },
  spellCast: (event) => {
    const id = cardIdOf(event, 'card');
    return id ? (SPELL_HAPTICS[id] ?? null) : null;
  },
  trapSprung: [45, 30, 25],
};
