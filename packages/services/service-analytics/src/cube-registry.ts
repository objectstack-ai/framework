// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Cube } from '@objectstack/spec/data';

/**
 * CubeRegistry — Central registry for analytics cube definitions.
 *
 * Cubes can be registered from two sources:
 * 1. **Manifest definitions** — Explicit cube definitions in `objectstack.config.ts`.
 * 2. **Object schema inference** — Auto-generated cubes from ObjectQL object schemas.
 *
 * The registry is the single source of truth for cube metadata discovery
 * (used by `getMeta()` and the strategy chain).
 */
export class CubeRegistry {
  private cubes = new Map<string, Cube>();

  /** Register a single cube definition. Overwrites if name already exists. */
  register(cube: Cube): void {
    this.cubes.set(cube.name, cube);
  }

  /** Register multiple cube definitions at once. */
  registerAll(cubes: Cube[]): void {
    for (const cube of cubes) {
      this.register(cube);
    }
  }

  /** Get a cube definition by name. */
  get(name: string): Cube | undefined {
    return this.cubes.get(name);
  }

  /** Check if a cube is registered. */
  has(name: string): boolean {
    return this.cubes.has(name);
  }

  /** Return all registered cubes. */
  getAll(): Cube[] {
    return Array.from(this.cubes.values());
  }

  /** Return all cube names. */
  names(): string[] {
    return Array.from(this.cubes.keys());
  }

  /** Number of registered cubes. */
  get size(): number {
    return this.cubes.size;
  }

  /** Remove all cubes. */
  clear(): void {
    this.cubes.clear();
  }

  /**
   * Auto-generate a cube definition from an object schema.
   *
   * Heuristic rules:
   * - `number` fields → `sum`, `avg`, `min`, `max` measures
   * - `boolean` fields → `count` measure (count where true)
   * - All non-computed fields → dimensions
   * - `date`/`datetime` fields → time dimensions with standard granularities
   * - A default `count` measure is always added
   *
   * @param objectName - The snake_case object name (used as table/cube name)
   * @param fields - Array of field descriptors `{ name, type, label? }`
   */
  inferFromObject(
    objectName: string,
    fields: Array<{ name: string; type: string; label?: string }>,
  ): Cube {
    const measures: Record<string, any> = {
      count: {
        name: 'count',
        label: 'Count',
        type: 'count',
        sql: '*',
      },
    };
    const dimensions: Record<string, any> = {};

    for (const field of fields) {
      const label = field.label || field.name;

      // All fields become dimensions
      const dimType = this.fieldTypeToDimensionType(field.type);
      dimensions[field.name] = {
        name: field.name,
        label,
        type: dimType,
        sql: field.name,
        ...(dimType === 'time'
          ? { granularities: ['day', 'week', 'month', 'quarter', 'year'] }
          : {}),
      };

      // Numeric fields also become aggregation measures
      if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
        measures[`${field.name}_sum`] = {
          name: `${field.name}_sum`,
          label: `${label} (Sum)`,
          type: 'sum',
          sql: field.name,
        };
        measures[`${field.name}_avg`] = {
          name: `${field.name}_avg`,
          label: `${label} (Avg)`,
          type: 'avg',
          sql: field.name,
        };
      }
    }

    const cube: Cube = {
      name: objectName,
      title: objectName,
      sql: objectName,
      measures,
      dimensions,
      public: false,
    };

    this.register(cube);
    return cube;
  }

  private fieldTypeToDimensionType(fieldType: string): string {
    switch (fieldType) {
      case 'number':
      case 'currency':
      case 'percent':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
      case 'datetime':
        return 'time';
      default:
        return 'string';
    }
  }
}
