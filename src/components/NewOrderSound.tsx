'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Usa tus variables públicas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente en el navegador
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function NewOrderSound() {
  const [enabled, setEnabled] = useState(false);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Preload audio + lee preferencia guardada
  useEffect(() => {
    try {
      const stored = localStorage.getItem('new-order-sound');
      setEnabled(stored === 'on');
    } catch {}
    setNotifPermission(typeof Notification !== 'undefined' ? Notification.permission : 'default');

    const el = new Audio('/sounds/new-order.mp3');
    el.preload = 'auto';
    audioRef.current = el;
  }, []);

  const beepFallback = async () => {
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // sin fallback
    }
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

  // Suscripción en tiempo real: INSERT (nuevo pedido) y UPDATE (pasa a pagado)
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('orders-sound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          playSound();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Nuevo pedido', {
              body: `Cliente: ${payload.new?.customer_name ?? ''} · Total: ${
                (payload.new?.total_cents ?? 0) / 100
              } €`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const oldRow: any = payload.old;
          const newRow: any = payload.new;
          if (oldRow?.payment_status !== 'paid' && newRow?.payment_status === 'paid') {
            playSound();
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Pago confirmado', {
                body: `Pedido ${newRow?.code ?? newRow?.id} pagado`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem('new-order-sound', next ? 'on' : 'off');
    } catch {}

    if (
      next &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      try {
        const p = await Notification.requestPermission();
        setNotifPermission(p);
      } catch {}
    }

    // Sonidito de confirmación al activar
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

      {enabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission !== 'granted' && (
          <div className="mt-2 text-xs text-gray-600 bg-white/90 rounded px-2 py-1 shadow">
            Activa las notificaciones del navegador para avisos en escritorio.
          </div>
        )}
    </div>
  );
}
