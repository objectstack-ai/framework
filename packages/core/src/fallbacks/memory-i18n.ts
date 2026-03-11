// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Resolve a locale code against available locales with fallback.
 *
 * Fallback chain:
 *   1. Exact match (e.g. `zh-CN` → `zh-CN`)
 *   2. Case-insensitive match (e.g. `zh-cn` → `zh-CN`)
 *   3. Base language match (e.g. `zh-CN` → `zh`)
 *   4. Variant expansion (e.g. `zh` → `zh-CN`)
 *
 * Returns the matched locale code, or `undefined` when no match is found.
 */
export function resolveLocale(requestedLocale: string, availableLocales: string[]): string | undefined {
  if (availableLocales.length === 0) return undefined;

  // 1. Exact match
  if (availableLocales.includes(requestedLocale)) return requestedLocale;

  // 2. Case-insensitive match
  const lower = requestedLocale.toLowerCase();
  const caseMatch = availableLocales.find(l => l.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Base language match (zh-CN → zh)
  const baseLang = requestedLocale.split('-')[0].toLowerCase();
  const baseMatch = availableLocales.find(l => l.toLowerCase() === baseLang);
  if (baseMatch) return baseMatch;

  // 4. Variant expansion (zh → zh-CN, zh-TW, etc. — first match wins)
  const variantMatch = availableLocales.find(l => l.split('-')[0].toLowerCase() === baseLang);
  if (variantMatch) return variantMatch;

  return undefined;
}

/**
 * In-memory i18n service fallback.
 *
 * Implements the II18nService contract with basic translate/load/getLocales
 * operations.  Used by ObjectKernel as an automatic fallback when no real
 * i18n plugin (e.g. I18nServicePlugin) is registered.
 *
 * Supports runtime translation loading, locale management, and
 * locale code fallback (e.g. `zh` → `zh-CN`).
 * Does not load files from disk — operates purely in-memory.
 */
export function createMemoryI18n() {
  const translations = new Map<string, Record<string, unknown>>();
  let defaultLocale = 'en';

  /**
   * Resolve a dot-notation key from a nested object.
   */
  function resolveKey(data: Record<string, unknown>, key: string): string | undefined {
    const parts = key.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Find translation data for a locale, with fallback resolution.
   */
  function resolveTranslations(locale: string): Record<string, unknown> | undefined {
    // Exact match
    if (translations.has(locale)) return translations.get(locale);

    // Locale fallback (zh → zh-CN, en-us → en-US, etc.)
    const resolved = resolveLocale(locale, [...translations.keys()]);
    if (resolved) return translations.get(resolved);

    return undefined;
  }

  return {
    _fallback: true, _serviceName: 'i18n',

    t(key: string, locale: string, params?: Record<string, unknown>): string {
      const data = resolveTranslations(locale) ?? translations.get(defaultLocale);
      const value = data ? resolveKey(data, key) : undefined;
      if (value == null) return key;
      if (!params) return value;
      // Interpolation format: {{paramName}} — matches FileI18nAdapter convention
      return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? `{{${name}}}`));
    },

    getTranslations(locale: string): Record<string, unknown> {
      return resolveTranslations(locale) ?? {};
    },

    loadTranslations(locale: string, data: Record<string, unknown>): void {
      const existing = translations.get(locale) ?? {};
      translations.set(locale, { ...existing, ...data });
    },

    getLocales(): string[] {
      return [...translations.keys()];
    },

    getDefaultLocale(): string {
      return defaultLocale;
    },

    setDefaultLocale(locale: string): void {
      defaultLocale = locale;
    },
  };
}
