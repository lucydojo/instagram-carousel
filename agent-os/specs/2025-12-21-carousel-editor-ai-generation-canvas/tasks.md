# Task Breakdown: Carousel Editor & AI Generation Canvas

## Overview
Total Tasks: 14

## Task List

### Platform Foundations

#### Task Group 1: Localization baseline (pt-BR default + en)
**Dependencies:** None

- [ ] 1.0 Add localization foundation
  - [ ] 1.1 Decide locale source (default `pt-BR`, user toggle `en`)
  - [ ] 1.2 Add a translation helper and replace hardcoded strings in existing auth/setup/app shell
  - [ ] 1.3 Ensure new studio/editor screens are built using the translation helper (no new hardcoded strings)

**Acceptance Criteria:**
- UI defaults to Brazilian Portuguese
- Users can switch to English
- No new feature screens ship with hardcoded copy

### Database Layer

#### Task Group 2: Project persistence schema
**Dependencies:** Task Group 1

- [ ] 2.0 Define and implement project persistence model
  - [ ] 2.1 Decide canonical stored format for editor state (single JSON vs normalized slides table)
  - [ ] 2.2 Add migrations for new/updated tables needed for:
    - Canvas/editor state (slides + objects + settings)
    - Locks state
    - Templates (built-in references + user custom)
    - Exports metadata (download links + status)
    - Optional: generation job status/progress
  - [ ] 2.3 Update RLS policies to preserve: workspace read, owner write
  - [ ] 2.4 Update TypeScript `Database` types and shared domain types

**Acceptance Criteria:**
- Schema supports reloading a canvas exactly as saved
- RLS enforces: members can read, only owner can write
- Types compile cleanly

#### Task Group 3: User-owned “custom values” model
**Dependencies:** Task Group 2

- [ ] 3.0 Support “global defaults + per-user custom”
  - [ ] 3.1 Decide which categories are global defaults (seeded with app) vs persisted per-user (custom)
  - [ ] 3.2 Add per-user tables (or extend existing ones) for custom:
    - Tones, audiences, palettes, templates (as applicable)
  - [ ] 3.3 Ensure RLS restricts custom values to the owning user

**Acceptance Criteria:**
- Global defaults are available to all users
- User-created values are only visible to that user

### Backend / Services

#### Task Group 4: Studio APIs and server actions
**Dependencies:** Task Groups 2–3

- [ ] 4.0 Implement server-side operations for the studio
  - [ ] 4.1 Load/save project state (with optimistic concurrency or safe last-write-wins)
  - [ ] 4.2 CRUD for templates (custom) and presets (reuse `user_presets`)
  - [ ] 4.3 CRUD for creator profiles (reuse `creator_profiles`)
  - [ ] 4.4 Signed URL helpers for assets, exports, headshots

**Acceptance Criteria:**
- Server actions support create/open/save flows
- Asset URLs are served via signed URLs (private buckets)

#### Task Group 5: AI generation services (text + images)
**Dependencies:** Task Group 4

- [ ] 5.0 Implement first-draft generation pipeline
  - [ ] 5.1 Define a structured “generation contract” (JSON schema) for slide copy + layout hints
  - [ ] 5.2 Implement text generation (Gemini) server-side with safe prompting + validation
  - [ ] 5.3 Implement image generation (nano banana pro) server-side
  - [ ] 5.4 Store generated assets in Supabase Storage and link them to the project
  - [ ] 5.5 Persist generation progress/status (job table or status fields)

**Acceptance Criteria:**
- Given prompt/options, system produces a structured draft that can be rendered on canvas
- Generated images are stored privately and can be previewed via signed URLs

#### Task Group 6: Natural language edits (lock-aware)
**Dependencies:** Task Group 5

- [ ] 6.0 Implement NL edit pipeline
  - [ ] 6.1 Define “edit instruction contract” (structured patch format over canvas state)
  - [ ] 6.2 Implement model call to translate user command → patch
  - [ ] 6.3 Apply patch to canvas state while respecting locked elements
  - [ ] 6.4 Persist edit history (minimal: append-only events or last command log)

