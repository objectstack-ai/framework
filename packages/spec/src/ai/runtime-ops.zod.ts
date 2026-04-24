// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { PluginHealthStatusSchema } from '../kernel/plugin-lifecycle-advanced.zod';

/**
 * # Runtime AI Operations (AIOps) Protocol
 * 
 * Defines protocols for AI-powered runtime operations including:
 * - Self-healing and automatic recovery
 * - Intelligent auto-scaling
 * - Anomaly detection and prediction
 * - Performance optimization
 * - Root cause analysis
 */

/**
 * Anomaly Detection Configuration
 * Configuration for detecting anomalies in plugin behavior
 */
import { lazySchema } from '../shared/lazy-schema';
export const AnomalyDetectionConfigSchema = lazySchema(() => z.object({
  /**
   * Enable anomaly detection
   */
  enabled: z.boolean().default(true),
  
  /**
   * Metrics to monitor
   */
  metrics: z.array(z.enum([
    'cpu-usage',
    'memory-usage',
    'response-time',
    'error-rate',
    'throughput',
    'latency',
    'connection-count',
    'queue-depth',
  ])),
  
  /**
   * Detection algorithm
   */
  algorithm: z.enum([
    'statistical',      // Statistical thresholds
    'machine-learning', // ML-based detection
    'heuristic',       // Rule-based heuristics
    'hybrid',          // Combination of methods
  ]).default('hybrid'),
  
  /**
   * Sensitivity level
   */
  sensitivity: z.enum(['low', 'medium', 'high']).default('medium')
    .describe('How aggressively to detect anomalies'),
  
  /**
   * Time window for analysis (seconds)
   */
  timeWindow: z.number().int().min(60).default(300)
    .describe('Historical data window for anomaly detection'),
  
  /**
   * Confidence threshold (0-100)
   */
  confidenceThreshold: z.number().min(0).max(100).default(80)
    .describe('Minimum confidence to flag as anomaly'),
  
  /**
   * Alert on detection
   */
  alertOnDetection: z.boolean().default(true),
}));

/**
 * Self-Healing Action
 * Defines an automated recovery action
 */
export const SelfHealingActionSchema = lazySchema(() => z.object({
  /**
   * Action identifier
   */
  id: z.string(),
  
  /**
   * Action type
   */
  type: z.enum([
    'restart',           // Restart the plugin
    'scale',             // Scale resources
    'rollback',          // Rollback to previous version
    'clear-cache',       // Clear caches
    'adjust-config',     // Adjust configuration
    'execute-script',    // Run custom script
    'notify',            // Notify administrators
  ]),
  
  /**
   * Trigger condition
   */
  trigger: z.object({
    /**
     * Health status that triggers this action
     */
    healthStatus: z.array(PluginHealthStatusSchema).optional(),
    
    /**
     * Anomaly types that trigger this action
     */
    anomalyTypes: z.array(z.string()).optional(),
    
    /**
     * Error patterns that trigger this action
     */
    errorPatterns: z.array(z.string()).optional(),
    
    /**
     * Custom condition expression
     */
    customCondition: z.string().optional()
      .describe('Custom trigger condition (e.g., "errorRate > 0.1")'),
  }),
  
  /**
   * Action parameters
   */
  parameters: z.record(z.string(), z.unknown()).optional(),
  
  /**
   * Maximum number of attempts
   */
  maxAttempts: z.number().int().min(1).default(3),
  
  /**
   * Cooldown period between attempts (seconds)
   */
  cooldown: z.number().int().min(0).default(60),
  
  /**
   * Timeout for action execution (seconds)
   */
  timeout: z.number().int().min(1).default(300),
  
  /**
   * Require manual approval
   */
  requireApproval: z.boolean().default(false),
  
  /**
   * Priority
   */
  priority: z.number().int().min(1).default(5)
    .describe('Action priority (lower number = higher priority)'),
}));

