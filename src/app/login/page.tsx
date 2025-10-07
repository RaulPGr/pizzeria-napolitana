'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j?.error || 'Error al iniciar sesión');
      return;
    }

    // Ya tenemos las cookies sb-… => al admin
    router.replace('/admin');
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full border p-2 rounded" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full border p-2 rounded" />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button className="w-full bg-emerald-600 text-white py-2 rounded">Entrar</button>
    </form>
  );
}
