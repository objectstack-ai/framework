// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
} from '../connector.zod';

/**
 * Vercel Connector Protocol
 * 
 * Specialized connector for Vercel deployment platform enabling automated
 * deployments, preview environments, and production releases.
 * 
 * Use Cases:
 * - Automated deployments from Git
 * - Preview deployments for pull requests
 * - Production releases
 * - Environment variable management
 * - Domain and SSL configuration
 * - Edge function deployment
 * 
 * @example
 * ```typescript
 * import { VercelConnector } from '@objectstack/spec/integration';
 * 
 * const vercelConnector: VercelConnector = {
 *   name: 'vercel_production',
 *   label: 'Vercel Production',
 *   type: 'saas',
 *   provider: 'vercel',
 *   baseUrl: 'https://api.vercel.com',
 *   authentication: {
 *     type: 'bearer',
 *     token: '${VERCEL_TOKEN}',
 *   },
 *   projects: [
 *     {
 *       name: 'objectstack-app',
 *       framework: 'nextjs',
 *       gitRepository: {
 *         type: 'github',
 *         repo: 'objectstack-ai/app',
 *       },
 *     },
 *   ],
 * };
 * ```
 */

/**
 * Vercel Provider Type
 */
import { lazySchema } from '../../shared/lazy-schema';
export const VercelProviderSchema = lazySchema(() => z.enum([
  'vercel',
]).describe('Vercel provider type'));

export type VercelProvider = z.infer<typeof VercelProviderSchema>;

/**
 * Vercel Framework Types
 */
export const VercelFrameworkSchema = lazySchema(() => z.enum([
  'nextjs',
  'react',
  'vue',
  'nuxtjs',
  'gatsby',
  'remix',
  'astro',
  'sveltekit',
  'solid',
  'angular',
  'static',
  'other',
]).describe('Frontend framework'));

export type VercelFramework = z.infer<typeof VercelFrameworkSchema>;

/**
 * Git Repository Configuration
 */
export const GitRepositoryConfigSchema = lazySchema(() => z.object({
  /**
   * Git provider type
   */
  type: z.enum(['github', 'gitlab', 'bitbucket']).describe('Git provider'),
  
  /**
   * Repository identifier (owner/repo)
   */
  repo: z.string().describe('Repository identifier (e.g., owner/repo)'),
  
  /**
   * Production branch
   */
  productionBranch: z.string().optional().default('main').describe('Production branch name'),
  
  /**
   * Auto-deploy production branch
   */
  autoDeployProduction: z.boolean().optional().default(true).describe('Auto-deploy production branch'),
  
  /**
   * Auto-deploy preview branches
   */
  autoDeployPreview: z.boolean().optional().default(true).describe('Auto-deploy preview branches'),
}));

export type GitRepositoryConfig = z.infer<typeof GitRepositoryConfigSchema>;

/**
 * Build Configuration
 */
export const BuildConfigSchema = lazySchema(() => z.object({
  /**
   * Build command
   */
  buildCommand: z.string().optional().describe('Build command (e.g., npm run build)'),
  
  /**
   * Output directory
   */
  outputDirectory: z.string().optional().describe('Output directory (e.g., .next, dist)'),
  
  /**
   * Install command
   */
  installCommand: z.string().optional().describe('Install command (e.g., npm install, pnpm install)'),
  
  /**
   * Development command
   */
  devCommand: z.string().optional().describe('Development command (e.g., npm run dev)'),
  
  /**
   * Node.js version
   */
  nodeVersion: z.string().optional().describe('Node.js version (e.g., 18.x, 20.x)'),
  
  /**
   * Environment variables
   */
  env: z.record(z.string(), z.string()).optional().describe('Build environment variables'),
}));

export type BuildConfig = z.infer<typeof BuildConfigSchema>;

/**
 * Deployment Configuration
 */
