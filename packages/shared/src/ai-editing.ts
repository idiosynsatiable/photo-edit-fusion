import { z } from 'zod';

/** Normalized, document-space scene metadata returned by a vision provider. */
export const SceneRegionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['person', 'face', 'object', 'background', 'text', 'unknown']),
  label: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bounds: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  text: z.string().optional(),
  protected: z.boolean().default(false),
});

export const SceneAnalysisSchema = z.object({
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  summary: z.string().min(1),
  regions: z.array(SceneRegionSchema),
  warnings: z.array(z.string()).default([]),
  provider: z.string().min(1),
  analyzedAt: z.string().datetime(),
});

const EditOperationBase = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  targetRegionIds: z.array(z.string()).default([]),
  prompt: z.string().optional(),
  reversible: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
});

export const EditOperationSchema = z.discriminatedUnion('type', [
  EditOperationBase.extend({ type: z.literal('remove-object') }),
  EditOperationBase.extend({ type: z.literal('replace-object') }),
  EditOperationBase.extend({ type: z.literal('adjust') }),
  EditOperationBase.extend({ type: z.literal('add-text') }),
  EditOperationBase.extend({ type: z.literal('recompose') }),
]);

export const EditPlanSchema = z.object({
  id: z.string().min(1),
  userInstruction: z.string().min(1),
  rationale: z.string().min(1),
  operations: z.array(EditOperationSchema).min(1),
  identityProtection: z.object({
    preserveFaces: z.boolean().default(true),
    protectedRegionIds: z.array(z.string()).default([]),
  }),
  requiresApproval: z.boolean().default(true),
  createdAt: z.string().datetime(),
});

export const AiAnalyzeRequestSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  projectId: z.string().min(1).optional(),
});

export const AiPlanRequestSchema = z.object({
  instruction: z.string().min(1).max(4000),
  analysis: SceneAnalysisSchema,
  priorOperations: z.array(EditOperationSchema).max(200).default([]),
  preserveIdentity: z.boolean().default(true),
});

export const AiExecutionProgressSchema = z.object({
  jobId: z.string().min(1),
  stage: z.enum(['queued', 'analyzing', 'planning', 'awaiting-approval', 'executing', 'compositing', 'verifying', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(1),
  message: z.string().min(1),
  operationId: z.string().optional(),
  errorCode: z.string().optional(),
});

export type SceneRegion = z.infer<typeof SceneRegionSchema>;
export type SceneAnalysis = z.infer<typeof SceneAnalysisSchema>;
export type EditOperation = z.infer<typeof EditOperationSchema>;
export type EditPlan = z.infer<typeof EditPlanSchema>;
export type AiAnalyzeRequest = z.infer<typeof AiAnalyzeRequestSchema>;
export type AiPlanRequest = z.infer<typeof AiPlanRequestSchema>;
export type AiExecutionProgress = z.infer<typeof AiExecutionProgressSchema>;
