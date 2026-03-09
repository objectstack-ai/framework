# @objectstack/plugin-auth

Authentication & Identity Plugin for ObjectStack.

> **✨ Status:** ObjectQL-based authentication implementation! Uses ObjectQL for data persistence (no third-party ORM required). Core authentication structure is in place with better-auth v1.4.18.

## Features

### Currently Implemented
- ✅ Plugin structure following ObjectStack conventions
- ✅ HTTP route registration for auth endpoints
- ✅ Service registration in ObjectKernel
- ✅ Configuration schema support
- ✅ **Better-Auth library integration (v1.4.18)**
- ✅ **ObjectQL-based database implementation (no ORM required)**
- ✅ **Direct request forwarding to better-auth handler**
- ✅ **Wildcard routing (`/api/v1/auth/*`)**
- ✅ **Full better-auth API access via `auth.api`**
- ✅ Comprehensive test coverage (11/11 tests passing)

### Production Ready Features
- ✅ **Email/Password Authentication** - Handled by better-auth
- ✅ **OAuth Providers** - Configured via `providers` option
- ✅ **Session Management** - Automatic session handling
- ✅ **Password Reset** - Email-based password reset flow
- ✅ **Email Verification** - Email verification workflow
- ✅ **2FA** - Two-factor authentication (when enabled)
- ✅ **Passkeys** - WebAuthn/Passkey support (when enabled)
- ✅ **Magic Links** - Passwordless authentication (when enabled)
- ✅ **Organizations** - Multi-tenant support (when enabled)

