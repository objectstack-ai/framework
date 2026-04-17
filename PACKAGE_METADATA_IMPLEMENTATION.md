# Package-Aware Metadata Management Implementation

## Overview

This document describes the implementation of package-aware metadata management in ObjectStack, ensuring that:
1. Every metadata item belongs to a package
2. Code-loaded packages are read-only
3. Database packages are mutable

## Architecture

### Core Principles

1. **Package Ownership**: All metadata (objects, views, flows, etc.) must belong to a package
2. **Source-Based Mutability**:
   - **Filesystem/Code packages** → Read-only (scope='system', source='filesystem')
   - **Database packages** → Mutable (scope='platform'/'user', source='database')
3. **Conversation Context**: AI tools track active package per conversation
4. **Overlay Pattern**: Code metadata can have database overlays for customization

### Schema Support (Already Exists)

The `MetadataRecordSchema` in `packages/spec/src/system/metadata-persistence.zod.ts` already includes:

```typescript
{
  packageId: string | undefined;        // Package ownership
  managedBy: 'package' | 'platform' | 'user';  // Lifecycle management
  scope: 'system' | 'platform' | 'user';       // Mutability scope
  source: 'filesystem' | 'database' | 'api' | 'migration';  // Origin
}
```

## Implementation Progress

### Phase 1: Package Management Tools ✅ COMPLETE

Created 5 new AI tools for package management:

1. **`list_packages`** (`list-packages.tool.ts`)
   - Lists all installed packages
   - Supports filtering by status and enabled state
   - Returns package metadata (id, name, version, type, status)

2. **`get_package`** (`get-package.tool.ts`)
   - Gets detailed information about a specific package
   - Returns full manifest, dependencies, namespaces

3. **`create_package`** (`create-package.tool.ts`)
   - Creates a new package with manifest
   - Validates reverse domain notation for package ID
   - Auto-derives namespace from package ID
   - Automatically sets as active package in conversation

4. **`get_active_package`** (`get-active-package.tool.ts`)
   - Retrieves the currently active package from conversation context
   - Returns null if no active package is set

5. **`set_active_package`** (`set-active-package.tool.ts`)
   - Sets the active package for the conversation
   - All subsequent metadata operations use this package

**Handler Implementation**: `package-tools.ts`
- Implements `IPackageRegistry` interface for package CRUD
- Implements `IConversationService` interface for context tracking
- Validates package IDs (reverse domain notation)
- Validates namespaces (snake_case)
- Validates versions (semver)

### Phase 2: Enhanced Metadata Tools ⏳ IN PROGRESS

**Completed:**
- Updated `MetadataToolContext` interface to include:
  - `conversationService` - for tracking active package
  - `conversationId` - current conversation context
  - `packageRegistry` - for validating packages and checking read-only status

- Added `packageId` parameter to `create_object` tool
  - Optional parameter
  - Falls back to active package from conversation
  - Provides clear error message if no package context available

**Remaining Work:**
- Update `createObjectHandler` to:
  - Resolve package ID (explicit > active > error)
  - Check if package is read-only
  - Attach package metadata to object definition
  - Return package info in success response

- Update other metadata tools (`add_field`, `modify_field`, `delete_field`)
  - Add `packageId` parameter where appropriate
  - Implement read-only validation

### Phase 3: Conversation Context Management (TODO)

**Objectives:**
- Store `activePackageId` in conversation metadata
- Persist across conversation turns
- Clear on conversation end

**Implementation Plan:**
```typescript
// In conversation service
interface ConversationMetadata {
  activePackageId?: string;
  lastPackageOperation?: string;
  createdAt?: string;
}

// Store in database table: ai_conversation_metadata
{
  conversation_id: string;
  metadata: JSON;  // Contains activePackageId
  updated_at: timestamp;
}
```

### Phase 4: Metadata Service Write Protection (TODO)

**Objectives:**
- Prevent modification of code-based metadata
- Allow database metadata modifications
- Support customization overlays for code metadata

**Implementation Plan:**

1. **Add source tracking to metadata registration:**
```typescript
// In metadata service
async register(type: string, name: string, data: unknown, options?: {
  packageId?: string;
  scope?: 'system' | 'platform' | 'user';
  source?: 'filesystem' | 'database' | 'api';
}): Promise<void>
```

2. **Implement read-only check:**
```typescript
async register(type: string, name: string, data: unknown, options) {
  const existing = await this.get(type, name);

  if (existing) {
    const metadata = existing as MetadataRecord;

    // Block if trying to modify code-based metadata
    if (metadata.scope === 'system' || metadata.source === 'filesystem') {
      throw new Error(
        `Cannot modify ${type} "${name}" - it is code-based metadata. ` +
        `Use overlay customization instead via saveOverlay().`
      );
    }
  }

  // Proceed with registration for database metadata
  await this.storage.save(type, name, { ...data, ...options });
}
```

