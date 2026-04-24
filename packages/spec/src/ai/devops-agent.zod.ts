// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { AgentSchema, AIToolSchema } from './agent.zod';

/**
 * DevOps Agent Protocol
 * 
 * Defines autonomous DevOps agents that can self-iterate on enterprise
 * management software development using the ObjectStack specification.
 * 
 * This agent integrates with GitHub for version control and Vercel for
 * deployment, enabling fully automated development, testing, and release cycles.
 * 
 * Architecture:
 * - Self-iterating development based on ObjectStack specifications
 * - Automated code generation following best practices
 * - Continuous integration and deployment
 * - Version management and release automation
 * - Monitoring and rollback capabilities
 * 
 * Use Cases:
 * - Automated feature development from specifications
 * - Self-healing code based on test failures
 * - Automated dependency updates
 * - Continuous optimization and refactoring
 * - Automated documentation generation
 * 
 * @example
 * ```typescript
 * import { DevOpsAgent } from '@objectstack/spec/ai';
 * 
 * const agent: DevOpsAgent = {
 *   name: 'devops_automation_agent',
 *   label: 'DevOps Automation Agent',
 *   role: 'Senior Full-Stack DevOps Engineer',
 *   instructions: '...',
 *   developmentConfig: {
 *     specificationSource: 'packages/spec',
 *     codeGeneration: {
 *       enabled: true,
 *       targets: ['frontend', 'backend', 'api'],
 *     },
 *   },
 *   integrations: {
 *     github: {
 *       connector: 'github_production',
 *       repository: {
 *         owner: 'objectstack-ai',
 *         name: 'app',
 *       },
 *     },
 *     vercel: {
 *       connector: 'vercel_production',
 *       project: 'objectstack-app',
 *     },
 *   },
 * };
 * ```
 */

/**
 * Code Generation Targets
 */
import { lazySchema } from '../shared/lazy-schema';
export const CodeGenerationTargetSchema = lazySchema(() => z.enum([
  'frontend',       // Frontend UI components
  'backend',        // Backend services
  'api',            // API endpoints
  'database',       // Database schemas
  'tests',          // Test suites
  'documentation',  // Documentation
  'infrastructure', // Infrastructure as code
]).describe('Code generation target'));

export type CodeGenerationTarget = z.infer<typeof CodeGenerationTargetSchema>;

/**
 * Code Generation Configuration
 */
export const CodeGenerationConfigSchema = lazySchema(() => z.object({
  /**
   * Enable code generation
   */
  enabled: z.boolean().optional().default(true).describe('Enable code generation'),
  
  /**
   * Generation targets
   */
  targets: z.array(CodeGenerationTargetSchema).describe('Code generation targets'),
  
  /**
   * Template repository
   */
  templateRepo: z.string().optional().describe('Template repository for scaffolding'),
  
  /**
   * Code style guide
   */
  styleGuide: z.string().optional().describe('Code style guide to follow'),
  
  /**
   * Include tests
   */
  includeTests: z.boolean().optional().default(true).describe('Generate tests with code'),
  
  /**
   * Include documentation
   */
  includeDocumentation: z.boolean().optional().default(true).describe('Generate documentation'),
  
  /**
   * Validation mode
   */
  validationMode: z.enum(['strict', 'moderate', 'permissive']).optional().default('strict').describe('Code validation strictness'),
}));

export type CodeGenerationConfig = z.infer<typeof CodeGenerationConfigSchema>;

/**
 * Testing Configuration
 */
export const TestingConfigSchema = lazySchema(() => z.object({
  /**
   * Enable automated testing
   */
  enabled: z.boolean().optional().default(true).describe('Enable automated testing'),
  
  /**
   * Test types to run
   */
  testTypes: z.array(z.enum([
    'unit',
    'integration',
    'e2e',
    'performance',
    'security',
    'accessibility',
  ])).optional().default(['unit', 'integration']).describe('Types of tests to run'),
  
  /**
   * Minimum coverage threshold
   */
  coverageThreshold: z.number().min(0).max(100).optional().default(80).describe('Minimum test coverage percentage'),
  
  /**
   * Test framework
   */
  framework: z.string().optional().describe('Testing framework (e.g., vitest, jest, playwright)'),
  
  /**
   * Run tests before commit
   */
  preCommitTests: z.boolean().optional().default(true).describe('Run tests before committing'),
  
  /**
   * Auto-fix failing tests
   */
  autoFix: z.boolean().optional().default(false).describe('Attempt to auto-fix failing tests'),
}));

export type TestingConfig = z.infer<typeof TestingConfigSchema>;

