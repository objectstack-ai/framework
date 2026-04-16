// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';
import { loadConfig } from '../utils/config.js';
import { printHeader, printKV, printSuccess, printError, printStep } from '../utils/format.js';

export default class Publish extends Command {
  static override description = 'Publish package to ObjectStack server';

  static override args = {
    config: Args.string({ description: 'Configuration file path', required: false }),
  };

  static override flags = {
    server: Flags.string({
      char: 's',
      description: 'Server URL',
      env: 'OBJECTSTACK_SERVER_URL',
      default: 'http://localhost:3000',
    }),
    token: Flags.string({
      char: 't',
      description: 'Auth token',
      env: 'OBJECTSTACK_AUTH_TOKEN',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Publish);

    printHeader('Publish Package');

    try {
      // 1. Load config
      printStep('Loading configuration...');
      const { config, absolutePath } = await loadConfig(args.config);

      if (!config || !config.manifest) {
        printError('Invalid config: missing manifest');
        this.exit(1);
      }

      const manifest = config.manifest;

      printSuccess(`Loaded: ${absolutePath}`);

      // 2. Collect metadata
      printStep('Collecting metadata...');
      const metadata = {
        objects: config.objects || [],
        views: config.views || [],
        apps: config.apps || [],
        flows: config.flows || [],
        agents: config.agents || [],
        tools: config.tools || [],
        translations: config.translations || [],
      };

      console.log('');
      printKV('  Package', `${manifest.id}@${manifest.version}`);
      printKV('  Objects', metadata.objects.length.toString());
      printKV('  Views', metadata.views.length.toString());
      printKV('  Apps', metadata.apps.length.toString());
      printKV('  Flows', metadata.flows.length.toString());
      printKV('  Agents', metadata.agents.length.toString());
      printKV('  Tools', metadata.tools.length.toString());
      printKV('  Translations', metadata.translations.length.toString());

      // 3. Publish to server
      const serverUrl = `${flags.server}/api/v1/packages`;
      printStep(`Publishing to ${serverUrl}...`);

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(flags.token && { 'Authorization': `Bearer ${flags.token}` }),
        },
        body: JSON.stringify({ manifest, metadata }),
      });

      if (!response.ok) {
        const error = await response.json();
        printError(`Publish failed: ${error.error || response.statusText}`);
        this.exit(1);
      }

      const result = await response.json();
      const size = (JSON.stringify(metadata).length / 1024).toFixed(2);

      console.log('');
      printSuccess(result.message);
      printKV('  Size', `${size} KB`);
      printKV('  Server', flags.server);

    } catch (error) {
      printError((error as Error).message);
      this.exit(1);
    }
  }
}
