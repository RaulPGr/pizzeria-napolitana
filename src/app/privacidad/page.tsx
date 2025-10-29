export const dynamic = 'force-static';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide text-slate-900">Política de Privacidad</h1>
      <div className="prose prose-sm max-w-none text-slate-700">
        <p>
          Tratamos los datos personales con la finalidad de gestionar pedidos, ofrecer
          soporte y mejorar el servicio. Solo se conservan durante el tiempo necesario para
          cumplir con obligaciones legales y/o la prestación del servicio.
        </p>
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión y otros
          derechos conforme al RGPD contactando con el establecimiento a través de los
          medios indicados en la página de inicio.
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="text-emerald-700 hover:underline">Volver al inicio</Link>
      </div>
    </div>
  );
}