/**
 * CI/CD Pipeline Stage
 */
export const PipelineStageSchema = lazySchema(() => z.object({
  /**
   * Stage name
   */
  name: z.string().describe('Pipeline stage name'),
  
  /**
   * Stage type
   */
  type: z.enum([
    'build',
    'test',
    'lint',
    'security_scan',
    'deploy',
    'smoke_test',
    'rollback',
  ]).describe('Stage type'),
  
  /**
   * Stage order
   */
  order: z.number().int().min(0).describe('Execution order'),
  
  /**
   * Run in parallel
   */
  parallel: z.boolean().optional().default(false).describe('Can run in parallel with other stages'),
  
  /**
   * Commands to execute
   */
  commands: z.array(z.string()).describe('Commands to execute'),
  
  /**
   * Environment variables
   */
  env: z.record(z.string(), z.string()).optional().describe('Stage-specific environment variables'),
  
  /**
   * Timeout in seconds
   */
  timeout: z.number().int().min(60).optional().default(600).describe('Stage timeout in seconds'),
  
  /**
   * Retry on failure
   */
  retryOnFailure: z.boolean().optional().default(false).describe('Retry stage on failure'),
  
  /**
   * Max retry attempts
   */
  maxRetries: z.number().int().min(0).max(5).optional().default(0).describe('Maximum retry attempts'),
}));

export type PipelineStage = z.infer<typeof PipelineStageSchema>;

/**
 * CI/CD Pipeline Configuration
 */
export const CICDPipelineConfigSchema = lazySchema(() => z.object({
  /**
   * Pipeline name
   */
  name: z.string().describe('Pipeline name'),
  
  /**
   * Pipeline trigger
   */
  trigger: z.enum([
    'push',
    'pull_request',
    'release',
    'schedule',
    'manual',
  ]).describe('Pipeline trigger'),
  
  /**
   * Branch filters
   */
  branches: z.array(z.string()).optional().describe('Branches to run pipeline on'),
  
  /**
   * Pipeline stages
   */
  stages: z.array(PipelineStageSchema).describe('Pipeline stages'),
  
  /**
   * Enable notifications
   */
  notifications: z.object({
    onSuccess: z.boolean().optional().default(false),
    onFailure: z.boolean().optional().default(true),
    channels: z.array(z.string()).optional().describe('Notification channels (e.g., slack, email)'),
  }).optional().describe('Pipeline notifications'),
}));

export type CICDPipelineConfig = z.infer<typeof CICDPipelineConfigSchema>;

/**
 * Version Management Configuration
 */
export const VersionManagementSchema = lazySchema(() => z.object({
  /**
   * Versioning scheme
   */
  scheme: z.enum(['semver', 'calver', 'custom']).optional().default('semver').describe('Versioning scheme'),
  
  /**
   * Auto-increment strategy
   */
  autoIncrement: z.enum(['major', 'minor', 'patch', 'none']).optional().default('patch').describe('Auto-increment strategy'),
  
  /**
   * Version prefix
   */
  prefix: z.string().optional().default('v').describe('Version tag prefix'),
  
  /**
   * Create changelog
   */
  generateChangelog: z.boolean().optional().default(true).describe('Generate changelog automatically'),
  
  /**
   * Changelog format
   */
  changelogFormat: z.enum(['conventional', 'keepachangelog', 'custom']).optional().default('conventional').describe('Changelog format'),
  
  /**
   * Tag releases
   */
  tagReleases: z.boolean().optional().default(true).describe('Create Git tags for releases'),
}));

export type VersionManagement = z.infer<typeof VersionManagementSchema>;

/**
 * Deployment Strategy Configuration
 */
export const DeploymentStrategySchema = lazySchema(() => z.object({
  /**
   * Strategy type
   */
  type: z.enum([
    'rolling',
    'blue_green',
    'canary',
    'recreate',
  ]).optional().default('rolling').describe('Deployment strategy'),
  
  /**
   * Canary percentage (for canary deployments)
   */
  canaryPercentage: z.number().min(0).max(100).optional().default(10).describe('Canary deployment percentage'),
  
  /**
   * Health check URL
   */
  healthCheckUrl: z.string().optional().describe('Health check endpoint'),
  
  /**
   * Health check timeout
   */
  healthCheckTimeout: z.number().int().min(10).optional().default(60).describe('Health check timeout in seconds'),
  
  /**
   * Rollback on failure
   */
  autoRollback: z.boolean().optional().default(true).describe('Automatically rollback on failure'),
  
  /**
   * Smoke tests
   */
  smokeTests: z.array(z.string()).optional().describe('Smoke test commands to run post-deployment'),
}));

