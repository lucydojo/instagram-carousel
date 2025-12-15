# Tech stack (default)

This is the default stack to assume unless the project/product context explicitly says otherwise.

## Core principle: typed-first
- Prefer statically typed languages by default.
- For JavaScript ecosystem projects, use **TypeScript** (not plain JavaScript) as the default.
- If the project is in a language that supports type checking (e.g., Python), require type annotations and a type checker.

## Framework & Runtime
- **Language/Runtime:** TypeScript + Node.js
- **Application Framework (Web):** Next.js (TypeScript)
- **Application Framework (API-only):** Node.js (TypeScript) with a minimal HTTP framework (e.g., Fastify/Express) if not using Next.js routes
- **Package Manager:** pnpm (preferred). If pnpm is not available, use npm.

## Frontend
- **UI Framework:** React (TypeScript)
- **CSS:** Tailwind CSS (preferred)
- **UI Components:** Prefer a component library (e.g., shadcn/ui + Radix) for speed and consistency

## Database & Storage
- **Database:** PostgreSQL (default)
- **ORM/Query Builder:** Prisma (default) or a typed query builder
- **Caching (when needed):** Redis

## Testing & Quality
- **Unit/Integration Tests:** Vitest (preferred) or Jest
- **Linting:** ESLint (TypeScript rules) or Biome
- **Formatting:** Prettier or Biome
- **Type checking:** `tsc --noEmit` (always available in TS projects)

## Deployment & Infrastructure
- **Web hosting:** Vercel (if Next.js) or equivalent
- **CI/CD:** GitHub Actions

## Third-Party Services (choose per project)
- **Auth:** NextAuth/Auth.js (Next.js) or equivalent
- **Email:** Postmark/SendGrid
- **Monitoring:** Sentry
