import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/unit/db/schema.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/templates/**'],
      reporter: ['text', 'json-summary'],
    },
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2026-02-08',
          compatibilityFlags: ['nodejs_compat'],
        },
        wrangler: {
          configPath: './infra/wrangler.toml',
        },
      },
    },
  },
});