export type DeploymentStrategy = z.infer<typeof DeploymentStrategySchema>;

/**
 * Monitoring Configuration
 */
export const MonitoringConfigSchema = lazySchema(() => z.object({
  /**
   * Enable monitoring
   */
  enabled: z.boolean().optional().default(true).describe('Enable monitoring'),
  
  /**
   * Metrics to track
   */
  metrics: z.array(z.enum([
    'performance',
    'errors',
    'usage',
    'availability',
    'latency',
  ])).optional().default(['performance', 'errors', 'availability']).describe('Metrics to monitor'),
  
  /**
   * Alert thresholds
   */
  alerts: z.array(z.object({
    name: z.string().describe('Alert name'),
    metric: z.string().describe('Metric to monitor'),
    threshold: z.number().describe('Alert threshold'),
    severity: z.enum(['info', 'warning', 'critical']).describe('Alert severity'),
  })).optional().describe('Alert configurations'),
  
  /**
   * Monitoring integrations
   */
  integrations: z.array(z.string()).optional().describe('Monitoring service integrations'),
}));

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

/**
 * Development Configuration
 */
export const DevelopmentConfigSchema = lazySchema(() => z.object({
  /**
   * ObjectStack specification source
   */
  specificationSource: z.string().describe('Path to ObjectStack specification'),
  
  /**
   * Code generation configuration
   */
  codeGeneration: CodeGenerationConfigSchema.describe('Code generation settings'),
  
  /**
   * Testing configuration
   */
  testing: TestingConfigSchema.optional().describe('Testing configuration'),
  
  /**
   * Linting configuration
   */
  linting: z.object({
    enabled: z.boolean().optional().default(true),
    autoFix: z.boolean().optional().default(true),
    rules: z.record(z.string(), z.unknown()).optional(),
  }).optional().describe('Code linting configuration'),
  
  /**
   * Formatting configuration
   */
  formatting: z.object({
    enabled: z.boolean().optional().default(true),
    autoFormat: z.boolean().optional().default(true),
    config: z.record(z.string(), z.unknown()).optional(),
  }).optional().describe('Code formatting configuration'),
}));

export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;

/**
 * GitHub Integration Configuration
 */
export const GitHubIntegrationSchema = lazySchema(() => z.object({
  /**
   * GitHub connector reference
   */
  connector: z.string().describe('GitHub connector name'),
  
  /**
   * Repository configuration
   */
  repository: z.object({
    owner: z.string().describe('Repository owner'),
    name: z.string().describe('Repository name'),
  }).describe('Repository configuration'),
  
  /**
   * Default branch for features
   */
  featureBranch: z.string().optional().default('develop').describe('Default feature branch'),
  
  /**
   * Pull request configuration
   */
  pullRequest: z.object({
    autoCreate: z.boolean().optional().default(true).describe('Automatically create PRs'),
    autoMerge: z.boolean().optional().default(false).describe('Automatically merge PRs when checks pass'),
    requireReviews: z.boolean().optional().default(true).describe('Require reviews before merge'),
    deleteBranchOnMerge: z.boolean().optional().default(true).describe('Delete feature branch after merge'),
  }).optional().describe('Pull request settings'),
}));

export type GitHubIntegration = z.infer<typeof GitHubIntegrationSchema>;

/**
 * Vercel Integration Configuration
 */
export const VercelIntegrationSchema = lazySchema(() => z.object({
  /**
   * Vercel connector reference
   */
  connector: z.string().describe('Vercel connector name'),
  
  /**
   * Project name
   */
  project: z.string().describe('Vercel project name'),
  
  /**
   * Environment mapping
   */
  environments: z.object({
    production: z.string().optional().default('main').describe('Production branch'),
    preview: z.array(z.string()).optional().default(['develop', 'feature/*']).describe('Preview branches'),
  }).optional().describe('Environment mapping'),
  
  /**
   * Deployment configuration
   */
  deployment: z.object({
    autoDeployProduction: z.boolean().optional().default(false).describe('Auto-deploy to production'),
    autoDeployPreview: z.boolean().optional().default(true).describe('Auto-deploy preview environments'),
    requireApproval: z.boolean().optional().default(true).describe('Require approval for production deployments'),
  }).optional().describe('Deployment settings'),
}));

export type VercelIntegration = z.infer<typeof VercelIntegrationSchema>;

/**
 * Integration Configuration
 */
