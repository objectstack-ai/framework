// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';

/**
 * # AI-Driven Plugin Development Protocol
 * 
 * Defines protocols for AI-powered plugin development including:
 * - Natural language to code generation
 * - Intelligent code scaffolding
 * - Automated testing and validation
 * - AI-powered code review and optimization
 * - Plugin composition and recommendation
 */

/**
 * Code Generation Request
 * Request for AI to generate plugin code
 */
import { lazySchema } from '../shared/lazy-schema';
export const CodeGenerationRequestSchema = lazySchema(() => z.object({
  /**
   * Natural language description of desired functionality
   */
  description: z.string().describe('What the plugin should do'),
  
  /**
   * Plugin type to generate
   */
  pluginType: z.enum([
    'driver',           // Data driver plugin
    'app',              // Application plugin
    'widget',           // UI widget
    'integration',      // External integration
    'automation',       // Automation/workflow
    'analytics',        // Analytics plugin
    'ai-agent',         // AI agent plugin
    'custom',           // Custom plugin type
  ]),
  
  /**
   * Output format for generated code
   */
  outputFormat: z.enum([
    'source-code',        // Generate TypeScript/JavaScript source code
    'low-code-schema',    // Generate ObjectStack JSON/YAML schema definitions
    'dsl',                // Generate domain-specific language definitions
  ]).default('source-code')
    .describe('Format of the generated output'),
  
  /**
   * Target programming language (for source-code format)
   */
  language: z.enum(['typescript', 'javascript', 'python']).default('typescript'),
  
  /**
   * Framework preferences
   */
  framework: z.object({
    runtime: z.enum(['node', 'browser', 'edge', 'universal']).optional(),
    uiFramework: z.enum(['react', 'vue', 'svelte', 'none']).optional(),
    testing: z.enum(['vitest', 'jest', 'mocha', 'none']).optional(),
  }).optional(),
  
  /**
   * Required capabilities
   */
  capabilities: z.array(z.string()).optional().describe('Protocol IDs to implement'),
  
  /**
   * Dependencies
   */
  dependencies: z.array(z.string()).optional().describe('Required plugin IDs'),
  
  /**
   * Example usage (helps AI understand intent)
   */
  examples: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    description: z.string().optional(),
  })).optional(),
  
  /**
   * Code style preferences (for source-code format)
   */
  style: z.object({
    indentation: z.enum(['tab', '2spaces', '4spaces']).default('2spaces'),
    quotes: z.enum(['single', 'double']).default('single'),
    semicolons: z.boolean().default(true),
    trailingComma: z.boolean().default(true),
  }).optional(),
  
  /**
   * Low-code schema preferences (for low-code-schema format)
   */
  schemaOptions: z.object({
    /**
     * Schema format
     */
    format: z.enum(['json', 'yaml', 'typescript']).default('typescript')
      .describe('Output schema format'),
    
    /**
     * Include example data
     */
    includeExamples: z.boolean().default(true),
    
    /**
     * Validation strictness
     */
    strictValidation: z.boolean().default(true),
    
    /**
     * Generate UI definitions
     */
    generateUI: z.boolean().default(true)
      .describe('Generate view, dashboard, and page definitions'),
    
    /**
     * Generate data models
     */
    generateDataModels: z.boolean().default(true)
      .describe('Generate object and field definitions'),
  }).optional(),
  
  /**
   * Additional context
   */
  context: z.object({
    /**
     * Existing code to extend
     */
    existingCode: z.string().optional(),
    
    /**
     * Related documentation URLs
     */
    documentationUrls: z.array(z.string()).optional(),
    
    /**
     * Similar plugins for reference
     */
    referencePlugins: z.array(z.string()).optional(),
  }).optional(),
  
  /**
   * Generation options
   */
  options: z.object({
    /**
     * Include tests
     */
    generateTests: z.boolean().default(true),
    
    /**
     * Include documentation
     */
    generateDocs: z.boolean().default(true),
    
    /**
     * Include examples
     */
    generateExamples: z.boolean().default(true),
    
    /**
     * Code coverage target
     */
    targetCoverage: z.number().min(0).max(100).default(80),
    
    /**
     * Optimization level
     */
    optimizationLevel: z.enum(['none', 'basic', 'aggressive']).default('basic'),
  }).optional(),
}));

