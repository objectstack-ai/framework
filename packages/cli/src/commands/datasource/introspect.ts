// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Args, Flags } from '@oclif/core';
import { writeFile } from 'node:fs/promises';
import { createApiClient } from '../../lib/api-client.js';

/**
 * `os datasource introspect <name> --table <remote>` — generate an Object
 * draft (`*.object.ts`) from a remote table (ADR-0015).
 * POST /api/v1/datasources/:name/external/tables/:remote/draft.
 */
export default class DatasourceIntrospect extends Command {
  static override description = 'Generate an Object draft from a remote table on an external datasource';

  static override examples = [
    '<%= config.bin %> <%= command.id %> warehouse --table fact_orders',
    '<%= config.bin %> <%= command.id %> warehouse --table fact_orders --out objects/wh_order.object.ts',
  ];

  static override args = {
    name: Args.string({ description: 'Datasource name', required: true }),
  };

  static override flags = {
    url: Flags.string({ char: 'u', description: 'Server URL', env: 'OS_SERVER_URL' }),
    token: Flags.string({ char: 't', description: 'Auth token', env: 'OS_TOKEN' }),
    table: Flags.string({ char: 'T', description: 'Remote table name', required: true }),
    out: Flags.string({ char: 'o', description: 'Write the generated source to this file' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DatasourceIntrospect);
    const { url, token } = createApiClient({ url: flags.url, token: flags.token });

    const res = await fetch(
      `${url}/api/v1/datasources/${args.name}/external/tables/${encodeURIComponent(flags.table)}/draft`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: '{}',
      },
    );
    const body = (await res.json()) as {
      draft?: { source?: string; review?: Array<{ column: string; note: string }> };
      error?: string;
    };
    if (body.error) this.error(body.error);

    const draft = body.draft;
    if (!draft?.source) {
      this.error(`Failed to generate draft for '${flags.table}' on '${args.name}'.`);
      return;
    }

    if (flags.out) {
      await writeFile(flags.out, draft.source, 'utf8');
      this.log(`Wrote ${flags.out}`);
    } else {
      this.log(draft.source);
    }

    for (const r of draft.review ?? []) {
      this.warn(`REVIEW: column '${r.column}' — ${r.note}`);
    }
  }
}
