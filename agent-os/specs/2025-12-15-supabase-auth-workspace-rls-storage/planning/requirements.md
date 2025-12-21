# Requirements — Supabase Auth + Workspace + RLS + Storage (Foundations)

## Goal
Establish the backend foundations for Dojogram using Supabase (Auth, Postgres, Storage) and a minimal frontend that validates the end-to-end flow without implementing carousel generation/editor functionality yet.

This spec should minimize future rework by:
- Locking in the multi-tenant workspace data model early
- Enforcing tenant isolation via RLS
- Establishing asset storage conventions (reference images, future generated slides/exports)
- Creating “draft” data structures that can later power the full canvas/editor + AI generation flows

## Non-Goals (Explicit Exclusions)
- No AI generation (images or text)
- No style analysis
- No canvas editor / selectable text canvas (beyond basic form inputs)
- No Instagram publishing
- No scheduling

## Authentication (Supabase Auth)
User wants “basic auth” (no OAuth).

### Supported methods (decision made)
- **Email + password** (user sets password on signup; logs in with password)

### Requirements
- Sign-in and sign-up UI
- Persistent session handling in Next.js (SSR-friendly)
- Closed demo access control (allowlist + super admins; see below)

## Access Control (Closed demo allowlist)
### Requirements
- Only allow approved emails to access the product (closed demo)
- Provide a way to add/approve emails later (without code changes)
- Introduce an **instance-level “super admin”** concept (not per-workspace) to manage allowlist and future roles

### Initial super admin accounts (seed)
- `lucy@dojo.com.br`
- `alexandre@dojo.com.br`
- `axiomaalexandre@gmail.com`

### Allowlist management (MVP)
- A super admin can add/remove allowlisted emails
- **Invite-only:** super admins invite allowlisted emails (no public signup)
- Non-allowlisted users should not be able to access any workspace-scoped data (enforced by RLS)
- Keep schema extensible to add workspace roles later (owner/admin/member) even if we don’t enforce them yet

### Client-friendly bootstrapping (white-label)
This repo will be reused for clients, so the instance must support “first run” initialization:
- If **no super admins exist yet**, allow a one-time setup flow:
  - First user signs up (email+password) and becomes the first super admin
  - Create the initial workspace during setup (name + logo), editable later
- After initialization completes, switch to **invite-only** mode enforced by policy/UI.

For the Dojo demo instance, we can seed initial super admins via configuration (the emails listed above).

## Multi-tenancy (Workspace)
### Requirements
- One workspace per user for MVP, but **workspace must support multiple users**
- Keep schema extensible for roles later (owner/admin/member), but do not enforce role-based permissions yet
- View-only sharing for carousel projects: workspace members can see all carousels, but only edit their own (enforced by RLS; roles can extend later)

### Data model (minimum)
- `workspaces`
- `workspace_members` (includes a `role` column, initially unused)

### Access control (RLS)
RLS enforced on all workspace-scoped tables using membership:
- A user can only read/write rows where they are a member of the row’s `workspace_id`
- Pattern: every core row includes `workspace_id`

For user-owned resources inside a workspace (e.g., carousel projects), RLS should differentiate:
- **read**: any workspace member
- **write**: only the owning user (until roles/collaboration are added)

## Storage (Supabase Storage)
### Requirements
- Storage buckets are **private**
- App uses signed URLs for previews/downloads
- DB stores object paths + metadata, not public URLs

## White-label / Branding (MVP)
This repo should be usable as a client-facing solution later (published to GitHub and imported into Lovable), so the app should support minimal “white label” customization.

### Requirements
- Workspace settings include:
  - Workspace name (editable)
  - Workspace logo (upload; stored in Supabase Storage)
- UI uses workspace branding in basic surface areas (app header/top nav, and where appropriate on auth screens)

### Assets we must support now (even if not generated yet)
- Reference images uploaded by users for style inspiration

### Assets we should plan for (future)
- Generated slide images
- Export bundles (ZIP)

### Suggested path convention
`workspaces/{workspace_id}/carousels/{carousel_id}/{asset_type}/{uuid}.{ext}`

## Minimal Frontend (Foundations UI)
### Required screens
1. Sign in / sign up
2. Workspace bootstrap (create/select the single workspace)
3. “New carousel” draft form (stores a draft but does not generate anything)
4. Carousel draft detail view (shows saved settings + uploaded reference assets)

### Draft “prompt builder” fields to store (no generation yet)
User wants the app to support multiple ways to drive creation later; we should store the inputs now:
- **Input mode:** topic/theme and/or freeform prompt (future: URL/video/PDF)
- **Slides count** (number)
- **Platform** (default Instagram)
- **Tone/Mood** (select)
- **Target audience** (select)
- **Language** (select)
- **Preset** (optional saved set of the above)
- **Creator info block** (toggle + name + handle/role)
- **Color palette** (picked colors / preset palette reference)
- **Template selection** (from built-ins and future custom templates)
- **Reference assets** (0..n images)

Store these in a dedicated table (e.g., `carousels`) with a typed shape (columns or JSONB) that can evolve without breaking changes.

## Visual references captured
- Login page reference: https://21st.dev/easemize/sign-in/default
- User provided UI inspiration screenshots:
  - `planning/visuals/Screenshot at Dec 21 16-25-44.png`
  - `planning/visuals/Screenshot at Dec 21 16-26-33.png`

## Visual Analysis (key takeaways)
The reference UIs suggest a “design studio” layout that we should align to early to reduce rework later:

- **Left sidebar = configuration/prompt builder**
  - A structured “optimization options” section (platform, tone/mood, target audience, language)
  - A “presets” area to save and reapply those optimization options
  - Template selection (“templates” as first-class) and template settings
  - Palette controls (background/text/accent color) and font/alignment controls
  - “Creator info” as a toggleable block with name/handle/role and optional headshot upload

- **Center = canvas preview**
  - Slides shown on a grid background in a canvas-like space
  - Navigation between slides and multi-slide overview

- **Right panel = per-slide content fields**
  - Slide type variants and common fields (tagline/title/paragraph/swipe indicator/background image)
  - Field-level toggles (include/exclude pieces)

For this spec, we do **not** implement the canvas editor yet, but we should:
1) shape the data model so these controls can be persisted on a carousel draft, and
2) design the minimal frontend so it can evolve into this layout without a rewrite.

## Open Questions (Need Answers)
1. Workspace bootstrap: do we create a single shared workspace automatically named “Dojo” on first signup, and auto-join later allowed users?
2. Workspace model for clients: do we want “single workspace per instance” as the default for MVP (simplest white-label), with room to expand to multiple workspaces later?
