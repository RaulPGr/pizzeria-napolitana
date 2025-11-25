-- Store discount/promotion info on orders

alter table if exists public.orders
  add column if not exists discount_cents integer not null default 0,
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null,
  add column if not exists promotion_name text;

create index if not exists idx_orders_promotion on public.orders (promotion_id);
