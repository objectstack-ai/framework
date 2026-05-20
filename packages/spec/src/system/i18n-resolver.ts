// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * I18n Resolver
 *
 * Convention-based label lookup helpers for views and actions.
 *
 * Developers author plain English `label`s in metadata
 * (`*.view.ts`, `*.actions.ts`); these helpers translate at render time using
 * the standardized keys:
 *
 *   objects.<object>._views.<view_name>.label
 *   objects.<object>._views.<view_name>.description
 *   objects.<object>._actions.<action_name>.label
 *   objects.<object>._actions.<action_name>.confirmText
 *   objects.<object>._actions.<action_name>.successMessage
 *
 * For object-less actions (no `objectName`), helpers fall back to:
 *
 *   globalActions.<action_name>.label / .confirmText / .successMessage
 *
 * Lookup order: requested locale → each entry of `fallbackChain` (defaults to
 * `['en']`) → literal `label` from the metadata. Helpers never throw — they
 * always return at minimum the metadata literal so unconfigured languages
 * gracefully degrade.
 */

import type { TranslationBundle, TranslationData } from './translation.zod';

/** Minimal view shape consumed by `resolveViewLabel`. */
export interface ViewLike {
  name: string;
  label?: string;
  description?: string;
  /** Object the view is bound to. Required for translation lookup. */
  objectName?: string;
  /** Some view definitions name the bound object via `data.object`. */
  data?: { object?: string };
}

/** Minimal action shape consumed by the action resolvers. */
export interface ActionLike {
  name: string;
  label?: string;
  confirmText?: string;
  successMessage?: string;
  /** When omitted, the action is treated as global. */
  objectName?: string;
}

/** Optional resolver settings. */
export interface ResolveOptions {
  /** BCP-47 locale code; defaults to `'en'`. */
  locale?: string;
  /**
   * Ordered fallback locales to consult after `locale` and before returning
   * the literal label. Defaults to `['en']`.
   */
  fallbackChain?: string[];
}

function pickData(
  bundle: TranslationBundle | undefined,
  locale: string,
): TranslationData | undefined {
  if (!bundle) return undefined;
  return bundle[locale];
}

function localeChain(opts?: ResolveOptions): string[] {
  const locale = opts?.locale ?? 'en';
  const fallbacks = opts?.fallbackChain ?? ['en'];
  // Preserve order, drop duplicates.
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const code of [locale, ...fallbacks]) {
    if (!seen.has(code)) {
      seen.add(code);
      chain.push(code);
    }
  }
  return chain;
}

function viewObjectName(view: ViewLike): string | undefined {
  return view.objectName ?? view.data?.object;
}

/**
 * Resolve a translated view label, falling back to the literal `view.label`
 * (or `view.name`) when no translation is available.
 */
