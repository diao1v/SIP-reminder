import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**/*.ts', 'src/utils/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/routes/**',
        'src/index.ts',
      ],
    },
  },
});