export const DeploymentConfigSchema = lazySchema(() => z.object({
  /**
   * Enable automatic deployments
   */
  autoDeployment: z.boolean().optional().default(true).describe('Enable automatic deployments'),
  
  /**
   * Deployment regions
   */
  regions: z.array(z.enum([
    'iad1',  // US East (Washington, D.C.)
    'sfo1',  // US West (San Francisco)
    'gru1',  // South America (São Paulo)
    'lhr1',  // Europe West (London)
    'fra1',  // Europe Central (Frankfurt)
    'sin1',  // Asia (Singapore)
    'syd1',  // Australia (Sydney)
    'hnd1',  // Asia (Tokyo)
    'icn1',  // Asia (Seoul)
  ])).optional().describe('Deployment regions'),
  
  /**
   * Enable preview deployments
   */
  enablePreview: z.boolean().optional().default(true).describe('Enable preview deployments'),
  
  /**
   * Preview deployment comments on PRs
   */
  previewComments: z.boolean().optional().default(true).describe('Post preview URLs in PR comments'),
  
  /**
   * Production deployment protection
   */
  productionProtection: z.boolean().optional().default(true).describe('Require approval for production deployments'),
  
  /**
   * Deploy hooks
   */
  deployHooks: z.array(z.object({
    name: z.string().describe('Hook name'),
    url: z.string().url().describe('Deploy hook URL'),
    branch: z.string().optional().describe('Target branch'),
  })).optional().describe('Deploy hooks'),
}));

export type DeploymentConfig = z.infer<typeof DeploymentConfigSchema>;

/**
 * Domain Configuration
 */
export const DomainConfigSchema = lazySchema(() => z.object({
  /**
   * Domain name
   */
  domain: z.string().describe('Domain name (e.g., app.example.com)'),
  
  /**
   * Enable HTTPS redirect
   */
  httpsRedirect: z.boolean().optional().default(true).describe('Redirect HTTP to HTTPS'),
  
  /**
   * Custom SSL certificate
   */
  customCertificate: z.object({
    cert: z.string().describe('SSL certificate'),
    key: z.string().describe('Private key'),
    ca: z.string().optional().describe('Certificate authority'),
  }).optional().describe('Custom SSL certificate'),
  
  /**
   * Git branch for this domain
   */
  gitBranch: z.string().optional().describe('Git branch to deploy to this domain'),
}));

export type DomainConfig = z.infer<typeof DomainConfigSchema>;

/**
 * Environment Variables Configuration
 */
export const EnvironmentVariablesSchema = lazySchema(() => z.object({
  /**
   * Variable name
   */
  key: z.string().describe('Environment variable name'),
  
  /**
   * Variable value
   */
  value: z.string().describe('Environment variable value'),
  
  /**
   * Target environments
   */
  target: z.array(z.enum(['production', 'preview', 'development'])).describe('Target environments'),
  
  /**
   * Is secret (encrypted)
   */
  isSecret: z.boolean().optional().default(false).describe('Encrypt this variable'),
  
  /**
   * Git branch (for preview/development)
   */
  gitBranch: z.string().optional().describe('Specific git branch'),
}));

export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>;

/**
 * Edge Function Configuration
 */
export const EdgeFunctionConfigSchema = lazySchema(() => z.object({
  /**
   * Function name
   */
  name: z.string().describe('Edge function name'),
  
  /**
   * Function path
   */
  path: z.string().describe('Function path (e.g., /api/*)'),
  
  /**
   * Regions to deploy
   */
  regions: z.array(z.string()).optional().describe('Specific regions for this function'),
  
  /**
   * Memory limit (MB)
   */
  memoryLimit: z.number().int().min(128).max(3008).optional().default(1024).describe('Memory limit in MB'),
  
  /**
   * Timeout (seconds)
   */
  timeout: z.number().int().min(1).max(300).optional().default(10).describe('Timeout in seconds'),
}));

export type EdgeFunctionConfig = z.infer<typeof EdgeFunctionConfigSchema>;

/**
 * Vercel Project Configuration
 */
