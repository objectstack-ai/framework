import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Temporarily disabled due to PluginContext type resolution issues
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  external: ['@objectstack/driver-turso'],
});
