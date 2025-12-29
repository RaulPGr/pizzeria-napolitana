-- Flexible reservations config (zones, slots, rules)

alter table public.businesses
  add column if not exists reservations_zones jsonb,
  add column if not exists reservations_slots jsonb,
  add column if not exists reservations_lead_hours integer,
  add column if not exists reservations_max_days integer,
  add column if not exists reservations_auto_confirm boolean,
  add column if not exists reservations_blocked_dates jsonb;

comment on column public.businesses.reservations_zones is 'Array de zonas {name, capacity} (p.ej. Interior/Terraza). Opcional.';
comment on column public.businesses.reservations_slots is 'Array de franjas {from, to, capacity} en formato HH:MM. Opcional.';
comment on column public.businesses.reservations_lead_hours is 'Antelacion minima en horas para reservar. Opcional.';
comment on column public.businesses.reservations_max_days is 'Maximo de dias de antelacion respecto a hoy. Opcional.';
comment on column public.businesses.reservations_auto_confirm is 'Si true y hay cupo, confirma automaticamente; si false, deja en pending.';
comment on column public.businesses.reservations_blocked_dates is 'Array de fechas YYYY-MM-DD sin reservas (bloqueos puntuales).';
