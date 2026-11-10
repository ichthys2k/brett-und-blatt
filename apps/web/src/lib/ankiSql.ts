import type { ApkgDeps, SqlDb } from '@brett-und-blatt/engine';

/*
 * Verbindet die Paket-Logik der Engine mit sql.js (SQLite als WASM). Getrennt vom Laden der WASM-Datei, damit die Tests es in Node nutzen.
 */

export interface SqlJsDatabase {
  exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): { run(params?: unknown[]): void; free(): void };
  export(): Uint8Array;
  close(): void;
}
export interface SqlJsModule {
  Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase;
}

function wrap(db: SqlJsDatabase): SqlDb {
  return {
    all(sql, params) {
      const result = db.exec(sql, params)[0];
      if (!result) return [];
      return result.values.map((row) => Object.fromEntries(result.columns.map((name, i) => [name, row[i]])));
    },
    run: (sql, params) => db.run(sql, params),
    batch(sql, rows) {
      db.run('BEGIN');
      const statement = db.prepare(sql);
      try {
        for (const row of rows) statement.run(row);
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      } finally {
        statement.free();
      }
    },
    export: () => db.export(),
    close: () => db.close(),
  };
}

export function sqlDeps(SQL: SqlJsModule, unzstd: (bytes: Uint8Array) => Uint8Array, zstd?: (bytes: Uint8Array) => Uint8Array): ApkgDeps {
  return { open: (bytes) => wrap(new SQL.Database(bytes ?? null)), unzstd, ...(zstd ? { zstd } : {}) };
}
