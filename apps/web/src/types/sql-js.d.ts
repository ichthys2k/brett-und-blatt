declare module 'sql.js' {
  interface Statement {
    run(params?: unknown[]): void;
    free(): void;
  }
  export interface Database {
    exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
    run(sql: string, params?: unknown[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
