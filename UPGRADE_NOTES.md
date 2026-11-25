# Photo Edit Fusion 1.2.0 preview

The typography tool now performs on-device English OCR and compares the rendered glyphs of the recognized wording against 14 bundled Latin font families. It automatically selects a visual fit, weight, slant, size, tracking, color and placement. A licensed user font can be imported and embedded in an editable project. The score expresses similarity, not a verified identity or calibrated probability. Missing/custom fonts, handwriting, curved text, effects, multilingual OCR and difficult photographic backgrounds remain limitations.

Scene matching samples the visible layers underneath an image at its current transformed position. A robust bounded per-channel color/tone correction and mask feather are previewed before application. Corrections, original bitmaps and masks stay editable and undoable. This is color harmonization, not generated relighting, shadow reconstruction, Poisson cloning, or a claim of forensic undetectability.

PNG and JPEG exports embed print density. Export offers physical dimensions and effective-PPI warnings. WebP retains pixel sizing without a universal density tag. A physical print proof and device-specific verification are still required to assess printer and screen differences.

Also includes mask restoration brushing, editable outline/shadow text controls, consistent anchor geometry for hit tests and sticker exports, and preservation of configured empty canvases when adding an image. Optional server font providers no longer fabricate image-specific matches from fixed priors.

Validation: local type checks, lint, scans, 81 unit tests and source builds passed before the workspace outage. The recovered branch and processing-order fix require CI revalidation. Automated browser tests cover known-font fitting, whole-image OCR, font project reopening, scene matching/undo/reload, exported pixels and embedded density. Android preview publication is gated on automated editor checks plus emulator install/launch. Final results are recorded by the linked CI run and release, not presumed here.