export function resolveViewLabel(
  bundle: TranslationBundle | undefined,
  view: ViewLike,
  opts?: ResolveOptions,
): string {
  const fallback = view.label ?? view.name;
  const objectName = viewObjectName(view);
  if (!bundle || !objectName) return fallback;
  for (const code of localeChain(opts)) {
    const data = pickData(bundle, code);
    const candidate = data?.objects?.[objectName]?._views?.[view.name]?.label;
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return fallback;
}

/**
 * Resolve a translated view description, returning `undefined` when neither a
 * translation nor a literal description is set.
 */
export function resolveViewDescription(
  bundle: TranslationBundle | undefined,
  view: ViewLike,
  opts?: ResolveOptions,
): string | undefined {
  const objectName = viewObjectName(view);
  if (bundle && objectName) {
    for (const code of localeChain(opts)) {
      const data = pickData(bundle, code);
      const candidate =
        data?.objects?.[objectName]?._views?.[view.name]?.description;
      if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    }
  }
  return view.description;
}

function lookupActionField(
  bundle: TranslationBundle | undefined,
  action: ActionLike,
  field: 'label' | 'confirmText' | 'successMessage',
  opts?: ResolveOptions,
): string | undefined {
  if (!bundle) return undefined;
  for (const code of localeChain(opts)) {
    const data = pickData(bundle, code);
    if (!data) continue;
    const fromObject = action.objectName
      ? data.objects?.[action.objectName]?._actions?.[action.name]?.[field]
      : undefined;
    if (typeof fromObject === 'string' && fromObject.length > 0) return fromObject;
    const fromGlobal = data.globalActions?.[action.name]?.[field];
    if (typeof fromGlobal === 'string' && fromGlobal.length > 0) return fromGlobal;
  }
  return undefined;
}

/**
 * Resolve a translated action label, falling back to the literal `action.label`
 * (or `action.name`) when no translation is available.
 */
export function resolveActionLabel(
  bundle: TranslationBundle | undefined,
  action: ActionLike,
  opts?: ResolveOptions,
): string {
  return (
    lookupActionField(bundle, action, 'label', opts) ??
    action.label ??
    action.name
  );
}

/**
 * Resolve a translated confirmation prompt for an action, returning
 * `undefined` if neither the bundle nor the action defines one.
 */
export function resolveActionConfirm(
  bundle: TranslationBundle | undefined,
  action: ActionLike,
  opts?: ResolveOptions,
): string | undefined {
  return lookupActionField(bundle, action, 'confirmText', opts) ?? action.confirmText;
}

/**
 * Resolve a translated success message for an action, returning `undefined`
 * if neither the bundle nor the action defines one.
 */
export function resolveActionSuccess(
  bundle: TranslationBundle | undefined,
  action: ActionLike,
  opts?: ResolveOptions,
): string | undefined {
  return (
    lookupActionField(bundle, action, 'successMessage', opts) ??
    action.successMessage
  );
}

/**
 * Apply the active locale to a view metadata document by overwriting `label`
 * and `description` with translated values when available. The original
 * document is not mutated; a shallow copy is returned. Useful for translating
 * metadata at the API boundary so any client (Studio, app-shell, plain HTTP)
 * receives already-localized labels.
 */
export function translateView<T extends ViewLike>(
  view: T,
  bundle: TranslationBundle | undefined,
  opts?: ResolveOptions,
): T {
  const label = resolveViewLabel(bundle, view, opts);
  const description = resolveViewDescription(bundle, view, opts);
  return { ...view, label, ...(description !== undefined ? { description } : {}) };
}

/**
 * Apply the active locale to an action metadata document by overwriting
 * `label`, `confirmText`, and `successMessage` with translated values when
 * available. The original document is not mutated; a shallow copy is returned.
 */
export function translateAction<T extends ActionLike>(
  action: T,
  bundle: TranslationBundle | undefined,
  opts?: ResolveOptions,
): T {
  const label = resolveActionLabel(bundle, action, opts);
  const confirmText = resolveActionConfirm(bundle, action, opts);
  const successMessage = resolveActionSuccess(bundle, action, opts);
  return {
    ...action,
    label,
    ...(confirmText !== undefined ? { confirmText } : {}),
    ...(successMessage !== undefined ? { successMessage } : {}),
  };
}

/**
 * Generic metadata translator: dispatches to `translateView` /
 * `translateAction` based on metadata type. Returns the original document
 * unchanged for unrecognised types.
 *
 * @param type Canonical metadata type string (see `MetadataTypeSchema`).
 * @param doc The metadata document to translate.
 * @param bundle Translation bundle (typically loaded from the i18n service).
 * @param opts Locale + fallback chain.
 */
export function translateMetadataDocument(
  type: string,
  doc: any,
  bundle: TranslationBundle | undefined,
  opts?: ResolveOptions,
): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (type === 'view') return translateView(doc, bundle, opts);
  if (type === 'action') return translateAction(doc, bundle, opts);
  return doc;
}

// ────────────────────────────────────────────────────────────────────────────
// Settings (SettingsManifest) resolvers
// ────────────────────────────────────────────────────────────────────────────

