"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

function parseHashParams(): Record<string,string> {
  try {
    const h = (typeof window !== 'undefined' ? window.location.hash : '') || '';
    const s = h.startsWith('#') ? h.slice(1) : h;
    const out: Record<string,string> = {};
    s.split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
  } catch { return {}; }
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'idle'|'auth'|'ready'|'saving'|'done'|'error'>('idle');
  const [message, setMessage] = useState<string>("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  // Establece sesión desde el enlace de email (soporta hash tokens o code)
  useEffect(() => {
    (async () => {
      try {
        setStatus('auth');
        // 1) Soportar formato ?code= (PKCE)
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus('ready'); setMessage(""); return;
        }
        // 2) Soportar formato #access_token=...&refresh_token=...
        const hash = parseHashParams();
        if (hash.access_token && hash.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.access_token,
            refresh_token: hash.refresh_token,
          } as any);
          if (error) throw error;
          setStatus('ready'); setMessage(""); return;
        }
        // Si no hay tokens, dejamos la página para que el usuario vuelva a pedir enlace
        setStatus('error'); setMessage('Enlace inválido o incompleto. Vuelve a solicitar el correo de recuperación.');
      } catch (e: any) {
        setStatus('error'); setMessage(e?.message || 'No se pudo validar el enlace');
      }
    })();
  }, []);

  const canSave = useMemo(() => {
    return pwd.length >= 6 && pwd === pwd2 && status === 'ready';
  }, [pwd, pwd2, status]);

  async function onSave() {
    try {
      if (!canSave) return;
      setStatus('saving'); setMessage("");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setStatus('done'); setMessage('Contraseña actualizada. Ya puedes entrar con tu email y contraseña.');
    } catch (e: any) {
      setStatus('ready'); setMessage(e?.message || 'No se pudo actualizar la contraseña');
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 text-2xl font-semibold">Establecer nueva contraseña</h1>

      {status === 'auth' && (
        <div className="rounded border bg-white p-3 text-sm">Validando enlace…</div>
      )}

      {(status === 'ready' || status === 'saving' || status === 'done' || status === 'error') && (
        <div className="space-y-4 rounded border bg-white p-4 shadow-sm">
          {status !== 'done' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Nueva contraseña</label>
                <input type="password" className="w-full rounded border px-3 py-2" value={pwd} onChange={(e)=>setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Repite la contraseña</label>
                <input type="password" className="w-full rounded border px-3 py-2" value={pwd2} onChange={(e)=>setPwd2(e.target.value)} />
              </div>
              <button onClick={onSave} disabled={!canSave || status==='saving'} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">
                {status==='saving' ? 'Guardando…' : 'Guardar contraseña'}
              </button>
              <div className="text-xs text-gray-600">Si este enlace falla, vuelve a solicitar "Olvidé mi contraseña" desde la pantalla de acceso.</div>
            </>
          )}

          {status === 'done' && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </div>
          )}

          {message && (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 text-sm">{message}</div>
          )}
        </div>
      )}
    </main>
  );
}
