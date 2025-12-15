# Product Roadmap

1. [ ] User authentication and workspace setup — Users can sign in, create a workspace, and access the dashboard with secure session management. `M`
2. [ ] Multi-account Instagram connection — Users can connect and manage multiple Instagram accounts via Meta/Instagram Graph API with OAuth flow, account switching, and permissions management. `L`
3. [ ] Prompt input and carousel generation — Users can enter a theme/prompt/idea and generate a complete multi-slide carousel with AI-generated images (nano banana pro) and copy (text generation AI) following Instagram carousel best practices. `L`
4. [ ] Style reference import and analysis — Users can upload or reference existing Instagram carousel posts (URL or images) and the system analyzes and extracts style profiles (layout patterns, color palette, typography, visual style) for replication. `M`
5. [ ] Style-based carousel generation — Users can generate new carousels that mimic the visual style of reference posts, applying extracted style profiles to new content while maintaining consistency across slides. `L`
6. [ ] Carousel editor with manual controls — Users can edit individual slides, modify text content, reorder slides, adjust layouts, and regenerate specific slides without affecting the entire carousel. `M`
7. [ ] Natural language editing interface — Users can make changes to carousels using plain-language commands (e.g., "make colors more vibrant", "shorten text on slide 3", "add more technical details") with AI-powered interpretation and application. `L`
8. [ ] Direct Instagram publishing — Users can publish generated carousels directly to connected Instagram accounts without downloading files, with caption text, hashtags, and metadata included. `M`
9. [ ] Post scheduling system — Users can schedule carousel posts for future publication dates/times across multiple Instagram accounts with a calendar view and scheduling queue management. `M`
10. [ ] Export functionality — Users can export carousels as Instagram-ready image files (PNG/JPG) with correct dimensions (1080x1080) and aspect ratios, plus caption text and optional ZIP bundle for backup/manual upload. `S`
11. [ ] Carousel history and management — Users can view, search, and manage all previously generated carousels with filtering by account, date, status (draft/scheduled/published), and reuse/duplicate capabilities. `S`
12. [ ] Demo-quality UI polish — Implement visually appealing, professional interface with smooth animations, responsive design, intuitive navigation, and onboarding flow that showcases AI capabilities. `M`

> Notes
> - Order items by technical dependencies and product architecture
> - Each item should represent an end-to-end (frontend + backend) functional and testable feature
> - Scheduling and direct Instagram publishing are MUST-HAVE features, not optional
> - Analytics and insights are explicitly NOT included - this is a generation and publishing tool only