function pickSettingsEntry(
  bundle: TranslationBundle | undefined,
  namespace: string,
  locale: string,
) {
  return pickData(bundle, locale)?.settings?.[namespace];
}

function resolveOptionalString(
  bundle: TranslationBundle | undefined,
  namespace: string,
  pick: (entry: NonNullable<ReturnType<typeof pickSettingsEntry>>) => string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  if (!bundle) return undefined;
  for (const code of localeChain(opts)) {
    const entry = pickSettingsEntry(bundle, namespace, code);
    if (!entry) continue;
    const value = pick(entry);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/** Resolve manifest title; falls back to literal. */
export function resolveSettingsTitle(
  bundle: TranslationBundle | undefined,
  namespace: string,
  fallback: string,
  opts?: ResolveOptions,
): string {
  return resolveOptionalString(bundle, namespace, (e) => e.title, opts) ?? fallback;
}

/** Resolve manifest description. Returns literal (possibly undefined) when no translation found. */
export function resolveSettingsDescription(
  bundle: TranslationBundle | undefined,
  namespace: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return resolveOptionalString(bundle, namespace, (e) => e.description, opts) ?? fallback;
}

/** Resolve a group title under `settings.<namespace>.groups.<group>.title`. */
export function resolveSettingsGroupTitle(
  bundle: TranslationBundle | undefined,
  namespace: string,
  groupKey: string,
  fallback: string,
  opts?: ResolveOptions,
): string {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.groups?.[groupKey]?.title, opts)
    ?? fallback
  );
}

export function resolveSettingsGroupDescription(
  bundle: TranslationBundle | undefined,
  namespace: string,
  groupKey: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.groups?.[groupKey]?.description, opts)
    ?? fallback
  );
}

/** Resolve a setting field label under `settings.<namespace>.keys.<key>.label`. */
export function resolveSettingsFieldLabel(
  bundle: TranslationBundle | undefined,
  namespace: string,
  key: string,
  fallback: string,
  opts?: ResolveOptions,
): string {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.keys?.[key]?.label, opts) ?? fallback
  );
}

export function resolveSettingsFieldHelp(
  bundle: TranslationBundle | undefined,
  namespace: string,
  key: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.keys?.[key]?.help, opts) ?? fallback
  );
}

export function resolveSettingsFieldPlaceholder(
  bundle: TranslationBundle | undefined,
  namespace: string,
  key: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.keys?.[key]?.placeholder, opts)
    ?? fallback
  );
}

/** Resolve an enum option label under `settings.<namespace>.keys.<key>.options.<value>`. */
export function resolveSettingsOptionLabel(
  bundle: TranslationBundle | undefined,
  namespace: string,
  key: string,
  optionValue: string,
  fallback: string,
  opts?: ResolveOptions,
): string {
  return (
    resolveOptionalString(
      bundle,
      namespace,
      (e) => e.keys?.[key]?.options?.[optionValue],
      opts,
    ) ?? fallback
  );
}

/** Resolve an action button label under `settings.<namespace>.actions.<actionId>.label`. */
export function resolveSettingsActionLabel(
  bundle: TranslationBundle | undefined,
  namespace: string,
  actionId: string,
  fallback: string,
  opts?: ResolveOptions,
): string {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.actions?.[actionId]?.label, opts)
    ?? fallback
  );
}

export function resolveSettingsActionConfirm(
  bundle: TranslationBundle | undefined,
  namespace: string,
  actionId: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.actions?.[actionId]?.confirmText, opts)
    ?? fallback
  );
}

export function resolveSettingsActionSuccess(
  bundle: TranslationBundle | undefined,
  namespace: string,
  actionId: string,
  fallback: string | undefined,
  opts?: ResolveOptions,
): string | undefined {
  return (
    resolveOptionalString(bundle, namespace, (e) => e.actions?.[actionId]?.successMessage, opts)
    ?? fallback
  );
}
