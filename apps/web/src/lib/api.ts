import type { ApiError, FontMatchResult } from '@pef/shared';

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
const baseUrl = configuredBaseUrl?.trim() || (import.meta.env?.DEV ? 'http://localhost:4317' : 'https://server-production-b79d.up.railway.app');

export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  reason?: string;
}

export async function getIntegrations(): Promise<IntegrationStatus[]> {
  const r = await fetch(`${baseUrl}/api/integrations`);
  if (!r.ok) return [];
  const json = (await r.json()) as { integrations: IntegrationStatus[] };
  return json.integrations;
}

export async function postFontIdentify(imageBase64: string, signal?: AbortSignal): Promise<FontMatchResult | ApiError> {
  const r = await fetch(`${baseUrl}/api/font-id`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
    signal,
  });
  return (await r.json()) as FontMatchResult | ApiError;
}

export async function postAiCut(imageBase64: string, preferProvider?: 'local-onnx' | 'remove-bg'): Promise<unknown> {
  const r = await fetch(`${baseUrl}/api/ai-cut`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, preferProvider }),
  });
  return await r.json();
}

export async function saveProject(id: string, project: { formatVersion: 1; document: unknown }): Promise<{ id: string; ok: true } | ApiError> {
  const r = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, project }),
  });
  return (await r.json()) as { id: string; ok: true } | ApiError;
}

export async function listProjects(): Promise<Array<{ id: string; modifiedAt: string; bytes: number }>> {
  const r = await fetch(`${baseUrl}/api/projects`);
  if (!r.ok) return [];
  const json = (await r.json()) as { projects: Array<{ id: string; modifiedAt: string; bytes: number }> };
  return json.projects;
}

import type { EditPlan, SceneAnalysis } from '@pef/shared';

export async function postAiAnalyze(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  signal?: AbortSignal,
): Promise<{ analysis: SceneAnalysis } | ApiError> {
  const r = await fetch(`${baseUrl}/api/ai-edit/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
    signal,
  });
  return (await r.json()) as { analysis: SceneAnalysis } | ApiError;
}

export async function postAiPlan(
  instruction: string,
  analysis: SceneAnalysis,
  preserveIdentity = true,
  priorOperations: EditPlan['operations'] = [],
  signal?: AbortSignal,
): Promise<{ plan: EditPlan } | ApiError> {
  const r = await fetch(`${baseUrl}/api/ai-edit/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ instruction, analysis, preserveIdentity, priorOperations }),
    signal,
  });
  return (await r.json()) as { plan: EditPlan } | ApiError;
}


export interface AiExecuteResult {
  imageBase64: string;
  mimeType: string;
  text?: string;
  provider: string;
  completedAt: string;
}

export async function postAiExecute(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  instruction: string,
  plan: EditPlan,
  analysis: SceneAnalysis,
  signal?: AbortSignal,
): Promise<AiExecuteResult | ApiError> {
  const r = await fetch(`${baseUrl}/api/ai-edit/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, instruction, plan, analysis, approved: true }),
    signal,
  });
  return (await r.json()) as AiExecuteResult | ApiError;
}
