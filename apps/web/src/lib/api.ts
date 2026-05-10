import type { ApiError, FontMatchResult } from '@pef/shared';

const baseUrl = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4317';

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
