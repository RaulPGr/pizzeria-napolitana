'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewOrderSound() {
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('new-order-sound');
      setEnabled(stored === 'on');
    } catch {}

    const el = new Audio('/sounds/new-order.mp3');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.volume = 1.0;
    el.preload = 'auto';
    audioRef.current = el;
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

  // Solo INSERT en orders
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('orders-sound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        try {
          playSound();
        } catch (e) {
          // ignore
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
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
