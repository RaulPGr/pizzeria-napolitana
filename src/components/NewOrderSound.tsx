'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewOrderSound() {
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('new-order-sound');
      const isOn = stored === 'on';
      setEnabled(isOn);
      enabledRef.current = isOn;
    } catch {}

    // Crear elemento <audio> real en el DOM para máxima compatibilidad
    try {
      const el = document.createElement('audio');
      el.src = '/sounds/new-order.mp3';
      el.preload = 'auto';
      el.controls = false;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      audioRef.current = el as HTMLAudioElement;
      try { el.load(); } catch {}
      return () => { try { el.pause(); } catch {}; try { el.remove(); } catch {}; };
    } catch {
      // fallback: no DOM available
    }
  }, []);

  const beepFallback = () => {
    try {
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
      osc.stop(ctx.currentTime + 1.0);
    } catch {}
  };

  const playSound = () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(beepFallback);
    } catch {
      beepFallback();
    }
  };

  // Realtime: escuchamos siempre; solo sonamos si está activado
  useEffect(() => {
    const channel = supabase
      .channel('orders-sound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (!enabledRef.current) return;
        try { playSound(); } catch {}
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Disparador secundario: evento personalizado desde OrdersClient (siempre registrado)
  useEffect(() => {
    const handler = () => { if (enabledRef.current) { try { playSound(); } catch {} } };
    window.addEventListener('pl:new-order', handler);
    return () => { window.removeEventListener('pl:new-order', handler); };
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    try {
      localStorage.setItem('new-order-sound', next ? 'on' : 'off');
    } catch {}
    if (next) playSound();
  };

  return (
    <div className="fixed z-50 bottom-6 right-6">
      <button
        onClick={toggle}
        className={`rounded-full shadow px-4 py-2 text-sm font-medium ${
          enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
        }`}
        title={enabled ? 'Sonido activado' : 'Sonido desactivado'}
      >
        {enabled ? '🔔 Sonido ON' : '🔕 Sonido OFF'}
      </button>
      {enabled && (
        <button
          onClick={playSound}
          className="ml-2 rounded-full bg-white/90 px-3 py-2 text-xs text-gray-700 shadow hover:bg-white"
          title="Probar sonido"
        >
          Probar
        </button>
      )}
    </div>
  );
}
