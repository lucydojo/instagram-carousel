# Product Roadmap

1. [ ] First-run setup wizard — App detects empty database and displays setup wizard (bypasses normal login); user creates first account (super admin) and workspace (name, logo); redirects to normal app after completion. Essential for Lovable fork initialization. `S`
2. [ ] Supabase auth + workspace foundations — Users can sign in via custom auth UI (Supabase Auth backend, email+password), access is invite-only (allowlist + super admins), workspaces support branding (name/logo), and core tables + RLS policies enforce tenant isolation with view-only sharing (members see all carousels but only edit their own). `M`
3. [ ] Creator profiles management — Users can create and manage multiple creator profiles (for themselves and clients) with headshot upload, name, handle/role; profiles are user-owned and reusable across that user's carousels. `S`
4. [ ] Multi-account Instagram connection — Users can connect and manage multiple Instagram accounts via Meta/Instagram Graph API; store connection metadata securely in Supabase Postgres and enforce access via RLS. `L`
5. [ ] Prompt builder + optimization options — Users can define topic/prompt and structured options (platform: Instagram for MVP, tone/mood, audience, language, slides count) and save/load user-saveable presets (e.g., "Entrepreneur minimal style") for consistent generation. `M`
6. [ ] Templates library (built-in + custom) — Users can choose a template (layout/structure) and import/save custom templates for reuse; template selection becomes part of the generation context. `M`
7. [ ] Style reference import and analysis — Users can upload or reference existing Instagram carousel posts (URL or images) and the system analyzes and extracts style profiles (layout patterns, color palette, typography, visual style) for replication. `M`
8. [ ] Theme/prompt → carousel generation — Users can generate a complete multi-slide carousel with AI-generated images (nano banana pro) and copy (Google Gemini), guided by template + optimization options, following carousel best practices. `L`
9. [ ] Canvas editor (Fabric.js) with global + per-slide editing — Users can edit slides in a Fabric.js canvas editor with selectable text/elements; global editing (color palette affects all slides) and per-slide editing (customize individual slides); element locking (lock icon to protect elements from AI edits). `L`
10. [ ] Creator info + palette controls — Users can toggle and edit a creator attribution block (select from saved creator profiles) and define/reuse a color palette applied across slides. `M`
11. [ ] Natural language editing interface — Users can make changes to carousels using plain-language commands (e.g., "make colors more vibrant", "shorten text on slide 3") with AI-powered interpretation; locked elements are protected from changes. `L`
12. [ ] Carousel project persistence — Users can save carousel projects (all slides, settings, creator selection) to Supabase and return to continue editing later; project listing/management UI. `S`
13. [ ] Export functionality — Users can export carousels as Instagram-ready image files (PNG/JPG, 1080x1080) plus caption text and optional ZIP bundle; assets live in Supabase Storage with signed download links. `S`
14. [ ] Direct Instagram publishing (when supported) — Users can publish generated carousels directly to connected Instagram accounts when their account type/API permissions allow it; otherwise the UX falls back to export + manual posting. `L`
15. [ ] Post scheduling system — Users can schedule carousel posts for future publication across connected accounts with a calendar view; scheduled posts are stored in Supabase Postgres and executed by a scheduled worker. `M`
16. [ ] Carousel history and management — Users can view, search, and manage generated carousels with filtering by account, date, status (draft/scheduled/published), and reuse/duplicate capabilities. `S`
17. [ ] Demo-quality UI polish — Implement visually appealing, professional interface with glassmorphic design elements, smooth animations, responsive design, intuitive navigation, and onboarding flow that showcases AI capabilities. `M`

> Notes
> - Order items by technical dependencies and product architecture
> - Each item should represent an end-to-end (frontend + backend) functional and testable feature
> - Item 1 (First-run setup wizard) is CRITICAL for Lovable fork use case
> - Direct Instagram publishing depends on Meta/Instagram Graph API requirements; the product must work well with export/manual posting
> - Analytics and insights are explicitly NOT included - this is a generation and publishing tool only
> - Effort estimates: XS (1 day), S (2-3 days), M (1 week), L (2 weeks), XL (3+ weeks)