export const IntegrationConfigSchema = lazySchema(() => z.object({
  /**
   * GitHub integration
   */
  github: GitHubIntegrationSchema.describe('GitHub integration configuration'),
  
  /**
   * Vercel integration
   */
  vercel: VercelIntegrationSchema.describe('Vercel integration configuration'),
  
  /**
   * Additional integrations
   */
  additional: z.record(z.string(), z.unknown()).optional().describe('Additional integration configurations'),
}));

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

/**
 * DevOps Agent Schema
 * Complete autonomous DevOps agent configuration
 */
export const DevOpsAgentSchema = lazySchema(() => AgentSchema.extend({
  /**
   * Development configuration
   */
  developmentConfig: DevelopmentConfigSchema.describe('Development configuration'),
  
  /**
   * CI/CD pipelines
   */
  pipelines: z.array(CICDPipelineConfigSchema).optional().describe('CI/CD pipelines'),
  
  /**
   * Version management
   */
  versionManagement: VersionManagementSchema.optional().describe('Version management configuration'),
  
  /**
   * Deployment strategy
   */
  deploymentStrategy: DeploymentStrategySchema.optional().describe('Deployment strategy'),
  
  /**
   * Monitoring configuration
   */
  monitoring: MonitoringConfigSchema.optional().describe('Monitoring configuration'),
  
  /**
   * Integration configuration
   */
  integrations: IntegrationConfigSchema.describe('Integration configurations'),
  
  /**
   * Self-iteration configuration
   */
  selfIteration: z.object({
    enabled: z.boolean().optional().default(true).describe('Enable self-iteration'),
    iterationFrequency: z.string().optional().describe('Iteration frequency (cron expression)'),
    optimizationGoals: z.array(z.enum([
      'performance',
      'security',
      'code_quality',
      'test_coverage',
      'documentation',
    ])).optional().describe('Optimization goals'),
    learningMode: z.enum(['conservative', 'balanced', 'aggressive']).optional().default('balanced').describe('Learning mode'),
  }).optional().describe('Self-iteration configuration'),
}));

export type DevOpsAgent = z.infer<typeof DevOpsAgentSchema>;

/**
 * DevOps Tools Extension
 * Additional tools available to DevOps agents
 */
export const DevOpsToolSchema = lazySchema(() => AIToolSchema.extend({
  type: z.enum([
    'action',
    'flow',
    'query',
    'vector_search',
    // DevOps-specific tools
    'git_operation',
    'code_generation',
    'test_execution',
    'deployment',
    'monitoring',
  ]),
}));

export type DevOpsTool = z.infer<typeof DevOpsToolSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: Full-Stack DevOps Agent
 */
