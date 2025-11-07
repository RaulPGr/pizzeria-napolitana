-- Adds timezone offset tracking for reservations
alter table public.reservations
  add column if not exists timezone_offset_minutes integer;
