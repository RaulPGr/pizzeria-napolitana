-- Multi-tenant base (idempotent-ish) for PideLocal
-- Safe to run on an existing project. It adds new tables/columns and RLS policies
-- without renombrar tablas ya existentes.

-- 0) Prerequisites
create extension if not exists pgcrypto;

-- 1) Tenants: businesses, member mapping and domains
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                      -- subdominio: ej. "pizzerianapolitana"
  name text not null,
  slogan text,
  description text,
  phone text,
  whatsapp text,
  email text,
  address_line text,
  city text,
  postal_code text,
  lat numeric,
  lng numeric,
  opening_hours jsonb,                            -- estructura por días
  logo_url text,
  hero_url text,
  brand_primary text,
  brand_secondary text,
  social jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.business_domains (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  domain text unique not null                     -- opcional: p.ej. pizzerianapolitana.pidelocal.es
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- 2) Añadir columna business_id a tablas existentes (transición: permite NULL)
alter table if exists public.categories add column if not exists business_id uuid;
alter table if exists public.products  add column if not exists business_id uuid;
alter table if exists public.orders    add column if not exists business_id uuid;
alter table if exists public.order_items add column if not exists business_id uuid;

-- 3) Índices por tenant
create index if not exists idx_categories_business on public.categories(business_id);
create index if not exists idx_products_business   on public.products(business_id);
create index if not exists idx_orders_business     on public.orders(business_id);
create index if not exists idx_order_items_business on public.order_items(business_id);
create index if not exists idx_orders_business_created on public.orders(business_id, created_at desc nulls last);

-- 4) RLS: habilitar
alter table public.businesses      enable row level security;
alter table public.business_members enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.products  enable row level security;
alter table if exists public.orders    enable row level security;
alter table if exists public.order_items enable row level security;

-- Helper: resuelve business_id desde cabecera 'x-tenant-slug'
-- Nota: Supabase expone los headers como JSON en current_setting('request.headers', true)
create or replace function public._tenant_id_from_header()
returns uuid language sql stable as $$
  select b.id
  from public.businesses b
  where lower(b.slug) = lower( coalesce( (current_setting('request.headers', true)::json ->> 'x-tenant-slug'), '' ) )
  limit 1
$$;

-- 5) Políticas RLS

-- 5.1 businesses: sólo miembros (owner/manager) pueden leer/editar su negocio
drop policy if exists "biz_select_own" on public.businesses;
create policy "biz_select_own" on public.businesses
  for select using (
    exists (
      select 1 from public.business_members m
      where m.business_id = businesses.id
        and m.user_id = auth.uid()
        and m.role in ('owner','manager','staff')
    )
  );

drop policy if exists "biz_update_owner_manager" on public.businesses;
create policy "biz_update_owner_manager" on public.businesses
  for update using (
    exists (
      select 1 from public.business_members m
      where m.business_id = businesses.id
        and m.user_id = auth.uid()
        and m.role in ('owner','manager')
    )
  );

-- 5.2 business_members: cada uno ve su fila; owners/managers gestionan miembros de su negocio
drop policy if exists "mem_select_self_or_same_business" on public.business_members;
create policy "mem_select_self_or_same_business" on public.business_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.business_members mm
               where mm.business_id = business_members.business_id
                 and mm.user_id = auth.uid()
                 and mm.role in ('owner','manager'))
  );

drop policy if exists "mem_insert_owner_manager" on public.business_members;
create policy "mem_insert_owner_manager" on public.business_members
  for insert with check (
    exists (select 1 from public.business_members mm
            where mm.business_id = business_members.business_id
              and mm.user_id = auth.uid()
              and mm.role in ('owner','manager'))
  );

drop policy if exists "mem_update_owner_manager" on public.business_members;
create policy "mem_update_owner_manager" on public.business_members
  for update using (
    exists (select 1 from public.business_members mm
            where mm.business_id = business_members.business_id
              and mm.user_id = auth.uid()
              and mm.role in ('owner','manager'))
  );

drop policy if exists "mem_delete_owner_manager" on public.business_members;
create policy "mem_delete_owner_manager" on public.business_members
  for delete using (
    exists (select 1 from public.business_members mm
            where mm.business_id = business_members.business_id
              and mm.user_id = auth.uid()
              and mm.role in ('owner','manager'))
  );

