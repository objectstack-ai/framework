// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * Unified Query DSL Specification
 * 
 * Based on industry best practices from:
 * - Prisma ORM
 * - Strapi CMS
 * - TypeORM
 * - LoopBack Framework
 * 
 * Version: 1.0.0
 * Status: Draft
 * 
 * Objective: Define a JSON-based, database-agnostic query syntax standard
 * for data filtering interactions between frontend and backend APIs.
 * 
 * Design Principles:
 * 1. Declarative: Frontend describes "what data to get", not "how to query"
 * 2. Database Agnostic: Syntax contains no database-specific directives
 * 3. Type Safe: Structure can be statically inferred by TypeScript
 * 4. Convention over Configuration: Implicit syntax for common queries
 */

/**
 * Field Reference
 * Represents a reference to another field/column instead of a literal value.
 * Used for joins (ON clause) and cross-field comparisons.
 * 
 * @example
 * // user.id = order.owner_id
 * { "$eq": { "$field": "order.owner_id" } }
 */
export const FieldReferenceSchema = z.object({
  $field: z.string().describe('Field Reference/Column Name')
});

export type FieldReference = z.infer<typeof FieldReferenceSchema>;

// ============================================================================
// 3.1 Comparison Operators
// ============================================================================

/**
 * Comparison operators for equality and inequality checks.
 * Supported data types: Any
 */
export const EqualityOperatorSchema = z.object({
  /** Equal to (default) - SQL: = | MongoDB: $eq */
  $eq: z.any().optional(),
  
  /** Not equal to - SQL: <> or != | MongoDB: $ne */
  $ne: z.any().optional(),
});

/**
 * Comparison operators for numeric and date comparisons.
 * Supported data types: Number, Date
 */
export const ComparisonOperatorSchema = z.object({
  /** Greater than - SQL: > | MongoDB: $gt */
  $gt: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  
  /** Greater than or equal to - SQL: >= | MongoDB: $gte */
  $gte: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  
  /** Less than - SQL: < | MongoDB: $lt */
  $lt: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  
  /** Less than or equal to - SQL: <= | MongoDB: $lte */
  $lte: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
});

// ============================================================================
// 3.2 Set & Range Operators
// ============================================================================

/**
 * Set operators for membership checks.
 */
export const SetOperatorSchema = z.object({
  /** In list - SQL: IN (?, ?, ?) | MongoDB: $in */
  $in: z.array(z.any()).optional(),
  
  /** Not in list - SQL: NOT IN (...) | MongoDB: $nin */
  $nin: z.array(z.any()).optional(),
});

/**
 * Range operator for interval checks (closed interval).
 * SQL: BETWEEN ? AND ? | MongoDB: $gte AND $lte
 */
export const RangeOperatorSchema = z.object({
  /** Between (inclusive) - takes [min, max] array */
  $between: z.tuple([
    z.union([z.number(), z.date(), FieldReferenceSchema]),
    z.union([z.number(), z.date(), FieldReferenceSchema])
  ]).optional(),
});

// ============================================================================
// 3.3 String-Specific Operators
// ============================================================================

/**
 * String pattern matching operators.
 * Note: Case sensitivity should be handled at backend level.
 */
export const StringOperatorSchema = z.object({
  /** Contains substring - SQL: LIKE %?% | MongoDB: $regex */
  $contains: z.string().optional(),
  
  /** Does not contain substring - SQL: NOT LIKE %?% | MongoDB: $not: $regex */
  $notContains: z.string().optional(),
  
  /** Starts with prefix - SQL: LIKE ?% | MongoDB: $regex */
  $startsWith: z.string().optional(),
  
  /** Ends with suffix - SQL: LIKE %? | MongoDB: $regex */
  $endsWith: z.string().optional(),
});

// ============================================================================
// 3.5 Special Operators
// ============================================================================

/**
 * Special check operators for null and existence.
 */
export const SpecialOperatorSchema = z.object({
  /** Is null check - SQL: IS NULL (true) / IS NOT NULL (false) | MongoDB: field: null */
  $null: z.boolean().optional(),
  
  /** Field exists check (primarily for NoSQL) - MongoDB: $exists */
  $exists: z.boolean().optional(),
});

// ============================================================================
// Combined Field Operators
// ============================================================================

/**
 * All field-level operators combined.
 * These can be applied to individual fields in a filter.
 */
