alter table public.brand_kits add column id uuid default gen_random_uuid();
alter table public.brand_kits add column slot text not null default 'A';
alter table public.brand_kits add column name text not null default 'Brand kit A';
alter table public.brand_kits alter column id set not null;
alter table public.brand_kits drop constraint brand_kits_pkey;
alter table public.brand_kits add primary key (id);
alter table public.brand_kits add constraint brand_kits_org_slot_unique unique (org_id, slot);
alter table public.brand_kits add constraint brand_kits_slot_check check (slot in ('A', 'B', 'C', 'D'));

insert into public.brand_kits (org_id, slot, name, logo_url, primary_color, accent_color, background_color, text_color, heading_font, body_font, intro_text, outro_text, voice)
select a.org_id, s.slot, 'Brand kit ' || s.slot, a.logo_url, a.primary_color, a.accent_color, a.background_color, a.text_color, a.heading_font, a.body_font, a.intro_text, a.outro_text, a.voice
from public.brand_kits a
cross join (values ('B'), ('C'), ('D')) as s(slot)
where a.slot = 'A';

alter table public.courses add column brand_kit_id uuid references public.brand_kits(id) on delete set null;
update public.courses c
set brand_kit_id = b.id
from public.brand_kits b
where b.org_id = c.org_id and b.slot = 'A' and c.brand_kit_id is null;
create index courses_brand_kit_id_idx on public.courses(brand_kit_id);

create or replace function public.create_organization(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if length(trim(_name)) = 0 then raise exception 'name required'; end if;
  insert into public.organizations(name, created_by) values (trim(_name), _uid) returning id into _id;
  insert into public.org_members(org_id, user_id, email, role) values (_id, _uid, auth.jwt()->>'email', 'owner');
  insert into public.brand_kits(org_id, slot, name) values
    (_id, 'A', 'Brand kit A'),
    (_id, 'B', 'Brand kit B'),
    (_id, 'C', 'Brand kit C'),
    (_id, 'D', 'Brand kit D');
  return _id;
end $$;