/**
 * Self-Healing Configuration
 * Complete configuration for self-healing capabilities
 */
export const SelfHealingConfigSchema = lazySchema(() => z.object({
  /**
   * Enable self-healing
   */
  enabled: z.boolean().default(true),
  
  /**
   * Healing strategy
   */
  strategy: z.enum([
    'conservative',  // Only safe, proven actions
    'moderate',      // Balanced approach
    'aggressive',    // Try more recovery options
  ]).default('moderate'),
  
  /**
   * Recovery actions
   */
  actions: z.array(SelfHealingActionSchema),
  
  /**
   * Anomaly detection
   */
  anomalyDetection: AnomalyDetectionConfigSchema.optional(),
  
  /**
   * Maximum concurrent healing operations
   */
  maxConcurrentHealing: z.number().int().min(1).default(1)
    .describe('Maximum number of simultaneous healing attempts'),
  
  /**
   * Learning mode
   */
  learning: z.object({
    enabled: z.boolean().default(true)
      .describe('Learn from successful/failed healing attempts'),
    
    feedbackLoop: z.boolean().default(true)
      .describe('Adjust strategy based on outcomes'),
  }).optional(),
}));

/**
 * Auto-Scaling Policy
 * Defines how to automatically scale plugin resources
 */
export const AutoScalingPolicySchema = lazySchema(() => z.object({
  /**
   * Enable auto-scaling
   */
  enabled: z.boolean().default(false),
  
  /**
   * Scaling metric
   */
  metric: z.enum([
    'cpu-usage',
    'memory-usage',
    'request-rate',
    'response-time',
    'queue-depth',
    'custom',
  ]),
  
  /**
   * Custom metric query (when metric is "custom")
   */
  customMetric: z.string().optional(),
  
  /**
   * Target value for the metric
   */
  targetValue: z.number()
    .describe('Desired metric value (e.g., 70 for 70% CPU)'),
  
  /**
   * Scaling bounds
   */
  bounds: z.object({
    /**
     * Minimum instances
     */
    minInstances: z.number().int().min(1).default(1),
    
    /**
     * Maximum instances
     */
    maxInstances: z.number().int().min(1).default(10),
    
    /**
     * Minimum resources per instance
     */
    minResources: z.object({
      cpu: z.string().optional().describe('CPU limit (e.g., "0.5", "1")'),
      memory: z.string().optional().describe('Memory limit (e.g., "512Mi", "1Gi")'),
    }).optional(),
    
    /**
     * Maximum resources per instance
     */
    maxResources: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
    }).optional(),
  }),
  
  /**
   * Scale up behavior
   */
  scaleUp: z.object({
    /**
     * Threshold to trigger scale up
     */
    threshold: z.number()
      .describe('Metric value that triggers scale up'),
    
    /**
     * Stabilization window (seconds)
     */
    stabilizationWindow: z.number().int().min(0).default(60)
      .describe('How long metric must exceed threshold'),
    
    /**
     * Cooldown period (seconds)
     */
    cooldown: z.number().int().min(0).default(300)
      .describe('Minimum time between scale-up operations'),
    
    /**
     * Step size
     */
    stepSize: z.number().int().min(1).default(1)
      .describe('Number of instances to add'),
  }),
  
  /**
   * Scale down behavior
   */
  scaleDown: z.object({
    /**
     * Threshold to trigger scale down
     */
    threshold: z.number()
      .describe('Metric value that triggers scale down'),
    
    /**
     * Stabilization window (seconds)
     */
    stabilizationWindow: z.number().int().min(0).default(300)
      .describe('How long metric must be below threshold'),
    
    /**
     * Cooldown period (seconds)
     */
    cooldown: z.number().int().min(0).default(600)
      .describe('Minimum time between scale-down operations'),
    
    /**
     * Step size
     */
    stepSize: z.number().int().min(1).default(1)
      .describe('Number of instances to remove'),
  }),
  
  /**
   * Predictive scaling
   */
  predictive: z.object({
    enabled: z.boolean().default(false)
      .describe('Use ML to predict future load'),
    
    lookAhead: z.number().int().min(60).default(300)
      .describe('How far ahead to predict (seconds)'),
    
    confidence: z.number().min(0).max(100).default(80)
      .describe('Minimum confidence for prediction-based scaling'),
  }).optional(),
}));