export const FieldOperatorsSchema = z.object({
  // Equality
  $eq: z.any().optional(),
  $ne: z.any().optional(),
  
  // Comparison (numeric/date)
  $gt: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  $gte: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  $lt: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  $lte: z.union([z.number(), z.date(), FieldReferenceSchema]).optional(),
  
  // Set & Range
  $in: z.array(z.any()).optional(),
  $nin: z.array(z.any()).optional(),
  $between: z.tuple([
    z.union([z.number(), z.date(), FieldReferenceSchema]),
    z.union([z.number(), z.date(), FieldReferenceSchema])
  ]).optional(),
  
  // String-specific
  $contains: z.string().optional(),
  $notContains: z.string().optional(),
  $startsWith: z.string().optional(),
  $endsWith: z.string().optional(),
  
  // Special
  $null: z.boolean().optional(),
  $exists: z.boolean().optional(),
});

// ============================================================================
// 3.4 Logical Operators & Recursive Filter Structure
// ============================================================================

/**
 * Recursive filter type that supports:
 * 1. Implicit equality: { field: value }
 * 2. Explicit operators: { field: { $op: value } }
 * 3. Logical combinations: { $and: [...], $or: [...], $not: {...} }
 * 4. Nested relations: { relation: { field: value } }
 */
export type FilterCondition = {
  [key: string]: 
    | any  // Implicit equality: key: value
    | z.infer<typeof FieldOperatorsSchema>  // Explicit operators: key: { $op: value }
    | FilterCondition;  // Nested relation: key: { nested: ... }
} & {
  /** Logical AND - combines all conditions that must be true */
  $and?: FilterCondition[];
  
  /** Logical OR - at least one condition must be true */
  $or?: FilterCondition[];
  
  /** Logical NOT - negates the condition */
  $not?: FilterCondition;
};

/**
 * Zod schema for recursive filter validation.
 * Uses z.lazy() to handle recursive structure.
 */
export const FilterConditionSchema: z.ZodType<FilterCondition> = z.lazy(() =>
  z.record(z.string(), z.unknown()).and(
    z.object({
      $and: z.array(FilterConditionSchema).optional(),
      $or: z.array(FilterConditionSchema).optional(),
      $not: FilterConditionSchema.optional(),
    })
  )
);

// ============================================================================
// Query Filter Wrapper
// ============================================================================

/**
 * Top-level query filter wrapper.
 * This is typically used as the "where" clause in a query.
 * 
 * @example
 * ```typescript
 * const filter: QueryFilter = {
 *   where: {
 *     status: "active",                    // Implicit equality
 *     age: { $gte: 18 },                   // Explicit operator
 *     $or: [                               // Logical combination
 *       { role: "admin" },
 *       { email: { $contains: "@company.com" } }
 *     ],
 *     profile: {                           // Nested relation
 *       verified: true
 *     }
 *   }
 * }
 * ```
 */
export const QueryFilterSchema = z.object({
  where: FilterConditionSchema.optional(),
});

// ============================================================================
// TypeScript Type Exports
// ============================================================================

/**
 * Type-safe filter operators for use in TypeScript.
 * 
 * @example
 * ```typescript
 * type UserFilter = Filter<User>;
 * 
 * const filter: UserFilter = {
 *   age: { $gte: 18 },
 *   email: { $contains: "@example.com" }
 * };
 * ```
 */
export type Filter<T = any> = {
  [K in keyof T]?: 
    | T[K]  // Implicit equality
    | {
        $eq?: T[K];
        $ne?: T[K];
        $gt?: T[K] extends number | Date ? T[K] : never;
        $gte?: T[K] extends number | Date ? T[K] : never;
        $lt?: T[K] extends number | Date ? T[K] : never;
        $lte?: T[K] extends number | Date ? T[K] : never;
        $in?: T[K][];
        $nin?: T[K][];
        $between?: T[K] extends number | Date ? [T[K], T[K]] : never;
        $contains?: T[K] extends string ? string : never;
        $notContains?: T[K] extends string ? string : never;
        $startsWith?: T[K] extends string ? string : never;
        $endsWith?: T[K] extends string ? string : never;
        $null?: boolean;
        $exists?: boolean;
      }
    | (T[K] extends object ? Filter<T[K]> : never);  // Nested relation
} & {
  $and?: Filter<T>[];
  $or?: Filter<T>[];
  $not?: Filter<T>;
};

/**
 * Scalar types supported by the filter system.
 */
export type Scalar = string | number | boolean | Date | null;

