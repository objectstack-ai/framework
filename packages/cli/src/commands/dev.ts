// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { spawnSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { printHeader, printKV, printStep, printError } from '../utils/format.js';

export default class Dev extends Command {
  static override description = 'Start development mode with hot-reload';

  static override args = {
    package: Args.string({ description: 'Package name or filter pattern', default: 'all', required: false }),
  };

  static override flags = {
    watch: Flags.boolean({ char: 'w', description: 'Enable watch mode (default)', default: true }),
    ui: Flags.boolean({ description: 'Enable Studio UI at /_studio/' }),
    verbose: Flags.boolean({ char: 'v', description: 'Verbose output' }),
    compile: Flags.boolean({
      description: 'Compile objectstack.config.ts to dist/objectstack.json before starting (auto if artifact missing)',
      default: false,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Dev);
    const packageName = args.package;

    printHeader('Development Mode');

    // ── Single-Project Mode ──────────────────────────────────────────────────
    const configPath = path.resolve(process.cwd(), 'objectstack.config.ts');
    if (packageName === 'all' && fs.existsSync(configPath)) {
      printKV('Config', configPath, '📂');

      const artifactPath = process.env.OBJECTSTACK_ARTIFACT_PATH
        ?? path.resolve(process.cwd(), 'dist/objectstack.json');

      // Auto-compile when artifact is missing or --compile is explicitly requested.
      const needsCompile = flags.compile || !fs.existsSync(artifactPath);
      if (needsCompile) {
        printStep('Compiling objectstack.config.ts → dist/objectstack.json...');
        const binPath = process.argv[1];
        const compileResult = spawnSync(
          process.execPath,
          [binPath, 'compile', '--output', artifactPath],
          { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } },
        );
        if (compileResult.status !== 0) {
          printError('Compile failed — fix errors above before starting dev server');
          process.exit(1);
        }
      }

      printStep('Starting dev server (local mode)...');

      const localEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: 'development',
        // Defaults for local mode — user's .env / existing env takes precedence.
        OBJECTSTACK_PROJECT_ID: process.env.OBJECTSTACK_PROJECT_ID ?? 'proj_local',
        OBJECTSTACK_ARTIFACT_PATH: process.env.OBJECTSTACK_ARTIFACT_PATH ?? artifactPath,
      };
      printKV('Project ID', localEnv.OBJECTSTACK_PROJECT_ID!, '🎯');
      printKV('Artifact', path.relative(process.cwd(), localEnv.OBJECTSTACK_ARTIFACT_PATH!), '📦');

      const binPath = process.argv[1];
      spawn(
        process.execPath,
        [
          binPath,
          'serve',
          '--dev',
          ...(flags.ui ? ['--ui'] : []),
          ...(flags.verbose ? ['--verbose'] : []),
        ],
        { stdio: 'inherit', env: localEnv },
      );
      return;
    }

    // ── Monorepo Orchestration Mode ──────────────────────────────────────────
    try {
      const cwd = process.cwd();
      const workspaceConfigPath = path.resolve(cwd, 'pnpm-workspace.yaml');
      const isWorkspaceRoot = fs.existsSync(workspaceConfigPath);

      if (packageName === 'all' && !isWorkspaceRoot) {
        printError(`Config file not found in ${cwd}`);
        console.error(chalk.yellow('  Run in a directory with objectstack.config.ts, or from the monorepo root.'));
        process.exit(1);
      }

      const filter = packageName === 'all' ? '' : `--filter ${packageName}`;
      printKV('Package', packageName === 'all' ? 'All packages' : packageName, '📦');
      printKV('Watch', 'enabled', '🔄');

      const { execSync } = await import('child_process');
      const command = `pnpm ${filter} dev`.trim();
      console.log(chalk.dim(`$ ${command}`));
      console.log('');
      execSync(command, { stdio: 'inherit', cwd });
    } catch (error: any) {
      printError(`Development mode failed: ${error.message || error}`);
      process.exit(1);
    }
  }
}
