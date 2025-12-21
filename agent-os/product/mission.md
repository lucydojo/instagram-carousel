# Product Mission

## Pitch
Dojogram is an AI-powered carousel design studio that helps AI/automation teams create stunning Instagram carousel posts by generating complete multi-slide carousels (images + copy) from a prompt, optional reference style, and structured "optimization options", with a canvas-like editor for iterative refinement — reducing hours of manual work to minutes.

## Distribution Model
Dojogram is designed as a **forkable MVP solution**:
- Open-source GitHub repository
- Clients fork into **Lovable accounts** and "remix" for their own versions
- **White-label ready**: Workspace name, logo customization
- **First-run setup wizard**: Guided initialization for new forks (no CLI required)
- Clean, well-structured code optimized for remixing

## Users

### Primary Customers
- **Internal AI/Automation Agency Team**: Marketing and content professionals creating educational and promotional carousels for AI productivity products and courses.
- **Agency Clients** (via Lovable forks): Teams who remix the product for their own use cases.

### User Personas
**Agency Content Strategist** (25-40)
- **Role:** Plans content themes and outlines weekly posts for multiple accounts
- **Context:** Small, high-output team at an AI/automation agency selling products and courses about AI productivity
- **Pain Points:** Carousels take too long to design; style consistency is hard; iteration loops are slow; managing multiple Instagram accounts is cumbersome
- **Goals:** Produce more posts per week with consistent style, quick revisions, and scheduled publishing across multiple accounts

**Creative Operator** (22-35)
- **Role:** Turns content outlines into polished carousel slides
- **Context:** Juggles multiple Instagram accounts and needs reusable design patterns
- **Pain Points:** Manual layout work; copy and design back-and-forth; exporting files and manually uploading to Instagram repeatedly
- **Goals:** Generate, refine, and publish carousels with minimal friction - no downloads, no manual uploads

## The Problem

### High-Effort Carousel Creation and Manual Publishing
Instagram carousels are time-consuming to design and write, especially when output quality must be consistently high across multiple accounts. The process involves coordinating design tools, writing copy, ensuring visual consistency, downloading files, and manually uploading to Instagram. This reduces publishing velocity, makes iteration expensive, and creates workflow bottlenecks.

**Our Solution:** Generate complete, editable carousels from a theme (and optional reference style inspiration), guide generation with structured optimization options (platform, tone, audience, language, presets), and let users refine output in a canvas-like editor with selectable elements and natural-language changes.

## Differentiators

### AI-Powered Style Replication
Unlike generic template tools or basic AI generators, we generate new carousels that closely match the layout, typography, color palette, and visual style of provided reference Instagram posts. This results in faster, consistent output that looks intentionally designed and maintains brand coherence.

### Natural Language Iteration with Element Locking
Unlike traditional editors that require manual pixel-pushing and text rewriting, we enable users to revise slides with plain-language instructions (e.g., "make the hook stronger", "use fewer words on slide 3", "make colors more vibrant"). Users can **lock specific elements** to protect them from AI edits. This results in faster review cycles and less creative friction.

### Direct Instagram Publishing Without Downloads
Unlike content creation tools that require downloading files and manual Instagram uploads, we provide seamless direct publishing to multiple connected Instagram accounts with scheduling capabilities. This results in a streamlined workflow that eliminates file management and manual posting steps entirely.

### Forkable White-Label Architecture
Unlike monolithic SaaS tools, Dojogram is designed to be forked and customized. Each fork can have its own branding (workspace name, logo), and the first-run setup wizard makes initialization seamless for non-technical users.

## Key Features

### Core Features
- **AI-Powered Generation:** Enter a prompt/theme/idea and get a complete multi-slide carousel with AI-generated images (via nano banana pro) and compelling copy
- **Style Mimicking:** Upload or reference existing Instagram carousel posts to replicate their visual style, layout, colors, and typography in new content
- **Canvas-like Editor (Fabric.js):** Edit text and elements directly on a slide canvas (selectable objects), reorder slides, and refine layout while keeping style consistent
- **Optimization Options + Presets:** Guide generation with platform (Instagram for MVP), tone/mood, target audience, language, slide count, and reusable user-saveable presets for consistent output
- **Templates + custom templates:** Start from built-in templates and import/save custom templates for repeatable carousel structures
- **Global + Per-Slide Editing:** Apply changes to all slides (e.g., color palette) or customize individual slides with specific edits

### Workflow Features
- **Natural Language Editing:** Refine generated content using conversational commands instead of manual editing tools
- **Element Locking:** Lock specific elements (text, images) to protect them from AI-driven changes
- **Multiple Creator Profiles:** Users can manage multiple creator profiles (for themselves and clients) with headshot, name, and handle
- **Carousel Project Saving:** Save work-in-progress carousels and return to edit later
- **Direct Instagram Export:** Publish carousels directly to connected Instagram accounts without downloading files first
- **Multi-Account Management:** Manage and publish to multiple Instagram accounts from a single unified dashboard

### Advanced Features
- **Post Scheduling:** Schedule carousel posts for future publication to maintain consistent posting cadence across accounts
- **User-Saveable Presets:** Save combinations of template, color palette, text style, and audience as named presets (e.g., "Entrepreneur minimal style")
- **Demo-Quality Visual Appeal:** Polished, professional UI with glassmorphic design elements that showcases AI capabilities

### Platform Features
- **First-Run Setup Wizard:** Detect empty database, guide super admin creation and workspace setup for Lovable forks
- **White-Label Branding:** Workspace name and logo customization
- **Workspace Model:** Multi-user workspaces with view-only sharing (members see all carousels but only edit their own)
- **Custom Auth UI:** Glassmorphic design matching modern aesthetics, powered by Supabase Auth backend
