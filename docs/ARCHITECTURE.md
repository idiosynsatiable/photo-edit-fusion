# Architecture

## Repository layout

```
photo-edit-fusion/
├── apps/
│   ├── web/        # React + Vite (PWA renderer; also Electron renderer)
│   ├── desktop/    # Electron main + preload; consumes apps/web/dist
│   └── server/     # Fastify HTTP API (font ID proxy, AI cut, project CRUD)
├── packages/
│   ├── shared/         # Layer types, Zod schemas, blend-mode catalog, error helpers
│   ├── canvas-engine/  # Document model, immer-patch history, transforms, hit-test
│   ├── filters/        # WebGL2 blend shaders, Canvas2D fallback, CPU reference, adjustments
│   ├── cut-tools/      # Lasso polygon raster, magic-wand LAB flood-fill, mask helpers
│   └── font-match/     # OCR feature extraction, Google Fonts catalog, scorer, API adapters
├── scripts/
│   ├── scan-secrets.mjs       # Fail-build secret scanner
│   └── scan-placeholders.mjs  # TODO/FIXME blocker
├── tests/e2e/                 # Playwright smoke tests
└── .github/workflows/ci.yml   # Type → lint → scan → unit → build → E2E
```

## Why a monorepo

The five features have shared abstractions: a **`Layer`** type used by everything, a **`BlendMode`** enum that has WebGL, Canvas2D, and CPU implementations, a **`Mask`** type produced by every cut tool. Sharing these via workspace packages keeps the contracts explicit and lets the desktop and server reuse them without copy-paste.

## Render pipeline

`apps/web` renders documents through Canvas2D (`apps/web/src/lib/render.ts`). For each visible layer, in `layerOrder`:

1. apply transform (translate → rotate → scale, anchored)
2. set `globalAlpha = layer.opacity`
3. set `globalCompositeOperation = CANVAS2D_FALLBACK[layer.blendMode]`
4. draw image / text / shape

`packages/filters/blend-shaders.ts` provides WebGL2 shaders for the 11 blend modes Canvas2D cannot express natively (vivid-light, linear-light, hard-mix, subtract, divide, dissolve, etc.). `packages/filters/webgl-compositor.ts` is a small reusable compositor that compiles one program per blend mode and runs a fullscreen-quad pass; the integration into `render.ts` is a follow-on optimisation — for v1 the Canvas2D fallback path is the default, and the WebGL path is exposed as a public API for use by future enhancements.

## State & history

`packages/canvas-engine/history.ts` uses `immer.produceWithPatches` to record forward and inverse JSON Patches per commit. Memory cost is proportional to the diff, not the document size, so undo stacks of 200 entries cost a few KB even on 4K canvases. The store in `apps/web/src/store/editor-store.ts` (Zustand) wraps `History` and exposes shape-stable selectors so components only re-render on changes they care about.

## Selection & cut

A **selection** is a `Mask` (`Uint8ClampedArray`, 0..255) at the same dimensions as the source bitmap. The three cut tools all produce a `Mask`:

- **Lasso / polygon** — `rasterizePolygon()` uses even-odd fill scan-line.
- **Magic wand** — `magicWand()` flood-fills (or globally samples) pixels whose CIE LAB ΔE76 from the seed pixel is within `tolerance`.
- **AI cut** — server returns a matted PNG (Remove.bg) or the client computes a corner-color edge approximation locally. A first-class ONNX U2Net runtime is wired but optional: drop a `u2net.onnx` model into `apps/web/public/models/` and the worker will pick it up.

Once a `Mask` exists, `applyMaskToImage(image, mask)` multiplies pixel alpha by `mask/255` in place. This keeps the bitmap in a single source of truth (the `Document.bitmaps` registry) and makes the cut undoable.

## Font identification

`packages/font-match/metrics.ts` contains an Otsu binarizer and a glyph feature extractor that computes:

- **stroke density** (foreground pixel ratio inside the bbox) — proxy for font weight
- **italic angle** (second-moment of the foreground points)
- **aspect ratio** (per-glyph bbox aspect)

These features feed both the local Google Fonts similarity ranker (`scorer.ts`) and the metrics field of every `FontMatchResult` so users can sanity-check API responses.

The server's `/api/font-id` route runs a provider chain:

```
WhatTheFont (if WHATTHEFONT_API_KEY set)
  → Fontspring (if FONTSPRING_API_KEY set)
    → google-fonts-similarity (always available)
```

Each provider failure (network error, non-2xx response) falls through to the next. The chain order can be reordered per request via `hints.preferProvider`. `LocalSimilarityProvider.isAvailable()` always returns `true`, so the route never serves a 503 for "everything missing" — it returns a 200 result with `provider: 'google-fonts-similarity'` and the UI shows a banner explaining the fallback.

## Disabled-safe contract

Every optional integration follows the same shape:

```ts
{ error: "integration_disabled", integration: "<name>", reason: "<envvar> not set", hint: "Set <envvar> ..." }
```

Status code: **503**. The web client checks `/api/integrations` on load and surfaces the result in the status bar. Per-feature flows handle the 503 by either offering a fallback (font ID) or letting the user know the feature requires configuration (Remove.bg).

## Build & distribution

- **Web** — `pnpm --filter @pef/web build` produces a static SPA in `apps/web/dist/`. Service worker registration and offline asset caching are intentionally not bundled in v1; PWA install works because of the `manifest.webmanifest`, but offline editing is a phase-2 feature.
- **Desktop** — `pnpm --filter @pef/desktop build` compiles `apps/desktop/src/main.ts` and `preload.ts` to CommonJS, copies `apps/web/dist` into `apps/desktop/renderer/`, and `electron-builder` packages a `.dmg` / `.exe` / `.AppImage`.
- **Server** — `pnpm --filter @pef/server build && node apps/server/dist/index.js`. Reads `.env` (or environment variables) on startup and validates with Zod. Fails fast on missing required vars, is permissive on missing optional vars.
