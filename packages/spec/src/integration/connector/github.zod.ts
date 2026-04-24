// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import {
  ConnectorSchema,
} from '../connector.zod';

/**
 * GitHub Connector Protocol
 * 
 * Specialized connector for GitHub integration enabling automated
 * version control operations, CI/CD workflows, and release management.
 * 
 * Use Cases:
 * - Automated code commits and pull requests
 * - GitHub Actions workflow management
 * - Issue and project tracking
 * - Release and tag management
 * - Repository administration
 * 
 * @example
 * ```typescript
 * import { GitHubConnector } from '@objectstack/spec/integration';
 * 
 * const githubConnector: GitHubConnector = {
 *   name: 'github_enterprise',
 *   label: 'GitHub Enterprise',
 *   type: 'saas',
 *   provider: 'github',
 *   baseUrl: 'https://api.github.com',
 *   authentication: {
 *     type: 'oauth2',
 *     clientId: '${GITHUB_CLIENT_ID}',
 *     clientSecret: '${GITHUB_CLIENT_SECRET}',
 *     authorizationUrl: 'https://github.com/login/oauth/authorize',
 *     tokenUrl: 'https://github.com/login/oauth/access_token',
 *     grantType: 'authorization_code',
 *     scopes: ['repo', 'workflow', 'admin:org'],
 *   },
 *   repositories: [
 *     {
 *       owner: 'objectstack-ai',
 *       name: 'spec',
 *       defaultBranch: 'main',
 *       autoMerge: false,
 *     },
 *   ],
 * };
 * ```
 */

/**
 * GitHub Provider Type
 */
import { lazySchema } from '../../shared/lazy-schema';
export const GitHubProviderSchema = lazySchema(() => z.enum([
  'github',            // GitHub.com
  'github_enterprise', // GitHub Enterprise Server
]).describe('GitHub provider type'));

export type GitHubProvider = z.infer<typeof GitHubProviderSchema>;

/**
 * GitHub Repository Configuration
 * Defines a repository to integrate with
 */
export const GitHubRepositorySchema = lazySchema(() => z.object({
  /**
   * Repository owner (organization or user)
   */
  owner: z.string().describe('Repository owner (organization or username)'),
  
  /**
   * Repository name
   */
  name: z.string().describe('Repository name'),
  
  /**
   * Default branch name
   */
  defaultBranch: z.string().optional().default('main').describe('Default branch name'),
  
  /**
   * Enable auto-merge for PRs
   */
  autoMerge: z.boolean().optional().default(false).describe('Enable auto-merge for pull requests'),
  
  /**
   * Branch protection rules
   */
  branchProtection: z.object({
    requiredReviewers: z.number().int().min(0).optional().default(1).describe('Required number of reviewers'),
    requireStatusChecks: z.boolean().optional().default(true).describe('Require status checks to pass'),
    enforceAdmins: z.boolean().optional().default(false).describe('Enforce protections for admins'),
    allowForcePushes: z.boolean().optional().default(false).describe('Allow force pushes'),
    allowDeletions: z.boolean().optional().default(false).describe('Allow branch deletions'),
  }).optional().describe('Branch protection configuration'),
  
  /**
   * Repository topics/tags
   */
  topics: z.array(z.string()).optional().describe('Repository topics'),
}));

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

/**
 * GitHub Commit Configuration
 */
export const GitHubCommitConfigSchema = lazySchema(() => z.object({
  /**
   * Commit author name
   */
  authorName: z.string().optional().describe('Commit author name'),
  
  /**
   * Commit author email
   */
  authorEmail: z.string().email().optional().describe('Commit author email'),
  
  /**
   * GPG sign commits
   */
  signCommits: z.boolean().optional().default(false).describe('Sign commits with GPG'),
  
  /**
   * Commit message template
   */
  messageTemplate: z.string().optional().describe('Commit message template'),
  
  /**
   * Conventional commits format
   */
  useConventionalCommits: z.boolean().optional().default(true).describe('Use conventional commits format'),
}));

export type GitHubCommitConfig = z.infer<typeof GitHubCommitConfigSchema>;

/**
 * GitHub Pull Request Configuration
 */
export const GitHubPullRequestConfigSchema = lazySchema(() => z.object({
  /**
   * Default PR title template
   */
  titleTemplate: z.string().optional().describe('PR title template'),
  
  /**
   * Default PR body template
   */
  bodyTemplate: z.string().optional().describe('PR body template'),
  
  /**
   * Default reviewers
   */
  defaultReviewers: z.array(z.string()).optional().describe('Default reviewers (usernames)'),
  
  /**
   * Default assignees
   */
  defaultAssignees: z.array(z.string()).optional().describe('Default assignees (usernames)'),
  
  /**
   * Default labels
   */
  defaultLabels: z.array(z.string()).optional().describe('Default labels'),
  
  /**
   * Enable draft PRs by default
   */
  draftByDefault: z.boolean().optional().default(false).describe('Create draft PRs by default'),
  
  /**
   * Auto-delete head branch after merge
   */
  deleteHeadBranch: z.boolean().optional().default(true).describe('Delete head branch after merge'),
}));

