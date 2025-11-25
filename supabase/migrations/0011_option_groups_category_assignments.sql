-- Allow assigning reusable option groups to entire categories

create table if not exists public.category_option_groups (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  group_id uuid not null references public.option_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint category_option_groups_unique unique (category_id, group_id)
);

create index if not exists idx_cat_option_groups_business
  on public.category_option_groups (business_id);

create index if not exists idx_cat_option_groups_category
  on public.category_option_groups (category_id);

create index if not exists idx_cat_option_groups_group
  on public.category_option_groups (group_id);

alter table public.category_option_groups enable row level security;

drop policy if exists category_option_groups_select on public.category_option_groups;
create policy category_option_groups_select on public.category_option_groups
  for select using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = category_option_groups.business_id
        and mm.user_id = auth.uid()
    )
  );

drop policy if exists category_option_groups_crud on public.category_option_groups;
create policy category_option_groups_crud on public.category_option_groups
  for all using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = category_option_groups.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  )
  with check (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = category_option_groups.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  );
