// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';
import { printError } from '../../utils/format.js';
import { createApiClient, requireAuth } from '../../utils/api-client.js';
import { readAuthConfig, writeAuthConfig } from '../../utils/auth-config.js';

/**
 * `os projects switch <id>` — set the active project for this CLI session.
 *
 * Calls `POST /api/v1/cloud/projects/:id/activate` to update the
 * server-side session, then persists `activeProjectId` into
 * `~/.objectstack/credentials.json` so subsequent CLI commands (and any
 * client they create via `createApiClient`) automatically target this
 * project.
 */
export default class ProjectsSwitch extends Command {
  static override description = 'Activate a project for subsequent CLI calls';

  static override examples = [
    '$ os projects switch 00000000-0000-0000-0000-000000000001',
    '$ os projects switch proj-123 --no-remote',
  ];

  static override args = {
    id: Args.string({ description: 'Project id to activate', required: true }),
  };

  static override flags = {
    url: Flags.string({ char: 'u', description: 'Server URL', env: 'OBJECTSTACK_URL' }),
    token: Flags.string({ char: 't', description: 'Authentication token', env: 'OBJECTSTACK_TOKEN' }),
    remote: Flags.boolean({
      description: 'Also call /activate on the server (updates the session row)',
      default: true,
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProjectsSwitch);

    try {
      const { client, token } = await createApiClient({ url: flags.url, token: flags.token });
      requireAuth(token);

      // Sanity-check the id resolves — fail fast before writing the cred file
      const lookup = await client.projects.get(args.id);
      const project = lookup?.project;
      if (!project?.id) {
        throw new Error(`Project ${args.id} not found`);
      }

      if (flags.remote) {
        await client.projects.activate(project.id);
      }

      const cfg = await readAuthConfig();
      cfg.activeProjectId = project.id;
      cfg.lastUsedAt = new Date().toISOString();
      await writeAuthConfig(cfg);

      console.log(`\n✓ Active project: ${project.displayName ?? project.id}`);
      console.log(`  id: ${project.id}`);
      if (!flags.remote) {
        console.log('  (local only — server session unchanged)');
      }
      console.log('');
    } catch (error: any) {
      printError(error.message || String(error));
      this.exit(1);
    }
  }
}
