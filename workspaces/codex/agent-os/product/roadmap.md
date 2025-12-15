# Product Roadmap

1. [ ] Workspace, auth, and account model — Users can sign in, create a workspace, and add/manage multiple Instagram accounts (as “destinations”) with clear ownership and permissions. `[M]`
2. [ ] Reference import + style profiling — User can paste one or more reference carousel URLs or upload images; the system extracts a reusable “style profile” (layout patterns, palette, typography/spacing cues) for generation. `[M]`
3. [ ] Theme → carousel generation (v1) — User enters a theme/prompt and gets a complete carousel plan (slide-by-slide outline) plus generated copy and images that follow the selected style profile. `[L]`
4. [ ] Carousel editor (manual controls) — User can edit slide text, reorder slides, regenerate a single slide, and make basic layout adjustments while preserving the overall style. `[L]`
5. [ ] Natural-language revision loop — User can request targeted changes (per slide or whole carousel) in plain language; the system applies edits while keeping style consistency and minimizing unintended changes. `[L]`
6. [ ] Export-ready assets — User can export the carousel as Instagram-ready PNG/JPG slides plus caption text (and optionally a ZIP bundle), with correct dimensions and safe margins. `[S]`
7. [ ] Publishing integration (optional) — Where supported by account type, user can connect via the Meta/Instagram Graph API and publish directly; otherwise the product guides the user through manual posting with export artifacts. `[L]`
8. [ ] Demo polish + reuse library — Beautiful, fast UI with onboarding, a gallery of past carousels, style presets, and “duplicate + adapt” flows for quickly creating variations. `[M]`

> Notes
> - Order items by technical dependencies and product architecture
> - Each item should represent an end-to-end (frontend + backend) functional and testable feature
