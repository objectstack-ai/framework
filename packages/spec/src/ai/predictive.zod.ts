// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { TokenUsageSchema } from './cost.zod';

/**
 * Predictive Analytics Protocol
 * 
 * Defines predictive models and machine learning configurations for
 * data-driven decision making and forecasting in ObjectStack applications.
 * 
 * Use Cases:
 * - Lead scoring and conversion prediction
 * - Customer churn prediction
 * - Sales forecasting
 * - Demand forecasting
 * - Anomaly detection in operational data
 * - Customer segmentation and clustering
 * - Price optimization
 * - Recommendation systems
 */

/**
 * Predictive Model Types
 */
import { lazySchema } from '../shared/lazy-schema';
export const PredictiveModelTypeSchema = lazySchema(() => z.enum([
  'classification',      // Binary or multi-class classification
  'regression',          // Numerical prediction
  'clustering',          // Unsupervised grouping
  'forecasting',         // Time-series prediction
  'anomaly_detection',   // Outlier detection
  'recommendation',      // Item or action recommendation
  'ranking',             // Ordering items by relevance
]));

/**
 * Model Feature Definition
 * Describes an input feature for a predictive model
 */
export const ModelFeatureSchema = lazySchema(() => z.object({
  /** Feature Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Feature name (snake_case)'),
  label: z.string().optional().describe('Human-readable label'),
  
  /** Data Source */
  field: z.string().describe('Source field name'),
  object: z.string().optional().describe('Source object (if different from target)'),
  
  /** Feature Type */
  dataType: z.enum(['numeric', 'categorical', 'text', 'datetime', 'boolean']).describe('Feature data type'),
  
  /** Feature Engineering */
  transformation: z.enum([
    'none',
    'normalize',           // Normalize to 0-1 range
    'standardize',         // Z-score standardization
    'one_hot_encode',      // One-hot encoding for categorical
    'label_encode',        // Label encoding for categorical
    'log_transform',       // Logarithmic transformation
    'binning',             // Discretize continuous values
    'embedding',           // Text/categorical embedding
  ]).optional().default('none'),
  
  /** Configuration */
  required: z.boolean().optional().default(true),
  defaultValue: z.unknown().optional(),
  
  /** Metadata */
  description: z.string().optional(),
  importance: z.number().optional().describe('Feature importance score (0-1)'),
}));

/**
 * Model Hyperparameters
 * Configuration specific to model algorithms
 */
export const HyperparametersSchema = lazySchema(() => z.object({
  /** General Parameters */
  learningRate: z.number().optional().describe('Learning rate for training'),
  epochs: z.number().int().optional().describe('Number of training epochs'),
  batchSize: z.number().int().optional().describe('Training batch size'),
  
  /** Tree-based Models (Random Forest, XGBoost, etc.) */
  maxDepth: z.number().int().optional().describe('Maximum tree depth'),
  numTrees: z.number().int().optional().describe('Number of trees in ensemble'),
  minSamplesSplit: z.number().int().optional().describe('Minimum samples to split node'),
  minSamplesLeaf: z.number().int().optional().describe('Minimum samples in leaf node'),
  
  /** Neural Networks */
  hiddenLayers: z.array(z.number().int()).optional().describe('Hidden layer sizes'),
  activation: z.string().optional().describe('Activation function'),
  dropout: z.number().optional().describe('Dropout rate'),
  
  /** Regularization */
  l1Regularization: z.number().optional().describe('L1 regularization strength'),
  l2Regularization: z.number().optional().describe('L2 regularization strength'),
  
  /** Clustering */
  numClusters: z.number().int().optional().describe('Number of clusters (k-means, etc.)'),
  
  /** Time Series */
  seasonalPeriod: z.number().int().optional().describe('Seasonal period for time series'),
  forecastHorizon: z.number().int().optional().describe('Number of periods to forecast'),
  
  /** Additional custom parameters */
  custom: z.record(z.string(), z.unknown()).optional().describe('Algorithm-specific parameters'),
}));

/**
 * Model Training Configuration
 */
