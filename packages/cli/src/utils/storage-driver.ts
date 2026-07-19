// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Storage-driver resolution for `objectstack serve`.
 *
 * Extracted from serve.ts so the driver dispatch is unit-testable in isolation
 * (mirrors utils/telemetry-datasource.ts and utils/plugin-detection.ts). Two
 * concerns:
 *
 *   1. {@link resolveDriverType} — pick a canonical driver KIND from the
 *      explicit `OS_DATABASE_DRIVER` override plus the `OS_DATABASE_URL` scheme.
 *   2. {@link createStorageDriver} — construct the concrete driver instance for
 *      that kind. Driver packages are dynamically imported so the CLI carries no
 *      static dependency on any one of them.
 *
 * ## #3276 — the `memory` driver was advertised but had no dispatch branch
 *
 * `os dev` / `os start` / `os serve` all advertise a `memory` driver
 * (`--database-driver memory`, `OS_DATABASE_DRIVER=memory`, and a `memory://`
 * URL scheme). But the old inline dispatch had no `memory` case, so selecting it
 * silently fell through to the dev SQLite `:memory:` default — SQLite-in-memory,
 * a *different* engine — or, in production, registered no driver at all. The
 * URL-inference and construction branches below close that "declared ≠ enforced"
 * gap: `memory` now yields the mingo `InMemoryDriver`, in dev AND production,
 * exactly as requested.
 *
 * Note the deliberate distinction from SQLite's own `:memory:` pseudo-file:
 * `OS_DATABASE_URL=:memory:` stays `sqlite` (SQLite's in-memory mode), whereas
 * the `memory://` scheme and the `memory` driver select the mingo engine.
 */

/** Engines the shared sqlite step-down (`resolveSqliteDriver`) can produce. */
export type SqliteFamilyEngine = 'better-sqlite3' | 'sqlite-wasm' | 'memory';

/**
 * Thrown by {@link createStorageDriver} when a driver kind is *recognized* but the
 * open-core CLI cannot construct it — currently `turso`/libSQL, which ships in the
 * ObjectStack cloud / enterprise distribution (`@objectstack/driver-turso`, an
 * extension of SqlDriver over `@libsql/client`), composed by the cloud runtime's
 * own kernel factory, not by open-core's auto driver-registration.
 *
 * The whole point of surfacing this as a *typed* error is so `serve.ts` can fail
 * LOUDLY (fatal) instead of letting the selection fall through to the SQLite
 * default. That silent fall-through is the same "declared ≠ enforced" bug as
 * #3276 (the CLI advertised `memory`/`turso` but had no dispatch branch, so both
 * silently became SQLite-in-memory).
 */
export class UnsupportedDriverError extends Error {
  readonly driverType: string;
  constructor(driverType: string, message: string) {
    super(message);
    this.name = 'UnsupportedDriverError';
    this.driverType = driverType;
  }
}

/**
 * Infer a canonical driver kind from an `OS_DATABASE_URL` scheme.
 * Returns `''` when the URL is absent or its scheme is unrecognized (the caller
 * then falls back to the dev default / registers nothing in production).
 */
export function inferDriverTypeFromUrl(url: string | undefined): string {
  if (!url) return '';
  const u = url.trim();
  if (/^mongodb(\+srv)?:\/\//i.test(u)) return 'mongodb';
  if (/^postgres(ql)?:\/\//i.test(u)) return 'postgres';
  if (/^mysql2?:\/\//i.test(u)) return 'mysql';
  // libSQL / Turso URLs are DELIBERATELY still classified as `turso` (not left
  // unrecognized). Open-core can't construct that driver, but classifying it
  // lets createStorageDriver fail LOUDLY with a clear cloud/EE message — if we
  // returned '' here instead, a `libsql://` URL would fall through to the SQLite
  // default and silently ignore the remote connection (the very bug we're fixing).
  if (/^libsql:\/\//i.test(u)) return 'turso';
  if (/^https?:\/\//i.test(u) && /\.turso\./i.test(u)) return 'turso';
  if (/^wasm-sqlite:\/\//i.test(u) || /\.wasm\.db$/i.test(u)) return 'sqlite-wasm';
  // #3276: the mingo in-memory engine has its own URL scheme (`memory://`,
  // advertised in `os dev` / `os start` help). Kept ABOVE the sqlite test so it
  // is not shadowed, and deliberately distinct from sqlite's `:memory:`
  // pseudo-file below (which stays SQLite's own in-memory mode).
  if (/^(memory|mingo):\/\//i.test(u)) return 'memory';
  if (/^file:/i.test(u) || /^sqlite:/i.test(u) || u === ':memory:' || /\.(db|sqlite|sqlite3)$/i.test(u)) return 'sqlite';
  return '';
}

/**
 * Combine the explicit `OS_DATABASE_DRIVER` override with URL-scheme inference
 * into the canonical driver kind. An explicit driver always wins over the URL.
 */
export function resolveDriverType(
  explicitDriver: string | undefined,
  databaseUrl: string | undefined,
): string {
  const explicit = (explicitDriver ?? '').toLowerCase().trim();
  return explicit || inferDriverTypeFromUrl(databaseUrl);
}

export interface CreateStorageDriverOptions {
  /** Raw `OS_DATABASE_URL` (scheme stripped per-branch as before). */
  databaseUrl?: string;
  /** Dev mode — enables the sqlite native→wasm→in-memory step-down + loosen-only auto-migrate. */
  isDev: boolean;
  /** Warning sink for the sqlite step-down banners (serve.ts wraps in `chalk.yellow`). */
  warn?: (message: string) => void;
}

export interface StorageDriverResolution {
  /** The concrete driver instance to wrap in `DriverPlugin` and register. */
  driver: unknown;
  /** Short name for the boot banner's plugin list (serve.ts `trackPlugin`). */
  trackName: string;
  /** Human label for the startup banner's "driver" row. */
  label: string;
  /** Display-shaped database URL for the startup banner (e.g. `(in-memory)`). */
  displayUrl: string | undefined;
  /** sqlite-family resolved engine, else undefined. Keys the telemetry-sibling guard. */
  engine?: SqliteFamilyEngine;
  /**
   * On-disk sqlite path the telemetry datasource is provisioned next to. Set
   * ONLY for the explicit `sqlite`/`sql` driver — never the dev-default
   * `:memory:` path — so serve.ts provisions the telemetry sibling exactly where
   * it did before this extraction.
   */
  sqliteFilePath?: string;
}

/**
 * Construct the storage driver for a canonical driver kind. Returns `null` when
 * nothing matches and we are NOT in dev (production with an unknown/absent
 * driver registers no driver, matching the prior inline behavior).
 *
 * Throws {@link UnsupportedDriverError} for `turso`/libSQL — a cloud/EE driver the
 * open-core CLI cannot construct. serve.ts surfaces that as a fatal, actionable
 * boot error so the selection never silently degrades to SQLite.
 *
 * @see {@link resolveDriverType}
 */
export async function createStorageDriver(
  driverType: string,
  opts: CreateStorageDriverOptions,
): Promise<StorageDriverResolution | null> {
  const { databaseUrl, isDev } = opts;
  const warn =
    opts.warn ??
    ((message: string) => {
      try {
        console.warn(message);
      } catch {
        /* ignore */
      }
    });

  if (driverType === 'mongodb' || driverType === 'mongo') {
    const { MongoDBDriver } = await import('@objectstack/driver-mongodb');
    const url = databaseUrl ?? 'mongodb://localhost:27017/objectstack';
    return {
      driver: new MongoDBDriver({ url }) as any,
      trackName: 'MongoDBDriver',
      label: 'MongoDBDriver',
      displayUrl: url,
    };
  }

  if (driverType === 'sqlite' || driverType === 'sql') {
    const filePath = (databaseUrl ?? ':memory:')
      .replace(/^file:/, '')
      .replace(/^sqlite:/, '')
      .replace(/^sql:\/\//, '');
    // Probe-by-connect with a dev-only native → wasm → in-memory step-down
    // (#2229). better-sqlite3 loads its native addon lazily (first query), so an
    // ABI mismatch is invisible here and would otherwise surface much later as a
    // runtime crash. resolveSqliteDriver forces the load and degrades gracefully
    // in dev / fails loudly in prod.
    const { resolveSqliteDriver } = await import('@objectstack/service-datasource');
    const resolved = await resolveSqliteDriver({
      filename: filePath,
      dev: isDev,
      // #2186: in dev, self-heal a persisted DB when a metadata change relaxes a
      // constraint (loosen-only; never destructive / never in prod).
      autoMigrate: isDev ? 'safe' : undefined,
      warn,
    });
    return {
      driver: resolved.driver,
      trackName:
        resolved.engine === 'memory'
          ? 'MemoryDriver'
          : resolved.engine === 'sqlite-wasm'
            ? 'SqliteWasmDriver'
            : 'SqlDriver',
      label: resolved.label,
      displayUrl: resolved.engine === 'memory' ? '(in-memory)' : (databaseUrl ?? ':memory:'),
      engine: resolved.engine,
      sqliteFilePath: filePath,
    };
  }

  if (driverType === 'sqlite-wasm' || driverType === 'wasm-sqlite' || driverType === 'wasm') {
    const { SqliteWasmDriver } = await import('@objectstack/driver-sqlite-wasm');
    const filePath = (databaseUrl ?? ':memory:')
      .replace(/^file:/, '')
      .replace(/^wasm-sqlite:\/\//, '')
      .replace(/^sqlite:/, '');
    return {
      driver: new SqliteWasmDriver({ filename: filePath, persist: 'on-disconnect' }) as any,
      trackName: 'SqliteWasmDriver',
      label: 'SqliteWasmDriver',
      displayUrl: databaseUrl ?? ':memory:',
    };
  }

  if (driverType === 'postgres' || driverType === 'postgresql' || driverType === 'pg') {
    const { SqlDriver } = await import('@objectstack/driver-sql');
    return {
      driver: new SqlDriver({
        client: 'pg',
        connection: databaseUrl,
        pool: { min: 0, max: 5 },
        autoMigrate: isDev ? 'safe' : undefined, // #2186 dev loosen-only self-heal
      }) as any,
      trackName: 'PostgresDriver',
      label: 'SqlDriver(pg)',
      displayUrl: databaseUrl,
    };
  }

  if (driverType === 'mysql' || driverType === 'mysql2') {
    const { SqlDriver } = await import('@objectstack/driver-sql');
    return {
      driver: new SqlDriver({
        client: 'mysql2',
        connection: databaseUrl,
        pool: { min: 0, max: 5 },
        autoMigrate: isDev ? 'safe' : undefined, // #2186 dev loosen-only self-heal
      }) as any,
      trackName: 'MySQLDriver',
      label: 'SqlDriver(mysql2)',
      displayUrl: databaseUrl,
    };
  }

  // turso / libSQL: recognized but NOT constructible by the open-core CLI. The
  // driver (`@objectstack/driver-turso`) ships in the cloud / enterprise
  // distribution and is composed by the cloud runtime's own kernel factory —
  // runtime/standalone-stack.ts explicitly stopped consuming its auth token, and
  // its config schema lives in the cloud package so it never pollutes open-core
  // `@objectstack/spec`. Fail LOUDLY here rather than let the selection fall
  // through to the SQLite default (the reported "declared ≠ enforced" bug):
  // serve.ts turns this typed error into a fatal, actionable boot message.
  if (driverType === 'turso' || driverType === 'libsql') {
    throw new UnsupportedDriverError(
      'turso',
      'The `turso`/libSQL driver ships with the ObjectStack cloud / enterprise '
        + 'distribution (@objectstack/driver-turso), not the open-core CLI. To use '
        + "it, register it explicitly in your stack config (a datasource with driver: "
        + "'turso' and config { url, authToken }, with @objectstack/driver-turso "
        + 'installed), or run under the cloud distribution. Otherwise select an '
        + 'open-core driver via OS_DATABASE_DRIVER / OS_DATABASE_URL: '
        + 'sqlite | postgres | mysql | mongodb | memory.',
    );
  }

  // #3276: explicit in-memory (mingo) driver. Honored in dev AND production — an
  // operator asking for `memory` gets the mingo InMemoryDriver (ephemeral, not
  // real SQL), never the SQLite `:memory:` default. This is the branch whose
  // absence caused the reported "declared ≠ enforced" fall-through to SQLite.
  if (driverType === 'memory' || driverType === 'mingo' || driverType === 'in-memory') {
    const { InMemoryDriver } = await import('@objectstack/driver-memory');
    return {
      driver: new InMemoryDriver(),
      trackName: 'MemoryDriver',
      label: 'InMemoryDriver',
      displayUrl: '(in-memory)',
      engine: 'memory',
    };
  }

  // Default (no driver configured): dev prefers native SQLite for production-like
  // SQL at native speed, with a graceful step-down to wasm SQLite then in-memory
  // when the native better-sqlite3 binary is unavailable (#2229). Production
  // registers nothing here so a missing driver surfaces loudly downstream.
  if (isDev) {
    const { resolveSqliteDriver } = await import('@objectstack/service-datasource');
    const resolved = await resolveSqliteDriver({
      filename: ':memory:',
      dev: true,
      autoMigrate: 'safe', // #2186 dev loosen-only self-heal
      warn,
    });
    return {
      driver: resolved.driver,
      trackName:
        resolved.engine === 'memory'
          ? 'MemoryDriver'
          : resolved.engine === 'sqlite-wasm'
            ? 'SqliteWasmDriver'
            : 'SqlDriver',
      label: resolved.label,
      displayUrl: resolved.engine === 'memory' ? '(in-memory)' : ':memory:',
      engine: resolved.engine,
      // No sqliteFilePath: the dev-default `:memory:` store never gets a
      // telemetry sibling (resolveTelemetryDbPath returns undefined for it), so
      // leaving this unset keeps serve.ts from provisioning one — matching the
      // pre-extraction behavior where this branch never touched telemetry.
    };
  }

  return null;
}
