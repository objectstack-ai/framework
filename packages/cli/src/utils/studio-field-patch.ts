// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio field-patch — ts-morph powered surgery on a single field
 * inside an `ObjectSchema.create({...})` or `defineObject({...})` call.
 *
 * Supported field shapes:
 *   account_number: Field.autonumber({ ...props })          // CallExpression
 *   owner:          Field.lookup('user', { ...props })      // CallExpression with second-arg object
 *   custom:         { ...props }                            // bare ObjectLiteral
 *
 * Properties we know how to update: `label`, `description`, `required`.
 * Falsy values (`null`, `''`, `false`) are interpreted as "remove this
 * property" so the source stays minimal.
 */
import {
  Project,
  SyntaxKind,
  type SourceFile,
  type ObjectLiteralExpression,
  type CallExpression,
  type PropertyAssignment,
} from 'ts-morph';

export interface FieldPatch {
  label?: string | null;
  description?: string | null;
  required?: boolean | null;
}

export type PatchResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Locate the field's inner object-literal and apply the patch.
 * Writes the file in place when successful.
 */
export async function patchObjectFieldFile(
  absPath: string,
  fieldKey: string,
  patch: FieldPatch,
): Promise<PatchResult> {
  // ts-morph stand-alone Project — no tsconfig probing, fastest startup.
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  let sf: SourceFile;
  try {
    sf = project.addSourceFileAtPath(absPath);
  } catch (err: any) {
    return { ok: false, error: `parse failed: ${err?.message ?? String(err)}` };
  }

  const schemaCall = findSchemaCall(sf);
  if (!schemaCall) {
    return { ok: false, error: 'no ObjectSchema.create / defineObject call found in file' };
  }

  const schemaArg = schemaCall.getArguments()[0];
  if (!schemaArg || !schemaArg.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return { ok: false, error: 'schema call argument is not an object literal' };
  }
  const schemaObj = schemaArg as ObjectLiteralExpression;

  const fieldsProp = schemaObj.getProperty('fields');
  if (!fieldsProp || !fieldsProp.isKind(SyntaxKind.PropertyAssignment)) {
    return { ok: false, error: 'schema object has no `fields` property' };
  }
  const fieldsInit = (fieldsProp as PropertyAssignment).getInitializer();
  if (!fieldsInit || !fieldsInit.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return { ok: false, error: '`fields` initializer is not an object literal' };
  }
  const fieldsObj = fieldsInit as ObjectLiteralExpression;

  const fieldProp = fieldsObj.getProperty(fieldKey);
  if (!fieldProp || !fieldProp.isKind(SyntaxKind.PropertyAssignment)) {
    return { ok: false, error: `field \`${fieldKey}\` not found in fields` };
  }
  const innerObj = resolveInnerObjectLiteral((fieldProp as PropertyAssignment).getInitializer());
  if (!innerObj) {
    return { ok: false, error: `field \`${fieldKey}\` initializer has no editable object literal` };
  }

  // Apply each known patch key.
  if ('label' in patch) applyStringProp(innerObj, 'label', patch.label);
  if ('description' in patch) applyStringProp(innerObj, 'description', patch.description);
  if ('required' in patch) applyBooleanProp(innerObj, 'required', patch.required);

  try {
    await sf.save();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `write failed: ${err?.message ?? String(err)}` };
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function findSchemaCall(sf: SourceFile): CallExpression | null {
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression().getText();
    if (expr === 'ObjectSchema.create' || expr === 'defineObject') {
      return call;
    }
  }
  return null;
}

/**
 * Given a property initializer, return the inner ObjectLiteralExpression
 * we should patch.
 *   - `{ ... }`                       → that literal
 *   - `Field.X({ ... })`              → first arg if object literal
 *   - `Field.X('rel', { ... })`       → second arg
 *   - `Field.X({ ... }, { ... })`     → first arg (defensive)
 */
function resolveInnerObjectLiteral(init: any): ObjectLiteralExpression | null {
  if (!init) return null;
  if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return init as ObjectLiteralExpression;
  }
  if (init.isKind(SyntaxKind.CallExpression)) {
    const args = (init as CallExpression).getArguments();
    for (const arg of args) {
      if (arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
        return arg as ObjectLiteralExpression;
      }
    }
  }
  return null;
}

function applyStringProp(obj: ObjectLiteralExpression, key: string, value: string | null | undefined) {
  const existing = obj.getProperty(key);
  if (value == null || value === '') {
    if (existing) existing.remove();
    return;
  }
  const literal = JSON.stringify(value); // safe quoting + escape
  if (existing && existing.isKind(SyntaxKind.PropertyAssignment)) {
    (existing as PropertyAssignment).setInitializer(literal);
  } else {
    obj.addPropertyAssignment({ name: key, initializer: literal });
  }
}

function applyBooleanProp(obj: ObjectLiteralExpression, key: string, value: boolean | null | undefined) {
  const existing = obj.getProperty(key);
  // Default for `required` is false, so we omit the property when false
  // to keep the source minimal — matches what authors hand-write.
  if (value !== true) {
    if (existing) existing.remove();
    return;
  }
  if (existing && existing.isKind(SyntaxKind.PropertyAssignment)) {
    (existing as PropertyAssignment).setInitializer('true');
  } else {
    obj.addPropertyAssignment({ name: key, initializer: 'true' });
  }
}