export type GitHubPullRequestConfig = z.infer<typeof GitHubPullRequestConfigSchema>;

/**
 * GitHub Actions Workflow Configuration
 */
export const GitHubActionsWorkflowSchema = lazySchema(() => z.object({
  /**
   * Workflow name
   */
  name: z.string().describe('Workflow name'),
  
  /**
   * Workflow file path
   */
  path: z.string().describe('Workflow file path (e.g., .github/workflows/ci.yml)'),
  
  /**
   * Enable workflow
   */
  enabled: z.boolean().optional().default(true).describe('Enable workflow'),
  
  /**
   * Workflow triggers
   */
  triggers: z.array(z.enum([
    'push',
    'pull_request',
    'release',
    'schedule',
    'workflow_dispatch',
    'repository_dispatch',
  ])).optional().describe('Workflow triggers'),
  
  /**
   * Environment variables
   */
  env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
  
  /**
   * Secrets required
   */
  secrets: z.array(z.string()).optional().describe('Required secrets'),
}));

export type GitHubActionsWorkflow = z.infer<typeof GitHubActionsWorkflowSchema>;

/**
 * GitHub Release Configuration
 */
export const GitHubReleaseConfigSchema = lazySchema(() => z.object({
  /**
   * Tag name pattern
   */
  tagPattern: z.string().optional().default('v*').describe('Tag name pattern (e.g., v*, release/*)'),
  
  /**
   * Use semantic versioning
   */
  semanticVersioning: z.boolean().optional().default(true).describe('Use semantic versioning'),
  
  /**
   * Generate release notes automatically
   */
  autoReleaseNotes: z.boolean().optional().default(true).describe('Generate release notes automatically'),
  
  /**
   * Release name template
   */
  releaseNameTemplate: z.string().optional().describe('Release name template'),
  
  /**
   * Pre-release pattern
   */
  preReleasePattern: z.string().optional().describe('Pre-release pattern (e.g., *-alpha, *-beta)'),
  
  /**
   * Create draft releases
   */
  draftByDefault: z.boolean().optional().default(false).describe('Create draft releases by default'),
}));

export type GitHubReleaseConfig = z.infer<typeof GitHubReleaseConfigSchema>;

/**
 * GitHub Issue Tracking Configuration
 */
export const GitHubIssueTrackingSchema = lazySchema(() => z.object({
  /**
   * Enable issue tracking
   */
  enabled: z.boolean().optional().default(true).describe('Enable issue tracking'),
  
  /**
   * Default issue labels
   */
  defaultLabels: z.array(z.string()).optional().describe('Default issue labels'),
  
  /**
   * Issue template paths
   */
  templatePaths: z.array(z.string()).optional().describe('Issue template paths'),
  
  /**
   * Auto-assign issues
   */
  autoAssign: z.boolean().optional().default(false).describe('Auto-assign issues'),
  
  /**
   * Auto-close stale issues
   */
  autoCloseStale: z.object({
    enabled: z.boolean().default(false),
    daysBeforeStale: z.number().int().min(1).optional().default(60),
    daysBeforeClose: z.number().int().min(1).optional().default(7),
    staleLabel: z.string().optional().default('stale'),
  }).optional().describe('Auto-close stale issues configuration'),
}));

export type GitHubIssueTracking = z.infer<typeof GitHubIssueTrackingSchema>;

/**
 * GitHub Connector Schema
 * Complete GitHub integration configuration
 */
export const GitHubConnectorSchema = lazySchema(() => ConnectorSchema.extend({
  type: z.literal('saas'),
  
  /**
   * GitHub provider type
   */
  provider: GitHubProviderSchema.describe('GitHub provider'),
  
  /**
   * GitHub API base URL
   */
  baseUrl: z.string().url().optional().default('https://api.github.com').describe('GitHub API base URL'),
  
  /**
   * Repositories to integrate
   */
  repositories: z.array(GitHubRepositorySchema).describe('Repositories to manage'),
  
  /**
   * Commit configuration
   */
  commitConfig: GitHubCommitConfigSchema.optional().describe('Commit configuration'),
  
  /**
   * Pull request configuration
   */
  pullRequestConfig: GitHubPullRequestConfigSchema.optional().describe('Pull request configuration'),
  
  /**
   * GitHub Actions workflows
   */
  workflows: z.array(GitHubActionsWorkflowSchema).optional().describe('GitHub Actions workflows'),
  
  /**
   * Release configuration
   */
  releaseConfig: GitHubReleaseConfigSchema.optional().describe('Release configuration'),
  
  /**
   * Issue tracking configuration
   */
  issueTracking: GitHubIssueTrackingSchema.optional().describe('Issue tracking configuration'),
  
  /**
   * Enable webhooks
   */
  enableWebhooks: z.boolean().optional().default(true).describe('Enable GitHub webhooks'),
  
  /**
   * Webhook events to subscribe
   */
  webhookEvents: z.array(z.enum([
    'push',
    'pull_request',
    'issues',
    'issue_comment',
    'release',
    'workflow_run',
    'deployment',
    'deployment_status',
    'check_run',
    'check_suite',
    'status',
  ])).optional().describe('Webhook events to subscribe to'),
}));

