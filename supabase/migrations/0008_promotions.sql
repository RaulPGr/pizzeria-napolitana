-- Promotions feature: table + policies

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('percent','fixed')),
  value numeric not null check (value >= 0),
  scope text not null check (scope in ('order','category','product')),
  target_category_id bigint,
  target_product_id bigint,
  min_amount numeric default 0,
  start_date date,
  end_date date,
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope <> 'category' or target_category_id is not null)
    and (scope <> 'product' or target_product_id is not null)
  )
);

create index if not exists idx_promotions_business on public.promotions (business_id);
create index if not exists idx_promotions_active on public.promotions (business_id, active);

create or replace function public.promotions_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
before update on public.promotions
for each row
execute procedure public.promotions_set_updated_at();

alter table public.promotions enable row level security;

drop policy if exists promotions_select on public.promotions;
create policy promotions_select on public.promotions
  for select using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = promotions.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  );

drop policy if exists promotions_insert on public.promotions;
create policy promotions_insert on public.promotions
  for insert with check (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = promotions.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager')
    )
  );

drop policy if exists promotions_update on public.promotions;
create policy promotions_update on public.promotions
  for update using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = promotions.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager')
    )
  );

drop policy if exists promotions_delete on public.promotions;
create policy promotions_delete on public.promotions
  for delete using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = promotions.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager')
    )
  );
