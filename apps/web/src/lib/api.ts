import type { ApiError, FontMatchResult } from '@pef/shared';

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
// A production client must never silently call a paid or user-owned cloud host.
// Cloud APIs are opt-in through VITE_API_BASE_URL; core editing stays local.
const baseUrl = configuredBaseUrl?.trim() || (import.meta.env?.DEV ? 'http://localhost:4317' : '');

function apiUrl(path: string): string {
  if (!baseUrl) {
    throw new Error('Cloud services are not configured. Local editing remains available; connect an API server to use this feature.');
  }
  return `${baseUrl}${path}`;
}

export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  reason?: string;
}

export async function getIntegrations(): Promise<IntegrationStatus[]> {
  if (!baseUrl) return [];
  try {
    const r = await fetch(apiUrl('/api/integrations'));
    if (!r.ok) return [];
    const json = (await r.json()) as { integrations: IntegrationStatus[] };
    return json.integrations;
  } catch {
    return [];
  }
}

export async function postFontIdentify(imageBase64: string, signal?: AbortSignal): Promise<FontMatchResult | ApiError> {
  const r = await fetch(apiUrl('/api/font-id'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
    signal,
  });
  return (await r.json()) as FontMatchResult | ApiError;
}

export async function postAiCut(imageBase64: string, preferProvider?: 'local-onnx' | 'remove-bg'): Promise<unknown> {
  // The local cut path is intentionally available without any backend or API key.
  if (!baseUrl || preferProvider === 'local-onnx') {
    return { provider: 'local-onnx', delegateToClient: true };
  }
  try {
    const r = await fetch(apiUrl('/api/ai-cut'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64, preferProvider }),
    });
    return await r.json();
  } catch {
    // A sleeping, missing, or unreachable server must not block local editing.
    return { provider: 'local-onnx', delegateToClient: true };
  }
}

export async function saveProject(id: string, project: { formatVersion: 1; document: unknown }): Promise<{ id: string; ok: true } | ApiError> {
  const r = await fetch(apiUrl('/api/projects'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, project }),
  });
  return (await r.json()) as { id: string; ok: true } | ApiError;
}

export async function listProjects(): Promise<Array<{ id: string; modifiedAt: string; bytes: number }>> {
  if (!baseUrl) return [];
  try {
    const r = await fetch(apiUrl('/api/projects'));
    if (!r.ok) return [];
    const json = (await r.json()) as { projects: Array<{ id: string; modifiedAt: string; bytes: number }> };
    return json.projects;
  } catch {
    return [];
  }
}

import type { EditPlan, SceneAnalysis } from '@pef/shared';

export async function postAiAnalyze(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  signal?: AbortSignal,
): Promise<{ analysis: SceneAnalysis } | ApiError> {
  const r = await fetch(apiUrl('/api/ai-edit/analyze'), {
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
  const r = await fetch(apiUrl('/api/ai-edit/plan'), {
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
  const r = await fetch(apiUrl('/api/ai-edit/execute'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, instruction, plan, analysis, approved: true }),
    signal,
  });
  return (await r.json()) as AiExecuteResult | ApiError;
}
