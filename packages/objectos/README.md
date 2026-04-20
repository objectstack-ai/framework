# @objectstack/objectos

**ObjectOS - System Runtime Object Definitions**

This package contains the core system object definitions that form the foundation of the ObjectStack platform. These objects represent the metadata layer itself (objects, views, flows, agents, etc.) as queryable data.

## Architecture

ObjectStack follows a layered architecture:

- **Protocol Layer** (`@objectstack/spec`) — Zod schemas (ObjectSchema, ViewSchema, AgentSchema)
- **Runtime Layer** (`@objectstack/objectos`) — Concrete system objects (SysObject, SysView, SysAgent)
- **Service Layer** (`@objectstack/metadata`) — Metadata management service

## System Objects

ObjectOS provides system object definitions for all metadata types:

### Data Protocol
- `sys_metadata` - Generic metadata envelope
- `sys_object` - Object definitions
- `sys_field` - Field definitions

### UI Protocol
- `sys_view` - View definitions
- `sys_dashboard` - Dashboard definitions
- `sys_app` - App definitions
- `sys_action` - Action definitions

### Automation Protocol
- `sys_flow` - Flow definitions
- `sys_workflow` - Workflow definitions

### AI Protocol
- `sys_agent` - AI Agent definitions
- `sys_tool` - AI Tool definitions
- `sys_skill` - AI Skill definitions

### Security Protocol
- `sys_permission` - Permission sets
- `sys_profile` - User profiles
- `sys_role` - Security roles

### Identity Protocol
- `sys_user` - System users
- `sys_organization` - Organizations

### System Protocol
- `sys_environment` - Environments
- `sys_datasource` - Datasources
- `sys_package` - Installed packages
- `sys_translation` - Translation bundles

## Usage

```typescript
import { SystemObjects } from '@objectstack/objectos';

// Register all system objects
await metadataService.registerSystemObjects(SystemObjects);

// Or register individual objects
import { SysObject } from '@objectstack/objectos/objects';
await metadataService.register('object', 'sys_object', SysObject);
```

## Design Philosophy

ObjectOS follows the "Metadata as Data" pattern:

1. **Dual-Table Architecture**: System metadata is stored in both `sys_metadata` (source of truth) and type-specific tables (queryable data)
2. **Object Protocol**: All system objects use the same Object Protocol as business data
3. **Auto-Generated UI**: Studio can render metadata forms/tables using existing view components
4. **Version Control**: Full version history via `sys_metadata_history` table
5. **Package Management**: Metadata tracked by package ownership

## Industry Alignment

- **Salesforce**: Treats metadata as queryable objects (CustomObject, CustomField)
- **ServiceNow**: System Dictionary is a table, queryable like any other
- **Kubernetes**: CRDs are stored as structured resources

## License

Apache-2.0
