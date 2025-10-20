# Despliegue en Vercel (Subdominio)

Esta guía deja el proyecto listo para desplegar en Vercel bajo tu subdominio.

## 1) Requisitos
- Node.js 20+ y npm.
- Proyecto Supabase con: URL, `anon key`, `service role`.
- Bucket público en Supabase Storage (por defecto `product-images`).
- Cuenta en Vercel y acceso al DNS de tu dominio.

## 2) Variables de entorno
Rellena `.env.local` tomando como base `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_PLAN=starter   # starter o medium
NEXT_PUBLIC_ADMIN_EMAILS=  # correo1@...,correo2@...
NEXT_PUBLIC_STORAGE_BUCKET=product-images
```

Comprobación rápida local: `npm run dev` y abre `/api/env-check` → `{ ok: true, hasUrl: true, hasAnon: true, hasServiceRole: true }`.

## 3) Vercel: crear proyecto
Puedes hacerlo por UI (web) o CLI.

### Opción A — UI
1. Entra a https://vercel.com/new e importa el repo.
2. Framework: Next.js (detectado automáticamente).
3. Build: `npm run build` (por defecto). Node 20 está forzado en `vercel.json`.
4. Añade todas las variables anteriores en “Environment Variables”. No marques `SUPABASE_SERVICE_ROLE_KEY` como pública.
5. Deploy inicial.

### Opción B — CLI
1. Instala CLI: `npm i -g vercel` e inicia sesión: `vercel login`.
2. En el directorio del proyecto:
   - `vercel link`  (elige scope y proyecto)
   - `vercel env add` para cada variable (o `vercel env pull` si ya existen)
   - `vercel --prod`

## 4) Subdominio propio
1. En Vercel → Project → Settings → Domains → `subdominio.tudominio.com`.
2. Vercel te mostrará un registro DNS tipo CNAME apuntando a `cname.vercel-dns.com`.
3. Crea ese CNAME en tu proveedor DNS. Espera propagación (normalmente minutos hasta 1–2h).
4. Cuando el dominio resuelva, actualiza `NEXT_PUBLIC_SITE_URL` a `https://subdominio.tudominio.com` y redeploy.

## 5) Checklist de Supabase
- Tablas usadas por la app: `products`, `categories`, `orders`, `order_items`, `settings`.
- Bucket `product-images` público (o el que definas en `NEXT_PUBLIC_STORAGE_BUCKET`).
- Fila `settings.id = 1` con `allowed_payment_methods` si quieres gestionarlo desde panel; si no, la API devuelve un valor por defecto.

## 6) Panel /admin (opcional)
Para proteger `/admin`, renombra `middleware.off.ts` → `middleware.ts` y define `NEXT_PUBLIC_ADMIN_EMAILS`.

## 7) Verificaciones post‑deploy
- `https://TU_DOMINIO/api/env-check` → debe devolver `ok: true` y `has* = true`.
- Crear/editar productos (subida de imagen) → confirma que el bucket es público y el nombre coincide.

## Notas
- `next.config.ts` ignora errores de ESLint en build.
- `vercel.json` fija Node.js 20 para funciones.

