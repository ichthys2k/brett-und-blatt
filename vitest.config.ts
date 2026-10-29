import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/server/test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // Der Bibel-Quiz-Katalog kommt im Betrieb vom Server; für alle Tests wird er einmal gesetzt.
    setupFiles: ['tests/katalog.ts'],
    // Die Prüfungen für Spielmodule spielen viele ganze Partien durch.
    testTimeout: 60_000,
  },
});