export const TrainingConfigSchema = lazySchema(() => z.object({
  /** Data Split */
  trainingDataRatio: z.number().min(0).max(1).optional().default(0.8).describe('Proportion of data for training'),
  validationDataRatio: z.number().min(0).max(1).optional().default(0.1).describe('Proportion for validation'),
  testDataRatio: z.number().min(0).max(1).optional().default(0.1).describe('Proportion for testing'),
  
  /** Data Filtering */
  dataFilter: z.string().optional().describe('Formula to filter training data'),
  minRecords: z.number().int().optional().default(100).describe('Minimum records required'),
  maxRecords: z.number().int().optional().describe('Maximum records to use'),
  
  /** Training Strategy */
  strategy: z.enum(['full', 'incremental', 'online', 'transfer_learning']).optional().default('full'),
  crossValidation: z.boolean().optional().default(true),
  folds: z.number().int().min(2).max(10).optional().default(5).describe('Cross-validation folds'),
  
  /** Early Stopping */
  earlyStoppingEnabled: z.boolean().optional().default(true),
  earlyStoppingPatience: z.number().int().optional().default(10).describe('Epochs without improvement before stopping'),
  
  /** Resource Limits */
  maxTrainingTime: z.number().optional().describe('Maximum training time in seconds'),
  gpuEnabled: z.boolean().optional().default(false),
  
  /** Reproducibility */
  randomSeed: z.number().int().optional().describe('Random seed for reproducibility'),
}).superRefine((data, ctx) => {
  if (data.trainingDataRatio && data.validationDataRatio && data.testDataRatio) {
    const sum = data.trainingDataRatio + data.validationDataRatio + data.testDataRatio;
    if (Math.abs(sum - 1) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Data split ratios must sum to 1. Current sum: ${sum}`,
        path: ['trainingDataRatio'],
      });
    }
  }
}));

/**
 * Model Evaluation Metrics
 */
export const EvaluationMetricsSchema = lazySchema(() => z.object({
  /** Classification Metrics */
  accuracy: z.number().optional(),
  precision: z.number().optional(),
  recall: z.number().optional(),
  f1Score: z.number().optional(),
  auc: z.number().optional().describe('Area Under ROC Curve'),
  
  /** Regression Metrics */
  mse: z.number().optional().describe('Mean Squared Error'),
  rmse: z.number().optional().describe('Root Mean Squared Error'),
  mae: z.number().optional().describe('Mean Absolute Error'),
  r2Score: z.number().optional().describe('R-squared score'),
  
  /** Clustering Metrics */
  silhouetteScore: z.number().optional(),
  daviesBouldinIndex: z.number().optional(),
  
  /** Time Series Metrics */
  mape: z.number().optional().describe('Mean Absolute Percentage Error'),
  smape: z.number().optional().describe('Symmetric MAPE'),
  
  /** Additional Metrics */
  custom: z.record(z.string(), z.number()).optional(),
}));

/**
 * Predictive Model Schema
 * Complete definition of a predictive model
 */
export const PredictiveModelSchema = lazySchema(() => z.object({
  /** Identity */
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/).describe('Model unique identifier (snake_case)'),
  label: z.string().describe('Model display name'),
  description: z.string().optional(),
  
  /** Model Type */
  type: PredictiveModelTypeSchema,
  algorithm: z.string().optional().describe('Specific algorithm (e.g., "random_forest", "xgboost", "lstm")'),
  
  /** Target Object & Field */
  objectName: z.string().describe('Target object for predictions'),
  target: z.string().describe('Target field to predict'),
  targetType: z.enum(['numeric', 'categorical', 'binary']).optional().describe('Target field type'),
  
  /** Features */
  features: z.array(ModelFeatureSchema).describe('Input features for the model'),
  
  /** Hyperparameters */
  hyperparameters: HyperparametersSchema.optional(),
  
  /** Training Configuration */
  training: TrainingConfigSchema.optional(),
  
  /** Model Performance */
  metrics: EvaluationMetricsSchema.optional().describe('Evaluation metrics from last training'),
  
  /** Deployment */
  deploymentStatus: z.enum(['draft', 'training', 'trained', 'deployed', 'deprecated']).optional().default('draft'),
  version: z.string().optional().default('1.0.0'),
  
  /** Prediction Configuration */
  predictionField: z.string().optional().describe('Field to store predictions'),
  confidenceField: z.string().optional().describe('Field to store confidence scores'),
  updateTrigger: z.enum(['on_create', 'on_update', 'manual', 'scheduled']).optional().default('on_create'),
  
  /** Retraining */
  autoRetrain: z.boolean().optional().default(false),
  retrainSchedule: z.string().optional().describe('Cron expression for auto-retraining'),
  retrainThreshold: z.number().optional().describe('Performance threshold to trigger retraining'),
  
  /** Explainability */
  enableExplainability: z.boolean().optional().default(false).describe('Generate feature importance & explanations'),
  
  /** Monitoring */
  enableMonitoring: z.boolean().optional().default(true),
  alertOnDrift: z.boolean().optional().default(true).describe('Alert when model drift is detected'),
  
  /** Access Control */
  active: z.boolean().optional().default(true),
  owner: z.string().optional().describe('User ID of model owner'),
  permissions: z.array(z.string()).optional().describe('User/group IDs with access'),
  
  /** Metadata */
  tags: z.array(z.string()).optional(),
  category: z.string().optional().describe('Model category (e.g., "sales", "marketing", "operations")'),
  lastTrainedAt: z.string().datetime().optional().describe('ISO timestamp'),
  createdAt: z.string().datetime().optional().describe('ISO timestamp'),
  updatedAt: z.string().datetime().optional().describe('ISO timestamp'),
}));

/**
 * Prediction Request
 * Request for making predictions using a trained model
 */
export const PredictionRequestSchema = lazySchema(() => z.object({
  modelName: z.string().describe('Model to use for prediction'),
  recordIds: z.array(z.string()).optional().describe('Specific records to predict (if not provided, uses all)'),
  inputData: z.record(z.string(), z.unknown()).optional().describe('Direct input data (alternative to recordIds)'),
  returnConfidence: z.boolean().optional().default(true),
  returnExplanation: z.boolean().optional().default(false),
}));

/**
 * Prediction Result
 * Result of a prediction request
 */
export const PredictionResultSchema = lazySchema(() => z.object({
  modelName: z.string(),
  modelVersion: z.string(),
  recordId: z.string().optional(),
  prediction: z.unknown().describe('The predicted value'),
  confidence: z.number().optional().describe('Confidence score (0-1)'),
  probabilities: z.record(z.string(), z.number()).optional().describe('Class probabilities (for classification)'),
  explanation: z.object({
    topFeatures: z.array(z.object({
      feature: z.string(),
      importance: z.number(),
      value: z.unknown(),
    })).optional(),
    reasoning: z.string().optional(),
  }).optional(),
  tokens: TokenUsageSchema.optional().describe('Token usage for this prediction (if AI-powered)'),
  cost: z.number().nonnegative().optional().describe('Cost for this prediction in USD'),
  metadata: z.object({
    executionTime: z.number().optional().describe('Execution time in milliseconds'),
    timestamp: z.string().datetime().optional().describe('ISO timestamp'),
  }).optional(),
}));

/**
 * Model Drift Detection
 * Monitoring for model performance degradation
 */
export const ModelDriftSchema = lazySchema(() => z.object({
  modelName: z.string(),
  driftType: z.enum(['feature_drift', 'prediction_drift', 'performance_drift']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  detectedAt: z.string().datetime().describe('ISO timestamp'),
  metrics: z.object({
    driftScore: z.number().describe('Drift magnitude (0-1)'),
    affectedFeatures: z.array(z.string()).optional(),
    performanceChange: z.number().optional().describe('Change in performance metric'),
  }),
  recommendation: z.string().optional(),
  autoRetrainTriggered: z.boolean().optional().default(false),
}));

// Type exports
export type PredictiveModelType = z.infer<typeof PredictiveModelTypeSchema>;
export type ModelFeature = z.infer<typeof ModelFeatureSchema>;
export type Hyperparameters = z.infer<typeof HyperparametersSchema>;
export type TrainingConfig = z.infer<typeof TrainingConfigSchema>;
export type EvaluationMetrics = z.infer<typeof EvaluationMetricsSchema>;
export type PredictiveModel = z.infer<typeof PredictiveModelSchema>;
export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;
export type PredictionResult = z.infer<typeof PredictionResultSchema>;
export type ModelDrift = z.infer<typeof ModelDriftSchema>;