// Export inferred types
export type FieldOperators = z.infer<typeof FieldOperatorsSchema>;
export type QueryFilter = z.infer<typeof QueryFilterSchema>;

// ============================================================================
// Normalization Utilities (Internal Representation)
// ============================================================================

/**
 * Normalized filter AST structure.
 * This is the internal representation after converting all syntactic sugar
 * to explicit operators.
 * 
 * Stage 1: Normalization Pass
 * Input:  { age: 18, role: "admin" }
 * Output: { $and: [{ age: { $eq: 18 } }, { role: { $eq: "admin" } }] }
 * 
 * This simplifies adapter implementation by providing a consistent structure.
 */
export const NormalizedFilterSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    $and: z.array(
      z.union([
        // Field condition: { field: { $op: value } }
        z.record(z.string(), FieldOperatorsSchema),
        // Nested logical group
        NormalizedFilterSchema,
      ])
    ).optional(),
    
    $or: z.array(
      z.union([
        z.record(z.string(), FieldOperatorsSchema),
        NormalizedFilterSchema,
      ])
    ).optional(),
    
    $not: z.union([
      z.record(z.string(), FieldOperatorsSchema),
      NormalizedFilterSchema,
    ]).optional(),
  })
);

export type NormalizedFilter = z.infer<typeof NormalizedFilterSchema>;

// ============================================================================
// AST Array Format Detection & Validation
// ============================================================================

/**
 * Set of valid AST comparison operators (case-insensitive).
 * Used by `isFilterAST()` to validate AST structure beyond `Array.isArray`.
 */
export const VALID_AST_OPERATORS = new Set([
  '=', '==', '!=', '<>', '>', '>=', '<', '<=',
  'in', 'nin', 'not_in',
  'contains', 'notcontains', 'not_contains', 'like',
  'startswith', 'starts_with',
  'endswith', 'ends_with',
  'between',
  'is_null', 'is_not_null',
]);

/**
 * Detect whether a value is a valid Filter AST array structure.
 *
 * A valid AST is one of:
 * - Comparison node: `[field: string, operator: string, value: unknown]` where operator is a known operator
 * - Logical node: `["and" | "or", ...children]` where children are valid AST nodes
 * - Legacy flat array: `[[cond], [cond], ...]` where all elements are sub-arrays (each a valid AST node)
 *
 * This replaces the naïve `Array.isArray(filter)` check, preventing accidental
 * misidentification of arbitrary arrays as filter ASTs.
 *
 * @example
 * isFilterAST(["status", "=", "active"])              // true
 * isFilterAST(["and", ["a", "=", 1], ["b", ">", 2]]) // true
 * isFilterAST([["a", "=", 1], ["b", "=", 2]])         // true (legacy)
 * isFilterAST([1, 2, 3])                               // false
 * isFilterAST("not an array")                           // false
 * isFilterAST({ status: "active" })                     // false
 */
export function isFilterAST(filter: unknown): boolean {
  if (!Array.isArray(filter) || filter.length === 0) return false;

  const first = filter[0];

  // Logical node: ["and", ...] or ["or", ...]
  if (typeof first === 'string') {
    const lower = first.toLowerCase();
    if (lower === 'and' || lower === 'or') {
      return filter.length >= 2 && filter.slice(1).every((child: unknown) => isFilterAST(child));
    }

    // Comparison node: [field, operator, value]
    if (filter.length >= 2 && typeof filter[1] === 'string') {
      return VALID_AST_OPERATORS.has(filter[1].toLowerCase());
    }
  }

  // Legacy flat array: [[cond], [cond], ...]
  if (filter.every((item: unknown) => isFilterAST(item))) {
    return filter.length > 0;
  }

  return false;
}

// ============================================================================
// AST Array → FilterCondition Conversion
// ============================================================================

/**
 * Operator mapping from AST infix operators to FilterCondition `$`-prefixed operators.
 */
const AST_OPERATOR_MAP: Record<string, string> = {
  '=': '$eq',
  '==': '$eq',
  '!=': '$ne',
  '<>': '$ne',
  '>': '$gt',
  '>=': '$gte',
  '<': '$lt',
  '<=': '$lte',
  'in': '$in',
  'nin': '$nin',
  'not_in': '$nin',
  'contains': '$contains',
  'notcontains': '$notContains',
  'not_contains': '$notContains',
  'like': '$contains',
  'startswith': '$startsWith',
  'starts_with': '$startsWith',
  'endswith': '$endsWith',
  'ends_with': '$endsWith',
  'between': '$between',
  'is_null': '$null',
  'is_not_null': '$null',
};

