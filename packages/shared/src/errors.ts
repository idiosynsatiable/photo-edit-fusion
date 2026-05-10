/**
 * Disabled-safe error helpers used by the server and shared with the client.
 * Endpoints depending on optional integrations return a structured 503 instead
 * of crashing when their API key is missing.
 */

export interface IntegrationDisabledError {
  error: 'integration_disabled';
  integration: string;
  reason: string;
  /** suggestions for the operator */
  hint?: string;
}

export interface ValidationError {
  error: 'validation_error';
  details: Array<{ path: string; message: string }>;
}

export interface UpstreamError {
  error: 'upstream_error';
  integration: string;
  status: number;
  message: string;
}

export interface RateLimitError {
  error: 'rate_limited';
  retryAfterMs: number;
}

export type ApiError =
  | IntegrationDisabledError
  | ValidationError
  | UpstreamError
  | RateLimitError;

export function integrationDisabled(integration: string, envVar: string): IntegrationDisabledError {
  return {
    error: 'integration_disabled',
    integration,
    reason: `${envVar} not set`,
    hint: `Set ${envVar} in your environment to enable ${integration}.`,
  };
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  );
}
