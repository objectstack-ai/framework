// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.


/**
 * Simple In-Memory Query Matcher
 * 
 * Implements a subset of the ObjectStack Filter Protocol (MongoDB-compatible)
 * for evaluating conditions against in-memory JavaScript objects.
 */

type RecordType = Record<string, any>;

/**
 * matches - Check if a record matches a filter criteria
 * @param record The data record to check
 * @param filter The filter condition (where clause)
 */
export function match(record: RecordType, filter: any): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;
    
    // 1. Handle Top-Level Logical Operators ($and, $or, $not)
    // These usually appear at the root or nested.
    
    // $and: [ { ... }, { ... } ]
    if (Array.isArray(filter.$and)) {
        if (!filter.$and.every((f: any) => match(record, f))) {
            return false;
        }
    }
    
    // $or: [ { ... }, { ... } ]
    if (Array.isArray(filter.$or)) {
        if (!filter.$or.some((f: any) => match(record, f))) {
            return false;
        }
    }
    
    // $not: { ... }
    if (filter.$not) {
        if (match(record, filter.$not)) {
            return false;
        }
    }
    
    // 2. Iterate over field constraints
    for (const key of Object.keys(filter)) {
        // Skip logical operators we already handled (or future ones)
        if (key.startsWith('$')) continue;
        
        const condition = filter[key];
        const value = getValueByPath(record, key);
        
        if (!checkCondition(value, condition)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Access nested properties via dot-notation (e.g. "user.name")
 */
export function getValueByPath(obj: any, path: string): any {
    if (!path.includes('.')) return obj[path];
    return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

/**
 * Evaluate a specific condition against a value
 */
function checkCondition(value: any, condition: any): boolean {
    // Case A: Implicit Equality (e.g. status: 'active')
    // If condition is a primitive or Date/Array (exact match), treat as equality.
    if (
        typeof condition !== 'object' || 
        condition === null || 
        condition instanceof Date ||
        Array.isArray(condition)
    ) {
        // Loose equality to handle undefined/null mismatch or string/number coercion if desired.
        // But stick to == for JS loose equality which is often convenient in weakly typed queries.
        return value == condition;
    }
    
    // Case B: Operator Object (e.g. { $gt: 10, $lt: 20 })
    const keys = Object.keys(condition);
    const isOperatorObject = keys.some(k => k.startsWith('$'));
    
    if (!isOperatorObject) {
         // It's just a nested object comparison or implicit equality against an object
         // Simplistic check:
         return JSON.stringify(value) === JSON.stringify(condition);
    }

    // Iterate operators
    for (const op of keys) {
        const target = condition[op];
        
        // Handle undefined values
        if (value === undefined && op !== '$exists' && op !== '$ne' && op !== '$null') {
            return false; 
        }

        switch (op) {
            case '$eq': 
                if (value != target) return false; 
                break;
            case '$ne': 
                if (value == target) return false; 
                break;
            
            // Numeric / Date
            case '$gt': 
                if (!(value > target)) return false; 
                break;
            case '$gte': 
                if (!(value >= target)) return false; 
                break;
            case '$lt': 
                if (!(value < target)) return false; 
                break;
            case '$lte': 
                if (!(value <= target)) return false; 
                break;
            case '$between':
                // target should be [min, max]
                if (Array.isArray(target) && (value < target[0] || value > target[1])) return false;
                break;

            // Sets
            case '$in': 
                if (!Array.isArray(target) || !target.includes(value)) return false; 
                break;
            case '$nin': 
                if (Array.isArray(target) && target.includes(value)) return false; 
                break;
            
            // Existence
            case '$exists':
                const exists = value !== undefined && value !== null;
                if (exists !== !!target) return false;
                break;

            // Strings
            case '$contains': 
                if (typeof value !== 'string' || !value.includes(target)) return false; 
                break;
            case '$notContains':
                if (typeof value !== 'string' || value.includes(target)) return false;
                break;
            case '$startsWith': 
                if (typeof value !== 'string' || !value.startsWith(target)) return false; 
                break;
            case '$endsWith': 
                if (typeof value !== 'string' || !value.endsWith(target)) return false; 
                break;
            case '$null':
                // $null: true → value must be null/undefined; $null: false → value must not be null/undefined
                if (target === true && value != null) return false;
                if (target === false && value == null) return false;
                break;
            case '$regex':
                try {
                    const re = new RegExp(target, condition.$options || '');
                    if (!re.test(String(value))) return false;
                } catch (e) { return false; }
                break;

            default: 
                // Unknown operator, ignore or fail. Ignoring safe for optional features.
                break;
        }
    }
    
    return true;
}