/**
 * Generated Code
 * Result of code generation
 */
export const GeneratedCodeSchema = lazySchema(() => z.object({
  /**
   * Output format used
   */
  outputFormat: z.enum(['source-code', 'low-code-schema', 'dsl']),
  
  /**
   * Main plugin code (for source-code format)
   */
  code: z.string().optional(),
  
  /**
   * Language used (for source-code format)
   */
  language: z.string().optional(),
  
  /**
   * Low-code schema definitions (for low-code-schema format)
   */
  schemas: z.array(z.object({
    type: z.enum(['object', 'view', 'dashboard', 'app', 'workflow', 'api', 'page']),
    path: z.string().describe('File path for the schema'),
    content: z.string().describe('Schema content (JSON/YAML/TypeScript)'),
    description: z.string().optional(),
  })).optional()
    .describe('Generated low-code schema files'),
  
  /**
   * File structure
   */
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional(),
  })),
  
  /**
   * Generated tests
   */
  tests: z.array(z.object({
    path: z.string(),
    content: z.string(),
    coverage: z.number().min(0).max(100).optional(),
  })).optional(),
  
  /**
   * Documentation
   */
  documentation: z.object({
    readme: z.string().optional(),
    api: z.string().optional(),
    usage: z.string().optional(),
  }).optional(),
  
  /**
   * Package metadata
   */
  package: z.object({
    name: z.string(),
    version: z.string(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
  }).optional(),
  
  /**
   * Quality metrics
   */
  quality: z.object({
    complexity: z.number().optional().describe('Cyclomatic complexity'),
    maintainability: z.number().min(0).max(100).optional(),
    testCoverage: z.number().min(0).max(100).optional(),
    lintScore: z.number().min(0).max(100).optional(),
  }).optional(),
  
  /**
   * AI confidence score
   */
  confidence: z.number().min(0).max(100).describe('AI confidence in generated code'),
  
  /**
   * Suggestions for improvement
   */
  suggestions: z.array(z.string()).optional(),
  
  /**
   * Warnings or caveats
   */
  warnings: z.array(z.string()).optional(),
}));

/**
 * Plugin Scaffolding Template
 * Template for plugin structure
 */
export const PluginScaffoldingTemplateSchema = lazySchema(() => z.object({
  /**
   * Template identifier
   */
  id: z.string(),
  
  /**
   * Template name
   */
  name: z.string(),
  
  /**
   * Description
   */
  description: z.string(),
  
  /**
   * Plugin type
   */
  pluginType: z.string(),
  
  /**
   * File structure
   */
  structure: z.array(z.object({
    type: z.enum(['file', 'directory']),
    path: z.string(),
    template: z.string().optional().describe('Template content with variables'),
    optional: z.boolean().default(false),
  })),
  
  /**
   * Variables to be filled
   */
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean().default(true),
    default: z.unknown().optional(),
    validation: z.string().optional().describe('Validation regex or rule'),
  })),
  
  /**
   * Post-scaffold scripts
   */
  scripts: z.array(z.object({
    name: z.string(),
    command: z.string(),
    description: z.string().optional(),
    optional: z.boolean().default(false),
  })).optional(),
}));

/**
 * AI Code Review Result
 * Result of AI-powered code review
 */
