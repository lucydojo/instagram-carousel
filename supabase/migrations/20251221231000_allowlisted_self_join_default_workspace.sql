-- Allow allowlisted users to self-join the default workspace without requiring
-- read access to `public.workspaces`.

create or replace function public.default_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.id
  from public.workspaces w
  order by w.created_at asc
  limit 1;
$$;

drop policy if exists workspace_members_allowlisted_self_join on public.workspace_members;
create policy workspace_members_allowlisted_self_join
on public.workspace_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_email_allowlisted(auth.jwt() ->> 'email')
  and workspace_id = public.default_workspace_id()
);

