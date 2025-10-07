// src/components/billing/UpgradeCTA.tsx
'use client';

export default function UpgradeCTA() {
  const go = async () => {
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {}
  };

  return (
    <button onClick={go} className="px-4 py-2 rounded bg-emerald-600 text-white">
      Mejorar plan
    </button>
  );
}