/**
 * Convert a single AST comparison node `[field, operator, value]` to a FilterCondition object.
 */
function convertComparison(node: [string, string, unknown]): FilterCondition {
  const [field, operator, value] = node;
  const op = operator.toLowerCase();

  // Special case: equality shorthand
  if (op === '=' || op === '==') {
    return { [field]: value } as FilterCondition;
  }

  // Null check operators
  if (op === 'is_null') {
    return { [field]: { $null: true } } as FilterCondition;
  }
  if (op === 'is_not_null') {
    return { [field]: { $null: false } } as FilterCondition;
  }

  const mapped = AST_OPERATOR_MAP[op];
  if (mapped) {
    return { [field]: { [mapped]: value } } as FilterCondition;
  }

  // Fallback: use the operator as-is with $ prefix
  return { [field]: { [`$${op}`]: value } } as FilterCondition;
}

/**
 * Parse a filter from AST array format to FilterCondition object format.
 *
 * The AST array format is used by the ObjectUI client and the `FilterBuilder`:
 * - Comparison: `[field, operator, value]` → `{ field: value }` or `{ field: { $op: value } }`
 * - Logical AND: `["and", cond1, cond2, ...]` → `{ $and: [...] }`
 * - Logical OR: `["or", cond1, cond2, ...]` → `{ $or: [...] }`
 *
 * If the input is already a FilterCondition object (not an array), it is returned as-is.
 * If the input is `null` or `undefined`, it is returned as-is.
 *
 * @example
 * // Simple condition
 * parseFilterAST(["status", "=", "active"])
 * // → { status: "active" }
 *
 * @example
 * // Compound AND
 * parseFilterAST(["and", ["priority", "=", "high"], ["status", "=", "active"]])
 * // → { $and: [{ priority: "high" }, { status: "active" }] }
 *
 * @example
 * // Object passthrough
 * parseFilterAST({ status: "active" })
 * // → { status: "active" }
 */
export function parseFilterAST(filter: unknown): FilterCondition | undefined {
  if (filter == null) return undefined;
  if (!Array.isArray(filter)) return filter as FilterCondition;
  if (filter.length === 0) return undefined;

  const first = filter[0];

  // Logical node: ["and", cond1, cond2, ...] or ["or", cond1, cond2, ...]
  if (typeof first === 'string' && (first.toLowerCase() === 'and' || first.toLowerCase() === 'or')) {
    const logicOp = `$${first.toLowerCase()}` as '$and' | '$or';
    const children = filter.slice(1).map((child: unknown) => parseFilterAST(child)).filter(Boolean) as FilterCondition[];
    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return { [logicOp]: children } as FilterCondition;
  }

  // Comparison node: [field, operator, value]
  if (filter.length >= 2 && typeof first === 'string') {
    return convertComparison(filter as [string, string, unknown]);
  }

  // Legacy flat array: [[field, op, val], [field, op, val], ...]
  // All elements are sub-arrays → treat as implicit AND
  if (filter.every((item: unknown) => Array.isArray(item))) {
    const children = filter.map((child: unknown) => parseFilterAST(child)).filter(Boolean) as FilterCondition[];
    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return { $and: children } as FilterCondition;
  }

  return undefined;
}

// ============================================================================
// Constants & Metadata
// ============================================================================

/**
 * All supported operator keys.
 * Useful for validation and parsing.
 */
export const FILTER_OPERATORS = [
  // Equality
  '$eq', '$ne',
  // Comparison
  '$gt', '$gte', '$lt', '$lte',
  // Set & Range
  '$in', '$nin', '$between',
  // String
  '$contains', '$notContains', '$startsWith', '$endsWith',
  // Special
  '$null', '$exists',
] as const;

/**
 * Logical operator keys.
 */
export const LOGICAL_OPERATORS = ['$and', '$or', '$not'] as const;

/**
 * All operator keys (field + logical).
 */
export const ALL_OPERATORS = [...FILTER_OPERATORS, ...LOGICAL_OPERATORS] as const;

export type FilterOperatorKey = typeof FILTER_OPERATORS[number];
export type LogicalOperatorKey = typeof LOGICAL_OPERATORS[number];
export type OperatorKey = typeof ALL_OPERATORS[number];