3. **Support overlay pattern:**
```typescript
// Allow customization of code metadata via overlays
await metadataService.saveOverlay({
  type: 'object',
  name: 'account',
  scope: 'platform',  // or 'user'
  overlay: {
    fields: {
      custom_field: { type: 'text', label: 'Custom Field' }
    }
  }
});

// Runtime serves merged result:
// base (from code) + platform overlay + user overlay
const effective = await metadataService.getEffective('object', 'account', context);
```

### Phase 5: Testing & Documentation (TODO)

**Unit Tests Needed:**
- Package tool validation (reverse domain, semver, snake_case)
- Package CRUD operations
- Active package resolution logic
- Read-only package detection
- Metadata service write protection

**Integration Tests Needed:**
- End-to-end package creation workflow
- Metadata creation with package context
- Read-only enforcement for code packages
- Overlay application and merging

**Documentation Needed:**
- Package-first development workflow guide
- AI agent integration examples
- Package naming conventions
- Customization overlay patterns
- Migration guide for existing metadata

## Usage Examples

### Creating a Package and Objects via AI

```typescript
// User: "Create a new CRM application"
// AI uses: create_package
{
  id: "com.acme.crm",
  name: "CRM Application",
  version: "1.0.0",
  type: "application"
}

// AI automatically sets as active package
// Now all metadata creation uses this package

// User: "Create an Account object with name and email fields"
// AI uses: create_object (packageId is implicit from active package)
{
  name: "account",
  label: "Account",
  fields: [
    { name: "account_name", type: "text", label: "Account Name" },
    { name: "email", type: "text", label: "Email" }
  ]
}

// Object is created with packageId="com.acme.crm"
```

### Handling Read-Only Packages

```typescript
// Code-based package (loaded from filesystem)
// packages/my-plugin/metadata/objects/user.object.ts
export default defineObject({
  name: 'user',
  label: 'User',
  fields: { ... }
});

// At runtime, this is registered with:
// scope='system', source='filesystem', packageId='com.example.myplugin'

// User tries: "Add a custom_field to the user object"
// AI uses: add_field
{
  objectName: "user",
  name: "custom_field",
  type: "text"
}

// Metadata service blocks:
// "Cannot modify object 'user' - it is code-based metadata.
//  Use overlay customization instead."

// AI suggests alternative:
// "I see 'user' is a system object. I can create a customization overlay instead.
//  Would you like me to add the field as a platform-level customization?"
```

## Best Practices

1. **Package Naming**:
   - Use reverse domain notation: `com.company.product`
   - Examples: `com.acme.crm`, `org.nonprofit.fundraising`

2. **Namespace Derivation**:
   - Auto-derived from last part of package ID
   - `com.acme.crm` → namespace: `crm`
   - Can be explicitly overridden if needed

3. **Scope Selection**:
   - `system`: Platform/framework code (read-only)
   - `platform`: Admin-configured (mutable, applies to all users)
   - `user`: User-configured (mutable, personal customizations)

4. **Source Tracking**:
   - `filesystem`: Loaded from code files (read-only)
   - `database`: Stored in database (mutable)
   - `api`: Loaded from external API
   - `migration`: Created during migration

## Next Steps

1. Complete Phase 2: Finish enhancing all metadata tool handlers
2. Implement Phase 3: Conversation context persistence
3. Implement Phase 4: Metadata service write protection
4. Write comprehensive tests (Phase 5)
5. Update AI agent system prompts with package-first instructions
6. Create user documentation and migration guide

## Related Files

### New Files Created
- `packages/services/service-ai/src/tools/list-packages.tool.ts`
- `packages/services/service-ai/src/tools/get-package.tool.ts`
- `packages/services/service-ai/src/tools/create-package.tool.ts`
- `packages/services/service-ai/src/tools/get-active-package.tool.ts`
- `packages/services/service-ai/src/tools/set-active-package.tool.ts`
- `packages/services/service-ai/src/tools/package-tools.ts`

### Modified Files
- `packages/services/service-ai/src/index.ts` - Added package tool exports
- `packages/services/service-ai/src/tools/create-object.tool.ts` - Added packageId parameter
- `packages/services/service-ai/src/tools/metadata-tools.ts` - Enhanced context interface

### Existing Schema Files (Used)
- `packages/spec/src/system/metadata-persistence.zod.ts` - MetadataRecordSchema
- `packages/spec/src/kernel/package-registry.zod.ts` - InstalledPackageSchema
- `packages/spec/src/kernel/manifest.zod.ts` - ManifestSchema
- `packages/spec/src/api/package-api.zod.ts` - Package API contracts
- `packages/spec/src/contracts/metadata-service.ts` - IMetadataService interface

## Conclusion

The foundation for package-aware metadata management has been established. The package management tools are complete and ready for use. The next phases will complete the integration with metadata tools and enforce read-only protection for code-based packages.

This implementation aligns with industry best practices from Salesforce, ServiceNow, and other enterprise low-code platforms, ensuring metadata governance, version control compatibility, and safe upgrade paths.