/**
 * Root Cause Analysis Request
 * Request for AI to analyze root cause of issues
 */
export const RootCauseAnalysisRequestSchema = lazySchema(() => z.object({
  /**
   * Incident identifier
   */
  incidentId: z.string(),
  
  /**
   * Plugin identifier
   */
  pluginId: z.string(),
  
  /**
   * Symptoms observed
   */
  symptoms: z.array(z.object({
    type: z.string().describe('Symptom type'),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    timestamp: z.string().datetime(),
  })),
  
  /**
   * Time range for analysis
   */
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  
  /**
   * Include log analysis
   */
  analyzeLogs: z.boolean().default(true),
  
  /**
   * Include metric analysis
   */
  analyzeMetrics: z.boolean().default(true),
  
  /**
   * Include dependency analysis
   */
  analyzeDependencies: z.boolean().default(true),
  
  /**
   * Context information
   */
  context: z.record(z.string(), z.unknown()).optional(),
}));

/**
 * Root Cause Analysis Result
 * Result of root cause analysis
 */
export const RootCauseAnalysisResultSchema = lazySchema(() => z.object({
  /**
   * Analysis identifier
   */
  analysisId: z.string(),
  
  /**
   * Incident identifier
   */
  incidentId: z.string(),
  
  /**
   * Identified root causes
   */
  rootCauses: z.array(z.object({
    /**
     * Cause identifier
     */
    id: z.string(),
    
    /**
     * Description
     */
    description: z.string(),
    
    /**
     * Confidence score (0-100)
     */
    confidence: z.number().min(0).max(100),
    
    /**
     * Category
     */
    category: z.enum([
      'code-defect',
      'configuration',
      'resource-exhaustion',
      'dependency-failure',
      'network-issue',
      'data-corruption',
      'security-breach',
      'other',
    ]),
    
    /**
     * Evidence
     */
    evidence: z.array(z.object({
      type: z.enum(['log', 'metric', 'trace', 'event']),
      content: z.string(),
      timestamp: z.string().datetime().optional(),
    })),
    
    /**
     * Impact assessment
     */
    impact: z.enum(['low', 'medium', 'high', 'critical']),
    
    /**
     * Recommended actions
     */
    recommendations: z.array(z.string()),
  })),
  
  /**
   * Contributing factors
   */
  contributingFactors: z.array(z.object({
    description: z.string(),
    confidence: z.number().min(0).max(100),
  })).optional(),
  
  /**
   * Timeline of events
   */
  timeline: z.array(z.object({
    timestamp: z.string().datetime(),
    event: z.string(),
    significance: z.enum(['low', 'medium', 'high']),
  })).optional(),
  
  /**
   * Remediation plan
   */
  remediation: z.object({
    /**
     * Immediate actions
     */
    immediate: z.array(z.string()),
    
    /**
     * Short-term fixes
     */
    shortTerm: z.array(z.string()),
    
    /**
     * Long-term improvements
     */
    longTerm: z.array(z.string()),
  }).optional(),
  
  /**
   * Overall confidence in analysis
   */
  overallConfidence: z.number().min(0).max(100),
  
  /**
   * Analysis timestamp
   */
  timestamp: z.string().datetime(),
}));

/**
 * Performance Optimization Suggestion
 * AI-generated performance optimization suggestion
 */