export const fullStackDevOpsAgentExample: DevOpsAgent = {
  name: 'devops_automation_agent',
  label: 'DevOps Automation Agent',
  visibility: 'organization',
  avatar: '/avatars/devops-bot.png',
  role: 'Senior Full-Stack DevOps Engineer',
  
  instructions: `You are an autonomous DevOps agent specialized in enterprise management software development.

Your responsibilities:
1. Generate code based on ObjectStack specifications
2. Write comprehensive tests for all generated code
3. Ensure code quality through linting and formatting
4. Manage Git workflow (commits, branches, PRs)
5. Deploy applications to Vercel
6. Monitor deployments and handle rollbacks
7. Continuously optimize and iterate on the codebase

Guidelines:
- Follow ObjectStack naming conventions (camelCase for props, snake_case for names)
- Write clean, maintainable, well-documented code
- Ensure 80%+ test coverage
- Use conventional commit messages
- Create detailed PR descriptions
- Deploy only after all checks pass
- Monitor production deployments closely
- Learn from failures and optimize continuously

Always prioritize code quality, security, and maintainability.`,
  
  model: {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    maxTokens: 8192,
  },
  
  tools: [
    {
      type: 'action',
      name: 'generate_from_spec',
      description: 'Generate code from ObjectStack specification',
    },
    {
      type: 'action',
      name: 'run_tests',
      description: 'Execute test suites',
    },
    {
      type: 'action',
      name: 'commit_and_push',
      description: 'Commit changes and push to GitHub',
    },
    {
      type: 'action',
      name: 'create_pull_request',
      description: 'Create pull request on GitHub',
    },
    {
      type: 'action',
      name: 'deploy_to_vercel',
      description: 'Deploy application to Vercel',
    },
    {
      type: 'action',
      name: 'check_deployment_health',
      description: 'Check deployment health status',
    },
    {
      type: 'action',
      name: 'rollback_deployment',
      description: 'Rollback to previous deployment',
    },
  ],
  
  knowledge: {
    topics: [
      'objectstack_protocol',
      'typescript_best_practices',
      'testing_strategies',
      'ci_cd_patterns',
      'deployment_strategies',
    ],
    indexes: ['devops_knowledge_base'],
  },
  
  developmentConfig: {
    specificationSource: 'packages/spec',
    
    codeGeneration: {
      enabled: true,
      targets: ['frontend', 'backend', 'api', 'tests', 'documentation'],
      styleGuide: 'objectstack',
      includeTests: true,
      includeDocumentation: true,
      validationMode: 'strict',
    },
    
    testing: {
      enabled: true,
      testTypes: ['unit', 'integration', 'e2e'],
      coverageThreshold: 80,
      framework: 'vitest',
      preCommitTests: true,
      autoFix: false,
    },
    
    linting: {
      enabled: true,
      autoFix: true,
    },
    
    formatting: {
      enabled: true,
      autoFormat: true,
    },
  },
  
  pipelines: [
    {
      name: 'CI Pipeline',
      trigger: 'pull_request',
      branches: ['main', 'develop'],
      stages: [
        {
          name: 'Install Dependencies',
          type: 'build',
          order: 1,
          commands: ['pnpm install'],
          timeout: 300,
          parallel: false,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Lint',
          type: 'lint',
          order: 2,
          parallel: true,
          commands: ['pnpm run lint'],
          timeout: 180,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Type Check',
          type: 'lint',
          order: 2,
          parallel: true,
          commands: ['pnpm run type-check'],
          timeout: 180,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Test',
          type: 'test',
          order: 3,
          commands: ['pnpm run test:ci'],
          timeout: 600,
          parallel: false,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Build',
          type: 'build',
          order: 4,
          commands: ['pnpm run build'],
          timeout: 600,
          parallel: false,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Security Scan',
          type: 'security_scan',
          order: 5,
          commands: ['pnpm audit', 'pnpm run security-scan'],
          timeout: 300,
          parallel: false,
          retryOnFailure: false,
          maxRetries: 0,
        },
      ],
    },
    {
      name: 'CD Pipeline',
      trigger: 'push',
      branches: ['main'],
      stages: [
        {
          name: 'Deploy to Production',
          type: 'deploy',
          order: 1,
          commands: ['vercel deploy --prod'],
          timeout: 600,
          parallel: false,
          retryOnFailure: false,
          maxRetries: 0,
        },
        {
          name: 'Smoke Tests',
          type: 'smoke_test',
          order: 2,
          commands: ['pnpm run test:smoke'],
          timeout: 300,
          parallel: false,
          retryOnFailure: true,
          maxRetries: 2,
        },
      ],
      notifications: {
        onSuccess: true,
        onFailure: true,
        channels: ['slack', 'email'],
      },
    },
  ],
  
  versionManagement: {
    scheme: 'semver',
    autoIncrement: 'patch',
    prefix: 'v',
    generateChangelog: true,
    changelogFormat: 'conventional',
    tagReleases: true,
  },
  
  deploymentStrategy: {
    type: 'rolling',
    healthCheckUrl: '/api/health',
    healthCheckTimeout: 60,
    autoRollback: true,
    smokeTests: ['pnpm run test:smoke'],
    canaryPercentage: 10,
  },
  
  monitoring: {
    enabled: true,
    metrics: ['performance', 'errors', 'availability'],
    alerts: [
      {
        name: 'High Error Rate',
        metric: 'error_rate',
        threshold: 0.05,
        severity: 'critical',
      },
      {
        name: 'Slow Response Time',
        metric: 'response_time',
        threshold: 1000,
        severity: 'warning',
      },
    ],
    integrations: ['vercel', 'datadog'],
  },
  
  integrations: {
    github: {
      connector: 'github_production',
      repository: {
        owner: 'objectstack-ai',
        name: 'app',
      },
      featureBranch: 'develop',
      pullRequest: {
        autoCreate: true,
        autoMerge: false,
        requireReviews: true,
        deleteBranchOnMerge: true,
      },
    },
    
    vercel: {
      connector: 'vercel_production',
      project: 'objectstack-app',
      environments: {
        production: 'main',
        preview: ['develop', 'feature/*'],
      },
      deployment: {
        autoDeployProduction: false,
        autoDeployPreview: true,
        requireApproval: true,
      },
    },
  },
  
  selfIteration: {
    enabled: true,
    iterationFrequency: '0 0 * * 0', // Weekly on Sunday
    optimizationGoals: ['code_quality', 'test_coverage', 'performance'],
    learningMode: 'balanced',
  },
  
  active: true,
};
