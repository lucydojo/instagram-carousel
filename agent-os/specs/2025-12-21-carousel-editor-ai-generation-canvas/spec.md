# Specification: Carousel Editor & AI Generation Canvas

## Goal
Build a canvas-based Instagram carousel studio that generates drafts via AI and lets users edit slides visually with global and per-slide controls, persisting projects in Supabase.

## User Stories
- As a creator, I want to generate a carousel from a topic/prompt so that I can get a complete first draft fast.
- As a creator, I want to edit slides on a canvas (and lock elements) so that I can refine output without losing what I already approved.
- As a creator, I want to save, reopen, and export carousels so that I can iterate and publish later without rework.

## Specific Requirements

**Editor workspace (studio layout)**
- Provide a studio route for editing a carousel project with a 3-pane layout: left controls, center canvas, right per-slide/element controls.
- Support selecting slides and navigating between slides.
- Keep Instagram-only constraints for now (1080x1080, fixed aspect).
- Require authenticated access and workspace membership (reuse existing guards/RLS).

**Project persistence model**
- Persist the full editor state needed to reload the canvas (slides + objects + settings + locks) in Supabase.
- Support version-safe saves (prevent accidental overwrites; last-write-wins is acceptable for MVP).
- Keep “view-only sharing” in workspace: members can read all projects, only owners can write.

**AI generation workflow (first draft)**
- Inputs: topic/prompt, slides count, platform=Instagram, tone/mood, target audience, language, template, palette, creator selection.
- Use a text model to generate structured slide copy + layout instructions (no free-form-only output).
- Use an image model to generate required images, store them in Supabase Storage, and link them to the project.
- Provide a progress UX (loading states; errors surfaced to user).

**Canvas editor (Fabric.js)**
- Render slides and elements on a Fabric.js canvas.
- Support direct manipulation: move/resize elements and inline text editing.
- Support undo/redo (at least within a session).
- Persist changes back to the saved project state.

**Global controls**
- Allow applying a template/layout baseline across all slides.
- Allow selecting a color palette and applying it globally (with per-slide overrides).
- Allow text style controls (font family/size/weight) globally (with per-slide overrides).

**Per-slide controls**
- Allow toggling visibility of common elements (e.g., tagline, title, paragraph, swipe indicator, background image).
- Allow per-slide overrides for palette and text styling.
- Allow per-slide background image selection/replacement.

**Element locking**
- Allow locking specific elements to protect them from AI edits.
- Locked elements must remain unchanged during regeneration and natural-language edits.
- Show a clear locked state indicator in the UI.

**Natural language edits**
- Provide a chat/command input to request edits (global or slide-specific).
- Translate user instruction into structured changes applied to the canvas state.
- Respect element locks and minimize unintended changes.

**Creator profiles and attribution block**
- Allow users to manage multiple creator profiles (headshot upload, name, handle, role).
- Support selecting a creator profile for a carousel; render attribution on slides.
- Persist creator selection in the project.

**Presets**
- Allow saving/loading user presets that bundle template + palette + text style + audience/tone/language.
- Presets are user-owned and reusable across that user’s carousels.
- Provide basic preset management (create, rename, delete).

**Export**
- Export slides as Instagram-ready images (PNG/JPG, 1080x1080).
- Provide an export bundle option (ZIP) and include caption text if available.
- Store exports in Supabase Storage with signed download links.

## Visual Design

**`planning/visuals/Screenshot at Dec 21 16-25-44.png`**
- Left sidebar contains generation controls, template settings, palette grid, typography settings, and creator info.
- Center area shows multi-slide preview/canvas with slide navigation affordances.
- Right panel shows per-slide toggles and input fields for slide elements.
- Palette UI supports both preset palettes and custom color picking.
- Creator info includes headshot upload and name/handle fields.

**`planning/visuals/Screenshot at Dec 21 16-26-33.png`**
- Compact left panel includes content input tabs, model selector, slide count, and optimization options.
- Optimization options include tone/mood, target audience, and language selection.
- Canvas preview is primary visual focus with slide controls and background image controls.

## Existing Code to Leverage

**Supabase auth + server/browser clients**
- Reuse `src/lib/supabase/server.ts` and `src/lib/supabase/browser.ts` patterns for SSR + client operations.
- Reuse `src/lib/auth/guards.ts` for authenticated routing patterns.

**Workspace access control**
- Reuse RLS-backed patterns in `src/lib/app/access.ts` and workspace membership queries used in `src/app/app/layout.tsx`.

**Current carousel draft persistence**
- Reuse `public.carousels` and `public.carousel_assets` tables and the server-action insert patterns in `src/app/app/new/page.tsx`.
- Reuse signed URL helper pattern in `src/app/app/carousels/[id]/page.tsx`.

## Out of Scope
- Instagram auto-publishing and scheduling
- Multi-platform support (LinkedIn/TikTok/etc.)
- Real-time collaborative editing
- AI-generated headshots
- Advanced white-label theming beyond name/logo
- Account switching UI for multiple Instagram accounts
