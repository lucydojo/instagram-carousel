# Tech Stack

This document records the intended tech stack for Dojogram. User-provided requirements take precedence (Gemini image generation via “Nano Banana Pro”; direct Instagram publishing is optional with a manual export fallback).

## Language & Runtime
- TypeScript
- Node.js

## Web App
- Next.js (TypeScript)
- React

## UI & Styling
- Tailwind CSS
- shadcn/ui + Radix UI (component primitives)

## Data & Persistence
- PostgreSQL
- Prisma (typed ORM)

## File Storage (generated assets)
- S3-compatible object storage (e.g., AWS S3 / Cloudflare R2) for slide images, reference images, and exported bundles

## Auth & User Management
- Auth.js (NextAuth) for authentication
- Workspace model in DB for team use and multi-account organization

## AI (copy, style analysis, generation)
- Google Gemini API
  - **Image generation:** “Nano Banana Pro” (Gemini image model) for slide imagery
  - **Text generation:** Gemini text model for hooks, slide copy, captions, and rewrite requests
  - **Style extraction:** Gemini multimodal analysis on reference images to derive a “style profile” (palette, typography cues, layout patterns)
- Output validation: Zod schemas for structured model outputs (outlines, slide specs, export manifests)

## Editor & Rendering
- Interactive slide editor: React-based canvas/editor (implementation can be Konva/Fabric.js or a DOM-based editor)
- Export rendering: server-side high-resolution PNG/JPG export (e.g., via headless Chromium rendering or deterministic image composition)

## Jobs & Performance (when needed)
- Background processing for multi-slide generation and exports (e.g., Redis-backed queue/worker)
- Caching (optional): Redis

## Instagram Publishing (optional integration)
- Meta/Instagram Graph API for direct publishing **when supported by account type** (typically requires a Business/Creator account setup)
- Default fallback: download/export Instagram-ready assets for manual posting

## Quality Gates
- Linting: ESLint
- Formatting: Prettier
- Type checking: `tsc --noEmit`
- Tests: Vitest (where tests exist for core flows)

## Deployment & Ops
- Hosting: Vercel (Next.js)
- CI/CD: GitHub Actions
- Monitoring (optional): Sentry
