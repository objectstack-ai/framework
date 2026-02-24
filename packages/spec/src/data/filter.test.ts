import { describe, it, expect } from 'vitest';
import {
  FilterConditionSchema,
  QueryFilterSchema,
  FieldOperatorsSchema,
  EqualityOperatorSchema,
  ComparisonOperatorSchema,
  SetOperatorSchema,
  RangeOperatorSchema,
  StringOperatorSchema,
  SpecialOperatorSchema,
  NormalizedFilterSchema,
  FILTER_OPERATORS,
  LOGICAL_OPERATORS,
  ALL_OPERATORS,
  parseFilterAST,
  type Filter,
  type QueryFilter,
  type FieldOperators,
} from './filter.zod';

// ============================================================================
// 3.1 Comparison Operators Tests
// ============================================================================

describe('EqualityOperatorSchema', () => {
  it('should accept $eq operator', () => {
    const filter = { $eq: 'active' };
    expect(() => EqualityOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept $ne operator', () => {
    const filter = { $ne: 'inactive' };
    expect(() => EqualityOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept any data type', () => {
    expect(() => EqualityOperatorSchema.parse({ $eq: 'string' })).not.toThrow();
    expect(() => EqualityOperatorSchema.parse({ $eq: 123 })).not.toThrow();
    expect(() => EqualityOperatorSchema.parse({ $eq: true })).not.toThrow();
    expect(() => EqualityOperatorSchema.parse({ $eq: null })).not.toThrow();
  });
});

describe('ComparisonOperatorSchema', () => {
  it('should accept numeric comparisons', () => {
    expect(() => ComparisonOperatorSchema.parse({ $gt: 18 })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $gte: 21 })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $lt: 100 })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $lte: 99 })).not.toThrow();
  });

  it('should accept date comparisons', () => {
    const date = new Date('2024-01-01');
    expect(() => ComparisonOperatorSchema.parse({ $gt: date })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $gte: date })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $lt: date })).not.toThrow();
    expect(() => ComparisonOperatorSchema.parse({ $lte: date })).not.toThrow();
  });
});

// ============================================================================
// 3.2 Set & Range Operators Tests
// ============================================================================

