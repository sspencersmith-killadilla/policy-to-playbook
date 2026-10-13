create type public.org_role as enum ('owner','editor','viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  email text,
  role public.org_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'editor',
  token uuid not null default gen_random_uuid() unique,
  created_by uuid not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.brand_kits (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#1F3A5F',
  accent_color text not null default '#E07A3F',
  background_color text not null default '#FAF7F2',
  text_color text not null default '#1B1B1B',
  heading_font text not null default 'Fraunces',
  body_font text not null default 'Work Sans',
  intro_text text not null default 'Welcome to your training',
  outro_text text not null default 'Thank you for completing this training',
  voice text not null default 'Kore',
  updated_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  file_path text,
  mime text,
  extracted_text text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft',
  content jsonb not null default '{"slides":[],"quiz":[]}'::jsonb,
  pass_score int not null default 80,
  approved_by uuid,
  approved_by_email text,
  approved_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content jsonb not null,
  note text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor uuid,
  actor_email text,
  action text not null,
  target text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.org_members where org_id=_org and user_id=_user) $$;
create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.org_members where org_id=_org and user_id=_user and role = any(_roles)) $$;

create or replace function public.create_organization(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if length(trim(_name)) = 0 then raise exception 'name required'; end if;
  insert into public.organizations(name, created_by) values (trim(_name), _uid) returning id into _id;
  insert into public.org_members(org_id, user_id, email, role) values (_id, _uid, auth.jwt()->>'email', 'owner');
  insert into public.brand_kits(org_id) values (_id);
  return _id;
end $$;

create or replace function public.accept_invite(_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _inv public.org_invites; _uid uuid := auth.uid(); _email text := lower(auth.jwt()->>'email');
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select * into _inv from public.org_invites where token=_token and accepted_at is null;
  if not found then raise exception 'invite not found or already used'; end if;
  if lower(_inv.email) <> _email then raise exception 'this invite was sent to a different email'; end if;
  insert into public.org_members(org_id, user_id, email, role) values (_inv.org_id, _uid, _email, _inv.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  update public.org_invites set accepted_at = now() where id = _inv.id;
  return _inv.org_id;
end $$;

grant execute on function public.is_org_member, public.has_org_role, public.create_organization, public.accept_invite to authenticated;

grant select, insert, update, delete on public.organizations, public.org_members, public.org_invites, public.brand_kits, public.documents, public.courses, public.course_versions, public.audit_events to authenticated;
grant all on public.organizations, public.org_members, public.org_invites, public.brand_kits, public.documents, public.courses, public.course_versions, public.audit_events to service_role;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.brand_kits enable row level security;
alter table public.documents enable row level security;
alter table public.courses enable row level security;
alter table public.course_versions enable row level security;
alter table public.audit_events enable row level security;

create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id, auth.uid()));
create policy "owners update org" on public.organizations for update to authenticated using (public.has_org_role(id, auth.uid(), array['owner']::public.org_role[]));
create policy "owners delete org" on public.organizations for delete to authenticated using (public.has_org_role(id, auth.uid(), array['owner']::public.org_role[]));

create policy "members read members" on public.org_members for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "owners manage members" on public.org_members for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner']::public.org_role[]));
create policy "owners remove members" on public.org_members for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner']::public.org_role[]) or user_id = auth.uid());

create policy "owners read invites" on public.org_invites for select to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner']::public.org_role[]));
create policy "owners create invites" on public.org_invites for insert to authenticated with check (public.has_org_role(org_id, auth.uid(), array['owner']::public.org_role[]) and created_by = auth.uid());
create policy "owners delete invites" on public.org_invites for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner']::public.org_role[]));

create policy "members read brand" on public.brand_kits for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "owners update brand" on public.brand_kits for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]));

create policy "members read docs" on public.documents for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "editors write docs" on public.documents for insert to authenticated with check (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]) and created_by = auth.uid());
create policy "editors delete docs" on public.documents for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]));

create policy "members read courses" on public.courses for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "editors create courses" on public.courses for insert to authenticated with check (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]) and created_by = auth.uid());
create policy "editors update courses" on public.courses for update to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]));
create policy "editors delete courses" on public.courses for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]));

create policy "members read versions" on public.course_versions for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "editors add versions" on public.course_versions for insert to authenticated with check (public.has_org_role(org_id, auth.uid(), array['owner','editor']::public.org_role[]) and created_by = auth.uid());

create policy "members read audit" on public.audit_events for select to authenticated using (public.is_org_member(org_id, auth.uid()));
create policy "members add audit" on public.audit_events for insert to authenticated with check (public.is_org_member(org_id, auth.uid()) and actor = auth.uid());

create policy "org files read" on storage.objects for select to authenticated using (bucket_id in ('documents','brand-assets') and public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "org files write" on storage.objects for insert to authenticated with check (bucket_id in ('documents','brand-assets') and public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), array['owner','editor']::public.org_role[]));
create policy "org files delete" on storage.objects for delete to authenticated using (bucket_id in ('documents','brand-assets') and public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), array['owner','editor']::public.org_role[]));