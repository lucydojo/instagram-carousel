-- Dojogram foundations: instance bootstrap, workspaces, members, access control, drafts, assets.
-- This migration is designed for Supabase Postgres.

create extension if not exists "pgcrypto";

-- Helpers
create or replace function public.now_utc()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- Instance settings (publicly readable)
create table if not exists public.instance_settings (
  id int primary key default 1,
  initialized boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc(),
  constraint instance_settings_singleton check (id = 1)
);

insert into public.instance_settings (id, initialized)
values (1, false)
on conflict (id) do nothing;

-- Super admins (instance-level)
create table if not exists public.super_admins (
  user_id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default public.now_utc()
);

create or replace function public.is_super_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.super_admins sa where sa.user_id = $1);
$$;

-- Allowlisted emails (invite-only policy)
create table if not exists public.allowlisted_emails (
  email text primary key,
  invited_by uuid null,
  created_at timestamptz not null default public.now_utc()
);

create or replace function public.is_email_allowlisted(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.allowlisted_emails ae where lower(ae.email) = lower(p_email));
$$;

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text null,
  created_by uuid not null,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc()
);

-- Workspace membership (role reserved for future)
create type public.workspace_role as enum ('owner', 'member', 'admin');

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default public.now_utc(),
  primary key (workspace_id, user_id)
);

-- Carousel drafts (no generation yet)
create table if not exists public.carousels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null,
  title text null,
  draft jsonb not null default '{}'::jsonb,
  element_locks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc()
);

-- Assets (reference uploads now; future: generated/export)
create table if not exists public.carousel_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  carousel_id uuid not null references public.carousels (id) on delete cascade,
  owner_id uuid not null,
  asset_type text not null, -- reference|generated|export
  storage_bucket text not null,
  storage_path text not null,
  mime_type text null,
  created_at timestamptz not null default public.now_utc()
);

-- User-owned creator profiles (not shared with workspace members)
create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null,
  display_name text not null,
  handle text null,
  role_title text null,
  avatar_path text null,
  is_default boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc()
);

-- User saveable presets (not shared with workspace members)
create table if not exists public.user_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null,
  name text not null,
  preset_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc()
);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = public.now_utc();
  return new;
end;
$$;

drop trigger if exists set_updated_at_workspaces on public.workspaces;
create trigger set_updated_at_workspaces
before update on public.workspaces
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_instance_settings on public.instance_settings;
create trigger set_updated_at_instance_settings
before update on public.instance_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_carousels on public.carousels;
create trigger set_updated_at_carousels
before update on public.carousels
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_creator_profiles on public.creator_profiles;
create trigger set_updated_at_creator_profiles
before update on public.creator_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_user_presets on public.user_presets;
create trigger set_updated_at_user_presets
before update on public.user_presets
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.instance_settings enable row level security;
alter table public.super_admins enable row level security;
alter table public.allowlisted_emails enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.carousels enable row level security;
alter table public.carousel_assets enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.user_presets enable row level security;

-- Public read of instance settings (used for setup wizard)
drop policy if exists instance_settings_read on public.instance_settings;
create policy instance_settings_read
on public.instance_settings
for select
to anon, authenticated
using (true);

drop policy if exists instance_settings_super_admin_update on public.instance_settings;
create policy instance_settings_super_admin_update
on public.instance_settings
for update
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Super admin policies
drop policy if exists super_admins_read_self on public.super_admins;
create policy super_admins_read_self
on public.super_admins
for select
to authenticated
using (public.is_super_admin(auth.uid()));

-- Bootstrap: first authenticated user can insert first super_admin if none exist yet.
drop policy if exists super_admins_bootstrap_insert on public.super_admins;
create policy super_admins_bootstrap_insert
on public.super_admins
for insert
to authenticated
with check (not exists (select 1 from public.super_admins));

drop policy if exists super_admins_manage on public.super_admins;
create policy super_admins_manage
on public.super_admins
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allowlist policies (super admins only)
drop policy if exists allowlisted_manage on public.allowlisted_emails;
create policy allowlisted_manage
on public.allowlisted_emails
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Workspace policies
drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists workspaces_super_admin_write on public.workspaces;
create policy workspaces_super_admin_write
on public.workspaces
for update
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow any authenticated user to create a workspace only during bootstrap (no workspaces exist yet).
drop policy if exists workspaces_bootstrap_insert on public.workspaces;
create policy workspaces_bootstrap_insert
on public.workspaces
for insert
to authenticated
with check (not exists (select 1 from public.workspaces));

-- Workspace members policies
drop policy if exists workspace_members_self_read on public.workspace_members;
create policy workspace_members_self_read
on public.workspace_members
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists workspace_members_manage_super_admin on public.workspace_members;
create policy workspace_members_manage_super_admin
on public.workspace_members
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Allow allowlisted users to self-join the default workspace (invite-only UX without manual membership management).
-- This is compatible with the "single workspace per instance" MVP and can be replaced with role-based invites later.
drop policy if exists workspace_members_allowlisted_self_join on public.workspace_members;
create policy workspace_members_allowlisted_self_join
on public.workspace_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_email_allowlisted(auth.jwt() ->> 'email')
  and workspace_id = (
    select w.id
    from public.workspaces w
    order by w.created_at asc
    limit 1
  )
);

-- Carousels: view-only sharing (read for members; write for owner)
drop policy if exists carousels_member_read on public.carousels;
create policy carousels_member_read
on public.carousels
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = carousels.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists carousels_owner_write on public.carousels;
create policy carousels_owner_write
on public.carousels
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Carousel assets: same pattern as carousels
drop policy if exists carousel_assets_member_read on public.carousel_assets;
create policy carousel_assets_member_read
on public.carousel_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = carousel_assets.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists carousel_assets_owner_write on public.carousel_assets;
create policy carousel_assets_owner_write
on public.carousel_assets
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Creator profiles: owner-only (read/write)
drop policy if exists creator_profiles_owner_rw on public.creator_profiles;
create policy creator_profiles_owner_rw
on public.creator_profiles
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- User presets: owner-only (read/write)
drop policy if exists user_presets_owner_rw on public.user_presets;
create policy user_presets_owner_rw
on public.user_presets
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Storage buckets (private) + RLS policies for client-side access when desired.
-- If you choose to only upload via server (service role), these policies are still safe to keep.
insert into storage.buckets (id, name, public)
values
  ('workspace-logos', 'workspace-logos', false),
  ('carousel-assets', 'carousel-assets', false)
on conflict (id) do nothing;

create or replace function public.workspace_id_from_storage_path(path text)
returns uuid
language sql
stable
as $$
  select substring(path from '^workspaces/([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12})/')::uuid;
$$;

alter table storage.objects enable row level security;

drop policy if exists storage_objects_workspace_member_read on storage.objects;
create policy storage_objects_workspace_member_read
on storage.objects
for select
to authenticated
using (
  bucket_id in ('workspace-logos', 'carousel-assets')
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.workspace_id_from_storage_path(name)
      and wm.user_id = auth.uid()
  )
);

drop policy if exists storage_objects_workspace_owner_write on storage.objects;
create policy storage_objects_workspace_owner_write
on storage.objects
for all
to authenticated
using (
  bucket_id in ('workspace-logos', 'carousel-assets')
  and owner = auth.uid()
)
with check (
  bucket_id in ('workspace-logos', 'carousel-assets')
  and owner = auth.uid()
);
