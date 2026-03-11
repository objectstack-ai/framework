/**
 * Root Development Configuration
 *
 * Aggregates all example apps for `pnpm studio` / `pnpm dev`.
 * This is NOT a deployable config — it's the monorepo dev entry point.
 */
import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import CrmApp from './examples/app-crm/objectstack.config';
import TodoApp from './examples/app-todo/objectstack.config';
import BiPlugin from './examples/plugin-bi/objectstack.config';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { I18nServicePlugin } from '@objectstack/service-i18n';

export default defineStack({
  manifest: {
    id: 'dev-workspace',
    name: 'dev_workspace',
    version: '0.0.0',
    description: 'ObjectStack monorepo development workspace',
    type: 'app',
  },
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver()),
    new I18nServicePlugin({       
      defaultLocale: 'en',
      fallbackLocale: 'en',
      registerRoutes: true,          // 自动注册 /api/v1/i18n/* 路由
    }),
    new AuthPlugin({
      secret: 'dev-secret-please-change-in-production-min-32-chars',
      baseUrl: 'http://localhost:3000',
      // Optional: Enable OAuth providers
      // providers: [
      //   {
      //     id: 'google',
      //     clientId: process.env.GOOGLE_CLIENT_ID!,
      //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      //   }
      // ],
      // Optional: Enable advanced features
      // plugins: {
      //   organization: true,  // Multi-tenant support
      //   twoFactor: true,     // 2FA
      //   passkeys: true,      // WebAuthn/Passkeys
      //   magicLink: true,     // Passwordless auth
      // }
    }),
    new AppPlugin(CrmApp),
    new AppPlugin(TodoApp),
    new AppPlugin(BiPlugin),
  ],
});
