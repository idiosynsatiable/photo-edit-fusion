# Photo Edit Fusion Ω — Acceptance & Implementation Plan

**Status:** In progress  
**Acceptance rule:** ALL 16 selected requirements must pass verification.  
**Branch:** `feat/photo-edit-fusion-omega-autonomous-editor`  
**Repository:** `idiosynsatiable/photo-edit-fusion`

This plan extends the existing TypeScript monorepo (PWA + Electron + Fastify API). Preserve the current layer/document model, renderer, masks, undo history, and disabled-safe integrations. Do not ship a parallel demo editor.

## Acceptance checklist

### AI intelligence
- [ ] Automatically scan the entire uploaded image, producing a structured scene analysis.
- [ ] Understand natural-language editing instructions, including follow-up context.
- [ ] Identify objects, people, backgrounds, and visible text with confidence/region metadata.
- [ ] Generate a reviewable editing plan before execution; require user confirmation for destructive/ambiguous actions.

### Autonomous editing
- [ ] Remove or replace selected objects using a generative provider, with deterministic fallback/error states.
- [ ] Preserve facial identity and important details; use identity-preservation constraints and explicit regression cases, never promise perfect preservation.
- [ ] Support follow-up instructions against the current project state without restarting or flattening prior edits.

### Editing experience
- [ ] Maintain editable layers and masks; represent AI operations as reversible layer/mask/document changes where possible.
- [ ] Provide synchronized before/after comparison.
- [ ] Support per-operation undo and full-session undo/restore.
- [ ] Show progress by stage and explain completed, skipped, or failed changes.
- [ ] Export full-resolution output with alpha transparency when requested; preserve dimensions and avoid accidental flattening.

### Platform and delivery
- [ ] Verify reliable operation on Samsung Android devices/browsers, including touch, memory pressure, upload, editing, and export.
- [ ] Support desktop and mobile browser editing with responsive controls and capability-aware fallbacks.
- [ ] Securely integrate Gemini and TITAN server-side; no provider secrets in browser bundles, repository, or APK.
- [ ] Produce a downloadable Android APK and test install/launch, core editing flow, AI flow, undo, and export.

## Implementation sequence and gates

1. **Baseline / contracts:** inspect app and package boundaries; add typed scene-analysis, edit-plan, operation, progress, and provider contracts. Record current test baseline.
2. **Secure AI gateway:** Fastify routes for image analysis and plan generation; validate uploads, MIME/size, rate limits, auth/ownership, provider timeouts, structured output, and redacted logs. Gemini key remains server-side. TITAN is an optional orchestration adapter with disabled-safe behavior.
3. **Scene understanding:** whole-image analysis plus normalized regions/object labels/text; retain source image and analysis metadata in the project.
4. **Plan review & execution:** typed plan preview, user approval, operation queue, progress events, cancellation, retry/idempotency, and explainability.
5. **Generative operations:** provider abstraction for object removal/replacement/inpainting; mask/region inputs; results imported as editable layers; deterministic fallback and provider-unavailable messaging.
6. **Identity/detail safeguards:** protected-region masks, conservative defaults, explicit confirmation for face edits, before/after regression fixtures, and quality warnings.
7. **Conversation continuity:** project-scoped edit context, follow-up planner, operation history, and state-aware prompts.
8. **Editor integration:** layer/mask mapping, operation-level undo, session restore, comparison view, and non-destructive compositing.
9. **Export:** full-resolution canvas pipeline, alpha validation, PNG/WebP options, and export tests.
10. **Responsive & Samsung QA:** mobile layout/touch, upload handling, memory limits, browser compatibility, and device/browser test matrix.
11. **Android packaging:** select/verify wrapper strategy compatible with current repo; produce signed or debug APK as appropriate, publish artifact through GitHub Actions, install and smoke-test on Android.
12. **Release gate:** run `pnpm verify`, E2E, API/provider contract tests, secret scan, web build, Android build/install tests; attach evidence and APK. No completion claim until every checklist item is checked with evidence.

## Required evidence per acceptance item

Record: implementation path(s), automated test(s), manual/device test where relevant, result, and artifact/link. Provider-dependent checks must distinguish mocked tests from live-key integration tests. Missing secrets or unavailable physical Samsung hardware are blockers to final verification, not grounds to mark the item complete.

## Security and product constraints

- Keep Gemini/TITAN credentials in Railway environment variables or equivalent server secret store.
- Never log image bytes, prompts containing sensitive personal data, provider tokens, or raw credentials.
- Obtain explicit user consent before sending images to third-party AI providers; disclose provider and retention limitations.
- Keep original image immutable; operations must be reversible and auditable.
- Do not claim identity preservation, accuracy, device reliability, or APK readiness without tests.
