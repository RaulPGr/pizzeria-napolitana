-- Adds table to store restaurant reservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  party_size integer not null check (party_size > 0 and party_size <= 20),
  reserved_at timestamptz not null,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_business_time on public.reservations(business_id, reserved_at);
create index if not exists idx_reservations_created on public.reservations(created_at desc);

alter table public.reservations enable row level security;

drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = reservations.business_id
        and mm.user_id = auth.uid()
    )
  );
