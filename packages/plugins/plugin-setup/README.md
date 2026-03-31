# @objectstack/plugin-setup

Setup Plugin for ObjectStack — owns and composes the platform **Setup App** with area-based navigation.

## Overview

The Setup App is the central administration interface of the ObjectStack platform (equivalent to Salesforce Setup or ServiceNow System Administration). Rather than scattering setup definitions across `spec` and `objectql`, this plugin provides clear ownership:

- **Spec** → protocol schemas only
- **ObjectQL** → data engine only
- **plugin-setup** → owns the Setup App identity, areas, and navigation composition

## Features

- **Four Built-in Areas**: Administration, Platform, System, and AI — shipped as empty skeletons.
- **Contribution Model**: Any plugin can contribute navigation items to Setup areas via the `setupNav` service.
- **Area Filtering**: Empty areas are automatically filtered out at finalization.
- **Custom Areas**: Plugins can contribute to custom area IDs beyond the four built-in ones.
- **I18n Labels**: All labels use the `I18nLabel` union type for internationalization.

## Usage

### Register the Plugin

```typescript
import { ObjectKernel } from '@objectstack/core';
import { SetupPlugin } from '@objectstack/plugin-setup';

const kernel = new ObjectKernel({
  plugins: [
    new SetupPlugin(),
    // ... other plugins
  ],
});
```

### Contribute Navigation from Another Plugin

```typescript
import type { Plugin, PluginContext } from '@objectstack/core';
import type { SetupNavService } from '@objectstack/plugin-setup';
import { SETUP_AREA_IDS } from '@objectstack/plugin-setup';

export class MyPlugin implements Plugin {
  name = 'com.example.my-plugin';

  async init(ctx: PluginContext) {
    const setupNav = ctx.getService<SetupNavService>('setupNav');

    setupNav.contribute({
      areaId: SETUP_AREA_IDS.administration,
      items: [
        { id: 'nav_users', type: 'object', label: 'Users', objectName: 'sys_user' },
        { id: 'nav_roles', type: 'object', label: 'Roles', objectName: 'sys_role' },
      ],
    });
  }
}
```

### Exported Components

```typescript
import {
  SetupPlugin,
  type SetupNavService,
  SETUP_APP_DEFAULTS,
  type SetupNavContribution,
  SETUP_AREAS,
  SETUP_AREA_IDS,
  type SetupAreaId,
} from '@objectstack/plugin-setup';
```

## Built-in Setup Areas

| Area | ID | Icon | Order | Description |
|:-----|:---|:-----|:-----:|:------------|
| Administration | `area_administration` | shield | 10 | Users, roles, permissions, security |
| Platform | `area_platform` | layers | 20 | Objects, fields, layouts, automation |
| System | `area_system` | settings | 30 | Datasources, integrations, jobs, logs |
| AI | `area_ai` | brain | 40 | Agents, models, RAG pipelines |

## Architecture

```
┌──────────────────────────────────────────┐
│              SetupPlugin                 │
│                                          │
│  init():                                 │
│    → registers 'setupNav' service        │
│                                          │
│  start():                                │
│    → collects contributions              │
│    → merges into area skeletons          │
│    → filters empty areas                 │
│    → registers finalized Setup App       │
│                                          │
└──────────────────────────────────────────┘
         ▲                    ▲
         │  contribute()      │  contribute()
    ┌────┴────┐          ┌────┴────┐
    │ plugin  │          │ plugin  │
    │  auth   │          │security │
    └─────────┘          └─────────┘
```

## License

Apache-2.0 © ObjectStack
