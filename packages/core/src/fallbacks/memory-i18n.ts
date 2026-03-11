// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * In-memory i18n service fallback.
 *
 * Implements the II18nService contract with basic translate/load/getLocales
 * operations.  Used by ObjectKernel as an automatic fallback when no real
 * i18n plugin (e.g. I18nServicePlugin) is registered.
 *
 * Supports runtime translation loading and locale management.
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

  return {
    _fallback: true, _serviceName: 'i18n',

    t(key: string, locale: string, params?: Record<string, unknown>): string {
      const data = translations.get(locale) ?? translations.get(defaultLocale);
      const value = data ? resolveKey(data, key) : undefined;
      if (value == null) return key;
      if (!params) return value;
      // Interpolation format: {{paramName}} — matches FileI18nAdapter convention
      return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? `{{${name}}}`));
    },

    getTranslations(locale: string): Record<string, unknown> {
      return translations.get(locale) ?? {};
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