export const AICodeReviewResultSchema = lazySchema(() => z.object({
  /**
   * Overall assessment
   */
  assessment: z.enum(['excellent', 'good', 'acceptable', 'needs-improvement', 'poor']),
  
  /**
   * Overall score (0-100)
   */
  score: z.number().min(0).max(100),
  
  /**
   * Issues found
   */
  issues: z.array(z.object({
    severity: z.enum(['critical', 'error', 'warning', 'info', 'style']),
    category: z.enum([
      'bug',
      'security',
      'performance',
      'maintainability',
      'style',
      'documentation',
      'testing',
      'type-safety',
      'best-practice',
    ]),
    file: z.string(),
    line: z.number().int().optional(),
    column: z.number().int().optional(),
    message: z.string(),
    suggestion: z.string().optional(),
    autoFixable: z.boolean().default(false),
    autoFix: z.string().optional().describe('Automated fix code'),
  })),
  
  /**
   * Positive highlights
   */
  highlights: z.array(z.object({
    category: z.string(),
    description: z.string(),
    file: z.string().optional(),
  })).optional(),
  
  /**
   * Quality metrics
   */
  metrics: z.object({
    complexity: z.number().optional(),
    maintainability: z.number().min(0).max(100).optional(),
    testCoverage: z.number().min(0).max(100).optional(),
    duplicateCode: z.number().min(0).max(100).optional(),
    technicalDebt: z.string().optional().describe('Estimated technical debt'),
  }).optional(),
  
  /**
   * Recommendations
   */
  recommendations: z.array(z.object({
    priority: z.enum(['high', 'medium', 'low']),
    title: z.string(),
    description: z.string(),
    effort: z.enum(['trivial', 'small', 'medium', 'large']).optional(),
  })),
  
  /**
   * Security analysis
   */
  security: z.object({
    vulnerabilities: z.array(z.object({
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      type: z.string(),
      description: z.string(),
      remediation: z.string().optional(),
    })).optional(),
    score: z.number().min(0).max(100).optional(),
  }).optional(),
}));

/**
 * Plugin Composition Request
 * Request for AI to compose multiple plugins together
 */
export const PluginCompositionRequestSchema = lazySchema(() => z.object({
  /**
   * Desired outcome
   */
  goal: z.string().describe('What should the composed plugins achieve'),
  
  /**
   * Available plugins
   */
  availablePlugins: z.array(z.object({
    pluginId: z.string(),
    version: z.string(),
    capabilities: z.array(z.string()).optional(),
    description: z.string().optional(),
  })),
  
  /**
   * Constraints
   */
  constraints: z.object({
    /**
     * Maximum plugins to use
     */
    maxPlugins: z.number().int().min(1).optional(),
    
    /**
     * Required plugins
     */
    requiredPlugins: z.array(z.string()).optional(),
    
    /**
     * Excluded plugins
     */
    excludedPlugins: z.array(z.string()).optional(),
    
    /**
     * Performance requirements
     */
    performance: z.object({
      maxLatency: z.number().optional().describe('Maximum latency in ms'),
      maxMemory: z.number().optional().describe('Maximum memory in bytes'),
    }).optional(),
  }).optional(),
  
  /**
   * Optimization criteria
   */
  optimize: z.enum([
    'performance',
    'reliability',
    'simplicity',
    'cost',
    'security',
  ]).optional(),
}));

/**
 * Plugin Composition Result
 * AI-generated plugin composition
 */
export const PluginCompositionResultSchema = lazySchema(() => z.object({
  /**
   * Selected plugins
   */
  plugins: z.array(z.object({
    pluginId: z.string(),
    version: z.string(),
    role: z.string().describe('Role in the composition'),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })),
  
  /**
   * Integration code
   */
  integration: z.object({
    /**
     * Glue code to connect plugins
     */
    code: z.string(),
    
    /**
     * Configuration
     */
    config: z.record(z.string(), z.unknown()).optional(),
    
    /**
     * Initialization order
     */
    initOrder: z.array(z.string()),
  }),
  
  /**
   * Data flow diagram
   */
  dataFlow: z.array(z.object({
    from: z.string(),
    to: z.string(),
    data: z.string().describe('Data type or description'),
  })),
  
  /**
   * Expected performance
   */
  performance: z.object({
    estimatedLatency: z.number().optional().describe('Estimated latency in ms'),
    estimatedMemory: z.number().optional().describe('Estimated memory in bytes'),
  }).optional(),
  
  /**
   * Confidence score
   */
  confidence: z.number().min(0).max(100),
  
  /**
   * Alternative compositions
   */
  alternatives: z.array(z.object({
    description: z.string(),
    plugins: z.array(z.string()),
    tradeoffs: z.string(),
  })).optional(),
  
  /**
   * Warnings and considerations
   */
  warnings: z.array(z.string()).optional(),
}));

