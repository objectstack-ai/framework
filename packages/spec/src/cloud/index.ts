// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Cloud Protocol
 *
 * Cloud-specific protocols for the ObjectStack SaaS platform.
 * These schemas define the contract for cloud services like:
 * - Marketplace (listing, publishing, review, search, install)
 * - Developer Portal (developer registration, API keys, publishing analytics)
 * - Marketplace Administration (review workflow, curation, governance)
 * - App Store (customer experience: reviews, recommendations, subscriptions)
 * - Multi-Tenancy (tenant registry, provisioning, routing)
 * - Future: Composer, Space, Hub Federation
 */
export * from './marketplace.zod';
export * from './developer-portal.zod';
export * from './marketplace-admin.zod';
export * from './app-store.zod';
export * from './tenant.zod';
export * from './environment.zod';
export * from './environment-package.zod';
