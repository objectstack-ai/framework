// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * platform-objects/security — Security & Permission Platform Objects
 *
 * **Empty since ADR-0029 (K2).** The RBAC objects (role / permission-set /
 * user-permission-set / role-permission-set + default permission sets) moved
 * to `@objectstack/plugin-security`, and the sharing objects (record-share /
 * sharing-rule / share-link) moved to `@objectstack/plugin-sharing`, so each
 * plugin owns its data model and behavior as one unit. Import them from the
 * owning plugin instead.
 *
 * The subpath (`@objectstack/platform-objects/security`) is retained as an
 * empty barrel to avoid churning the package `exports` map / tsup entries
 * during the incremental decomposition; it can be removed at ADR-0029 K4.
 */

export {};