describe('SetOperatorSchema', () => {
  it('should accept $in operator with array', () => {
    const filter = { $in: ['admin', 'editor', 'viewer'] };
    expect(() => SetOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept $nin operator with array', () => {
    const filter = { $nin: ['guest', 'anonymous'] };
    expect(() => SetOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept arrays of different types', () => {
    expect(() => SetOperatorSchema.parse({ $in: [1, 2, 3] })).not.toThrow();
    expect(() => SetOperatorSchema.parse({ $in: ['a', 'b', 'c'] })).not.toThrow();
  });
});

describe('RangeOperatorSchema', () => {
  it('should accept $between with numeric range', () => {
    const filter = { $between: [18, 65] as [number, number] };
    expect(() => RangeOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept $between with date range', () => {
    const filter = { 
      $between: [new Date('2024-01-01'), new Date('2024-12-31')] as [Date, Date]
    };
    expect(() => RangeOperatorSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// 3.3 String-Specific Operators Tests
// ============================================================================

describe('StringOperatorSchema', () => {
  it('should accept $contains operator', () => {
    const filter = { $contains: '@company.com' };
    expect(() => StringOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept $startsWith operator', () => {
    const filter = { $startsWith: 'admin_' };
    expect(() => StringOperatorSchema.parse(filter)).not.toThrow();
  });

  it('should accept $endsWith operator', () => {
    const filter = { $endsWith: '.pdf' };
    expect(() => StringOperatorSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// 3.5 Special Operators Tests
// ============================================================================

describe('SpecialOperatorSchema', () => {
  it('should accept $null operator', () => {
    expect(() => SpecialOperatorSchema.parse({ $null: true })).not.toThrow();
    expect(() => SpecialOperatorSchema.parse({ $null: false })).not.toThrow();
  });

  it('should accept $exists operator', () => {
    expect(() => SpecialOperatorSchema.parse({ $exists: true })).not.toThrow();
    expect(() => SpecialOperatorSchema.parse({ $exists: false })).not.toThrow();
  });
});

// ============================================================================
// Combined Field Operators Tests
// ============================================================================

describe('FieldOperatorsSchema', () => {
  it('should accept multiple operators combined', () => {
    const filter: FieldOperators = {
      $gte: 18,
      $lte: 65,
    };
    expect(() => FieldOperatorsSchema.parse(filter)).not.toThrow();
  });

  it('should accept all operator types', () => {
    const filter: FieldOperators = {
      $eq: 'value',
      $ne: 'other',
      $gt: 10,
      $gte: 10,
      $lt: 100,
      $lte: 100,
      $in: ['a', 'b'],
      $nin: ['c', 'd'],
      $between: [1, 10] as [number, number],
      $contains: 'test',
      $startsWith: 'prefix',
      $endsWith: 'suffix',
      $null: false,
      $exists: true,
    };
    expect(() => FieldOperatorsSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// Filter Condition Tests - Basic
// ============================================================================

describe('FilterConditionSchema - Implicit Equality', () => {
  it('should accept simple implicit equality', () => {
    const filter = { status: 'active' };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept multiple implicit equalities', () => {
    const filter = {
      status: 'active',
      role: 'admin',
      verified: true,
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });
});

describe('FilterConditionSchema - Explicit Operators', () => {
  it('should accept explicit comparison operators', () => {
    const filter = {
      age: { $gte: 18 },
      score: { $lt: 100 },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept explicit string operators', () => {
    const filter = {
      email: { $contains: '@company.com' },
      username: { $startsWith: 'admin_' },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept explicit set operators', () => {
    const filter = {
      status: { $in: ['active', 'pending'] },
      role: { $nin: ['guest', 'anonymous'] },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// Filter Condition Tests - Logical Operators
// ============================================================================

describe('FilterConditionSchema - Logical Operators', () => {
  it('should accept $and operator', () => {
    const filter = {
      $and: [
        { status: 'active' },
        { age: { $gte: 18 } },
      ],
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept $or operator', () => {
    const filter = {
      $or: [
        { role: 'admin' },
        { role: 'editor' },
      ],
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept $not operator', () => {
    const filter = {
      $not: { status: 'deleted' },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept nested logical operators', () => {
    const filter = {
      $and: [
        { status: 'active' },
        {
          $or: [
            { role: 'admin' },
            { permissions: { $contains: 'edit' } },
          ],
        },
      ],
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// Filter Condition Tests - Relation Queries
// ============================================================================

describe('FilterConditionSchema - Nested Relations', () => {
  it('should accept nested object filters', () => {
    const filter = {
      profile: {
        verified: true,
      },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept deeply nested relations', () => {
    const filter = {
      department: {
        company: {
          country: 'USA',
        },
      },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept nested relations with operators', () => {
    const filter = {
      department: {
        name: { $eq: 'IT' },
        employeeCount: { $gt: 10 },
      },
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// Query Filter Tests - Complete Examples
// ============================================================================

describe('QueryFilterSchema - Complete Examples', () => {
  it('should accept the example from specification', () => {
    const filter: QueryFilter = {
      where: {
        status: 'active',                     // Implicit equality (AND)
        age: { $gte: 18 },                    // Explicit comparison (AND)
        $or: [                                // Logical branch
          { role: 'admin' },
          { email: { $contains: '@company.com' } },
        ],
        profile: {                            // Relation query
          verified: true,
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept complex nested query', () => {
    const filter: QueryFilter = {
      where: {
        $and: [
          { status: { $in: ['active', 'pending'] } },
          { createdAt: { $gte: new Date('2024-01-01') } },
          {
            $or: [
              { priority: 'high' },
              { assignee: { $null: false } },
            ],
          },
        ],
        tags: {
          name: { $contains: 'urgent' },
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept query with all operator types', () => {
    const filter: QueryFilter = {
      where: {
        // Equality
        status: 'active',
        archived: { $ne: true },
        
        // Comparison
        age: { $gte: 18, $lte: 65 },
        score: { $gt: 80 },
        
        // Set
        role: { $in: ['admin', 'editor'] },
        category: { $nin: ['spam', 'deleted'] },
        
        // Range
        createdAt: { 
          $between: [
            new Date('2024-01-01'), 
            new Date('2024-12-31')
          ] as [Date, Date]
        },
        
        // String
        email: { $contains: '@example.com' },
        username: { $startsWith: 'user_' },
        filename: { $endsWith: '.pdf' },
        
        // Special
        deletedAt: { $null: true },
        metadata: { $exists: true },
        
        // Logical
        $or: [
          { priority: 'high' },
          { urgent: true },
        ],
        
        // Nested relation
        owner: {
          department: {
            name: 'Engineering',
          },
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// TypeScript Type Tests
// ============================================================================

describe('TypeScript Type System', () => {
  it('should infer correct types for simple filter', () => {
    interface User {
      id: number;
      name: string;
      age: number;
      email: string;
      active: boolean;
    }

    const filter: Filter<User> = {
      age: { $gte: 18 },
      email: { $contains: '@example.com' },
      active: true,
    };

    expect(filter).toBeDefined();
  });

  it('should infer correct types for nested relations', () => {
    interface User {
      id: number;
      name: string;
      profile: {
        verified: boolean;
        bio: string;
      };
    }

    const filter: Filter<User> = {
      name: { $startsWith: 'John' },
      profile: {
        verified: true,
        bio: { $contains: 'developer' },
      },
    };

    expect(filter).toBeDefined();
  });

  it('should support logical operators', () => {
    interface Task {
      title: string;
      status: string;
      priority: number;
    }

    const filter: Filter<Task> = {
      $or: [
        { status: 'urgent' },
        { priority: { $gt: 8 } },
      ],
      $and: [
        { title: { $contains: 'bug' } },
        { status: { $ne: 'closed' } },
      ],
    };

    expect(filter).toBeDefined();
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Filter Operator Constants', () => {
  it('should export all filter operators', () => {
    expect(FILTER_OPERATORS).toContain('$eq');
    expect(FILTER_OPERATORS).toContain('$ne');
    expect(FILTER_OPERATORS).toContain('$gt');
    expect(FILTER_OPERATORS).toContain('$gte');
    expect(FILTER_OPERATORS).toContain('$lt');
    expect(FILTER_OPERATORS).toContain('$lte');
    expect(FILTER_OPERATORS).toContain('$in');
    expect(FILTER_OPERATORS).toContain('$nin');
    expect(FILTER_OPERATORS).toContain('$between');
    expect(FILTER_OPERATORS).toContain('$contains');
    expect(FILTER_OPERATORS).toContain('$startsWith');
    expect(FILTER_OPERATORS).toContain('$endsWith');
    expect(FILTER_OPERATORS).toContain('$null');
    expect(FILTER_OPERATORS).toContain('$exists');
  });

  it('should export all logical operators', () => {
    expect(LOGICAL_OPERATORS).toContain('$and');
    expect(LOGICAL_OPERATORS).toContain('$or');
    expect(LOGICAL_OPERATORS).toContain('$not');
  });

  it('should export all operators combined', () => {
    expect(ALL_OPERATORS.length).toBe(FILTER_OPERATORS.length + LOGICAL_OPERATORS.length);
  });
});

// ============================================================================
// Edge Cases & Validation
// ============================================================================

describe('FilterConditionSchema - Edge Cases', () => {
  it('should accept empty where clause', () => {
    const filter: QueryFilter = { where: {} };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept undefined where clause', () => {
    const filter: QueryFilter = {};
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept empty logical arrays', () => {
    const filter = {
      $and: [],
      $or: [],
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });

  it('should accept complex deeply nested structure', () => {
    const filter = {
      $and: [
        {
          $or: [
            { status: 'active' },
            {
              $and: [
                { archived: false },
                { deletedAt: { $null: true } },
              ],
            },
          ],
        },
        {
          $not: {
            role: { $in: ['banned', 'suspended'] },
          },
        },
      ],
    };
    expect(() => FilterConditionSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// Real-World Use Case Examples
// ============================================================================

describe('Real-World Use Cases', () => {
  it('should support user search query', () => {
    const filter: QueryFilter = {
      where: {
        $or: [
          { name: { $contains: 'john' } },
          { email: { $contains: 'john' } },
          { username: { $contains: 'john' } },
        ],
        status: 'active',
        role: { $in: ['user', 'admin'] },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should support e-commerce order filtering', () => {
    const filter: QueryFilter = {
      where: {
        status: { $in: ['pending', 'processing', 'shipped'] },
        totalAmount: { $gte: 100 },
        createdAt: {
          $between: [
            new Date('2024-01-01'),
            new Date('2024-12-31'),
          ] as [Date, Date],
        },
        customer: {
          tier: 'premium',
          country: { $in: ['US', 'CA', 'UK'] },
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should support project task filtering', () => {
    const filter: QueryFilter = {
      where: {
        $and: [
          {
            $or: [
              { priority: 'high' },
              { dueDate: { $lt: new Date() } },
            ],
          },
          { status: { $ne: 'completed' } },
          { assignee: { $null: false } },
        ],
        project: {
          status: 'active',
          team: {
            department: 'Engineering',
          },
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });

  it('should support content management filtering', () => {
    const filter: QueryFilter = {
      where: {
        $and: [
          { published: true },
          { deletedAt: { $null: true } },
        ],
        $or: [
          { title: { $contains: 'tutorial' } },
          { tags: { name: { $in: ['tutorial', 'guide', 'howto'] } } },
        ],
        author: {
          verified: true,
          role: { $in: ['editor', 'admin'] },
        },
        publishedAt: {
          $gte: new Date('2024-01-01'),
        },
      },
    };
    expect(() => QueryFilterSchema.parse(filter)).not.toThrow();
  });
});

describe('NormalizedFilterSchema', () => {
  it('should accept normalized $and condition', () => {
    const filter = {
      $and: [
        { age: { $eq: 18 } },
        { role: { $eq: 'admin' } }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept normalized $or condition', () => {
    const filter = {
      $or: [
        { status: { $eq: 'active' } },
        { status: { $eq: 'pending' } }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept normalized $not condition', () => {
    const filter = {
      $not: { deleted: { $eq: true } }
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept nested normalized filters in $and', () => {
    const filter = {
      $and: [
        { age: { $gte: 18 } },
        {
          $or: [
            { role: { $eq: 'admin' } },
            { role: { $eq: 'moderator' } }
          ]
        }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept nested normalized filters in $or', () => {
    const filter = {
      $or: [
        { status: { $eq: 'active' } },
        {
          $and: [
            { status: { $eq: 'pending' } },
            { verified: { $eq: true } }
          ]
        }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept nested normalized filter in $not', () => {
    const filter = {
      $not: {
        $and: [
          { deleted: { $eq: true } },
          { archived: { $eq: true } }
        ]
      }
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept complex deeply nested normalized filters', () => {
    const filter = {
      $and: [
        { active: { $eq: true } },
        {
          $or: [
            { type: { $eq: 'premium' } },
            {
              $and: [
                { type: { $eq: 'basic' } },
                { credits: { $gte: 100 } }
              ]
            }
          ]
        }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept multiple operators in $and', () => {
    const filter = {
      $and: [
        { age: { $gte: 18 } },
        { age: { $lte: 65 } },
        { role: { $in: ['user', 'admin'] } }
      ]
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept empty optional operators', () => {
    const filter = {};
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });

  it('should accept combination of all logical operators', () => {
    const filter = {
      $and: [
        { active: { $eq: true } }
      ],
      $or: [
        { role: { $eq: 'admin' } },
        { role: { $eq: 'moderator' } }
      ],
      $not: {
        deleted: { $eq: true }
      }
    };
    
    expect(() => NormalizedFilterSchema.parse(filter)).not.toThrow();
  });
});

// ============================================================================
// parseFilterAST Tests
// ============================================================================

describe('parseFilterAST', () => {
  it('should return undefined for null/undefined input', () => {
    expect(parseFilterAST(null)).toBeUndefined();
    expect(parseFilterAST(undefined)).toBeUndefined();
  });

  it('should return undefined for empty array', () => {
    expect(parseFilterAST([])).toBeUndefined();
  });

  it('should pass through object filters as-is', () => {
    const filter = { status: 'active' };
    expect(parseFilterAST(filter)).toEqual({ status: 'active' });
  });

  it('should pass through FilterCondition with $and/$or as-is', () => {
    const filter = { $and: [{ priority: 'high' }, { status: 'active' }] };
    expect(parseFilterAST(filter)).toEqual(filter);
  });

  it('should convert simple equality comparison', () => {
    expect(parseFilterAST(['status', '=', 'active'])).toEqual({ status: 'active' });
  });

  it('should convert == equality comparison', () => {
    expect(parseFilterAST(['status', '==', 'active'])).toEqual({ status: 'active' });
  });

  it('should convert != comparison', () => {
    expect(parseFilterAST(['status', '!=', 'deleted'])).toEqual({ status: { $ne: 'deleted' } });
  });

  it('should convert <> comparison', () => {
    expect(parseFilterAST(['status', '<>', 'deleted'])).toEqual({ status: { $ne: 'deleted' } });
  });

  it('should convert > comparison', () => {
    expect(parseFilterAST(['age', '>', 18])).toEqual({ age: { $gt: 18 } });
  });

  it('should convert >= comparison', () => {
    expect(parseFilterAST(['age', '>=', 18])).toEqual({ age: { $gte: 18 } });
  });

  it('should convert < comparison', () => {
    expect(parseFilterAST(['age', '<', 65])).toEqual({ age: { $lt: 65 } });
  });

  it('should convert <= comparison', () => {
    expect(parseFilterAST(['age', '<=', 65])).toEqual({ age: { $lte: 65 } });
  });

  it('should convert in operator', () => {
    expect(parseFilterAST(['role', 'in', ['admin', 'editor']])).toEqual({ role: { $in: ['admin', 'editor'] } });
  });

  it('should convert not_in operator', () => {
    expect(parseFilterAST(['role', 'not_in', ['guest']])).toEqual({ role: { $nin: ['guest'] } });
  });

  it('should convert contains/like operator', () => {
    expect(parseFilterAST(['name', 'contains', 'John'])).toEqual({ name: { $contains: 'John' } });
    expect(parseFilterAST(['name', 'like', 'John'])).toEqual({ name: { $contains: 'John' } });
  });

  it('should convert startswith operator', () => {
    expect(parseFilterAST(['name', 'startswith', 'A'])).toEqual({ name: { $startsWith: 'A' } });
    expect(parseFilterAST(['name', 'starts_with', 'A'])).toEqual({ name: { $startsWith: 'A' } });
  });

  it('should convert endswith operator', () => {
    expect(parseFilterAST(['name', 'endswith', '.pdf'])).toEqual({ name: { $endsWith: '.pdf' } });
    expect(parseFilterAST(['name', 'ends_with', '.pdf'])).toEqual({ name: { $endsWith: '.pdf' } });
  });

  it('should convert is_null operator', () => {
    expect(parseFilterAST(['deleted_at', 'is_null', null])).toEqual({ deleted_at: { $null: true } });
  });

  it('should convert is_not_null operator', () => {
    expect(parseFilterAST(['deleted_at', 'is_not_null', null])).toEqual({ deleted_at: { $null: false } });
  });

  it('should convert AND logical node', () => {
    const input = ['and', ['priority', '=', 'high'], ['status', '=', 'active']];
    expect(parseFilterAST(input)).toEqual({
      $and: [{ priority: 'high' }, { status: 'active' }],
    });
  });

  it('should convert OR logical node', () => {
    const input = ['or', ['role', '=', 'admin'], ['role', '=', 'editor']];
    expect(parseFilterAST(input)).toEqual({
      $or: [{ role: 'admin' }, { role: 'editor' }],
    });
  });

  it('should handle nested logical operators', () => {
    const input = ['and', ['status', '=', 'active'], ['or', ['priority', '=', 'high'], ['priority', '=', 'critical']]];
    expect(parseFilterAST(input)).toEqual({
      $and: [
        { status: 'active' },
        { $or: [{ priority: 'high' }, { priority: 'critical' }] },
      ],
    });
  });

  it('should unwrap single-child logical nodes', () => {
    const input = ['and', ['status', '=', 'active']];
    expect(parseFilterAST(input)).toEqual({ status: 'active' });
  });

  it('should handle case-insensitive logical operators', () => {
    const input = ['AND', ['status', '=', 'active'], ['priority', '=', 'high']];
    expect(parseFilterAST(input)).toEqual({
      $and: [{ status: 'active' }, { priority: 'high' }],
    });
  });

  it('should handle legacy flat array of conditions', () => {
    const input = [['status', '=', 'active'], ['priority', '=', 'high']];
    expect(parseFilterAST(input)).toEqual({
      $and: [{ status: 'active' }, { priority: 'high' }],
    });
  });

  it('should handle real-world browser filter example from issue', () => {
    const input = ['and', ['priority', '=', 'high'], ['status', '=', 'active']];
    const result = parseFilterAST(input);
    expect(result).toEqual({
      $and: [{ priority: 'high' }, { status: 'active' }],
    });
    // Validate the result is a valid FilterCondition
    expect(() => FilterConditionSchema.parse(result)).not.toThrow();
  });

  it('should produce valid FilterCondition for complex nested AST', () => {
    const input = [
      'and',
      ['status', '!=', 'deleted'],
      ['or', ['priority', '=', 'high'], ['age', '>', 18]],
      ['role', 'in', ['admin', 'editor']],
    ];
    const result = parseFilterAST(input);
    expect(result).toEqual({
      $and: [
        { status: { $ne: 'deleted' } },
        { $or: [{ priority: 'high' }, { age: { $gt: 18 } }] },
        { role: { $in: ['admin', 'editor'] } },
      ],
    });
    expect(() => FilterConditionSchema.parse(result)).not.toThrow();
  });
});
