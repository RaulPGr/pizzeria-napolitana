-- 0004_theme_config.sql
-- Añade columna para configuración de tema por negocio (oculto en panel)

alter table public.businesses
  add column if not exists theme_config jsonb;

comment on column public.businesses.theme_config is 'Opciones de tema (colores y fuentes) para el sitio';

