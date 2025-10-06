"use client";
import { useEffect, useMemo, useState } from "react";
import { openingHours } from "@/lib/openingHours";
import { genSlots, sameLocalDate } from "@/lib/slots";

export default function PickupTime({
  slotMinutes = 5,
  prepMinutes = 20,
  closeBuffer = 10,
  onChange,
}: {
  slotMinutes?: number;
  prepMinutes?: number;
  closeBuffer?: number;
  onChange?: (v:{date:string; time:string|null}) => void;
}) {
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState<string|null>(null);

  useEffect(() => {
    setDateValue(new Date().toISOString().slice(0,10));
  }, []);

  const slots = useMemo(() => {
    if (!dateValue) return [];
    const [y,m,d] = dateValue.split("-").map(Number);
    return genSlots(new Date(y, m-1, d), openingHours, slotMinutes, prepMinutes, closeBuffer);
  }, [dateValue, slotMinutes, prepMinutes, closeBuffer]);

  useEffect(() => { onChange?.({date:dateValue, time:timeValue}); }, [dateValue, timeValue, onChange]);

  const isToday = dateValue && sameLocalDate(new Date(), new Date(dateValue));

  return (
    <div className="space-y-3">
      <div>
        <label className="block font-semibold mb-1" htmlFor="pickup-date">Fecha</label>
        <input
          id="pickup-date"
          type="date"
          min={new Date().toISOString().slice(0,10)}
          value={dateValue}
          onChange={(e)=>{ setDateValue(e.target.value); setTimeValue(null); }}
          className="w-full max-w-xs rounded-lg border p-2"
        />
      </div>

      <div>
        <label className="block font-semibold mb-1" htmlFor="pickup-time">Hora</label>
        <select
          id="pickup-time"
          disabled={!dateValue || slots.length===0}
          value={timeValue ?? ""}
          onChange={(e)=>setTimeValue(e.target.value)}
          className="w-full max-w-xs rounded-lg border p-2"
        >
          {!dateValue && <option value="">Selecciona una fecha</option>}
          {dateValue && slots.length===0 && <option value="">Sin horas disponibles</option>}
          {slots.map(hm => <option key={hm} value={hm}>{hm}</option>)}
        </select>
        <p className="text-sm text-gray-600 mt-1">
          {isToday ? `Incluye preparación mínima de ${prepMinutes} min y margen antes del cierre.` : "\u00A0"}
        </p>
      </div>
    </div>
  );
}
