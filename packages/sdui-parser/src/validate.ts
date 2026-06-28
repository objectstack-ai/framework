/**
 * ObjectUI — SDUI tree validation against the registry manifest (ADR-0080 §3/§6)
 *
 * Shallow, author-time validation: unknown component, unknown/missing prop,
 * wrong coarse type, illegal enum value. Collects `requires` (plugin provenance)
 * and binding sites the SERVER must resolve against object schema (we cannot
 * resolve objects/fields here — that check is framework-side by design).
 */

import type {
  Diagnostic,
  Manifest,
  ManifestInput,
  SchemaElement,
  SchemaNode,
  ValidationResult,
} from './types.js';

/** Base props every node may carry (mirrors BaseSchema) — never "unknown prop". */
const BASE_PROPS = new Set([
  'type',
  'id',
  'className',
  'style',
  'visible',
  'visibleOn',
  'disabled',
  'disabledOn',
  'children',
]);

const isExpr = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && '$expr' in (v as Record<string, unknown>);

export function validateTree(tree: SchemaElement | null, manifest: Manifest): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const requires = new Set<string>();
  const bindings: ValidationResult['bindings'] = [];

  const visit = (node: SchemaNode): void => {
    if (typeof node === 'string') return;
    const comp = manifest.components[node.type];
    if (!comp) {
      diagnostics.push({
        severity: 'error',
        code: 'unknown-component',
        message: `<${node.type}> is not a known component`,
        tag: node.type,
      });
    } else {
      if (comp.namespace) requires.add(comp.namespace);
      const byName = new Map(comp.inputs.map((i) => [i.name, i]));

      // required present?
      for (const input of comp.inputs) {
        if (input.required && !(input.name in node)) {
          diagnostics.push({
            severity: 'error',
            code: 'missing-required-prop',
            message: `<${node.type}> is missing required prop "${input.name}"`,
            tag: node.type,
          });
        }
      }

      // each provided prop
      for (const [key, value] of Object.entries(node)) {
        if (BASE_PROPS.has(key)) continue;
        const input = byName.get(key);
        if (!input) {
          diagnostics.push({
            severity: 'warning',
            code: 'unknown-prop',
            message: `<${node.type}> has no prop "${key}"`,
            tag: node.type,
          });
          continue;
        }
        if (input.binding) {
          bindings.push({ tag: node.type, input: key, kind: input.binding, value });
        }
        if (!isExpr(value)) {
          const typeDiag = checkType(node.type, input, value);
          if (typeDiag) diagnostics.push(typeDiag);
        }
      }

      // containment
      if (node.children?.length && !comp.isContainer) {
        diagnostics.push({
          severity: 'warning',
          code: 'not-a-container',
          message: `<${node.type}> does not accept children`,
          tag: node.type,
        });
      }
    }

    if (node.children) node.children.forEach(visit);
  };

  if (tree) visit(tree);
  return { diagnostics, requires: [...requires], bindings };
}

function checkType(tag: string, input: ManifestInput, value: unknown): Diagnostic | null {
  const mismatch = (expected: string): Diagnostic => ({
    severity: 'warning',
    code: 'type-mismatch',
    message: `<${tag}> prop "${input.name}" expected ${expected}`,
    tag,
  });
  switch (input.type) {
    case 'number':
      return typeof value === 'number' ? null : mismatch('a number');
    case 'boolean':
      return typeof value === 'boolean' ? null : mismatch('a boolean');
    case 'string':
    case 'color':
    case 'date':
    case 'code':
    case 'file':
      return typeof value === 'string' ? null : mismatch('a string');
    case 'array':
      return Array.isArray(value) ? null : mismatch('an array');
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? null
        : mismatch('an object');
    case 'enum': {
      const allowed = (input.enum ?? []).map((e) => (typeof e === 'object' ? e.value : e));
      return allowed.includes(value as never)
        ? null
        : {
            severity: 'error',
            code: 'invalid-enum',
            message: `<${tag}> prop "${input.name}"=${JSON.stringify(value)} is not one of ${JSON.stringify(allowed)}`,
            tag,
          };
    }
    default:
      return null;
  }
}
