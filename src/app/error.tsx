"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-brand-chalk flex items-center justify-center">
      <div className="text-center space-y-3 p-6">
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Ha ocurrido un problema al cargar la página</h1>
        <p className="text-sm text-gray-600">Pulsa para intentarlo de nuevo. Si persiste, recarga la página.</p>
        <button onClick={() => reset()} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Reintentar</button>
      </div>
    </div>
  );
}
