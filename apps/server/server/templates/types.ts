// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Project Template — descriptor used by the provisioning seeder.
 *
 * A template's `load()` returns an `ObjectStackDefinition`-shaped bundle
 * (objects/views/dashboards/flows/agents/apps/data) which is then fanned
 * out into `bulkRegister` calls against the freshly-provisioned project
 * kernel. Loading is async + lazy so example bundles are evaluated only
 * when the template is actually selected — a Zod drift in one example
 * cannot crash control-plane bootstrap.
 */
export interface ProjectTemplate {
    /** Stable id used by the API / Studio selector. */
    id: string;
    /** Human-readable label shown in Studio. */
    label: string;
    /** Short description for the picker. */
    description: string;
    /** Optional category tag. */
    category?: string;
    /** Lazy bundle loader. Must be cheap to call repeatedly. */
    load(): Promise<any>;
}
