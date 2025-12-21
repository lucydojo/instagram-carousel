# Tech Stack

This document records the complete tech stack for Dojogram. The stack leverages TypeScript/Next.js defaults and uses Supabase for database, authentication, and file storage, with specific additions for AI image generation (nano banana pro), text generation, Instagram API integration, and scheduling.

## Language & Runtime
- **TypeScript** - Primary language for type safety across frontend and backend
- **Node.js** - Server runtime environment

## Web Application Framework
- **Next.js (TypeScript)** - Full-stack React framework with API routes
- **React (TypeScript)** - Frontend UI framework

## UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui + Radix UI** - Component library for accessible, composable UI primitives
- **Framer Motion** (optional) - Animation library for demo-quality polish and smooth transitions

## Canvas Editor (core UX)
- **Canvas editor library:** Fabric.js
- **Element model:** Text, shapes, images as selectable objects (enables template-based layouts and AI-driven modifications later)

## Data & Persistence
- **Supabase Postgres** - Primary relational database
- **Supabase CLI migrations** - Schema migrations and local development workflow
- **Row Level Security (RLS)** - Multi-tenant access control for workspaces and connected Instagram accounts
- **Typed access** - Prefer `supabase-js` with generated TypeScript types for end-to-end type safety

## File Storage
- **Supabase Storage** - For generated carousel images, reference images, exported assets, and user uploads (use signed URLs for private assets)

## Authentication & User Management
- **Supabase Auth** - Authentication and session management
- **Supabase SSR (Next.js)** - Server-side auth/session handling for Next.js
- **Custom Auth UI** - Glassmorphic design (split-screen layout, glass effects, staggered animations) built with React/Tailwind, calling Supabase Auth methods
- **First-run setup wizard** - Detect empty database, guide super admin + workspace creation for Lovable forks
- **Workspace model** - Multi-tenant data structure with view-only sharing (members see all carousels, only edit their own)
- **Closed demo allowlist** - Allowlist + instance-level "super admin" accounts to control access (expandable to roles later)

## AI Services

### Image Generation
- **nano banana pro** - REQUIRED AI image generation service for carousel slide imagery
- Integration via API (implementation details TBD based on nano banana pro documentation)

### Text Generation & Analysis
- **Google Gemini API** - Preferred (aligns with nano banana pro being a Gemini image model)
- **Alternative:** OpenAI API or Anthropic Claude API
- Used for:
  - Carousel copy generation from prompts
  - Caption and hashtag generation
  - Natural language command interpretation
  - Style analysis from reference images

### Style Analysis
- **Vision model** (OpenAI GPT-4 Vision, Claude with vision, or Gemini) - For analyzing reference Instagram posts to extract style profiles (color palette, typography, layout patterns, visual style)

## Data Validation
- **Zod** - Runtime type validation and schema definition for API inputs/outputs, AI model outputs, and form validation

## Carousel Editor & Rendering

### Interactive Editor
- **Fabric.js** - Canvas manipulation library (chosen for stronger text editing capabilities and better documentation for carousel-style layouts)
- **React integration** - Fabric.js wrapped in React components for state management
- Supports:
  - Drag-and-drop element positioning
  - Direct text editing on canvas
  - Selectable objects (text, images, shapes)
  - Global editing (color palette affects all slides)
  - Per-slide editing (customize individual slides)
  - Element locking (lock icon to protect elements from AI edits)

### Export Rendering
- **Puppeteer** or **Playwright** - Headless browser for server-side high-resolution rendering of carousel slides to PNG/JPG
- **Sharp** (optional) - Image processing for optimization and format conversion

## Instagram Integration

### Publishing API
- **Meta/Instagram Graph API** - REQUIRED for direct Instagram publishing
  - OAuth 2.0 flow for account connection
  - Content Publishing API for carousel posts
  - Account management and permissions
  - Support for Business and Creator accounts

### Scheduling
- **Supabase-backed scheduling** - Store scheduled posts in Postgres and publish via a scheduled job runner
  - **Supabase Edge Functions** (or Next.js server routes) for the publishing worker
  - **Cron trigger** (e.g., scheduled invocation) to publish due posts
  - Optional: add a dedicated queue (BullMQ/Redis or Inngest) if volume/retries require it

## Background Processing & Performance
- **Supabase Edge Functions** (or server routes) - Background processing entrypoints
- **Optional queue** (BullMQ/Redis or Inngest) - Background job processing for:
  - Multi-slide AI generation
  - Image rendering and export
  - Scheduled post publishing
  - Style analysis processing

## Quality Gates & Development Tools
- **ESLint** - TypeScript linting and code quality
- **Prettier** - Code formatting
- **tsc --noEmit** - TypeScript type checking
- **Vitest** - Unit and integration testing
- **Biome** (alternative) - Combined linting and formatting

## Deployment & Infrastructure
- **Vercel** - Primary hosting platform for Next.js application
- **GitHub Actions** - CI/CD pipeline for testing, linting, and deployment
- **Sentry** (optional) - Error monitoring and performance tracking

## Third-Party Services

### Required
- **Meta/Instagram Graph API** - Direct Instagram publishing
- **nano banana pro API** - Image generation
- **Google Gemini API** - Text generation and natural language processing (primary choice, aligns with nano banana pro)

### Optional
- **Postmark** or **SendGrid** - Transactional email (notifications, alerts)
- **Sentry** - Error tracking and monitoring
- **Vercel Analytics** - Basic usage analytics

## Environment Variables & Configuration
- **Environment-based configuration** - All API keys, secrets, and service URLs managed via environment variables
- **No secrets in version control** - .env files gitignored, secrets managed via Vercel environment variables

## Notes
- Stack is fully typed (TypeScript) across frontend, backend, and database layers
- All AI services require API key configuration
- Instagram API integration requires app registration with Meta and user OAuth flow
- nano banana pro integration details depend on service API documentation
- Scheduling can start Supabase-first (Postgres + cron + worker) and upgrade to a queue when needed
