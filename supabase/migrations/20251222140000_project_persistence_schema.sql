-- Task Group 2: Project persistence schema (Spec 2)

-- Carousels: persist editor/canvas state and generation metadata
alter table public.carousels
  add column if not exists editor_state jsonb not null default '{"version": 1}'::jsonb,
  add column if not exists generation_status text not null default 'idle',
  add column if not exists generation_meta jsonb not null default '{}'::jsonb,
  add column if not exists generation_error text null;

alter table public.carousels
  alter column editor_state set default '{"version": 1}'::jsonb,
  alter column generation_status set default 'idle',
  alter column generation_meta set default '{}'::jsonb;

update public.carousels
set editor_state = '{"version": 1}'::jsonb
where (editor_state ->> 'version') is null;

-- Carousel assets: add minimal metadata/status for exports/generated assets
alter table public.carousel_assets
  add column if not exists status text not null default 'ready',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.carousel_assets
  alter column status set default 'ready',
  alter column metadata set default '{}'::jsonb;

-- Templates: global (app) + user custom (owner-only)
create table if not exists public.carousel_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces (id) on delete cascade,
  owner_id uuid null,
  name text not null,
  template_data jsonb not null default '{}'::jsonb,
  is_global boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc(),
  constraint carousel_templates_scope_check check (
    (is_global = true and owner_id is null and workspace_id is null)
    or (is_global = false and owner_id is not null)
  )
);

create index if not exists carousel_templates_owner_id_idx
  on public.carousel_templates (owner_id);

create index if not exists carousel_templates_workspace_id_idx
  on public.carousel_templates (workspace_id);

drop trigger if exists set_updated_at_carousel_templates on public.carousel_templates;
create trigger set_updated_at_carousel_templates
before update on public.carousel_templates
for each row execute procedure public.set_updated_at();

alter table public.carousel_templates enable row level security;

drop policy if exists carousel_templates_read on public.carousel_templates;
create policy carousel_templates_read
on public.carousel_templates
for select
to authenticated
using (is_global = true or owner_id = auth.uid());

drop policy if exists carousel_templates_owner_write on public.carousel_templates;
create policy carousel_templates_owner_write
on public.carousel_templates
for all
to authenticated
using (owner_id = auth.uid() and is_global = false)
with check (owner_id = auth.uid() and is_global = false);

drop policy if exists carousel_templates_super_admin_global_write on public.carousel_templates;
create policy carousel_templates_super_admin_global_write
on public.carousel_templates
for all
to authenticated
using (public.is_super_admin(auth.uid()) and is_global = true)
with check (public.is_super_admin(auth.uid()) and is_global = true);