export const VercelProjectSchema = lazySchema(() => z.object({
  /**
   * Project name
   */
  name: z.string().describe('Vercel project name'),
  
  /**
   * Framework
   */
  framework: VercelFrameworkSchema.optional().describe('Frontend framework'),
  
  /**
   * Git repository
   */
  gitRepository: GitRepositoryConfigSchema.optional().describe('Git repository configuration'),
  
  /**
   * Build configuration
   */
  buildConfig: BuildConfigSchema.optional().describe('Build configuration'),
  
  /**
   * Deployment configuration
   */
  deploymentConfig: DeploymentConfigSchema.optional().describe('Deployment configuration'),
  
  /**
   * Custom domains
   */
  domains: z.array(DomainConfigSchema).optional().describe('Custom domains'),
  
  /**
   * Environment variables
   */
  environmentVariables: z.array(EnvironmentVariablesSchema).optional().describe('Environment variables'),
  
  /**
   * Edge functions
   */
  edgeFunctions: z.array(EdgeFunctionConfigSchema).optional().describe('Edge functions'),
  
  /**
   * Root directory
   */
  rootDirectory: z.string().optional().describe('Root directory (for monorepos)'),
}));

export type VercelProject = z.infer<typeof VercelProjectSchema>;

/**
 * Vercel Monitoring Configuration
 */
export const VercelMonitoringSchema = lazySchema(() => z.object({
  /**
   * Enable Web Analytics
   */
  enableWebAnalytics: z.boolean().optional().default(false).describe('Enable Vercel Web Analytics'),
  
  /**
   * Enable Speed Insights
   */
  enableSpeedInsights: z.boolean().optional().default(false).describe('Enable Vercel Speed Insights'),
  
  /**
   * Enable Log Drains
   */
  logDrains: z.array(z.object({
    name: z.string().describe('Log drain name'),
    url: z.string().url().describe('Log drain URL'),
    headers: z.record(z.string(), z.string()).optional().describe('Custom headers'),
    sources: z.array(z.enum(['static', 'lambda', 'edge'])).optional().describe('Log sources'),
  })).optional().describe('Log drains configuration'),
}));

export type VercelMonitoring = z.infer<typeof VercelMonitoringSchema>;

/**
 * Vercel Team Configuration
 */
export const VercelTeamSchema = lazySchema(() => z.object({
  /**
   * Team ID or slug
   */
  teamId: z.string().optional().describe('Team ID or slug'),
  
  /**
   * Team name
   */
  teamName: z.string().optional().describe('Team name'),
}));

export type VercelTeam = z.infer<typeof VercelTeamSchema>;

/**
 * Vercel Connector Schema
 * Complete Vercel integration configuration
 */
export const VercelConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('saas'),
  
  /**
   * Vercel provider
   */
  provider: VercelProviderSchema.describe('Vercel provider'),
  
  /**
   * Vercel API base URL
   */
  baseUrl: z.string().url().optional().default('https://api.vercel.com').describe('Vercel API base URL'),
  
  /**
   * Team configuration
   */
  team: VercelTeamSchema.optional().describe('Vercel team configuration'),
  
  /**
   * Projects to manage
   */
  projects: z.array(VercelProjectSchema).describe('Vercel projects'),
  
  /**
   * Monitoring configuration
   */
  monitoring: VercelMonitoringSchema.optional().describe('Monitoring configuration'),
  
  /**
   * Enable webhooks
   */
  enableWebhooks: z.boolean().optional().default(true).describe('Enable Vercel webhooks'),
  
  /**
   * Webhook events to subscribe
   */
  webhookEvents: z.array(z.enum([
    'deployment.created',
    'deployment.succeeded',
    'deployment.failed',
    'deployment.ready',
    'deployment.error',
    'deployment.canceled',
    'deployment-checks-completed',
    'deployment-prepared',
    'project.created',
    'project.removed',
  ])).optional().describe('Webhook events to subscribe to'),
}));

export type VercelConnector = z.infer<typeof VercelConnectorSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: Vercel Next.js Project Configuration
 */
