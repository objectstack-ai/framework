// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { printHeader, printKV, printStep, printError } from '../utils/format.js';

export default class Start extends Command {
  static override description = 'Serve the pre-compiled artifact in production mode (requires objectstack build first)';

  static override flags = {
    ui: Flags.boolean({ description: 'Enable Studio UI at /_studio/' }),
    verbose: Flags.boolean({ char: 'v', description: 'Verbose output' }),
    port: Flags.integer({ char: 'p', description: 'Port to listen on' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Start);

    printHeader('Production Mode');

    const artifactPath = process.env.OBJECTSTACK_ARTIFACT_PATH
      ?? path.resolve(process.cwd(), 'dist/objectstack.json');

    if (!fs.existsSync(artifactPath)) {
      printError(`Artifact not found: ${path.relative(process.cwd(), artifactPath)}`);
      console.error('  Run \x1b[33mobjectstack build\x1b[0m to compile your configuration first.');
      process.exit(1);
    }

    printKV('Artifact', path.relative(process.cwd(), artifactPath), '📦');
    printStep('Starting server (production mode)...');

    const localEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      OBJECTSTACK_PROJECT_ID: process.env.OBJECTSTACK_PROJECT_ID ?? 'proj_local',
      OBJECTSTACK_ARTIFACT_PATH: process.env.OBJECTSTACK_ARTIFACT_PATH ?? artifactPath,
      ...(flags.port ? { PORT: String(flags.port) } : {}),
    };

    if (!process.env.OBJECTSTACK_CLOUD_URL) {
      delete localEnv.OBJECTSTACK_CLOUD_URL;
    }

    printKV('Project ID', localEnv.OBJECTSTACK_PROJECT_ID!, '🎯');

    const binPath = process.argv[1];
    spawn(
      process.execPath,
      [
        binPath,
        'serve',
        '--prebuilt',
        ...(flags.ui ? ['--ui'] : []),
        ...(flags.verbose ? ['--verbose'] : []),
      ],
      { stdio: 'inherit', env: localEnv },
    );
  }
}
