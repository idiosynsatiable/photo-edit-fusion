# Photo Edit Fusion

An all-in-one photo editor that ships from a single TypeScript monorepo as both a **Progressive Web App** and an **Electron desktop app**, with a small Fastify API server for font identification and AI background removal.

## Five core features

1. **Overlay** — unlimited stacked layers (image, text, shape, group) with z-order, opacity, transform, lock/visibility, duplicate, and reorder.
2. **Blend** — all 27 Photoshop-style blend modes with WebGL2 fragment shaders and a Canvas2D `globalCompositeOperation` fallback.
3. **Cut** — three modes:
   - Lasso / polygon path selection with even-odd polygon rasterization.
   - Magic-wand color-similarity selection in **CIE LAB** space (perceptually uniform, not naive RGB distance).
   - AI background removal — local approximation always on; Remove.bg cloud provider when `REMOVE_BG_API_KEY` is set.
4. **Font extraction** — crop a region of text, send to **WhatTheFont** (primary) or **Fontspring Matcherator** (fallback). When neither key is set, the server falls back to **glyph-feature similarity** against a curated 27-font Google Fonts metrics catalog.
5. **Clone for text matching** — clone the chosen match into a new editable text layer with auto-loaded Google Fonts and recovered weight/style metrics.

## Disabled-safe by design

Every external integration is optional. Missing API keys produce structured `503 { error: "integration_disabled", integration, reason }` responses; the UI's status bar shows live integration health and the relevant feature degrades gracefully (e.g. font extraction falls back to local similarity scoring).

## Quick start

```bash
pnpm install
cp .env.example .env  # keys are optional — leave blank to use disabled-safe fallbacks
pnpm build

# run server + web in dev mode
pnpm dev:server &
pnpm dev:web

# or run the desktop app
pnpm dev:desktop
```

Open `http://localhost:5173` (web) or wait for the Electron window.

## Verification

```bash
pnpm verify   # runs typecheck + lint + scan-secrets + scan-placeholders + tests
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [HTTP API](docs/API.md)
- [Final Verification Report](docs/FINAL_VERIFICATION_REPORT.md)

## License

MIT.
