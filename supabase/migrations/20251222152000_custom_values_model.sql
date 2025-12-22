-- Task Group 3: Global defaults + per-user custom values

-- Tones (global + user custom)
create table if not exists public.tones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null,
  name text not null,
  is_global boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc(),
  constraint tones_scope_check check (
    (is_global = true and owner_id is null)
    or (is_global = false and owner_id is not null)
  )
);

create index if not exists tones_owner_id_idx on public.tones (owner_id);
create unique index if not exists tones_global_name_uq
  on public.tones (lower(name))
  where is_global = true;

drop trigger if exists set_updated_at_tones on public.tones;
create trigger set_updated_at_tones
before update on public.tones
for each row execute procedure public.set_updated_at();

alter table public.tones enable row level security;

drop policy if exists tones_read on public.tones;
create policy tones_read
on public.tones
for select
to authenticated
using (is_global = true or owner_id = auth.uid());

drop policy if exists tones_owner_write on public.tones;
create policy tones_owner_write
on public.tones
for all
to authenticated
using (owner_id = auth.uid() and is_global = false)
with check (owner_id = auth.uid() and is_global = false);

drop policy if exists tones_super_admin_global_write on public.tones;
create policy tones_super_admin_global_write
on public.tones
for all
to authenticated
using (public.is_super_admin(auth.uid()) and is_global = true)
with check (public.is_super_admin(auth.uid()) and is_global = true);

insert into public.tones (name, is_global)
values
  ('Amigável', true),
  ('Profissional', true),
  ('Didático', true),
  ('Inspirador', true),
  ('Humor leve', true)
on conflict do nothing;

-- Audiences (global + user custom)
create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null,
  name text not null,
  is_global boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc(),
  constraint audiences_scope_check check (
    (is_global = true and owner_id is null)
    or (is_global = false and owner_id is not null)
  )
);

create index if not exists audiences_owner_id_idx on public.audiences (owner_id);
create unique index if not exists audiences_global_name_uq
  on public.audiences (lower(name))
  where is_global = true;

drop trigger if exists set_updated_at_audiences on public.audiences;
create trigger set_updated_at_audiences
before update on public.audiences
for each row execute procedure public.set_updated_at();

alter table public.audiences enable row level security;

drop policy if exists audiences_read on public.audiences;
create policy audiences_read
on public.audiences
for select
to authenticated
using (is_global = true or owner_id = auth.uid());

drop policy if exists audiences_owner_write on public.audiences;
create policy audiences_owner_write
on public.audiences
for all
to authenticated
using (owner_id = auth.uid() and is_global = false)
with check (owner_id = auth.uid() and is_global = false);

drop policy if exists audiences_super_admin_global_write on public.audiences;
create policy audiences_super_admin_global_write
on public.audiences
for all
to authenticated
using (public.is_super_admin(auth.uid()) and is_global = true)
with check (public.is_super_admin(auth.uid()) and is_global = true);

insert into public.audiences (name, is_global)
values
  ('Iniciantes', true),
  ('Intermediários', true),
  ('Avançados', true),
  ('Empreendedores', true),
  ('Profissionais de marketing', true)
on conflict do nothing;

-- Palettes (global + user custom)
create table if not exists public.palettes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null,
  name text not null,
  palette_data jsonb not null default '{}'::jsonb,
  is_global boolean not null default false,
  created_at timestamptz not null default public.now_utc(),
  updated_at timestamptz not null default public.now_utc(),
  constraint palettes_scope_check check (
    (is_global = true and owner_id is null)
    or (is_global = false and owner_id is not null)
  )
);

create index if not exists palettes_owner_id_idx on public.palettes (owner_id);
create unique index if not exists palettes_global_name_uq
  on public.palettes (lower(name))
  where is_global = true;

drop trigger if exists set_updated_at_palettes on public.palettes;
create trigger set_updated_at_palettes
before update on public.palettes
for each row execute procedure public.set_updated_at();

alter table public.palettes enable row level security;

drop policy if exists palettes_read on public.palettes;
create policy palettes_read
on public.palettes
for select
to authenticated
using (is_global = true or owner_id = auth.uid());

drop policy if exists palettes_owner_write on public.palettes;
create policy palettes_owner_write
on public.palettes
for all
to authenticated
using (owner_id = auth.uid() and is_global = false)
with check (owner_id = auth.uid() and is_global = false);

drop policy if exists palettes_super_admin_global_write on public.palettes;
create policy palettes_super_admin_global_write
on public.palettes
for all
to authenticated
using (public.is_super_admin(auth.uid()) and is_global = true)
with check (public.is_super_admin(auth.uid()) and is_global = true);

insert into public.palettes (name, palette_data, is_global)
values
  (
    'Dojo (claro)',
    jsonb_build_object('background', '#ffffff', 'text', '#111827', 'accent', '#7a8bfa'),
    true
  ),
  (
    'Dojo (escuro)',
    jsonb_build_object('background', '#0b1220', 'text', '#e5e7eb', 'accent', '#7a8bfa'),
    true
  ),
  (
    'Violeta',
    jsonb_build_object('background', '#f5f3ff', 'text', '#111827', 'accent', '#7c3aed'),
    true
  ),
  (
    'Verde',
    jsonb_build_object('background', '#ecfdf5', 'text', '#064e3b', 'accent', '#10b981'),
    true
  ),
  (
    'Laranja',
    jsonb_build_object('background', '#fff7ed', 'text', '#7c2d12', 'accent', '#f97316'),
    true
  )
on conflict do nothing;

