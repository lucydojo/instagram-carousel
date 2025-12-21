# Spec Requirements: Carousel Editor with AI Generation Canvas

## Initial Description

Build a canvas-based carousel editor with AI-powered generation for Dojogram - an internal AI/Automation Agency tool for creating Instagram carousels. The editor combines:
- AI generation from text prompts (like PostNitro)
- Canvas-based visual editing (like aiCarousels)
- Creator info/branding features
- Natural language editing with style consistency
- Style mimicking from existing Instagram carousels

Key context: This is a GitHub repo designed to be **forked into Lovable accounts** where clients can "remix" the project for their own versions. Code must be clean, well-structured, and support white-label customization.

## Requirements Discussion

### First Round Questions

**Q1:** Canvas Library Choice - Fabric.js vs Konva.js vs DOM-based approach?
**Answer:** Go with recommended - Fabric.js (stronger text editing capabilities and better documentation for carousel-style layouts).

**Q2:** MVP Priority - Generate from scratch vs Style mimicking as primary flow?
**Answer:** Generate from scratch with AI is primary. Good consistency between individual posts is key. Style mimicking is secondary.

**Q3:** Platform selection - Instagram only or multi-platform (LinkedIn/TikTok)?
**Answer:** Instagram only for now.

**Q4:** Creator Info - Upload only, AI generation, or both for headshots?
**Answer:** Upload only (no AI headshot generation). CRITICAL UPDATE: Support **multiple creators per account** - user can add creator info for multiple people (themselves, clients, etc.). Creator profiles need to be saved and reusable.

**Q5:** Per-Slide Editing - Global defaults with overrides vs fully independent?
**Answer:** BOTH Global AND Per-slide editing needed. Global: color palette changes affect all slides. Per-slide: specific changes like "make the image bigger and text bolder" on individual slides.

**Q6:** Natural Language Editing - Automatic style consistency vs lock/unlock elements?
**Answer:** Users need a **lock icon** to protect specific elements from AI edits. When user prompts changes, locked elements are not affected.

**Q7:** Presets - Built-in only, user-saveable, or both?
**Answer:** User-saveable presets. Save combination of: template + color palette + text style + audience + other settings. Name them like "Entrepreneur minimal style".

**Q8:** Scope clarifications - What's out of scope?
**Answer:**
- OUT of scope: Instagram auto-publish, post scheduling, account switching UI
- IN scope: Multi-user workspace (Supabase schema), carousel project saving, white-label branding

### Existing Code to Reference

No similar existing features identified for reference - starting fresh.

### Follow-up Questions

**Follow-up 1:** Workspace permissions model - View-only, full collaboration, or role-based?
**Answer:** View-only sharing. Members see all carousels in workspace but only edit their own.

**Follow-up 2:** Creator profile ownership - Workspace-level or user-level?
**Answer:** User-level ownership. Each user manages their own creator profiles (not shared workspace-wide).

**Follow-up 3:** White-label scope for MVP?
**Answer:** Simple - just workspace name and logo.

**Follow-up 4:** Login page reference - Analyze for design or auth flow?
**Answer:** Analyze for DESIGN only. Supabase handles auth backend. User will build custom auth UI (styled like reference) that calls Supabase Auth methods.

**Follow-up 5:** First-run setup flow for Lovable forks?
**Answer:** CRITICAL REQUIREMENT - First-Run Setup Wizard needed:
1. App detects no workspaces/admins exist in database
2. Shows setup page (not normal login) where user creates first account (becomes super admin) and creates workspace (name, logo)
3. After setup, redirects to normal app flow
This is essential for Lovable fork use case - person who forks needs guided initialization without CLI access.

## Visual Assets

### Files Provided:
- `Screenshot at Dec 21 16-25-44.png`: aiCarousels-style interface showing left sidebar with AI Carousel Generator, color palette grid, text settings, creator info section with headshot upload, and canvas area with multi-slide carousel preview (coral/teal/yellow slides). Right panel shows per-slide editing toggles (Tagline, Title, Subtitle, Paragraph, Swipe Indicator, Background Image).
- `Screenshot at Dec 21 16-26-33.png`: PostNitro-style interface showing content input tabs (Text/Article/YouTube), model selector (GPT-4o Mini), slides count, Optimization Options (Tone/Mood, Target Audience, Language), and canvas preview with pink-themed carousel and creator branding.

### Visual Insights:
- **Layout pattern**: Left sidebar for settings/generation, center canvas for preview, right panel for per-slide editing
- **Color palette UI**: Grid of preset color combinations with quick selection
- **Per-slide controls**: Toggle switches for content elements (tagline, title, paragraph, etc.)
- **Creator branding**: Headshot + name + handle positioned at slide bottom
- **Optimization panel**: Collapsible section with form controls for AI generation parameters
- **Fidelity level**: High-fidelity production screenshots from competitor tools

