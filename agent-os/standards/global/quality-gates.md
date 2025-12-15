# Quality gates (lint, typecheck, format) — required

## Definition of done (DoD)
Before marking a task "done", you MUST ensure:
1) Lint passes
2) Typecheck passes
3) Format check passes
4) Tests pass (when tests exist for the touched core flow)

## Default commands (TypeScript/Node projects)
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck` (or `pnpm tsc --noEmit`)
- Format check: `pnpm format:check`
- Tests: `pnpm test`

## If the project does not have these scripts yet
Add them in `package.json` (preferred) instead of running ad-hoc commands.

Example scripts (adjust tools as needed):
- "lint": "eslint ."
- "typecheck": "tsc --noEmit"
- "format:check": "prettier --check ."
- "format:write": "prettier --write ."
- "test": "vitest"

## Fix policy
- If any gate fails, fix it immediately within the same task scope.
- Do NOT ignore type errors with `any`, `@ts-ignore`, or disabling rules unless explicitly instructed.