export type GitHubConnector = z.infer<typeof GitHubConnectorSchema>;

// ============================================================================
// Helper Functions & Examples
// ============================================================================

/**
 * Example: GitHub.com Connector Configuration
 */
export const githubPublicConnectorExample = {
  name: 'github_public',
  label: 'GitHub.com',
  type: 'saas',
  provider: 'github',
  baseUrl: 'https://api.github.com',
  
  authentication: {
    type: 'oauth2',
    clientId: '${GITHUB_CLIENT_ID}',
    clientSecret: '${GITHUB_CLIENT_SECRET}',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'workflow', 'write:packages'],
  },
  
  repositories: [
    {
      owner: 'objectstack-ai',
      name: 'spec',
      defaultBranch: 'main',
      autoMerge: false,
      branchProtection: {
        requiredReviewers: 1,
        requireStatusChecks: true,
        enforceAdmins: false,
        allowForcePushes: false,
        allowDeletions: false,
      },
      topics: ['objectstack', 'low-code', 'metadata-driven'],
    },
  ],
  
  commitConfig: {
    authorName: 'ObjectStack Bot',
    authorEmail: 'bot@objectstack.ai',
    signCommits: false,
    useConventionalCommits: true,
  },
  
  pullRequestConfig: {
    titleTemplate: '{{type}}: {{description}}',
    defaultReviewers: ['team-lead'],
    defaultLabels: ['automated', 'ai-generated'],
    draftByDefault: false,
    deleteHeadBranch: true,
  },
  
  workflows: [
    {
      name: 'CI',
      path: '.github/workflows/ci.yml',
      enabled: true,
      triggers: ['push', 'pull_request'],
    },
    {
      name: 'Release',
      path: '.github/workflows/release.yml',
      enabled: true,
      triggers: ['release'],
    },
  ],
  
  releaseConfig: {
    tagPattern: 'v*',
    semanticVersioning: true,
    autoReleaseNotes: true,
    releaseNameTemplate: 'Release {{version}}',
    draftByDefault: false,
  },
  
  issueTracking: {
    enabled: true,
    defaultLabels: ['needs-triage'],
    autoAssign: false,
    autoCloseStale: {
      enabled: true,
      daysBeforeStale: 60,
      daysBeforeClose: 7,
      staleLabel: 'stale',
    },
  },
  
  enableWebhooks: true,
  webhookEvents: ['push', 'pull_request', 'release', 'workflow_run'],
  
  status: 'active',
  enabled: true,
};

/**
 * Example: GitHub Enterprise Connector Configuration
 */
export const githubEnterpriseConnectorExample = {
  name: 'github_enterprise',
  label: 'GitHub Enterprise',
  type: 'saas',
  provider: 'github_enterprise',
  baseUrl: 'https://github.enterprise.com/api/v3',
  
  authentication: {
    type: 'oauth2',
    clientId: '${GITHUB_ENTERPRISE_CLIENT_ID}',
    clientSecret: '${GITHUB_ENTERPRISE_CLIENT_SECRET}',
    authorizationUrl: 'https://github.enterprise.com/login/oauth/authorize',
    tokenUrl: 'https://github.enterprise.com/login/oauth/access_token',
    scopes: ['repo', 'admin:org', 'workflow'],
  },
  
  repositories: [
    {
      owner: 'enterprise-org',
      name: 'internal-app',
      defaultBranch: 'develop',
      autoMerge: true,
      branchProtection: {
        requiredReviewers: 2,
        requireStatusChecks: true,
        enforceAdmins: true,
        allowForcePushes: false,
        allowDeletions: false,
      },
    },
  ],
  
  commitConfig: {
    authorName: 'CI Bot',
    authorEmail: 'ci-bot@enterprise.com',
    signCommits: true,
    useConventionalCommits: true,
  },
  
  pullRequestConfig: {
    titleTemplate: '[{{branch}}] {{description}}',
    bodyTemplate: `## Changes\n\n{{changes}}\n\n## Testing\n\n{{testing}}`,
    defaultReviewers: ['tech-lead', 'security-team'],
    defaultLabels: ['automated'],
    draftByDefault: true,
    deleteHeadBranch: true,
  },
  
  releaseConfig: {
    tagPattern: 'release/*',
    semanticVersioning: true,
    autoReleaseNotes: true,
    preReleasePattern: '*-rc*',
    draftByDefault: true,
  },
  
  status: 'active',
  enabled: true,
};