export const vercelNextJsConnectorExample = {
  name: 'vercel_production',
  label: 'Vercel Production',
  type: 'saas',
  provider: 'vercel',
  baseUrl: 'https://api.vercel.com',
  
  authentication: {
    type: 'bearer',
    token: '${VERCEL_TOKEN}',
  },
  
  projects: [
    {
      name: 'objectstack-app',
      framework: 'nextjs',
      
      gitRepository: {
        type: 'github',
        repo: 'objectstack-ai/app',
        productionBranch: 'main',
        autoDeployProduction: true,
        autoDeployPreview: true,
      },
      
      buildConfig: {
        buildCommand: 'npm run build',
        outputDirectory: '.next',
        installCommand: 'npm ci',
        devCommand: 'npm run dev',
        nodeVersion: '20.x',
        env: {
          NEXT_PUBLIC_API_URL: 'https://api.objectstack.ai',
        },
      },
      
      deploymentConfig: {
        autoDeployment: true,
        regions: ['iad1', 'sfo1', 'fra1'],
        enablePreview: true,
        previewComments: true,
        productionProtection: true,
      },
      
      domains: [
        {
          domain: 'app.objectstack.ai',
          httpsRedirect: true,
          gitBranch: 'main',
        },
        {
          domain: 'staging.objectstack.ai',
          httpsRedirect: true,
          gitBranch: 'develop',
        },
      ],
      
      environmentVariables: [
        {
          key: 'DATABASE_URL',
          value: '${DATABASE_URL}',
          target: ['production', 'preview'],
          isSecret: true,
        },
        {
          key: 'NEXT_PUBLIC_ANALYTICS_ID',
          value: 'UA-XXXXXXXX-X',
          target: ['production'],
          isSecret: false,
        },
      ],
      
      edgeFunctions: [
        {
          name: 'api-middleware',
          path: '/api/*',
          regions: ['iad1', 'sfo1'],
          memoryLimit: 1024,
          timeout: 10,
        },
      ],
    },
  ],
  
  monitoring: {
    enableWebAnalytics: true,
    enableSpeedInsights: true,
    logDrains: [
      {
        name: 'datadog-logs',
        url: 'https://http-intake.logs.datadoghq.com/api/v2/logs',
        headers: {
          'DD-API-KEY': '${DATADOG_API_KEY}',
        },
        sources: ['lambda', 'edge'],
      },
    ],
  },
  
  enableWebhooks: true,
  webhookEvents: [
    'deployment.succeeded',
    'deployment.failed',
    'deployment.ready',
  ],
  
  status: 'active',
  enabled: true,
};

/**
 * Example: Vercel Static Site Configuration
 */
export const vercelStaticSiteConnectorExample = {
  name: 'vercel_docs',
  label: 'Vercel Documentation',
  type: 'saas',
  provider: 'vercel',
  baseUrl: 'https://api.vercel.com',
  
  authentication: {
    type: 'bearer',
    token: '${VERCEL_TOKEN}',
  },
  
  team: {
    teamId: 'team_xxxxxx',
    teamName: 'ObjectStack',
  },
  
  projects: [
    {
      name: 'objectstack-docs',
      framework: 'static',
      
      gitRepository: {
        type: 'github',
        repo: 'objectstack-ai/docs',
        productionBranch: 'main',
        autoDeployProduction: true,
        autoDeployPreview: true,
      },
      
      buildConfig: {
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        installCommand: 'npm ci',
        nodeVersion: '18.x',
      },
      
      deploymentConfig: {
        autoDeployment: true,
        regions: ['iad1', 'lhr1', 'sin1'],
        enablePreview: true,
        previewComments: true,
        productionProtection: false,
      },
      
      domains: [
        {
          domain: 'docs.objectstack.ai',
          httpsRedirect: true,
        },
      ],
      
      environmentVariables: [
        {
          key: 'ALGOLIA_APP_ID',
          value: '${ALGOLIA_APP_ID}',
          target: ['production', 'preview'],
          isSecret: false,
        },
        {
          key: 'ALGOLIA_API_KEY',
          value: '${ALGOLIA_API_KEY}',
          target: ['production', 'preview'],
          isSecret: true,
        },
      ],
    },
  ],
  
  monitoring: {
    enableWebAnalytics: true,
    enableSpeedInsights: false,
  },
  
  enableWebhooks: false,
  
  status: 'active',
  enabled: true,
};
