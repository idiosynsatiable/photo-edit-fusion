# Photo Edit Fusion Ω — Offline QA and Play Store Release Gate

**Status:** Active readiness work. This document is a test plan, not a certification.
**Release rule:** No feature is marked PASS until its automated or manual evidence is attached.
**Operating constraint:** Core editing and OCR must work without a paid backend, Railway, provider keys, or internet after installation and initial app-shell warm-up.

## 1. Offline test definition

There are two distinct offline targets:

1. **Installed Android APK:** bundled HTML, JavaScript, CSS, WASM, OCR worker, language data, and local document storage must function with airplane mode enabled.
2. **Installed PWA:** after one successful online load and service-worker activation, the app shell and requested same-origin static assets must be cached. A first-ever visit cannot be assumed to work offline before its assets have been downloaded.

Cloud AI, remote font downloads, and external font-identification services are optional online enhancements. They must fail gracefully and must never block core editing.

## 2. Capability matrix

| Capability | Offline expectation | Current evidence / gap |
|---|---|---|
| Open local image | Must work | Implemented; device test required |
| Capture photo | Android camera/file capture handoff | Implemented in PR #5; physical Samsung test required |
| Canvas, layers, text, shapes | Must work | Existing editor; full workflow regression required |
| Undo/redo | Must work | Existing history engine; end-to-end coverage needed |
| PNG export | Must work | Existing export path; Android share-sheet validation needed |
| Project save/open | Must work | JSON project export/import; corruption and large-file tests needed |
| Autosave | Must work locally | IndexedDB implementation exists; restore/quota tests needed |
| OCR | Must work offline | Local worker, WASM, and English model are now bundled by build script; build verification pending |
| Font candidate ranking | Must work offline | Local similarity scorer integrated into text modal; accuracy benchmark pending |
| Exact font download | Optional online | Remote Google Fonts unavailable offline; system fallbacks used |
| Basic background cut | Local approximation | Not equivalent to semantic AI matting |
| Semantic AI analysis/editing | Online provider required unless local model is bundled | Not offline-complete |
| Advanced inpainting | Online provider or separately bundled model | Not offline-complete |
| Metadata inspection | Local | Inspection coverage and export behavior need QA |
| Provenance/history | Local | Product behavior and UI need final review |

## 3. Required test suites

### A. Build and supply-chain checks
- Frozen dependency install from committed lockfile.
- TypeScript typecheck, lint, unit tests, production build.
- Secret scan, dependency vulnerability scan, license inventory, and placeholder scan.
- Confirm APK has no cloud base URL and no provider secrets.
- Confirm OCR worker, all four WASM loader variants, and English traineddata are inside the packaged web assets.
- Generate an SBOM and retain build provenance for release artifacts.

### B. Offline functional suite
- Install APK, launch once, enable airplane mode, force-stop, relaunch.
- Open a local JPEG, PNG, and WebP; create text and shape layers.
- Run OCR on a known fixture and compare extracted text against a ground-truth string.
- Identify font candidates with network disabled.
- Move, resize, reorder, hide, and delete layers.
- Undo and redo each operation.
- Export PNG; verify dimensions, alpha, and decodability.
- Save project, force-stop, relaunch, verify autosave restore.
- Export project JSON, clear app data only after backup, reinstall, import project.
- Verify optional cloud actions show an actionable offline message and do not crash the editor.
- Inspect network log: no requests to third-party hosts during core editing or local OCR.

### C. Image quality suite
Use a versioned fixture set with ground-truth masks and text:
- low/high resolution, blur, noise, compression, skew, perspective, low contrast;
- serif, sans-serif, condensed, script, monospaced, mixed weights;
- transparent and textured backgrounds;
- portrait, landscape, large panoramas, and high-megapixel camera images.

Track OCR character error rate, word error rate, font top-1/top-5 accuracy, mask IoU, export pixel dimensions, and visual regression deltas. Do not label a model "production accurate" without benchmark thresholds and fixture results.

