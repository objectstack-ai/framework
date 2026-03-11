import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppPlugin } from './app-plugin';
import { PluginContext } from '@objectstack/core';

describe('AppPlugin', () => {
    let mockContext: PluginContext;

    beforeEach(() => {
        mockContext = {
            logger: { 
                info: vi.fn(), 
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn()
            },
            registerService: vi.fn(),
            getService: vi.fn(),
            getServices: vi.fn()
        } as unknown as PluginContext;
    });

    it('should initialize with manifest info', () => {
        const bundle = {
            id: 'com.test.app',
            name: 'Test App',
            version: '1.0.0'
        };
        const plugin = new AppPlugin(bundle);
        expect(plugin.name).toBe('plugin.app.com.test.app');
        expect(plugin.version).toBe('1.0.0');
    });

    it('should handle nested stack definition manifest', () => {
        const bundle = {
            manifest: {
                id: 'com.test.stack',
                version: '2.0.0'
            },
            objects: []
        };
        const plugin = new AppPlugin(bundle);
        expect(plugin.name).toBe('plugin.app.com.test.stack');
        expect(plugin.version).toBe('2.0.0');
    });

    it('registerService should register raw manifest in init phase', async () => {
        const bundle = {
            id: 'com.test.simple',
            objects: []
        };
        const plugin = new AppPlugin(bundle);
        
        await plugin.init(mockContext);
        
        expect(mockContext.registerService).toHaveBeenCalledWith('app.com.test.simple', bundle);
    });

    it('start should do nothing if no runtime hooks', async () => {
        const bundle = { id: 'com.test.static' };
        const plugin = new AppPlugin(bundle);
        
        vi.mocked(mockContext.getService).mockReturnValue({}); // Mock ObjectQL exists
        
        await plugin.start!(mockContext);
        // Only logs, no errors
        expect(mockContext.logger.debug).toHaveBeenCalled();
    });

    it('start should invoke onEnable if present', async () => {
        const onEnableSpy = vi.fn();
        const bundle = { 
            id: 'com.test.code',
            onEnable: onEnableSpy
        };
        const plugin = new AppPlugin(bundle);
        
        // Mock ObjectQL engine
        const mockQL = { registry: {} };
        vi.mocked(mockContext.getService).mockReturnValue(mockQL);
        
        await plugin.start!(mockContext);
        
        expect(onEnableSpy).toHaveBeenCalled();
        // Check context passed to onEnable
        const callArg = onEnableSpy.mock.calls[0][0];
        expect(callArg.ql).toBe(mockQL);
    });

    it('start should warn if objectql not found', async () => {
        const bundle = { id: 'com.test.warn' };
        const plugin = new AppPlugin(bundle);
        
        vi.mocked(mockContext.getService).mockReturnValue(undefined); // No ObjectQL
        
        await plugin.start!(mockContext);
        
        expect(mockContext.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('ObjectQL engine service not found'), 
            expect.any(Object)
        );
    });

    // ═══════════════════════════════════════════════════════════════
    // i18n translation auto-loading
    // ═══════════════════════════════════════════════════════════════

    describe('i18n translation loading', () => {
        let mockI18n: any;
        let mockQL: any;

        beforeEach(() => {
            mockI18n = {
                loadTranslations: vi.fn(),
                setDefaultLocale: vi.fn(),
                getLocales: vi.fn().mockReturnValue([]),
                getDefaultLocale: vi.fn().mockReturnValue('en'),
            };
            mockQL = { registry: {} };

            vi.mocked(mockContext.getService).mockImplementation((name: string) => {
                if (name === 'objectql') return mockQL;
                if (name === 'i18n') return mockI18n;
                return undefined;
            });
        });

        it('should auto-load translations from bundle into i18n service', async () => {
            const bundle = {
                id: 'com.test.i18n',
                translations: [
                    {
                        en: { objects: { task: { label: 'Task' } } },
                        'zh-CN': { objects: { task: { label: '任务' } } },
                    },
                ],
            };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            expect(mockI18n.loadTranslations).toHaveBeenCalledWith('en', { objects: { task: { label: 'Task' } } });
            expect(mockI18n.loadTranslations).toHaveBeenCalledWith('zh-CN', { objects: { task: { label: '任务' } } });
        });

        it('should set default locale from i18n config', async () => {
            const bundle = {
                id: 'com.test.locale',
                i18n: { defaultLocale: 'zh-CN', supportedLocales: ['en', 'zh-CN'] },
                translations: [{ en: { messages: { hello: 'Hello' } } }],
            };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            expect(mockI18n.setDefaultLocale).toHaveBeenCalledWith('zh-CN');
        });

        it('should skip translation loading when i18n service is not registered', async () => {
            vi.mocked(mockContext.getService).mockImplementation((name: string) => {
                if (name === 'objectql') return mockQL;
                return undefined; // No i18n service
            });

            const bundle = {
                id: 'com.test.noi18n',
                translations: [{ en: { messages: { hello: 'Hello' } } }],
            };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            // Should log debug but not throw
            expect(mockContext.logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('No i18n service registered'),
                expect.any(Object)
            );
        });

        it('should handle bundle with no translations gracefully', async () => {
            const bundle = { id: 'com.test.notrans' };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            expect(mockI18n.loadTranslations).not.toHaveBeenCalled();
        });

        it('should load translations from nested manifest.translations', async () => {
            const bundle = {
                manifest: {
                    id: 'com.test.nested',
                    translations: [
                        { en: { messages: { save: 'Save' } } },
                    ],
                },
            };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            expect(mockI18n.loadTranslations).toHaveBeenCalledWith('en', { messages: { save: 'Save' } });
        });

        it('should load multiple translation bundles', async () => {
            const bundle = {
                id: 'com.test.multi',
                translations: [
                    { en: { objects: { task: { label: 'Task' } } } },
                    { en: { objects: { contact: { label: 'Contact' } } }, 'ja-JP': { objects: { contact: { label: '連絡先' } } } },
                ],
            };
            const plugin = new AppPlugin(bundle);
            await plugin.start!(mockContext);

            expect(mockI18n.loadTranslations).toHaveBeenCalledTimes(3);
        });
    });
});
