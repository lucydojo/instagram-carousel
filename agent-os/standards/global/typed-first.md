# Typed-first development

## Default rule
- Prefer statically typed languages by default.
- In the JS ecosystem, use **TypeScript** (not plain JavaScript) by default.

## TypeScript rules
- Prefer strict typing (enable `strict: true` where possible).
- Avoid `any`. Prefer `unknown` + narrowing.
- Prefer explicit types at boundaries:
  - API input/output
  - DB layer inputs/outputs
  - Public function exports
- Avoid bypassing the type system:
  - avoid `@ts-ignore` / `@ts-nocheck`
  - avoid unsafe casts with `as` unless there is a clear runtime guarantee
- If a library is poorly typed, contain it in a thin adapter and expose typed interfaces to the app.

## Non-TS projects
- If using Python: require type hints and run a type checker (mypy/pyright) when available.
- If using another typed language (Go/Java/C#): keep types explicit at module boundaries and public APIs.
