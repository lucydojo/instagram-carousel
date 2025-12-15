# Product Roadmap

1. [ ] Supabase auth + workspace foundations — Users can sign in via Supabase Auth, create a workspace, and access the dashboard; core tables and RLS policies enforce tenant isolation. `M`
2. [ ] Multi-account Instagram connection — Users can connect and manage multiple Instagram accounts via Meta/Instagram Graph API; store connection metadata securely in Supabase Postgres and enforce access via RLS. `L`
3. [ ] Prompt input and carousel generation — Users can enter a theme/prompt/idea and generate a complete multi-slide carousel with AI-generated images (nano banana pro) and copy (text generation AI) following Instagram carousel best practices. `L`
4. [ ] Style reference import and analysis — Users can upload or reference existing Instagram carousel posts (URL or images) and the system analyzes and extracts style profiles (layout patterns, color palette, typography, visual style) for replication. `M`
5. [ ] Style-based carousel generation — Users can generate new carousels that mimic the visual style of reference posts, applying extracted style profiles to new content while maintaining consistency across slides. `L`
6. [ ] Carousel editor with manual controls — Users can edit individual slides, modify text content, reorder slides, adjust layouts, and regenerate specific slides without affecting the entire carousel. `M`
7. [ ] Natural language editing interface — Users can make changes to carousels using plain-language commands (e.g., "make colors more vibrant", "shorten text on slide 3", "add more technical details") with AI-powered interpretation and application. `L`
8. [ ] Export functionality — Users can export carousels as Instagram-ready image files (PNG/JPG) with correct dimensions (1080x1080) and aspect ratios, plus caption text and optional ZIP bundle; assets live in Supabase Storage with signed download links. `S`
9. [ ] Direct Instagram publishing (when supported) — Users can publish generated carousels directly to connected Instagram accounts when their account type/API permissions allow it; otherwise the UX falls back to export + manual posting. `L`
10. [ ] Post scheduling system — Users can schedule carousel posts for future publication across connected accounts with a calendar view; scheduled posts are stored in Supabase Postgres and executed by a scheduled worker (upgrade to a queue if needed). `M`
11. [ ] Carousel history and management — Users can view, search, and manage all previously generated carousels with filtering by account, date, status (draft/scheduled/published), and reuse/duplicate capabilities. `S`
12. [ ] Demo-quality UI polish — Implement visually appealing, professional interface with smooth animations, responsive design, intuitive navigation, and onboarding flow that showcases AI capabilities. `M`

> Notes
> - Order items by technical dependencies and product architecture
> - Each item should represent an end-to-end (frontend + backend) functional and testable feature
> - Direct Instagram publishing depends on Meta/Instagram Graph API requirements; the product must work well with export/manual posting
> - Analytics and insights are explicitly NOT included - this is a generation and publishing tool only
