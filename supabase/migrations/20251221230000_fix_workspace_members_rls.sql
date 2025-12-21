-- Fix RLS recursion caused by policies that query `public.workspace_members` from within
-- `public.workspace_members` policies.

create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  );
$$;

-- workspace_members
drop policy if exists workspace_members_self_read on public.workspace_members;
create policy workspace_members_self_read
on public.workspace_members
for select
to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.is_workspace_member(workspace_members.workspace_id, auth.uid())
);

-- workspaces
drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read
on public.workspaces
for select
to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.is_workspace_member(workspaces.id, auth.uid())
);

-- carousels
drop policy if exists carousels_member_read on public.carousels;
create policy carousels_member_read
on public.carousels
for select
to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.is_workspace_member(carousels.workspace_id, auth.uid())
);

-- carousel_assets
drop policy if exists carousel_assets_member_read on public.carousel_assets;
create policy carousel_assets_member_read
on public.carousel_assets
for select
to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.is_workspace_member(carousel_assets.workspace_id, auth.uid())
);

