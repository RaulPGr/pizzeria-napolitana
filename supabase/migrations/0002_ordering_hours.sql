-- Add ordering_hours to businesses (idempotent)
alter table if exists public.businesses
  add column if not exists ordering_hours jsonb;

-- No extra RLS needed; shares same row policies as businesses

