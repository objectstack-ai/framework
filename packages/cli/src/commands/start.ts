// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { printHeader, printKV, printStep, printError } from '../utils/format.js';

export default class Start extends Command {
  static override description = 'Serve the pre-compiled artifact in production mode (no objectstack.config.ts required)';

  static override examples = [
    '<%= config.bin %> start',
    '<%= config.bin %> start --artifact ./build/myapp.json',
    '<%= config.bin %> start --artifact https://cdn.example.com/app.json --port 8080',
    '<%= config.bin %> start --database file:./data/prod.db',
    '<%= config.bin %> start --database postgres://user:pass@host:5432/mydb',
    '<%= config.bin %> start --database libsql://my-db.turso.io --database-auth-token $TURSO_TOKEN',
    '<%= config.bin %> start --auth-secret $(openssl rand -hex 32) --ui',
  ];

  static override flags = {
    // Server
    port: Flags.integer({ char: 'p', description: 'Port to listen on (overrides $PORT, default 3000)' }),
    ui: Flags.boolean({
      description: 'Mount Studio / Account / Console portals at /_studio/, /_account/, /_console/ (off by default in production)',
    }),
    verbose: Flags.boolean({ char: 'v', description: 'Verbose output' }),

    // Artifact source
    artifact: Flags.string({
      char: 'a',
      description: 'Path or http(s):// URL to the compiled objectstack.json (overrides $OS_ARTIFACT_PATH; defaults to ./dist/objectstack.json)',
    }),

    // Project identity
    'project-id': Flags.string({
      description: 'Project identifier (overrides $OS_ENVIRONMENT_ID, default proj_local)',
    }),

    // Storage
    database: Flags.string({
      char: 'd',
      description: 'Database URL: file:./db.sqlite | libsql://... | postgres://... | mongodb://... | memory:// (overrides $OS_DATABASE_URL)',
    }),
    'database-driver': Flags.string({
      description: 'Force driver kind when URL is ambiguous: sqlite | turso | postgres | mongodb | memory (overrides $OS_DATABASE_DRIVER)',
      options: ['sqlite', 'turso', 'postgres', 'mongodb', 'memory'],
    }),
    'database-auth-token': Flags.string({
      description: 'Auth token for libsql/Turso connections (overrides $OS_DATABASE_AUTH_TOKEN / $TURSO_AUTH_TOKEN)',
    }),

    // Authentication
    'auth-secret': Flags.string({
      description: 'Secret for @objectstack/plugin-auth — required to mount /api/v1/auth/* (overrides $AUTH_SECRET; without it auth is silently skipped)',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Start);

    printHeader('Production Mode');

    // ── Artifact resolution ────────────────────────────────────────
    // Priority: --artifact flag > $OS_ARTIFACT_PATH > ./dist/objectstack.json
    const artifactPathInput = flags.artifact
      ?? process.env.OS_ARTIFACT_PATH
      ?? path.resolve(process.cwd(), 'dist/objectstack.json');

    // `--artifact` / `OS_ARTIFACT_PATH` is allowed to be an
    // `http(s)://` URL — the runtime's loadArtifactBundle() can fetch
    // JSON over the network. Skip the existence check for URLs
    // (validated lazily by the loader).
    const isUrl = /^https?:\/\//i.test(artifactPathInput);
    const artifactPath = isUrl ? artifactPathInput : path.resolve(process.cwd(), artifactPathInput);

    if (!isUrl && !fs.existsSync(artifactPath)) {
      printError(`Artifact not found: ${path.relative(process.cwd(), artifactPath)}`);
      console.error('  Run \x1b[33mobjectstack build\x1b[0m to compile your configuration first,');
      console.error('  pass \x1b[33m--artifact <path|url>\x1b[0m, or set \x1b[33mOS_ARTIFACT_PATH\x1b[0m.');
      process.exit(1);
    }

    const displayPath = isUrl ? artifactPath : path.relative(process.cwd(), artifactPath);
    printKV('Artifact', displayPath, '📦');
    printStep('Starting server (production mode)...');

    const environmentId = flags['project-id'] ?? process.env.OS_ENVIRONMENT_ID ?? 'proj_local';

    // Build the env handed to `serve`. Flags win over inherited env so
    // `--database file:foo.db` overrides any pre-existing OS_DATABASE_URL.
    const localEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      OS_ENVIRONMENT_ID: environmentId,
      OS_ARTIFACT_PATH: artifactPath,
      ...(flags.port ? { PORT: String(flags.port) } : {}),
      ...(flags.database ? { OS_DATABASE_URL: flags.database } : {}),
      ...(flags['database-driver'] ? { OS_DATABASE_DRIVER: flags['database-driver'] } : {}),
      ...(flags['database-auth-token'] ? { OS_DATABASE_AUTH_TOKEN: flags['database-auth-token'] } : {}),
      ...(flags['auth-secret'] ? { AUTH_SECRET: flags['auth-secret'] } : {}),
    };

    printKV('Project ID', environmentId, '🎯');
    if (flags.database) printKV('Database', redactDbUrl(flags.database), '🗄️');

    const binPath = process.argv[1];
    spawn(
      process.execPath,
      [
        binPath,
        'serve',
        // Production runtime: Studio is opt-in. The `serve` command
        // defaults `--ui` to true (because it's also driven by `os dev`
        // where Studio is the expected DX), so we have to explicitly
        // pass `--no-ui` when the user hasn't asked for `--ui`.
        ...(flags.ui ? ['--ui'] : ['--no-ui']),
        ...(flags.verbose ? ['--verbose'] : []),
      ],
      { stdio: 'inherit', env: localEnv },
    );
  }
}

function redactDbUrl(url: string): string {
  try {
    return url.replace(/(\/\/[^/@:]+):[^/@]+@/, '$1:****@');
  } catch {
    return url;
  }
}
