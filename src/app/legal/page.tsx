export const dynamic = 'force-static';

import Link from 'next/link';

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide text-slate-900">Aviso Legal</h1>
      <div className="prose prose-sm max-w-none text-slate-700">
        <p>
          Este sitio web es operado por el titular del negocio. La información de
          contacto y los datos identificativos del establecimiento se muestran en la
          página de inicio y en la sección de contacto.
        </p>
        <p>
          El uso de esta web implica la aceptación de las condiciones de uso, así como
          de la política de privacidad y la política de cookies publicadas.
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="text-emerald-700 hover:underline">Volver al inicio</Link>
      </div>
    </div>
  );
}
