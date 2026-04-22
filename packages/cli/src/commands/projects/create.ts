// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { printError } from '../../utils/format.js';
import { createApiClient, requireAuth } from '../../utils/api-client.js';
import { formatOutput } from '../../utils/output-formatter.js';
import { readAuthConfig, writeAuthConfig } from '../../utils/auth-config.js';

/**
 * `os projects create` — provision a new project.
 *
 * Delegates to `ProjectProvisioningService.provisionProject` on the server.
 * On success, optionally activates the new project for the current session
 * and persists `activeProjectId` into `~/.objectstack/credentials.json`
 * (unless `--no-activate` is passed).
 */
export default class ProjectsCreate extends Command {
  static override description = 'Provision a new project';

  static override examples = [
    '$ os projects create --org 00000000-0000-0000-0000-000000000000 --name Staging',
    '$ os projects create --org $ORG --name Dev --plan free',
    '$ os projects create --org $ORG --name "Clone" --clone-from <source-id> --no-activate',
  ];

  static override flags = {
    url: Flags.string({ char: 'u', description: 'Server URL', env: 'OBJECTSTACK_URL' }),
    token: Flags.string({ char: 't', description: 'Authentication token', env: 'OBJECTSTACK_TOKEN' }),
    org: Flags.string({ description: 'Organization id', required: true }),
    name: Flags.string({ description: 'Display name', required: true }),
    plan: Flags.string({ description: 'Billing plan', default: 'free' }),
    driver: Flags.string({ description: 'Data-plane driver id' }),
    'clone-from': Flags.string({ description: 'Clone schema from an existing project id' }),
    activate: Flags.boolean({
      description: 'Activate the new project for subsequent CLI calls',
      default: true,
      allowNo: true,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format',
      options: ['json', 'table', 'yaml'],
      default: 'table',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ProjectsCreate);

    try {
      const { client, token } = await createApiClient({ url: flags.url, token: flags.token });
      requireAuth(token);

      const res = await client.projects.create({
        organizationId: flags.org,
        displayName: flags.name,
        plan: flags.plan,
        driver: flags.driver,
        cloneFromProjectId: flags['clone-from'],
      });

      if (flags.activate && res?.project?.id) {
        try {
          await client.projects.activate(res.project.id);
          const cfg = await readAuthConfig().catch(() => null);
          if (cfg) {
            cfg.activeProjectId = res.project.id;
            cfg.lastUsedAt = new Date().toISOString();
            await writeAuthConfig(cfg);
          }
        } catch (activateError: any) {
          // Creation succeeded — surface activation failure as a warning
          console.error(`  ⚠ activation failed: ${activateError.message}`);
        }
      }

      if (flags.format === 'json') {
        formatOutput(res, 'json');
      } else if (flags.format === 'yaml') {
        formatOutput(res, 'yaml');
      } else {
        const p = res?.project ?? {};
        console.log(`\n✓ Project created: ${p.displayName ?? p.id} (${p.id})`);
        if (flags.activate) {
          console.log(`  active project set to ${p.id}`);
        }
        console.log('');
      }
    } catch (error: any) {
      if (flags.format === 'json') {
        console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        this.exit(1);
      }
      printError(error.message || String(error));
      this.exit(1);
    }
  }
}