/**
 * Plugin Recommendation Request
 * Request for plugin recommendations
 */
export const PluginRecommendationRequestSchema = lazySchema(() => z.object({
  /**
   * User context
   */
  context: z.object({
    /**
     * Current plugins installed
     */
    installedPlugins: z.array(z.string()).optional(),
    
    /**
     * User's industry
     */
    industry: z.string().optional(),
    
    /**
     * Use cases
     */
    useCases: z.array(z.string()).optional(),
    
    /**
     * Team size
     */
    teamSize: z.number().int().optional(),
    
    /**
     * Budget constraints
     */
    budget: z.enum(['free', 'low', 'medium', 'high', 'unlimited']).optional(),
  }),
  
  /**
   * Recommendation criteria
   */
  criteria: z.object({
    /**
     * Prioritize by
     */
    prioritize: z.enum([
      'popularity',
      'rating',
      'compatibility',
      'features',
      'cost',
      'support',
    ]).optional(),
    
    /**
     * Only certified plugins
     */
    certifiedOnly: z.boolean().default(false),
    
    /**
     * Minimum rating
     */
    minRating: z.number().min(0).max(5).optional(),
    
    /**
     * Maximum results
     */
    maxResults: z.number().int().min(1).max(50).default(10),
  }).optional(),
}));

/**
 * Plugin Recommendation
 * AI-generated plugin recommendation
 */
export const PluginRecommendationSchema = lazySchema(() => z.object({
  /**
   * Recommended plugins
   */
  recommendations: z.array(z.object({
    pluginId: z.string(),
    name: z.string(),
    description: z.string(),
    score: z.number().min(0).max(100).describe('Relevance score'),
    reasons: z.array(z.string()).describe('Why this plugin is recommended'),
    benefits: z.array(z.string()),
    considerations: z.array(z.string()).optional(),
    alternatives: z.array(z.string()).optional(),
    estimatedValue: z.string().optional().describe('Expected value/ROI'),
  })),
  
  /**
   * Recommended combinations
   */
  combinations: z.array(z.object({
    plugins: z.array(z.string()),
    description: z.string(),
    synergies: z.array(z.string()).describe('How these plugins work well together'),
    totalScore: z.number().min(0).max(100),
  })).optional(),
  
  /**
   * Learning path
   */
  learningPath: z.array(z.object({
    step: z.number().int(),
    plugin: z.string(),
    reason: z.string(),
    resources: z.array(z.string()).optional(),
  })).optional(),
}));

// Export types
export type CodeGenerationRequest = z.infer<typeof CodeGenerationRequestSchema>;
export type GeneratedCode = z.infer<typeof GeneratedCodeSchema>;
export type PluginScaffoldingTemplate = z.infer<typeof PluginScaffoldingTemplateSchema>;
export type AICodeReviewResult = z.infer<typeof AICodeReviewResultSchema>;
export type PluginCompositionRequest = z.infer<typeof PluginCompositionRequestSchema>;
export type PluginCompositionResult = z.infer<typeof PluginCompositionResultSchema>;
export type PluginRecommendationRequest = z.infer<typeof PluginRecommendationRequestSchema>;
export type PluginRecommendation = z.infer<typeof PluginRecommendationSchema>;