### ObjectQL-Based Database Architecture
- ✅ **Native ObjectQL Data Persistence** - Uses ObjectQL's IDataEngine interface
- ✅ **No Third-Party ORM** - No dependency on drizzle-orm or other ORMs
- ✅ **Better-Auth Native Schema** - Uses better-auth's naming conventions for seamless migration
- ✅ **Object Definitions** - Auth objects defined using ObjectStack's Object Protocol
  - `sys_user` - User accounts (protocol name, mapped from better-auth's `user`)
  - `sys_session` - Active sessions (protocol name, mapped from better-auth's `session`)
  - `sys_account` - OAuth provider accounts (protocol name, mapped from better-auth's `account`)
  - `sys_verification` - Email/phone verification tokens (protocol name, mapped from better-auth's `verification`)
- ✅ **ObjectQL Adapter** - Custom adapter bridges better-auth to ObjectQL

The plugin uses [better-auth](https://www.better-auth.com/) for robust, production-ready authentication functionality. All requests are forwarded directly to better-auth's universal handler, ensuring full compatibility with all better-auth features. Data persistence is handled by ObjectQL using **ObjectStack's snake_case naming conventions** for field names to maintain consistency across the platform.

## Installation

```bash
pnpm add @objectstack/plugin-auth
```

## Usage

### Basic Setup with ObjectQL

```typescript
import { ObjectKernel } from '@objectstack/core';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { ObjectQL } from '@objectstack/objectql';

// Initialize ObjectQL as the data engine
const dataEngine = new ObjectQL();

const kernel = new ObjectKernel({
  plugins: [
    new AuthPlugin({
      secret: process.env.AUTH_SECRET,
      baseUrl: 'http://localhost:3000',
      // ObjectQL will be automatically injected by the kernel
      providers: [
        {
          id: 'google',
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }
      ]
    })
  ]
});
```

**Note:** The `databaseUrl` parameter is no longer used. The plugin now uses ObjectQL's IDataEngine interface, which is provided by the kernel's `data` service. This allows the plugin to work with any ObjectQL-compatible driver (memory, SQL, NoSQL, etc.) without requiring a specific ORM.

### With Organization Support

```typescript
new AuthPlugin({
  secret: process.env.AUTH_SECRET,
  baseUrl: 'http://localhost:3000',
  plugins: {
    organization: true,  // Enable organization/teams
    twoFactor: true,     // Enable 2FA
    passkeys: true,      // Enable passkey support
  }
})
```

## Configuration

The plugin accepts configuration via `AuthConfig` schema from `@objectstack/spec/system`:

- `secret` - Encryption secret for session tokens
- `baseUrl` - Base URL for auth routes
- `databaseUrl` - Database connection string
- `providers` - Array of OAuth provider configurations
- `plugins` - Enable additional auth features (organization, 2FA, passkeys, magic link)
- `session` - Session configuration (expiry, update frequency)

## API Routes

The plugin forwards all requests under `/api/v1/auth/*` directly to better-auth's universal handler. Better-auth provides the following endpoints:

### Email/Password Authentication
- `POST /api/v1/auth/sign-in/email` - Sign in with email and password
- `POST /api/v1/auth/sign-up/email` - Register new user with email and password
- `POST /api/v1/auth/sign-out` - Sign out current user

### Session Management
- `GET /api/v1/auth/get-session` - Get current user session

### Password Management
- `POST /api/v1/auth/forget-password` - Request password reset email
- `POST /api/v1/auth/reset-password` - Reset password with token

### Email Verification
- `POST /api/v1/auth/send-verification-email` - Send verification email
- `GET /api/v1/auth/verify-email` - Verify email with token

### OAuth (when providers configured)
- `GET /api/v1/auth/authorize/[provider]` - Start OAuth flow
- `GET /api/v1/auth/callback/[provider]` - OAuth callback

### 2FA (when enabled)
- `POST /api/v1/auth/two-factor/enable` - Enable 2FA
- `POST /api/v1/auth/two-factor/verify` - Verify 2FA code

### Passkeys (when enabled)
- `POST /api/v1/auth/passkey/register` - Register a passkey
- `POST /api/v1/auth/passkey/authenticate` - Authenticate with passkey

### Magic Links (when enabled)
- `POST /api/v1/auth/magic-link/send` - Send magic link email
- `GET /api/v1/auth/magic-link/verify` - Verify magic link

For the complete API reference, see [better-auth documentation](https://www.better-auth.com/docs).

## Implementation Status

This package provides authentication services powered by better-auth. Current implementation status:

1. ✅ Plugin lifecycle (init, start, destroy)
2. ✅ HTTP route registration (wildcard routing)
3. ✅ Configuration validation
4. ✅ Service registration
5. ✅ Better-auth library integration (v1.4.18)
6. ✅ Direct request forwarding to better-auth handler
7. ✅ Full better-auth API support
8. ✅ OAuth providers (configurable)
9. ✅ 2FA, passkeys, magic links (configurable)
10. ✅ ObjectQL-based database implementation (no ORM required)

### Architecture

#### Request Flow

The plugin uses a **direct forwarding** approach:

```typescript
// All requests under /api/v1/auth/* are forwarded to better-auth
rawApp.all('/api/v1/auth/*', async (c) => {
  const request = c.req.raw; // Web standard Request
  const response = await authManager.handleRequest(request);
  return response; // Web standard Response
});
```

This architecture provides:
- ✅ **Minimal code** - No custom route implementations
- ✅ **Full compatibility** - All better-auth features work automatically
- ✅ **Easy updates** - Better-auth updates don't require code changes
- ✅ **Type safety** - Full TypeScript support from better-auth
- ✅ **Programmatic API** - Access auth methods via `authManager.api`

#### ObjectQL Database Architecture

The plugin uses **ObjectQL** for data persistence instead of third-party ORMs:

```typescript
// Object definitions use ObjectStack's snake_case naming conventions
export const AuthUser = ObjectSchema.create({
  name: 'sys_user',  // ObjectStack protocol name (better-auth model 'user' is mapped automatically)
  fields: {
    id: Field.text({ label: 'User ID', required: true }),
    email: Field.email({ label: 'Email', required: true }),
    email_verified: Field.boolean({ label: 'Email Verified' }),  // snake_case
    name: Field.text({ label: 'Name', required: true }),
    created_at: Field.datetime({ label: 'Created At' }),  // snake_case
    updated_at: Field.datetime({ label: 'Updated At' }),  // snake_case
    // ... other fields
  },
  indexes: [
    { fields: ['email'], unique: true }
  ]
});
```

**Benefits:**
- ✅ **No ORM Dependencies** - No drizzle-orm, Prisma, or other ORMs required
- ✅ **Unified Data Layer** - Uses same data engine as rest of ObjectStack
- ✅ **Driver Agnostic** - Works with memory, SQL, NoSQL via ObjectQL drivers
- ✅ **Type-Safe** - Zod-based schemas provide runtime + compile-time safety
- ✅ **"Data as Code"** - Object definitions are versioned, declarative code
- ✅ **Metadata Driven** - Supports migrations, validation, indexing via metadata
- ✅ **Compatible Schema** - Uses better-auth compatible table structure with ObjectStack's snake_case field naming

**Database Objects:**
Uses ObjectStack `sys_` prefixed protocol names with snake_case field naming.
The adapter automatically maps better-auth model names to protocol names:
- `sys_user` (← better-auth `user`) - User accounts (id, email, name, email_verified, created_at, etc.)
- `sys_session` (← better-auth `session`) - Active sessions (id, token, user_id, expires_at, ip_address, etc.)
- `sys_account` (← better-auth `account`) - OAuth provider accounts (id, provider_id, account_id, user_id, tokens, etc.)
- `sys_verification` (← better-auth `verification`) - Verification tokens (id, value, identifier, expires_at, etc.)

**Adapter:**
The `createObjectQLAdapter()` function bridges better-auth's database interface to ObjectQL's IDataEngine. It includes a model→protocol name mapping (`AUTH_MODEL_TO_PROTOCOL`) that translates better-auth's hardcoded model names (e.g. `user`) to ObjectStack protocol names (e.g. `sys_user`):

```typescript
// Better-auth → ObjectQL Adapter (handles model name mapping + field transformation)
import { createObjectQLAdapter, AUTH_MODEL_TO_PROTOCOL } from '@objectstack/plugin-auth';

const adapter = createObjectQLAdapter(dataEngine);

// Mapping: { user: 'sys_user', session: 'sys_session', account: 'sys_account', verification: 'sys_verification' }
console.log(AUTH_MODEL_TO_PROTOCOL);

// better-auth requires a DBAdapterInstance (factory function), not a raw adapter object.
// Passing a plain object falls through to the Kysely adapter path and fails silently.
// Wrap the adapter in a factory function:
const auth = betterAuth({
  database: (options) => ({
    id: 'objectql',
    ...adapter,
    transaction: async (cb) => cb(adapter),
  }),
  // ... other config
});
```

> **Note:** `AuthManager` handles this wrapping automatically when you provide a `dataEngine`.
> You only need the factory pattern above when using `createObjectQLAdapter()` directly.

## Development

```bash
# Build the plugin
pnpm build

# Run tests
pnpm test
```

## License

Apache-2.0 © ObjectStack
