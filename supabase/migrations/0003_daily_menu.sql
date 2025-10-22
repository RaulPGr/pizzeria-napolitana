-- Daily menu support (idempotent)

-- 1) menu_mode enum and column on businesses
do $$
begin
  if not exists (select 1 from pg_type where typname = 'menu_mode') then
    create type public.menu_mode as enum ('fixed','daily');
  end if;
end $$;

alter table if exists public.businesses
  add column if not exists menu_mode public.menu_mode not null default 'fixed';

-- 2) Per-product weekdays availability
create table if not exists public.product_weekdays (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  day smallint not null check (day between 1 and 7), -- ISO: 1=Mon ... 7=Sun
  created_at timestamptz not null default now(),
  unique (product_id, day)
);

create index if not exists idx_product_weekdays_product on public.product_weekdays(product_id);
create index if not exists idx_product_weekdays_day on public.product_weekdays(day);

-- 3) RLS: allow public select by tenant via product.business_id; CRUD by members
alter table public.product_weekdays enable row level security;

-- Public select by tenant header (products in same tenant or legacy null)
drop policy if exists pw_select_public_by_tenant on public.product_weekdays;
create policy pw_select_public_by_tenant on public.product_weekdays
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_weekdays.product_id
        and ((p.business_id is null) or (p.business_id = public._tenant_id_from_header()))
    )
  );

-- Members of the business can CRUD
drop policy if exists pw_crud_members on public.product_weekdays;
create policy pw_crud_members on public.product_weekdays
  for all using (
    exists (
      select 1
      from public.products p
      join public.business_members mm on mm.business_id = p.business_id
      where p.id = product_weekdays.product_id
        and mm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.products p
      join public.business_members mm on mm.business_id = p.business_id
      where p.id = product_weekdays.product_id
        and mm.user_id = auth.uid()
    )
  );

