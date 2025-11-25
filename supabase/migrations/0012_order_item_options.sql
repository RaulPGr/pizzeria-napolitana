-- Store selected toppings/options for each order item

create table if not exists public.order_item_options (
  id bigserial primary key,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_id uuid references public.options(id) on delete set null,
  name_snapshot text not null,
  price_delta_snapshot numeric not null default 0,
  group_name_snapshot text,
  business_id uuid references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_item_options_business
  on public.order_item_options (business_id);
create index if not exists idx_order_item_options_order_item
  on public.order_item_options (order_item_id);

alter table public.order_item_options enable row level security;

drop policy if exists order_item_options_member on public.order_item_options;
create policy order_item_options_member on public.order_item_options
  for select using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = public.order_item_options.business_id
        and mm.user_id = auth.uid()
    )
  );

drop policy if exists order_item_options_crud on public.order_item_options;
create policy order_item_options_crud on public.order_item_options
  for all using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = public.order_item_options.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  )
  with check (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = public.order_item_options.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  );
