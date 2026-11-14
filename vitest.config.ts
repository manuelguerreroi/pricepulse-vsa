import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.integration.spec.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'drizzle/**', '**/*.spec.ts', '**/*.integration.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@features': path.resolve(__dirname, './src/features'),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
