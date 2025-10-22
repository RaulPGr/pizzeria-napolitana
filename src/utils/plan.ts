// src/utils/plan.ts

export type Plan = 'starter' | 'medium' | 'premium';

export const PLAN: Plan =
  (process.env.NEXT_PUBLIC_PLAN as Plan) ?? 'starter';

function parseEmails(raw: string | undefined | null): string[] {
  const s = (raw || '').trim();
  if (!s) return [];
  return s
    // admite comas, punto y coma y saltos de línea
    .split(/[;,\n]/g)
    .map((e) => e.trim())
    // quita comillas accidentales
    .map((e) => e.replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
    .map((e) => e.toLowerCase())
    .filter(Boolean);
}

// Coma-separados. Ej: "yo@pidelocal.com, dueno@negocio.com"
export const adminEmails = () => parseEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS);

// Diseñadores/superadmins para acceder a opciones ocultas (no público)
export const designAdminEmails = () => parseEmails(process.env.DESIGN_ADMIN_EMAILS);
