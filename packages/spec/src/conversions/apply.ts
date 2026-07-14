// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The central conversion pass (ADR-0087 D2).
 *
 * {@link applyConversions} runs every registered {@link MetadataConversion}
 * against a normalized stack, threading the (immutably updated) stack through
 * each entry and turning each rewrite into a structured {@link ConversionNotice}.
 * It is wired into `normalizeStackInput`, so it fires on the single seam every
 * load path funnels through — `defineStack`, `objectstack validate`, `lint`,
 * `info`, and `doctor`.
 */

import { ALL_CONVERSIONS } from './registry.js';
import { CONVERSION_NOTICE_CODE, type ConversionNotice } from './types.js';

export interface ApplyConversionsOptions {
  /**
   * Sink for each structured notice. Defaults to a no-op: converting the shape
   * is the point (zero consumer action); *surfacing* the notice is the caller's
   * choice. `objectstack validate` passes a sink that prints them.
   */
  onNotice?: (notice: ConversionNotice) => void;
}

/**
 * Apply the whole conversion table to a normalized stack.
 *
 * Pure and immutable: returns the original reference untouched when nothing
 * converts, otherwise a copy-on-write stack with old shapes rewritten to
 * canonical. Never throws — a conversion only rewrites shapes it positively
 * recognizes, mirroring the handshake's "never false-reject" discipline (D1).
 */
export function applyConversions(
  stack: Record<string, unknown>,
  options: ApplyConversionsOptions = {},
): Record<string, unknown> {
  const { onNotice } = options;
  let current = stack;

  for (const conversion of ALL_CONVERSIONS) {
    const retiresIn = conversion.toMajor + 1;
    current = conversion.apply(current, (detail) => {
      if (!onNotice) return;
      onNotice({
        code: CONVERSION_NOTICE_CODE,
        conversionId: conversion.id,
        surface: conversion.surface,
        toMajor: conversion.toMajor,
        retiresIn,
        from: detail.from,
        to: detail.to,
        path: detail.path,
        message:
          `[protocol] converted ${conversion.surface} at ${detail.path}: ` +
          `'${detail.from}' → '${detail.to}' (deprecated; ADR-0087 conversion ` +
          `'${conversion.id}', retires from the load path in protocol ${retiresIn}). ` +
          `Update the source to '${detail.to}'.`,
      });
    });
  }

  return current;
}

/**
 * Collect the notices a stack would emit without needing an external sink —
 * convenience for `validate` / `lint` / the future MCP `spec_deprecations` tool.
 */
export function collectConversionNotices(stack: Record<string, unknown>): {
  stack: Record<string, unknown>;
  notices: ConversionNotice[];
} {
  const notices: ConversionNotice[] = [];
  const converted = applyConversions(stack, { onNotice: (n) => notices.push(n) });
  return { stack: converted, notices };
}
