// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Typed errors thrown by Repository implementations. Implementations must
 * use these exact classes (or subclasses) so callers can `instanceof`
 * across package boundaries.
 */

import type { MetaRef } from './types.js';

export class MetadataError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when a `put` or `delete` operation's `parentVersion` does not
 * match the current HEAD. Maps to HTTP 412 Precondition Failed.
 */
export class ConflictError extends MetadataError {
  constructor(
    public readonly ref: MetaRef,
    public readonly expectedParent: string | null,
    public readonly actualHead: string | null,
  ) {
    super(
      'METADATA_CONFLICT',
      `Conflict on ${ref.type}/${ref.name}: expected parent ${expectedParent ?? '<none>'}, ` +
      `current head is ${actualHead ?? '<none>'}`,
    );
  }
}

/** Thrown when a read targets a missing item. Maps to HTTP 404. */
export class NotFoundError extends MetadataError {
  constructor(public readonly ref: MetaRef) {
    super('METADATA_NOT_FOUND', `Metadata not found: ${ref.type}/${ref.name}`);
  }
}

/**
 * Thrown when a `put`'s spec fails Zod validation against the canonical
 * schema for the metadata type. Maps to HTTP 422.
 */
export class SchemaValidationError extends MetadataError {
  constructor(
    public readonly ref: MetaRef,
    public readonly issues: unknown,
  ) {
    super('METADATA_SCHEMA_INVALID', `Spec failed validation for ${ref.type}/${ref.name}`);
  }
}

/** Thrown for parent_branch / fork / merge edge cases. */
export class BranchError extends MetadataError {
  constructor(message: string) {
    super('METADATA_BRANCH', message);
  }
}
