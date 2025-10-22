'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewOrderSound() {
  const [enabled, setEnabled] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufRef = useRef<AudioBuffer | null>(null);
  const originalTitleRef = useRef<string>(typeof document !== 'undefined' ? document.title : '');
  const blinkTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('new-order-sound');
      const isOn = stored === 'on';
      setEnabled(isOn);
      enabledRef.current = isOn;
    } catch {}

    try {
      const nstored = localStorage.getItem('new-order-notify');
      setNotifyOn(nstored === 'on');
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
      const ctx: AudioContext = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
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

  async function ensureAudioBuffer() {
    try {
      if (!audioCtxRef.current) {
        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      if (!audioBufRef.current) {
        const res = await fetch('/sounds/new-order.mp3');
        const arr = await res.arrayBuffer();
        audioBufRef.current = await ctx.decodeAudioData(arr);
      }
      return true;
    } catch {
      return false;
    }
  }

  const playSound = async () => {
    const el = audioRef.current;
    try {
      // Prioridad 1: AudioBuffer (más fiable tras gesto previo)
      const ok = await ensureAudioBuffer();
      if (ok && audioCtxRef.current && audioBufRef.current) {
        const ctx = audioCtxRef.current;
        const src = ctx.createBufferSource();
        src.buffer = audioBufRef.current;
        src.connect(ctx.destination);
        src.start(0);
        return;
      }
    } catch {}
    try {
      // Prioridad 2: elemento HTMLAudio
      if (el) {
        el.currentTime = 0;
        await el.play();
        return;
      }
    } catch {}
    // Prioridad 3: beep programático
    beepFallback();
  };

  // Realtime: escuchamos siempre; solo sonamos si está activado
  useEffect(() => {
    const channel = supabase
      .channel('orders-sound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (!enabledRef.current) return;
        try { void playSound(); } catch {}
        if (notifyOn && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification('Nuevo pedido', { body: 'Ha llegado un pedido nuevo.', icon: '/favicon.ico', tag: 'pl-new-order' });
            n.onclick = () => { try { window.focus(); } catch {} };
          } catch {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [notifyOn]);

  // Disparador secundario: evento personalizado desde OrdersClient (siempre registrado)
  useEffect(() => {
    const handler = () => {
      // Sonido si está activado
      if (enabledRef.current) { try { void playSound(); } catch {} }
      // Parpadeo del título siempre
      try { startBlinkTitle('Nuevo pedido', { original: originalTitleRef, timer: blinkTimerRef }); } catch {}
    };
    const onFocus = () => { try { stopBlinkTitle({ original: originalTitleRef, timer: blinkTimerRef }); } catch {} };
    const onVis = () => { if (document.visibilityState === 'visible') onFocus(); };
    window.addEventListener('pl:new-order', handler);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pl:new-order', handler);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      try { stopBlinkTitle({ original: originalTitleRef, timer: blinkTimerRef }); } catch {}
    };
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    try {
      localStorage.setItem('new-order-sound', next ? 'on' : 'off');
    } catch {}
    if (next) void playSound();
  };

  const toggleNotify = async () => {
    const wantOn = !notifyOn;
    if (!('Notification' in window)) return setNotifyOn(false);
    if (wantOn && Notification.permission !== 'granted') {
      try { await Notification.requestPermission(); } catch {}
    }
    const ok = Notification.permission === 'granted' && wantOn;
    setNotifyOn(ok);
    try { localStorage.setItem('new-order-notify', ok ? 'on' : 'off'); } catch {}
    if (ok) {
      try { new Notification('Notificaciones activadas', { body: 'Avisaremos al llegar un pedido.' }); } catch {}
    }
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
      <button
        onClick={toggleNotify}
        className={`ml-2 rounded-full shadow px-4 py-2 text-sm font-medium ${
          notifyOn ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
        }`}
        title={notifyOn ? 'Notificaciones activadas' : 'Activar notificaciones'}
      >
        {notifyOn ? '📣 Notificaciones ON' : '📣 Notificaciones OFF'}
      </button>
      {enabled && (
        <button
          onClick={() => void playSound()}
          className="ml-2 rounded-full bg-white/90 px-3 py-2 text-xs text-gray-700 shadow hover:bg-white"
          title="Probar sonido"
        >
          Probar
        </button>
      )}
    </div>
  );
}

// ===== Helpers de parpadeo del título =====
// Se mantienen fuera de la función para no recrearlos por render.

function startBlinkTitle(message: string, refs: { original: React.MutableRefObject<string>; timer: React.MutableRefObject<number | null>; }) {
  if (typeof document === 'undefined') return;
  // Si ya está parpadeando, reinicia el contador pero no crees otro intervalo
  if (refs.timer.current != null) return;
  if (!refs.original.current) refs.original.current = document.title;
  let shownAlt = false;
  let ticks = 0; // número de cambios de título
  const limit = 12; // ~6 ciclos (original/alerta) si interval=500ms
  const id = window.setInterval(() => {
    try {
      document.title = shownAlt ? refs.original.current : message + ' · ' + refs.original.current;
      shownAlt = !shownAlt;
      ticks++;
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        stopBlinkTitle(refs);
      } else if (ticks >= limit) {
        stopBlinkTitle(refs);
      }
    } catch {
      stopBlinkTitle(refs);
    }
  }, 500);
  refs.timer.current = id as unknown as number;
}

function stopBlinkTitle(refs: { original: React.MutableRefObject<string>; timer: React.MutableRefObject<number | null>; }) {
  if (refs.timer.current != null) {
    try { window.clearInterval(refs.timer.current as unknown as number); } catch {}
    refs.timer.current = null;
  }
  try {
    if (typeof document !== 'undefined' && refs.original.current) document.title = refs.original.current;
  } catch {}
}
