// src/app/api/logout/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

/**
 * Elimina de forma segura las cookies de sesión que pueda estar usando la app.
 * Añade o quita nombres según tu caso.
 */
const SESSION_COOKIES = [
  "session",           // cookie propia de la app (si la usas)
  "sb-access-token",   // Supabase (auth helpers)
  "sb-refresh-token",  // Supabase (auth helpers)
  "sb:token",          // variantes antiguas
];

async function handleLogout() {
  const cookieStore = await cookies(); // Next.js 15: cookies() devuelve una Promesa

  for (const name of SESSION_COOKIES) {
    try {
      if (cookieStore.get(name)) {
        cookieStore.set(name, "", { expires: new Date(0), path: "/" });
      }
    } catch {
      // Evita romperse si el runtime no permite set-cookie en este contexto
    }
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(_req: NextRequest) {
  return handleLogout();
}

// Opcionalmente admite GET para facilitar pruebas desde el navegador
export async function GET(_req: NextRequest) {
  return handleLogout();
}
