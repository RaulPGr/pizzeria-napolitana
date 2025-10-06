import type { OpeningHours } from "./openingHours";

const pad2 = (n: number) => String(n).padStart(2, "0");
const hmToMin = (s: string) => { const [h,m] = s.split(":").map(Number); return h*60+m; };
const minToHM = (m: number) => `${pad2(Math.floor(m/60))}:${pad2(m%60)}`;
const roundUp = (m:number, slot:number) => Math.ceil(m/slot)*slot;

export const sameLocalDate = (a: Date, b: Date) =>
  a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

/** Genera HH:MM disponibles para una fecha local concreta */
export function genSlots(
  dateObj: Date,
  openingHours: OpeningHours,
  slotMin = 5,
  prepMin = 20,     // preparación mínima
  closeBuffer = 10  // margen antes del cierre
) {
  const dow = dateObj.getDay();
  const periods = openingHours[dow] || [];
  if (!periods.length) return [];

  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();
  const isToday = sameLocalDate(now, dateObj);
  const earliestToday = roundUp(nowMin + prepMin, slotMin);

  const out: string[] = [];
  for (const p of periods) {
    let start = hmToMin(p.start);
    const end = hmToMin(p.end) - closeBuffer;
    if (end <= start) continue;
    if (isToday) start = Math.max(start, earliestToday);
    for (let t = roundUp(start, slotMin); t <= end; t += slotMin) out.push(minToHM(t));
  }
  return Array.from(new Set(out));
}

export function isValidSlot(
  dateISO: string, timeHM: string,
  opts: { openingHours: OpeningHours; slotMin?:number; prepMin?:number; closeBuffer?:number }
) {
  const { openingHours, slotMin=5, prepMin=20, closeBuffer=10 } = opts;
  const [y,m,d] = dateISO.split("-").map(Number);
  const date = new Date(y, m-1, d);
  return genSlots(date, openingHours, slotMin, prepMin, closeBuffer).includes(timeHM);
}

/** Convierte fecha local (YYYY-MM-DD) + hora (HH:MM) a ISO UTC (para timestamptz) */
export function localDateTimeToUTCISO(dateISO: string, timeHM: string) {
  const [y,m,d] = dateISO.split("-").map(Number);
  const [hh,mm] = timeHM.split(":").map(Number);
  const local = new Date(y, m-1, d, hh, mm, 0, 0);
  return new Date(local.getTime() - local.getTimezoneOffset()*60000).toISOString();
}
