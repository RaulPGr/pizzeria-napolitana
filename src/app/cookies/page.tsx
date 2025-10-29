export const dynamic = 'force-static';

import Link from 'next/link';

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide text-slate-900">Política de Cookies</h1>
      <div className="prose prose-sm max-w-none text-slate-700">
        <p>
          Utilizamos cookies técnicas necesarias para el funcionamiento de la web y, en
          su caso, cookies estadísticas/analíticas para mejorar la experiencia. Puedes
          configurar tu navegador para bloquear o eliminar cookies.
        </p>
        <p>
          Al continuar navegando aceptas el uso de cookies conforme a esta política.
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="text-emerald-700 hover:underline">Volver al inicio</Link>
      </div>
    </div>
  );
}
