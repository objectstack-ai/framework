import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  external: [
    '@objectstack/driver-turso',
    '@objectstack/driver-sql',
    '@objectstack/driver-memory',
    '@objectstack/objectql',
    '@objectstack/metadata',
    '@objectstack/plugin-auth',
    '@objectstack/plugin-security',
    '@objectstack/plugin-audit',
    '@objectstack/service-tenant',
    '@objectstack/service-package',
  ],
});
