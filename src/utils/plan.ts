// src/utils/plan.ts

export type Plan = 'starter' | 'medium' | 'premium';

export const PLAN: Plan =
  (process.env.NEXT_PUBLIC_PLAN as Plan) ?? 'starter';

// Coma-separados. Ej: "yo@pidelocal.com, dueno@negocio.com"
export const adminEmails = () =>
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// Diseñadores/superadmins para acceder a opciones ocultas (no público)
export const designAdminEmails = () =>
  (process.env.DESIGN_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
