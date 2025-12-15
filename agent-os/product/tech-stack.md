# Tech Stack

This document records the complete tech stack for the Instagram Carousel Maker. The stack leverages TypeScript/Next.js defaults with specific additions for AI image generation (nano banana pro), text generation, Instagram API integration, and scheduling.

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

## Data & Persistence
- **PostgreSQL** - Primary relational database
- **Prisma** - Type-safe ORM and database toolkit

## File Storage
- **S3-compatible object storage** (AWS S3 or Cloudflare R2) - For storing generated carousel images, reference images, exported assets, and user uploads

## Authentication & User Management
- **Auth.js (NextAuth)** - Authentication solution with session management
- **Workspace model** - Multi-tenant data structure for team collaboration and multi-account organization

## AI Services

### Image Generation
- **nano banana pro** - REQUIRED AI image generation service for carousel slide imagery
- Integration via API (implementation details TBD based on nano banana pro documentation)

### Text Generation & Analysis
- **OpenAI API** or **Anthropic Claude API** - For generating carousel copy, captions, hooks, and natural language editing commands
- **Alternative:** Google Gemini API for multimodal capabilities
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
- **React-based canvas editor** with options:
  - **Konva.js** or **Fabric.js** - Canvas manipulation libraries
  - **DOM-based editor** - Alternative HTML/CSS-based approach
- Supports drag-and-drop, text editing, image replacement, and layout adjustments

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
- **Background job queue** - For scheduled post publication
  - **BullMQ** + **Redis** - Robust queue system with retry logic and scheduling
  - Alternative: **Inngest** - Serverless job scheduling platform

## Background Processing & Performance
- **Redis** - Caching and job queue management
- **BullMQ** or **Inngest** - Background job processing for:
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
- **OpenAI API** or **Anthropic Claude API** - Text generation and natural language processing

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
- Scheduling system requires persistent job queue (Redis + BullMQ recommended)
