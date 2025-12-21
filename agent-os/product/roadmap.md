# Product Roadmap

1. [ ] Supabase auth + workspace foundations — Users can sign in via Supabase Auth (email+password), access is invite-only for the demo (allowlist + super admins), workspaces support basic branding (name/logo), and core tables + RLS policies enforce tenant isolation. `M`
2. [ ] Multi-account Instagram connection — Users can connect and manage multiple Instagram accounts via Meta/Instagram Graph API; store connection metadata securely in Supabase Postgres and enforce access via RLS. `L`
3. [ ] Prompt builder + optimization options — Users can define topic/prompt and structured options (platform, tone/mood, audience, language, slides count) and save/load presets for consistent generation. `M`
4. [ ] Templates library (built-in + custom) — Users can choose a template (layout/structure) and import/save custom templates for reuse; template selection becomes part of the generation context. `M`
5. [ ] Style reference import and analysis — Users can upload or reference existing Instagram carousel posts (URL or images) and the system analyzes and extracts style profiles (layout patterns, color palette, typography, visual style) for replication. `M`
6. [ ] Theme/prompt → carousel generation — Users can generate a complete multi-slide carousel with AI-generated images (nano banana pro) and copy (text generation AI), guided by template + optimization options, following carousel best practices. `L`
7. [ ] Canvas editor (selectable elements) — Users can edit slides in a canvas-like editor with selectable text/elements, per-slide regeneration, and consistent styling. `L`
8. [ ] Creator info + palette controls — Users can toggle and edit a creator attribution block (name/handle/role) and define/reuse a color palette applied across slides. `M`
9. [ ] Natural language editing interface — Users can make changes to carousels using plain-language commands (e.g., "make colors more vibrant", "shorten text on slide 3") with AI-powered interpretation and application. `L`
10. [ ] Export functionality — Users can export carousels as Instagram-ready image files (PNG/JPG) with correct dimensions, plus caption text and optional ZIP bundle; assets live in Supabase Storage with signed download links. `S`
11. [ ] Direct Instagram publishing (when supported) — Users can publish generated carousels directly to connected Instagram accounts when their account type/API permissions allow it; otherwise the UX falls back to export + manual posting. `L`
12. [ ] Post scheduling system — Users can schedule carousel posts for future publication across connected accounts with a calendar view; scheduled posts are stored in Supabase Postgres and executed by a scheduled worker (upgrade to a queue if needed). `M`
13. [ ] Carousel history and management — Users can view, search, and manage generated carousels with filtering by account, date, status (draft/scheduled/published), and reuse/duplicate capabilities. `S`
14. [ ] Demo-quality UI polish — Implement visually appealing, professional interface with smooth animations, responsive design, intuitive navigation, and onboarding flow that showcases AI capabilities. `M`

> Notes
> - Order items by technical dependencies and product architecture
> - Each item should represent an end-to-end (frontend + backend) functional and testable feature
> - Direct Instagram publishing depends on Meta/Instagram Graph API requirements; the product must work well with export/manual posting
> - Analytics and insights are explicitly NOT included - this is a generation and publishing tool only
