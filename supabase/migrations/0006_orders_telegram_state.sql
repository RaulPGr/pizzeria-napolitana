alter table public.orders
  add column if not exists telegram_notified_at timestamptz,
  add column if not exists telegram_notify_errors integer not null default 0,
  add column if not exists telegram_last_error text;

create index if not exists idx_orders_telegram_pending
  on public.orders (created_at)
  where telegram_notified_at is null;
-- comentario de prueba 3