### Login Page Design Reference (from https://21st.dev/easemize/sign-in/default):
- **Layout**: Split-screen (form left, hero image + testimonials right). Mobile collapses to single column.
- **Style**: Modern minimalist with glassmorphic effects (semi-transparent backgrounds, backdrop blur)
- **Colors**: Light/dark mode support, neutral tones, violet (#a78bfa) for accents
- **Form inputs**: Rounded corners (1rem), glass effect, focus transitions
- **Typography**: System sans-serif, weights 300-600, clean hierarchy
- **Animations**: Staggered entrance animations with delays
- **Special features**: Password visibility toggle, Google OAuth button styling

## Requirements Summary

### Functional Requirements

**First-Run Setup (Lovable Fork Initialization)**
- Detect when no workspaces/admins exist in database
- Display setup wizard (bypasses normal login)
- Create first user account as super admin
- Create initial workspace with name and logo
- Redirect to normal app flow after completion

**Authentication (Custom UI)**
- Custom-built auth pages styled with glassmorphic design
- Split-screen layout matching reference (form + hero)
- Light/dark mode support
- Email/password authentication via Supabase Auth
- Google OAuth option
- Password visibility toggle
- Staggered entrance animations

**Workspace & Multi-User**
- Users belong to a workspace
- Workspace has name and logo (white-label branding)
- View-only sharing: members see all carousels but only edit their own
- Supabase RLS policies enforce workspace isolation

**Creator Profiles (User-Level)**
- Users manage their own creator profiles
- Multiple creators per user (for self and clients)
- Creator profile includes: headshot (upload), name, handle/role
- Profiles are reusable across that user's carousels
- Not shared with other workspace members

**AI Carousel Generation (Primary Flow)**
- Text prompt input for carousel theme/idea
- Model selection (Google Gemini for text)
- Slide count selection
- Optimization options: Tone/Mood, Target Audience
- Instagram-only platform (1080x1080 dimensions)
- AI generates: slide layouts, copy, image prompts
- nano banana pro for image generation

**Canvas-Based Editor (Fabric.js)**
- Visual carousel preview with all slides
- Select and navigate between slides
- Real-time editing on canvas
- Drag-and-drop element positioning
- Text editing directly on canvas

**Global Editing**
- Color palette selection and customization
- Template/layout selection
- Text style settings (fonts, sizes)
- Changes apply to all slides

**Per-Slide Editing**
- Toggle content elements: Tagline, Title, Subtitle, Paragraph, Swipe Indicator, Background Image
- Individual slide customization
- Override global settings per slide
- Slide-specific AI edits ("make the image bigger on this slide")

**Lock/Unlock Elements**
- Lock icon on individual elements
- Locked elements protected from AI edits
- Natural language commands respect locks
- Visual indicator for locked state

**Natural Language Editing**
- Chat/command interface for edits
- Global commands: "make colors more vibrant"
- Slide-specific commands: "make slide 3 text bolder"
- AI maintains style consistency across unlocked elements
- Respects locked elements

**User Presets**
- Save style configurations with custom names
- Preset includes: template, color palette, text style, audience, other settings
- Load presets for new carousels
- Manage/delete presets

**Carousel Project Persistence**
- Save carousel projects to Supabase
- Project includes: all slides, settings, creator info selection
- Return and continue editing later
- Project listing/management UI

**Style Mimicking (Secondary)**
- Upload or reference existing Instagram carousel
- AI analyzes style (colors, typography, layout)
- Apply extracted style to new carousel generation

### Reusability Opportunities
- No existing code to reference - fresh implementation
- Component library: shadcn/ui + Radix UI for UI primitives
- Supabase patterns for auth, database, storage

### Scope Boundaries

**In Scope:**
- First-run setup wizard for Lovable forks
- Custom auth UI (Supabase Auth backend)
- Workspace model with name/logo branding
- Multi-user with view-only carousel sharing
- User-level creator profiles (multiple per user)
- AI generation from text prompts
- Canvas-based editor (Fabric.js)
- Global and per-slide editing
- Element lock/unlock for AI protection
- Natural language editing interface
- User-saveable presets
- Carousel project saving/loading
- Style mimicking (secondary priority)
- Instagram-only (1080x1080)

**Out of Scope:**
- Instagram auto-publish / Graph API integration
- Post scheduling system
- Account switching UI
- Multi-platform support (LinkedIn, TikTok, etc.)
- AI-generated headshots
- Shared/collaborative carousel editing
- Role-based permissions beyond owner
- Custom domain support
- Advanced white-label theming

### Technical Considerations

**Tech Stack (Confirmed)**
- TypeScript, Next.js, React, Tailwind CSS
- Supabase: Auth, Postgres database, Storage
- Fabric.js for canvas editor
- nano banana pro for AI image generation
- Google Gemini API for text generation and natural language processing
- shadcn/ui + Radix UI for components

**Database Schema Implications**
- `workspaces` table: id, name, logo_url, created_at
- `users` table: id, workspace_id, email, role (super_admin, member), created_at
- `creator_profiles` table: id, user_id, name, handle, headshot_url, created_at
- `carousels` table: id, user_id, workspace_id, name, status, settings_json, created_at, updated_at
- `carousel_slides` table: id, carousel_id, position, content_json, created_at
- `user_presets` table: id, user_id, name, settings_json, created_at
- RLS policies: workspace isolation, user ownership for editing

**Forkability Requirements**
- Clean, well-structured code for Lovable remixing
- Environment variables for all API keys
- First-run detection and setup wizard
- White-label settings stored in workspace table
- No hardcoded branding

**Integration Points**
- Supabase Auth for authentication
- Supabase Storage for images (headshots, generated slides, exports)
- nano banana pro API for image generation
- Google Gemini API for text generation and NL command interpretation
- Fabric.js canvas for visual editing

**Export Requirements**
- Export slides as PNG/JPG (1080x1080)
- Export all slides as ZIP bundle
- Caption text export