**Acceptance Criteria:**
- NL edits reliably change intended elements
- Locked elements remain unchanged

### Frontend (Studio UI)

#### Task Group 7: Studio route + layout
**Dependencies:** Task Groups 2–4

- [ ] 7.0 Build studio shell UI
  - [ ] 7.1 Add studio route for a carousel project (open/create)
  - [ ] 7.2 Implement 3-pane layout (left controls, center canvas, right panel)
  - [ ] 7.3 Add slide navigator (thumbnails or stepper)
  - [ ] 7.4 Ensure responsive behavior (stack panels on small screens)

**Acceptance Criteria:**
- Users can open a project and navigate slides
- Layout matches intent from visuals

#### Task Group 8: Fabric.js canvas MVP
**Dependencies:** Task Group 7

- [ ] 8.0 Integrate Fabric.js and render slides
  - [ ] 8.1 Add Fabric.js dependency and a canvas wrapper component
  - [ ] 8.2 Render slide background + text blocks from persisted state
  - [ ] 8.3 Enable direct manipulation (move/resize) and inline text editing
  - [ ] 8.4 Serialize/deserialize canvas state to the persistence format

**Acceptance Criteria:**
- Canvas renders saved state
- Edits persist and reload correctly

#### Task Group 9: Global controls
**Dependencies:** Task Groups 7–8

- [ ] 9.0 Implement global controls panel
  - [ ] 9.1 Template selection (built-ins + user custom)
  - [ ] 9.2 Palette selection and global apply
  - [ ] 9.3 Typography selection and global apply

**Acceptance Criteria:**
- Global changes apply across all slides (with override rules defined)

#### Task Group 10: Per-slide controls
**Dependencies:** Task Groups 7–9

- [ ] 10.0 Implement per-slide controls
  - [ ] 10.1 Toggle visibility for common elements (tagline/title/paragraph/swipe/background)
  - [ ] 10.2 Per-slide palette/text overrides
  - [ ] 10.3 Background image replace/remove

**Acceptance Criteria:**
- Users can override global settings per slide
- Toggles reliably show/hide elements

#### Task Group 11: Locking UX
**Dependencies:** Task Groups 8–10

- [ ] 11.0 Add lock/unlock controls
  - [ ] 11.1 Add lock button on selectable elements
  - [ ] 11.2 Persist lock state and render locked indicator
  - [ ] 11.3 Enforce locks in any “regenerate” or NL edit operations

**Acceptance Criteria:**
- Locked elements cannot be modified by AI flows
- Lock state persists across reloads

#### Task Group 12: Generation + chat UX
**Dependencies:** Task Groups 5–6 and 7–11

- [ ] 12.0 Add generation and edit interfaces
  - [ ] 12.1 Left panel “Generate” UI with optimization options (tone, audience, language, slides count)
  - [ ] 12.2 Show progress and error handling for generation
  - [ ] 12.3 Add NL edit input (chat/command) and apply changes to canvas

**Acceptance Criteria:**
- Users can generate a first draft and then refine it via commands
- Errors are actionable and don’t break the session

### Export

#### Task Group 13: Export pipeline
**Dependencies:** Task Groups 7–12

- [ ] 13.0 Export to Instagram-ready assets
  - [ ] 13.1 Render slides to images (PNG/JPG, 1080x1080)
  - [ ] 13.2 Package ZIP export option
  - [ ] 13.3 Store exports in Supabase Storage + provide signed download links

**Acceptance Criteria:**
- Export produces correct dimensions and downloadable links
- Exports are private and time-limited via signed URLs

### Quality Gates

#### Task Group 14: Feature validation
**Dependencies:** Task Groups 1–13

- [ ] 14.0 Validate core flows (minimal)
  - [ ] 14.1 Add a minimal automated smoke test approach (e2e or integration) for:
    - Sign in → open project → save → reload
    - Generate draft → see assets → edit text → save
    - Lock element → run NL edit → verify locked unchanged
  - [ ] 14.2 Manual QA checklist aligned to visuals and core user stories

**Acceptance Criteria:**
- Core studio workflows are verifiably working end-to-end
- Regressions in auth/workspace isolation are avoided

