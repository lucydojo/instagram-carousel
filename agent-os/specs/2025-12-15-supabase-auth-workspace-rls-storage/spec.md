# Specification: Supabase Auth + Workspace + RLS + Storage (Foundations)

## Goal
Establish the backend foundations for Dojogram using Supabase (Auth, Postgres, Storage) with a minimal frontend that validates end-to-end flow, preparing the data model for future carousel generation and canvas editor features while enforcing multi-tenant isolation via RLS.

## User Stories
- As a first-time deployer, I want to run a setup wizard that creates my super admin account and initial workspace so that I can bootstrap a new instance without code changes.
- As a super admin, I want to manage an allowlist of emails so that only approved users can access the closed demo.
- As an allowlisted user, I want to create and view carousel drafts within my workspace so that I can prepare content for future generation features.

## Specific Requirements

**Instance Bootstrap Flow**
- First user who signs up becomes the first super admin (no pre-seeded admins required)
- Setup wizard creates initial workspace with custom name and optional logo upload
- After bootstrap completes, instance switches to invite-only mode (no public signup)
- Single workspace per instance for MVP; schema supports multiple workspaces for future expansion
- Instance settings table tracks `initialized` state as singleton row (id=1)

**Authentication System**
- Email + password authentication only (no OAuth providers for MVP)
- Supabase Auth with SSR-friendly session handling via `@supabase/ssr`
- Sign-in and sign-up pages with glassmorphic design: split-screen layout, backdrop blur effects, violet accent colors
- Redirect unauthenticated users to `/sign-in`; redirect uninitialized instances to `/setup`

**Access Control (Allowlist)**
- `allowlisted_emails` table stores approved emails; only these users can access workspace data
- Super admins can add/remove emails from allowlist via admin UI
- Non-allowlisted users see "Access not granted" message after login
- Allowlisted users auto-join the default (first) workspace as "member" role
- Keep `role` column on `workspace_members` for future owner/admin/member permissions (not enforced yet)

**Database Schema - Core Tables**
- `instance_settings`: singleton for bootstrap state (id, initialized, timestamps)
- `super_admins`: instance-level admins (user_id, email, created_at)
- `allowlisted_emails`: invite-only control (email, invited_by, created_at)
- `workspaces`: multi-tenant container (id, name, logo_path, created_by, timestamps)
- `workspace_members`: membership with role enum (workspace_id, user_id, role, created_at)
- `carousels`: draft storage with JSONB for flexible prompt builder fields (id, workspace_id, owner_id, title, draft, element_locks, timestamps)

**Database Schema - New Tables (Missing from Current Migration)**
- `creator_profiles`: per-workspace creator identity (id, workspace_id, user_id, display_name, handle, role_title, avatar_path, is_default, timestamps) - stores reusable creator info blocks
- `user_presets`: saved optimization option sets (id, workspace_id, user_id, name, preset_data JSONB, timestamps) - stores tone/audience/language combinations for quick reuse

**Carousels Table Enhancement**
- Add `element_locks` JSONB column to `carousels` table to track which slide elements are locked from AI regeneration
- Structure: `{ "slides": { "0": { "title": true, "paragraph": false }, "1": { ... } } }`
- This enables future canvas editor to mark user-edited elements as protected

**Row-Level Security (RLS)**
- All workspace-scoped tables enforce tenant isolation via `workspace_id`
- Read access: any workspace member can read rows matching their membership
- Write access: only the `owner_id` can modify their own resources (carousels, assets)
- Super admins bypass restrictions for administrative tasks
- Bootstrap policies allow first user to create initial super_admin and workspace records

**Storage Buckets**
- `workspace-logos`: private bucket for workspace branding assets
- `carousel-assets`: private bucket for reference images, future generated slides, exports
- Path convention: `workspaces/{workspace_id}/carousels/{carousel_id}/{asset_type}/{uuid}.{ext}`
- App uses signed URLs for all file access (no public URLs)
- DB stores `storage_path` + `storage_bucket`, not full URLs

**Carousel Draft Data Model**
- `inputMode`: "topic" or "prompt" (future: "url", "video", "pdf")
- `topic`, `prompt`: content input fields
- `slidesCount`: number of slides (2-10)
- `platform`: target platform (default "instagram")
- `tone`, `targetAudience`, `language`: optimization options
- `presetId`, `templateId`: references to saved presets and templates
- `creatorInfo`: toggleable block with name/handle/role
- `palette`: background/text/accent colors

## Visual Design

**`planning/visuals/Screenshot at Dec 21 16-25-44.png`**
- Left sidebar shows template selection with color-coded grid of template thumbnails
- Color palette picker section with background/accent/text color controls
- Template settings area below palette controls
- "Creator info" toggle section with name/handle fields
- Center canvas shows multi-slide preview on checkered background
- Slides displayed side-by-side for carousel overview
- Prominent purple/violet accent color throughout UI

**`planning/visuals/Screenshot at Dec 21 16-26-33.png`**
- Left sidebar contains structured form: input mode selector, model/AI selection, optimization options dropdown
- Optimization options include: tone/mood, target audience, language dropdowns
- "Presets" section for saving and loading option combinations
- Center canvas shows slide with editable text zones: subtitle, title, description
- Creator info block appears at bottom of slide with avatar and handle
- Pink/magenta theme with concentric circle background pattern
- Configuration and background image tabs above canvas area

**Auth UI Glassmorphic Design Requirements**
- Split-screen layout: left side for branding/illustration, right side for form
- Backdrop blur effect on form container (glass effect)
- Violet/purple accent colors for buttons and focus states
- Subtle border with transparency on card elements
- Gradient or abstract background on illustration side

## Existing Code to Leverage

**`/src/types/supabase.ts`**
- Complete TypeScript type definitions for all database tables
- Includes Row, Insert, Update types for type-safe Supabase queries
- Defines `Database` type used by Supabase client generics
- Add new tables (`creator_profiles`, `user_presets`) and `element_locks` column to this file

**`/src/lib/db/types.ts`**
- Defines `CarouselDraft` TypeScript interface matching JSONB structure
- Includes `Platform`, `CarouselInputMode` type aliases
- Extend with `ElementLocks` type for the new carousel field

**`/src/lib/supabase/server.ts`**
- SSR-compatible Supabase client factory using `@supabase/ssr`
- Cookie-based session handling for Next.js App Router
- Reuse this pattern for all server-side database operations

**`/src/app/setup/page.tsx`**
- Complete bootstrap flow: sign up, create super admin, create workspace, upload logo
- Server action pattern with form handling and error redirects
- Extend this to use glassmorphic design and add creator profile creation step

**`/supabase/migrations/20251221180000_foundations.sql`**
- Complete migration with all core tables, RLS policies, storage buckets
- Add new migration for `creator_profiles`, `user_presets` tables, and `element_locks` column
- Follow existing trigger patterns for `updated_at` timestamps

## Out of Scope
- AI image or text generation (no OpenAI/Anthropic integration)
- Style analysis from reference images
- Interactive canvas editor with drag-and-drop or selectable text
- Instagram publishing or API integration
- Content scheduling or queue management
- OAuth providers (Google, GitHub, etc.) - email/password only
- Role-based permissions enforcement (schema ready, logic deferred)
- Multiple workspaces per user (single workspace per instance for MVP)
- Template creation or customization UI (templates are built-in references only)
- Export functionality (ZIP downloads, individual slide exports)
