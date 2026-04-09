# @objectstack/service-user-preferences

## 1.0.0 (2026-04-09)

### Features

- **Initial Release** - User Preferences Service implementation
- **IUserPreferencesService** - Full service contract with get/set/setMany/delete/getAll/has/clear/listEntries methods
- **IUserFavoritesService** - Specialized favorites service with add/remove/has/toggle/list methods
- **ObjectQL Persistence** - Database-agnostic storage via IDataEngine
- **REST API** - Complete HTTP routes for preferences and favorites management
  - `/api/v1/user/preferences` - CRUD operations for preferences
  - `/api/v1/user/favorites` - Favorites management endpoints
- **Type Safety** - Full TypeScript support with Zod schemas
- **Prefix Filtering** - Query preferences by key prefix (e.g., `plugin.ai.*`)
- **Well-Known Keys** - Predefined system preference keys (theme, locale, timezone, etc.)
- **Auto-Registration** - Automatic plugin registration in CLI and Studio

### Schema

- **UserPreferenceEntry** - Core preference data model
- **FavoriteEntry** - Favorite item structure with type/target/metadata
- **WellKnownPreferenceKeys** - Enum of reserved system preference keys

### Tests

- Comprehensive unit tests for all service methods
- In-memory IDataEngine stub for fast testing
- Test coverage for scalar values, structured data, and edge cases
