import { APKG_MAX_BYTES, ApkgError, buildApkg, readApkg, subsetCollection, type AnkiCollection, type ApkgData, type ApkgDeps } from '@brett-und-blatt/engine';
import zstdWasmUrl from '../../node_modules/@bokuweb/zstd-wasm/dist/web/zstd.wasm?url';
import { sqlDeps } from './ankiSql';

/*
 * Anki-Pakete im Browser (#101, L3): lädt SQLite (sql.js, WASM), ZIP (fflate) und zstd (fzstd) erst beim ersten Gebrauch – nichts davon
 * liegt im Hauptpaket oder im Vorab-Speicher der PWA. Packt aus und ein; die Logik steht in `packages/engine/src/anki/apkg/`.
 */

/** Obergrenze für alles, was beim Entpacken eines ZIP zusammenkommt (Schutz vor „Zip-Bomben“). */
const UNZIPPED_MAX = 250 * 1024 * 1024;

interface Libs {
  deps: ApkgDeps;
  unzipSync: typeof import('fflate').unzipSync;
  zipSync: typeof import('fflate').zipSync;
  startPacker(): Promise<void>;
}
let libs: Promise<Libs> | null = null;

function load(): Promise<Libs> {
  libs ??= (async () => {
    const [{ default: initSqlJs }, { default: wasmUrl }, fflate, { decompress }, zstd] = await Promise.all([
      import('sql.js'),
      import('sql.js/dist/sql-wasm.wasm?url'),
      import('fflate'),
      import('fzstd'),
      import('@bokuweb/zstd-wasm'),
    ]);
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    // Der zstd-Packer wird nur für das neue Paketformat gebraucht und erst dann gestartet.
    let packerReady: Promise<void> | null = null;
    const deps = sqlDeps(SQL, decompress, (bytes) => zstd.compress(bytes, 6));
    return { deps, unzipSync: fflate.unzipSync, zipSync: fflate.zipSync, startPacker: () => (packerReady ??= (zstd.init as (path?: string) => Promise<void>)(zstdWasmUrl)) };
  })();
  libs.catch(() => (libs = null));
  return libs;
}

export const APKG_LIMIT_TEXT = `${Math.round(APKG_MAX_BYTES / 1024 / 1024)} MB`;

/** Liest eine `.apkg`- oder `.colpkg`-Datei. Wirft `ApkgError` mit einer Meldung für die Oberfläche. */
export async function importApkg(bytes: Uint8Array): Promise<ApkgData> {
  if (bytes.length > APKG_MAX_BYTES) throw new ApkgError('tooBig', `Das Paket ist größer als ${APKG_LIMIT_TEXT}.`);
  const { deps, unzipSync } = await load();
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        total += file.originalSize;
        if (total > UNZIPPED_MAX) throw new ApkgError('tooBig', 'Das Paket ist entpackt viel zu groß.');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ApkgError) throw error;
    throw new ApkgError('corrupt', 'Das ist keine gültige Anki-Paketdatei (ZIP).');
  }
  try {
    return readApkg(files, deps);
  } catch (error) {
    if (error instanceof ApkgError) throw error;
    throw new ApkgError('corrupt', 'Das Paket konnte nicht gelesen werden. Es ist vermutlich beschädigt.');
  }
}

export interface ApkgExportInput {
  collection: AnkiCollection;
  /** Nur dieser Stapel samt Unterstapeln. */
  deckId?: number;
  cards?: ApkgData['cards'];
  revlog?: ApkgData['revlog'];
  media?: ApkgData['media'];
  conf?: ApkgData['conf'];
  dconf?: ApkgData['dconf'];
}

/** Baut eine `.apkg`-Datei (Standard: Format Legacy 2, `latest` ist kleiner und für neuere Anki-Versionen). */
export async function exportApkg(input: ApkgExportInput, options: { scheduling: boolean; media: boolean; format?: 'legacy2' | 'latest' }): Promise<Uint8Array> {
  const { deps, zipSync, startPacker } = await load();
  if (options.format === 'latest') await startPacker();
  const collection = input.deckId === undefined ? input.collection : subsetCollection(input.collection, input.deckId);
  const files = buildApkg({ collection, cards: input.cards ?? [], revlog: input.revlog ?? [], media: input.media ?? new Map(), conf: input.conf ?? null, dconf: input.dconf ?? null }, options, deps);
  // Medien sind schon gepackt (Bilder, Ton); Sammlung und Liste werden gepackt.
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, [data, { level: name.startsWith('collection') || name === 'media' ? 6 : 0 }]])));
}
