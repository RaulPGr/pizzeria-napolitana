// src/app/menu/loading.tsx
export default function LoadingMenu() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="h-7 w-40 rounded bg-gray-200 animate-pulse mb-6" />

      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-crust bg-white p-4 shadow-sm animate-pulse">
            <div className="h-5 w-1/3 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-5/6 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

