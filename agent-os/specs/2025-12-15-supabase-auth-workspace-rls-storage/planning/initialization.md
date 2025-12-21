# Spec Initialization

## Raw idea (unmodified)
Build the first vertical slice for Dojogram using Supabase for backend foundations:

- Supabase Auth for login/session
- Workspace model (multi-tenant) for the team
- RLS policies to enforce tenant isolation
- Supabase Storage buckets and file path conventions for reference images and generated/exported assets
- Minimal frontend that exercises the flow end-to-end (sign in → create/select workspace → create a carousel draft and attach/upload reference assets)