-- 5.3 Catálogo: lectura pública filtrada por business del subdominio; transición: permite NULL
drop policy if exists "cat_select_public_by_tenant" on public.categories;
create policy "cat_select_public_by_tenant" on public.categories
  for select using (
    (business_id is null) or (business_id = public._tenant_id_from_header())
  );

drop policy if exists "prod_select_public_by_tenant" on public.products;
create policy "prod_select_public_by_tenant" on public.products
  for select using (
    (business_id is null) or (business_id = public._tenant_id_from_header())
  );

-- 5.4 Escrituras catálogo: sólo miembros del negocio
drop policy if exists "cat_crud_members" on public.categories;
create policy "cat_crud_members" on public.categories
  for all using (
    exists (select 1 from public.business_members mm
            where mm.business_id = categories.business_id
              and mm.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.business_members mm
            where mm.business_id = categories.business_id
              and mm.user_id = auth.uid())
  );

drop policy if exists "prod_crud_members" on public.products;
create policy "prod_crud_members" on public.products
  for all using (
    exists (select 1 from public.business_members mm
            where mm.business_id = products.business_id
              and mm.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.business_members mm
            where mm.business_id = products.business_id
              and mm.user_id = auth.uid())
  );

-- 5.5 Pedidos (orders + order_items): sólo miembros del negocio
drop policy if exists "orders_crud_members" on public.orders;
create policy "orders_crud_members" on public.orders
  for all using (
    (business_id is null) or exists (
      select 1 from public.business_members mm
      where mm.business_id = orders.business_id and mm.user_id = auth.uid()
    )
  ) with check (
    exists (select 1 from public.business_members mm
            where mm.business_id = orders.business_id and mm.user_id = auth.uid())
  );

drop policy if exists "order_items_crud_members" on public.order_items;
create policy "order_items_crud_members" on public.order_items
  for all using (
    (business_id is null) or exists (
      select 1 from public.business_members mm
      where mm.business_id = order_items.business_id and mm.user_id = auth.uid()
    )
  ) with check (
    exists (select 1 from public.business_members mm
            where mm.business_id = order_items.business_id and mm.user_id = auth.uid())
  );

-- 6) Storage bucket y policies
-- Bucket público para assets; carpeta por tenant: /businesses/{business_id}/...
-- Nota: en algunas versiones el nombre del parámetro es distinto.
-- Usamos llamada posicional (nombre, es_publico):
select storage.create_bucket('public-assets', true)
where not exists (select 1 from storage.buckets where id = 'public-assets');

-- Lectura pública del bucket
drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
  for select using (bucket_id = 'public-assets');

-- Escritura sólo para miembros del negocio indicado en la ruta businesses/<uuid>/...
drop policy if exists "storage_members_write" on storage.objects;
create policy "storage_members_write" on storage.objects
  for insert with check (
    bucket_id = 'public-assets' and
    (split_part(name, '/', 1) = 'businesses') and
    (split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$') and
    exists (
      select 1 from public.business_members mm
      where mm.user_id = auth.uid()
        and mm.business_id = (split_part(name, '/', 2))::uuid
    )
  );

drop policy if exists "storage_members_update" on storage.objects;
create policy "storage_members_update" on storage.objects
  for update using (
    bucket_id = 'public-assets' and
    (split_part(name, '/', 1) = 'businesses') and
    (split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$') and
    exists (
      select 1 from public.business_members mm
      where mm.user_id = auth.uid()
        and mm.business_id = (split_part(name, '/', 2))::uuid
    )
  );

drop policy if exists "storage_members_delete" on storage.objects;
create policy "storage_members_delete" on storage.objects
  for delete using (
    bucket_id = 'public-assets' and
    (split_part(name, '/', 1) = 'businesses') and
    (split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$') and
    exists (
      select 1 from public.business_members mm
      where mm.user_id = auth.uid()
        and mm.business_id = (split_part(name, '/', 2))::uuid
    )
  );

-- 7) Sugerencia de datos de transición (opcional):
-- INSERT INTO public.businesses (slug, name) VALUES ('pizzerianapolitana','Pizzeria napolitana')
--   ON CONFLICT (slug) DO UPDATE SET name=excluded.name;
-- UPDATE public.categories SET business_id = (select id from public.businesses where slug='pizzerianapolitana') where business_id is null;
-- UPDATE public.products  SET business_id = (select id from public.businesses where slug='pizzerianapolitana') where business_id is null;
