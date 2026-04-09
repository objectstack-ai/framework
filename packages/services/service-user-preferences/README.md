# @objectstack/service-user-preferences

User Preferences Service for ObjectStack — implements IUserPreferencesService and IUserFavoritesService with ObjectQL persistence and REST routes.

## Features

- **Scalar Preferences**: Simple key-value storage for user settings (theme, locale, etc.)
- **Structured Data**: Store complex data structures (favorites, recent items)
- **ObjectQL Persistence**: Leverages IDataEngine for database-agnostic storage
- **REST API**: Full HTTP routes for preferences and favorites management
- **Type Safety**: Complete TypeScript support with Zod schemas
- **Multi-tenant**: User-scoped preferences with isolation
- **Prefix Filtering**: Query preferences by key prefix (e.g., all `plugin.ai.*` settings)

## Installation

```bash
pnpm add @objectstack/service-user-preferences
```

## Usage

### Basic Setup

```typescript
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { DriverPlugin } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { UserPreferencesServicePlugin } from '@objectstack/service-user-preferences';

const kernel = new ObjectKernel();

await kernel.use(new ObjectQLPlugin());
await kernel.use(new DriverPlugin(new InMemoryDriver()));
await kernel.use(new UserPreferencesServicePlugin());

await kernel.bootstrap();

const prefs = kernel.getService<IUserPreferencesService>('user-preferences');
```

### Scalar Preferences

```typescript
// Set a preference
await prefs.set('user123', 'theme', 'dark');

// Get a preference
const theme = await prefs.get('user123', 'theme'); // => 'dark'

// Set multiple preferences at once
await prefs.setMany('user123', {
  theme: 'dark',
  locale: 'en-US',
  sidebar_collapsed: true,
});

// Get all preferences
const all = await prefs.getAll('user123');
// => { theme: 'dark', locale: 'en-US', sidebar_collapsed: true }

// Delete a preference
await prefs.delete('user123', 'theme');

// Check if a preference exists
const hasTheme = await prefs.has('user123', 'theme');
```

### Structured Data (Favorites)

```typescript
const favorites = kernel.getService<IUserFavoritesService>('user-favorites');

// Add a favorite
const entry = await favorites.add('user123', {
  type: 'view',
  target: 'kanban_tasks',
  label: 'My Tasks',
  icon: 'kanban',
});

// List all favorites
const allFavorites = await favorites.list('user123');

// Remove a favorite
await favorites.remove('user123', entry.id);

// Check if an item is favorited
const isFav = await favorites.has('user123', 'view', 'kanban_tasks');

// Toggle a favorite (add if not exists, remove if exists)
const added = await favorites.toggle('user123', {
  type: 'view',
  target: 'kanban_tasks',
});
```

### Prefix Filtering

```typescript
// Set plugin-specific preferences
await prefs.setMany('user123', {
  'plugin.ai.auto_save': true,
  'plugin.ai.model': 'gpt-4',
  'plugin.security.mfa_enabled': false,
});

// Get all AI plugin preferences
const aiPrefs = await prefs.getAll('user123', { prefix: 'plugin.ai.' });
// => { 'plugin.ai.auto_save': true, 'plugin.ai.model': 'gpt-4' }

// Clear all AI plugin preferences
await prefs.clear('user123', { prefix: 'plugin.ai.' });
```

## REST API

The plugin automatically registers HTTP routes when started:

### Preferences Routes

- **GET `/api/v1/user/preferences`** - Get all preferences (with optional `?prefix=` query param)
- **GET `/api/v1/user/preferences/:key`** - Get a single preference
- **POST `/api/v1/user/preferences`** - Batch set preferences (body: `{ preferences: { ... } }`)
- **PUT `/api/v1/user/preferences/:key`** - Set a single preference (body: `{ value: ... }`)
- **DELETE `/api/v1/user/preferences/:key`** - Delete a preference

### Favorites Routes

- **GET `/api/v1/user/favorites`** - List all favorites
- **POST `/api/v1/user/favorites`** - Add a favorite (body: `{ type, target, label?, icon?, metadata? }`)
- **DELETE `/api/v1/user/favorites/:id`** - Remove a favorite
- **POST `/api/v1/user/favorites/toggle`** - Toggle a favorite (body: `{ type, target, label?, icon?, metadata? }`)

All routes require authentication and the user's ID is automatically extracted from the request context.

## Well-Known Preference Keys

The following preference keys are reserved for system-level settings:

- `theme` - UI theme (`'light'` | `'dark'` | `'system'`)
- `locale` - User's preferred locale (`'en-US'`, `'zh-CN'`, etc.)
- `timezone` - User's timezone (`'America/New_York'`, etc.)
- `favorites` - User's favorite items (structured array)
- `recent_items` - Recently accessed items (structured array)
- `sidebar_collapsed` - UI: sidebar state (boolean)
- `page_size` - Default pagination size (number)

Plugins can define custom keys using their own namespace, e.g., `plugin.ai.auto_save`.

## Schema

### UserPreferenceEntry

```typescript
{
  id: string;              // Auto-generated (e.g., 'pref_abc123')
  userId: string;          // User ID
  key: string;             // Preference key
  value: unknown;          // JSON-serializable value
  valueType?: string;      // Type hint: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### FavoriteEntry

```typescript
{
  id: string;              // Auto-generated (e.g., 'fav_xyz789')
  type: 'object' | 'view' | 'app' | 'dashboard' | 'report' | 'record';
  target: string;          // Target reference (object name, view name, etc.)
  label?: string;          // Display label override
  icon?: string;           // Icon override
  metadata?: Record<string, unknown>;  // Custom metadata
  createdAt: string;       // ISO timestamp
}
```

## Database

The plugin creates a `user_preferences` object in ObjectQL with the following schema:

- `id` (text, primary) - Unique identifier
- `user_id` (text, indexed) - User who owns the preference
- `key` (text, indexed) - Preference key
- `value` (textarea) - JSON-serialized value
- `value_type` (select) - Type hint for client-side type safety
- `created_at` (datetime) - Creation timestamp
- `updated_at` (datetime) - Last update timestamp

Unique composite index: `(user_id, key)`

## Architecture

The service follows ObjectStack's standard patterns:

1. **Spec Layer** (`@objectstack/spec/identity`) - Zod schemas for preferences and favorites
2. **Contract Layer** (`@objectstack/spec/contracts`) - Service interfaces (IUserPreferencesService, IUserFavoritesService)
3. **Implementation Layer** - ObjectQL-based adapter for persistence
4. **Plugin Layer** - Kernel plugin with service registration and HTTP routes
5. **Client Layer** - Type-safe client SDK (future enhancement)

## License

Apache-2.0 © ObjectStack
