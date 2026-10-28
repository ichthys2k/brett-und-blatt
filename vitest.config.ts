import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/server/test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // Die Prüfungen für Spielmodule spielen viele ganze Partien durch.
    testTimeout: 60_000,
  },
});
