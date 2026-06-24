// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

// `schema_reader` (surface:'both') is the shared, read-only schema/query
// capability both kernel agents need, so it stays open here as the mechanism.
export { SCHEMA_READER_SKILL } from './schema-reader-skill.js';
// The `data_explorer` + `actions_executor` skills (the `ask` data product's
// exploration/action intelligence) and the metadata_authoring + solution_design
// authoring skills all moved to the cloud-only @objectstack/service-ai-studio
// package, which registers them on the `ai:ready` hook.
