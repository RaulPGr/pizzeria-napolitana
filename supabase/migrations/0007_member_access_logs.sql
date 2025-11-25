-- Track last access for business members and keep a history.

alter table if exists public.business_members
  add column if not exists last_access_at timestamptz;

create table if not exists public.business_member_access_logs (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index if not exists idx_member_access_business_time
  on public.business_member_access_logs (business_id, accessed_at desc);

create index if not exists idx_member_access_user_time
  on public.business_member_access_logs (user_id, accessed_at desc);

alter table public.business_member_access_logs enable row level security;

drop policy if exists member_access_logs_select on public.business_member_access_logs;
create policy member_access_logs_select on public.business_member_access_logs
  for select using (
    exists (
      select 1 from public.business_members mm
      where mm.business_id = business_member_access_logs.business_id
        and mm.user_id = auth.uid()
        and mm.role in ('owner','manager','staff')
    )
  );
