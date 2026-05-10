# HTTP API

Base URL: `http://${PEF_SERVER_HOST}:${PEF_SERVER_PORT}` (default `127.0.0.1:4317`).

All POST endpoints accept and return `application/json` unless noted. Rate limit: `PEF_RATE_LIMIT_MAX` requests per `PEF_RATE_LIMIT_WINDOW_MS` per IP (default 120/minute). Body limit: `PEF_MAX_UPLOAD_BYTES` (default 25 MB).

## GET /api/health

```json
{ "status": "ok", "appVersion": "1.0.0" }
```

## GET /api/integrations

Reports which optional integrations are configured.

```json
{
  "integrations": [
    { "name": "whatthefont", "enabled": false, "reason": "WHATTHEFONT_API_KEY not set" },
    { "name": "fontspring",  "enabled": false, "reason": "FONTSPRING_API_KEY not set" },
    { "name": "remove-bg",   "enabled": false, "reason": "REMOVE_BG_API_KEY not set" },
    { "name": "google-fonts-similarity", "enabled": true },
    { "name": "local-onnx-cut", "enabled": true }
  ]
}
```

## POST /api/font-id

Identify the font in a cropped text image.

Request:

```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEU... (PNG bytes, optionally as data URL)",
  "hints": {
    "preferProvider": "auto",
    "maxResults": 10
  }
}
```

Response (success):

```json
{
  "matches": [
    {
      "family": "Inter",
      "score": 0.91,
      "weight": 600,
      "style": "normal",
      "source": "whatthefont",
      "googleFontsUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;700",
      "fallbacks": ["system-ui", "sans-serif"]
    }
  ],
  "metrics": {
    "estimatedWeight": 600,
    "estimatedItalic": false,
    "estimatedSizePx": 0,
    "estimatedTrackingEm": 0,
    "medianGlyphAspect": 0.55,
    "sampleText": ""
  },
  "provider": "whatthefont",
  "durationMs": 312
}
```

Response (validation error, 400):

```json
{
  "error": "validation_error",
  "details": [{ "path": "imageBase64", "message": "String must contain at least 20 character(s)" }]
}
```

Provider chain: `WhatTheFont → Fontspring → google-fonts-similarity`. Local similarity is always available, so a missing-keys situation returns a 200 with `provider: "google-fonts-similarity"` rather than a 503.

## POST /api/ai-cut

Remove the background from an image. Server only handles the Remove.bg path; local-ONNX is delegated to the client.

Request:

```json
{ "imageBase64": "...", "preferProvider": "auto" }
```

`preferProvider` can be `auto`, `local-onnx`, or `remove-bg`.

Response when client should run locally (200):

```json
{ "provider": "local-onnx", "delegateToClient": true }
```

Response when remote succeeds (200):

```json
{
  "cutoutPngDataUrl": "data:image/png;base64,...",
  "maskPngDataUrl":   "data:image/png;base64,...",
  "provider": "remove-bg",
  "durationMs": 1840
}
```

Response when Remove.bg key not set (503):

```json
{ "error": "integration_disabled", "integration": "remove-bg", "reason": "REMOVE_BG_API_KEY not set", "hint": "Set REMOVE_BG_API_KEY in your environment to enable remove-bg." }
```

## Project CRUD

Save/load `.pef` project files to `${PEF_DATA_DIR}/projects/`.

- `GET /api/projects` → `{ projects: [{ id, modifiedAt, bytes }] }`
- `GET /api/projects/:id` → returns a `ProjectFileV1`
- `POST /api/projects` → body `{ id?, project: ProjectFileV1 }` → `{ id, ok: true }`
- `DELETE /api/projects/:id` → `{ ok: true }`

The `id` is sanitized to `[A-Za-z0-9_-]{1,64}`; anything else returns `400 validation_error`.

## Error shape

All endpoints return one of these structured error shapes when something goes wrong:

```ts
type ApiError =
  | { error: "integration_disabled"; integration: string; reason: string; hint?: string }
  | { error: "validation_error"; details: { path: string; message: string }[] }
  | { error: "upstream_error"; integration: string; status: number; message: string }
  | { error: "rate_limited"; retryAfterMs: number };
```