### D. Android/device suite
- Physical Samsung device: install, first launch, camera capture, gallery picker, orientation, keyboard, touch selection, file import/export, autosave, and low-memory behavior.
- API-level matrix: minimum supported Android version, current stable Android, and one previous major version.
- Test both fresh install and update install using the same signing key.
- Verify package ID, version code/name, min/target SDK, 64-bit native compatibility where applicable, app icon, label, permissions, privacy policy, and data-safety disclosures.
- Verify app does not request unnecessary permissions and does not crash on camera denial or storage/share cancellation.

### E. Release security and privacy
- Keep provider secrets server-side only.
- Obtain explicit consent before transmitting images to third-party providers.
- Avoid logging image bytes, user prompts, credentials, or sensitive metadata.
- Validate file MIME, actual file signature, size limits, malformed images, and decompression-bomb behavior.
- Preserve the source document non-destructively and clearly distinguish edited exports from originals where provenance is relevant.
- Verify exported metadata is truthful; never claim a modified image is an untouched camera original.

## 4. Immediate diagnostics contract

Every failure should report:
- feature and operation;
- stage where it failed;
- concise human-readable cause;
- whether data was saved;
- safe retry action;
- diagnostic code and app/build version.

The app must distinguish: unsupported device, permission denied, corrupt/unsupported file, insufficient memory/storage, missing local model asset, offline optional provider, timeout, export/share cancellation, and unexpected internal error. Never silently convert a failed operation into a success state.

## 5. Current blocker ledger

| ID | Blocker / risk | Required action | Exit evidence |
|---|---|---|---|
| PEF-001 | Android emulator timed out before boot; APK assembly and signature checks succeeded | Increase emulator boot timeout and rerun | Emulator install + launch step PASS |
| PEF-002 | Prior OCR default depended on remote Tesseract assets | Bundle worker, core loaders, and English model | Build asset check + OCR test in airplane mode |
| PEF-003 | PWA previously had no offline shell cache | Add service-worker app-shell and same-origin asset cache | Offline reload E2E after warm-up |
| PEF-004 | Font matching previously called API only | Add local feature extraction and similarity scorer | Font candidates returned with network blocked |
| PEF-005 | No physical Samsung evidence | Execute device acceptance matrix | Signed manual QA record + screenshots/logs |
| PEF-006 | Advanced semantic cut/inpainting not bundled locally | Keep labeled as online/experimental until a local model is packaged and benchmarked | Model provenance, device performance, quality benchmarks |
| PEF-007 | CI E2E selectors drifted from current UI | Update selectors and add camera/OCR asset tests | Playwright suite PASS |
| PEF-008 | Debug APK signing key may change between CI runs | Establish protected, stable release signing in GitHub Actions secrets | Repeatable signed artifact and update-install test |

## 6. Ten highest-value next steps

1. **Stabilize CI:** resolve the emulator boot timeout; require web CI and Android install/launch gates.
2. **Prove offline OCR:** verify the local worker, four WASM variants, and English model are present in the final APK; run OCR with airplane mode enabled.
3. **Prove offline font ranking:** benchmark local glyph feature extraction and verify no network dependency.
4. **Add an in-app System Check:** report storage, OCR asset availability, service-worker state, canvas support, and optional cloud connectivity with actionable diagnostics.
5. **Complete core editor E2E:** camera/gallery import, layers, text, masks, undo/redo, autosave, project restore, and PNG export.
6. **Run image-quality benchmarks:** OCR CER/WER, font top-1/top-5, cut-mask IoU, and pixel/export regression fixtures.
7. **Harden Android lifecycle:** camera permission, app pause/resume, orientation, memory pressure, low storage, and native share-sheet tests.
8. **Lock release signing and dependency integrity:** stable protected signing key, frozen lockfile, SBOM, license and vulnerability checks.
9. **Complete Play Console compliance:** store listing, screenshots, privacy policy, Data safety, content rating, target API, permissions, app access instructions, and any required closed testing.
10. **Cut a release candidate only after evidence:** attach APK/AAB, checksums, test report, device matrix, known limitations, and rollback plan.

## 7. Release decision

Release status remains **NOT READY** until every release-blocking test passes. A green build alone does not establish Play Store approval, physical-device compatibility, OCR quality, or offline completeness. Google Play review and publishing approval remain Google's decision.
