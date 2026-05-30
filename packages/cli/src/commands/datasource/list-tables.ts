// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Args, Command, Flags } from '@oclif/core';

/** Resolve server URL + token from flags then env (mirrors createApiClient). */
function resolveTarget(flags: { url?: string; token?: string }): { url: string; token?: string } {
  const url = flags.url || process.env.OS_CLOUD_URL || 'http://localhost:3000';
  const token = flags.token || process.env.OS_TOKEN;
  return { url, token };
}

/**
 * `os datasource list-tables <name>` — list remote tables on a federated
 * datasource (ADR-0015). GET /api/v1/datasources/:name/external/tables.
 */
export default class DatasourceListTables extends Command {
  static override description = 'List remote tables on an external (federated) datasource';

  static override examples = [
    '$ os datasource list-tables warehouse',
    '$ os datasource list-tables warehouse --schema mart',
  ];

  static override args = {
    name: Args.string({ description: 'Datasource name', required: true }),
  };

  static override flags = {
    url: Flags.string({ char: 'u', description: 'Server URL', env: 'OS_CLOUD_URL' }),
    token: Flags.string({ char: 't', description: 'Authentication token', env: 'OS_TOKEN' }),
    schema: Flags.string({ char: 's', description: 'Filter by remote schema' }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DatasourceListTables);
    const { url, token } = resolveTarget(flags);

    const qs = flags.schema ? `?schema=${encodeURIComponent(flags.schema)}` : '';
    const res = await fetch(`${url}/api/v1/datasources/${args.name}/external/tables${qs}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const body = (await res.json()) as {
      tables?: Array<{ schema?: string; name: string; columnCount: number; rowCountEstimate?: number }>;
      error?: string;
    };
    if (body.error) this.error(body.error);

    const tables = body.tables ?? [];
    if (tables.length === 0) {
      this.log('No remote tables found.');
      return;
    }
    for (const t of tables) {
      const where = t.schema ? `${t.schema}.${t.name}` : t.name;
      const rows = t.rowCountEstimate != null ? `, ~${t.rowCountEstimate} rows` : '';
      this.log(`  ${where}  (${t.columnCount} cols${rows})`);
    }
  }
}
