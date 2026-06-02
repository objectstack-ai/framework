// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineTool } from '@objectstack/spec/ai';

/**
 * validate_expression — AI Tool Metadata (ADR-0032 §Decision 1e)
 *
 * Lets an authoring agent check an expression *before* committing it — closing
 * the self-correction loop at authoring time instead of at build/run time. It
 * runs the same shared validator (`@objectstack/formula`) that `objectstack
 * build` and `registerFlow` use, so the verdict and the corrective message are
 * identical across every surface.
 *
 * Use it whenever writing a `condition` / `guard` / formula / computed value
 * (role `predicate` or `value`, bare CEL) or a notification/title text body
 * (role `template`, `{{ path }}` holes). Pass `objectName` to additionally
 * check that referenced `record.<field>` names exist on that object.
 */
export const validateExpressionTool = defineTool({
  name: 'validate_expression',
  label: 'Validate Expression',
  description:
    'Validate an ObjectStack expression (flow/validation condition, formula, computed value, or text template) ' +
    'BEFORE saving it. Returns { ok, errors[] } with self-correcting messages. ' +
    'Predicates and computed values are bare CEL (e.g. `record.rating >= 4`) — never wrap field references in `{…}` braces. ' +
    'Templates use `{{ path }}` holes. Pass objectName to also check that record.<field> references exist.',
  category: 'utility',
  builtIn: true,
  parameters: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['predicate', 'value', 'template'],
        description:
          "Field role: 'predicate' (boolean condition/guard, bare CEL), 'value' (computed value, bare CEL), or 'template' (text with {{ path }} holes).",
      },
      source: {
        type: 'string',
        description: 'The expression source to validate.',
      },
      objectName: {
        type: 'string',
        description: 'Optional object machine name (snake_case) for schema-aware field-existence checks.',
      },
    },
    required: ['role', 'source'],
    additionalProperties: false,
  },
});
