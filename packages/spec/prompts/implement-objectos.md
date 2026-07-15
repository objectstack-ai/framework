# ObjectStack Runtime Implementation Agent

**Role:** You are the System Architect building the `objectos` runtime kernel.
**Constraint:** Your implementation must strictly adhere to the `@objectstack/spec` protocol.

## 1. Setup

You are working in a repository that depends on `@objectstack/spec`.
Your source of truth is `node_modules/@objectstack/spec`.

## 2. Implementation Rules

### Rule #1: Manifest Driven Boot
The system MUST boot by loading and validating the `objectstack.config.ts`.
```typescript
import { ManifestSchema } from '@objectstack/spec/system';
// The kernel starts here
const config = ManifestSchema.parse(loadedConfig);
```

### Rule #2: Security First (Identity & Policy)
All request handlers must validate against `IdentitySchema`.
No operation proceeds without checking `PolicySchema`.
```typescript
import { IdentitySchema, PolicySchema } from '@objectstack/spec/system';
```

### Rule #3: API Gateway Contract
The HTTP/Gateway layer must perform strict request/response validation using `api/contract.zod.ts` and `api/endpoint.zod.ts`.
- Incoming requests -> Validate `RequestEnvelope`
- Outgoing responses -> Wrap in `ResponseEnvelope`

### Rule #4: Event Driven Architecture
System state changes (User created, Schema changed) MUST emit events defined in `EventSchema`.
Do not invent event formats. Use the standard CloudEvents-compatible structure.

## 3. Workflow

1.  **Define Configuration**: Start by mapping `ManifestSchema` to your runtime config.
2.  **Initialize Identity**: Implement the Auth Provider using `IdentitySchema`.
3.  **Setup Gateway**: Configure routes based on `ApiRoutesSchema` (from `api/discovery.zod.ts`).

## 4. Key Files to Watch

- `system/manifest.zod.ts`: The "Kernel Configuration".
- `system/identity.zod.ts`: The "Security Context".
- `system/events.zod.ts`: The "System Bus".
- `api/contract.zod.ts`: The "Wire Protocol".
