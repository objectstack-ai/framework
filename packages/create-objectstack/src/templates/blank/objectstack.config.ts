import { defineStack } from '@objectstack/spec';
import { ConnectorMcpPlugin } from '@objectstack/connector-mcp';
import { ConnectorOpenApiPlugin } from '@objectstack/connector-openapi';
import { ConnectorRestPlugin } from '@objectstack/connector-rest';
import * as objects from './src/objects/index.js';

export default defineStack({
  manifest: {
    id: 'blank',
    namespace: 'blank',
    version: '0.1.0',
    type: 'app',
    name: 'Blank Starter',
    description: 'Minimal ObjectStack environment — a clean slate for building.',
    // Protocol compatibility range (ADR-0087 D1): lets an incompatible runtime
    // refuse this package at the boundary with the exact migration command,
    // instead of crashing later. Kept in lockstep with releases by
    // scripts/sync-template-versions.mjs.
    engines: { protocol: '^15' },
  },
  objects: Object.values(objects),

  // The three GENERIC connector executors (rest / openapi / mcp) ship in the
  // default preset (#3056, ADR-0097): with them installed, a declarative
  // `connectors:` entry that names a `provider` materializes into a live,
  // dispatchable connector at boot — integrations stay pure metadata, no
  // plugin code required. Zero-arg = each contributes only its provider
  // factory (an unused factory costs nothing at runtime). Remove any you
  // don't want; brand connectors (Slack, …) are installed separately.
  //
  // Security note (#3055): a declarative `mcp` instance with a STDIO
  // transport spawns a local process from metadata, so it is denied by
  // default — opt in per host with
  // `new ConnectorMcpPlugin({ declarativeStdio: ['<trusted-command>'] })`.
  // http transports need no opt-in.
  plugins: [new ConnectorRestPlugin(), new ConnectorOpenApiPlugin(), new ConnectorMcpPlugin()],
});
