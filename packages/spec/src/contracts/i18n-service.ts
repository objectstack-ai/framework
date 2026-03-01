// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AppTranslationBundle, TranslationCoverageResult } from '../system/translation.zod';

/**
 * II18nService - Internationalization Service Contract
 *
 * Defines the interface for translation and locale management in ObjectStack.
 * Concrete implementations (i18next, custom, etc.)
 * should implement this interface.
 *
 * Follows Dependency Inversion Principle - plugins depend on this interface,
 * not on concrete i18n library implementations.
 *
 * Aligned with CoreServiceName 'i18n' in core-services.zod.ts.
 */

export interface II18nService {
    /**
     * Translate a message key for a given locale
     * @param key - Translation key (e.g. 'o.account.label')
     * @param locale - BCP-47 locale code (e.g. 'en-US', 'zh-CN')
     * @param params - Optional interpolation parameters
     * @returns Translated string, or the key itself if not found
     */
    t(key: string, locale: string, params?: Record<string, unknown>): string;

    /**
     * Get all translations for a locale
     * @param locale - BCP-47 locale code
     * @returns Translation data map
     */
    getTranslations(locale: string): Record<string, unknown>;

    /**
     * Load translations for a locale
     * @param locale - BCP-47 locale code
     * @param translations - Translation key-value data
     */
    loadTranslations(locale: string, translations: Record<string, unknown>): void;

    /**
     * List available locales
     * @returns Array of BCP-47 locale codes
     */
    getLocales(): string[];

    /**
     * Get the current default locale
     * @returns BCP-47 locale code
     */
    getDefaultLocale?(): string;

    /**
     * Set the default locale
     * @param locale - BCP-47 locale code
     */
    setDefaultLocale?(locale: string): void;

    // ── Object-first aggregation & diff detection ──────────────────────

    /**
     * Get object-first translation bundle for a locale.
     *
     * Returns all translations aggregated under `o.{objectName}` with
     * global groups (app, nav, dashboard, etc.) at the top level.
     *
     * @param locale - BCP-47 locale code
     * @returns Object-first AppTranslationBundle, or undefined if no data
     */
    getAppBundle?(locale: string): AppTranslationBundle | undefined;

    /**
     * Load an object-first translation bundle for a locale.
     *
     * @param locale - BCP-47 locale code
     * @param bundle - Object-first AppTranslationBundle
     */
    loadAppBundle?(locale: string, bundle: AppTranslationBundle): void;

    /**
     * Get translation coverage for a locale, optionally scoped to a single object.
     *
     * Compares the supplied (or currently loaded) translation bundle against
     * the source metadata to detect missing, redundant, and stale entries.
     *
     * @param locale - BCP-47 locale code
     * @param objectName - Optional object name to scope the check
     * @returns Coverage result with per-key diff items
     */
    getCoverage?(locale: string, objectName?: string): TranslationCoverageResult;
}
