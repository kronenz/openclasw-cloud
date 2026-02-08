import { defineConfig } from 'vitest/config';

// Separate config for Node-only tests (schema validation needs fs access)
export default defineConfig({
  test: {
    globals: true,
    include: ['tests/unit/db/schema.test.ts'],
    environment: 'node',
  },
});
