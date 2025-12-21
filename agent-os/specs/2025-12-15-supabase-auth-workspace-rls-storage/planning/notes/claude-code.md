# claude-code Notes (Working)

This file is for claude-code brainstorming and proposed decisions for this spec.
The source of truth is `planning/requirements.md`.

## Review Summary

Overall the Foundation spec is solid and aligns well with what we discussed during carousel editor spec-shaping. A few additions and clarifications are needed.

## What's Well Covered ✅

1. **First-run setup wizard** (lines 47-54) - Correctly captures the Lovable fork initialization flow
2. **Multi-tenancy with RLS** - Workspace isolation is well defined
3. **View-only sharing** (line 60) - Matches our requirement
4. **White-label branding** - Workspace name/logo covered
5. **Storage conventions** - Good path structure for assets
6. **Draft prompt builder fields** (lines 107-121) - Comprehensive list

## Missing from Data Model 🔴

### 1. Creator Profiles Table
The carousel editor spec requires **multiple creator profiles per user**. This needs a table in the foundation:

```sql
creator_profiles (
  id uuid primary key,
  user_id uuid references auth.users,
  workspace_id uuid references workspaces,
  name text not null,
  handle text,  -- @handle or role like "Founder at Company"
  headshot_path text,  -- path in Supabase Storage
  created_at timestamptz default now()
)
```

RLS: User can CRUD their own profiles. Workspace members can READ all profiles (for display in carousels they view).

### 2. User Presets Table
Line 115 mentions "Preset" but no table. Add:

```sql
user_presets (
  id uuid primary key,
  user_id uuid references auth.users,
  workspace_id uuid references workspaces,
  name text not null,  -- e.g., "Entrepreneur minimal style"
  settings jsonb not null,  -- tone, audience, palette, template, etc.
  created_at timestamptz default now()
)
```

RLS: User can CRUD their own presets only.

### 3. Carousels Table - Add Element Locks
The `carousels` table should include a field for element locks (which elements are protected from AI edits):

```sql
carousels (
  ...
  element_locks jsonb,  -- { "slide_1_title": true, "slide_2_image": true }
  ...
)
```

## Auth UI Design Clarification 🟡

Lines 101-102 mention "Sign in / sign up UI" but don't specify design approach.

**From our spec-shaping session:**
- Custom auth UI with **glassmorphic design** (not Supabase hosted UI)
- Split-screen layout (form left, hero/testimonials right)
- Semi-transparent backgrounds with backdrop blur
- Violet (#a78bfa) accent color
- Staggered entrance animations
- Password visibility toggle
- Reference: https://21st.dev/easemize/sign-in/default

Recommend adding a "Visual Design" section to requirements.md with these details.

## Answers to Open Questions

### Q1: Workspace bootstrap
**Answer:** No auto-created "Dojo" workspace. First-run setup wizard lets first user:
1. Create their account (becomes super admin)
2. Create initial workspace (choose name + upload logo)

For Dojo demo instance, seed data can pre-create the workspace if desired.

### Q2: Single workspace per instance
**Answer:** Yes, **single workspace per instance for MVP**. This is the simplest model for white-label Lovable forks. The schema supports multiple workspaces, but UI assumes one.

## Proposed Additions to requirements.md

1. Add `creator_profiles` table to Data Model section
2. Add `user_presets` table to Data Model section
3. Add `element_locks` field to carousels table
4. Add "Auth UI Visual Design" section with glassmorphic specs
5. Answer the two open questions explicitly

## Tradeoffs / Risks

### Risk: Schema changes later
If we don't add `creator_profiles` and `user_presets` now, the carousel editor spec will need its own migration later. Better to do it in foundation.

### Risk: Over-engineering foundation
Counter-argument: Keep foundation minimal, add tables when needed. However, since both tables are clearly needed (per carousel editor spec), including them now prevents rework.

### Tradeoff: Single workspace assumption
Simplifies MVP significantly but means "switch workspace" isn't possible. Acceptable for white-label fork use case where each fork = one workspace.

## Alignment with Carousel Editor Spec

| Requirement | Foundation Spec | Editor Spec | Status |
|-------------|-----------------|-------------|--------|
| First-run wizard | ✅ Covered | ✅ Covered | Aligned |
| View-only sharing | ✅ Line 60 | ✅ Covered | Aligned |
| Multiple creators | ❌ Missing table | ✅ Covered | **Needs sync** |
| User presets | ⚠️ Mentioned, no table | ✅ Covered | **Needs sync** |
| Element locking | N/A | ✅ Covered | N/A (editor-only) |
| Glassmorphic auth UI | ⚠️ Not specified | ✅ Covered | **Needs sync** |
| Carousel project saving | ✅ Draft flow covered | ✅ Covered | Aligned |