export const PerformanceOptimizationSchema = lazySchema(() => z.object({
  /**
   * Optimization identifier
   */
  id: z.string(),
  
  /**
   * Plugin identifier
   */
  pluginId: z.string(),
  
  /**
   * Optimization type
   */
  type: z.enum([
    'caching',
    'query-optimization',
    'resource-allocation',
    'code-refactoring',
    'architecture-change',
    'configuration-tuning',
  ]),
  
  /**
   * Description
   */
  description: z.string(),
  
  /**
   * Expected impact
   */
  expectedImpact: z.object({
    /**
     * Performance improvement percentage
     */
    performanceGain: z.number().min(0).max(100)
      .describe('Expected performance improvement (%)'),
    
    /**
     * Resource savings
     */
    resourceSavings: z.object({
      cpu: z.number().optional().describe('CPU reduction (%)'),
      memory: z.number().optional().describe('Memory reduction (%)'),
      network: z.number().optional().describe('Network reduction (%)'),
    }).optional(),
    
    /**
     * Cost reduction
     */
    costReduction: z.number().optional()
      .describe('Estimated cost reduction (%)'),
  }),
  
  /**
   * Implementation difficulty
   */
  difficulty: z.enum(['trivial', 'easy', 'moderate', 'complex', 'very-complex']),
  
  /**
   * Implementation steps
   */
  steps: z.array(z.string()),
  
  /**
   * Risks and considerations
   */
  risks: z.array(z.string()).optional(),
  
  /**
   * Confidence score
   */
  confidence: z.number().min(0).max(100),
  
  /**
   * Priority
   */
  priority: z.enum(['low', 'medium', 'high', 'critical']),
}));

/**
 * AIOps Agent Configuration
 * Configuration for AI operations agent
 */
export const AIOpsAgentConfigSchema = lazySchema(() => z.object({
  /**
   * Agent identifier
   */
  agentId: z.string(),
  
  /**
   * Plugin identifier
   */
  pluginId: z.string(),
  
  /**
   * Self-healing configuration
   */
  selfHealing: SelfHealingConfigSchema.optional(),
  
  /**
   * Auto-scaling policies
   */
  autoScaling: z.array(AutoScalingPolicySchema).optional(),
  
  /**
   * Continuous monitoring
   */
  monitoring: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().min(1000).default(60000)
      .describe('Monitoring interval in milliseconds'),
    
    /**
     * Metrics to collect
     */
    metrics: z.array(z.string()).optional(),
  }).optional(),
  
  /**
   * Proactive optimization
   */
  optimization: z.object({
    enabled: z.boolean().default(true),
    
    /**
     * Scan interval (seconds)
     */
    scanInterval: z.number().int().min(3600).default(86400)
      .describe('How often to scan for optimization opportunities'),
    
    /**
     * Auto-apply optimizations
     */
    autoApply: z.boolean().default(false)
      .describe('Automatically apply low-risk optimizations'),
  }).optional(),
  
  /**
   * Incident response
   */
  incidentResponse: z.object({
    enabled: z.boolean().default(true),
    
    /**
     * Auto-trigger root cause analysis
     */
    autoRCA: z.boolean().default(true),
    
    /**
     * Notification channels
     */
    notifications: z.array(z.object({
      channel: z.enum(['email', 'slack', 'webhook', 'sms']),
      config: z.record(z.string(), z.unknown()),
    })).optional(),
  }).optional(),
}));

// Export types
export type AnomalyDetectionConfig = z.infer<typeof AnomalyDetectionConfigSchema>;
export type SelfHealingAction = z.infer<typeof SelfHealingActionSchema>;
export type SelfHealingConfig = z.infer<typeof SelfHealingConfigSchema>;
export type AutoScalingPolicy = z.infer<typeof AutoScalingPolicySchema>;
export type RootCauseAnalysisRequest = z.infer<typeof RootCauseAnalysisRequestSchema>;
export type RootCauseAnalysisResult = z.infer<typeof RootCauseAnalysisResultSchema>;
export type PerformanceOptimization = z.infer<typeof PerformanceOptimizationSchema>;
export type AIOpsAgentConfig = z.infer<typeof AIOpsAgentConfigSchema>;
