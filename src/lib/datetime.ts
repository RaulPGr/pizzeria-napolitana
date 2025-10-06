// src/lib/datetime.ts

/**
 * Convierte una fecha (YYYY-MM-DD) + hora (HH:mm) elegidas por el usuario
 * (en HORA LOCAL del navegador) a un ISO string en UTC (terminado en Z).
 */
export function toUTCISOStringFromLocal(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) throw new Error("Fecha u hora vacías");

  // Construimos una Date en hora LOCAL (del navegador)
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0, 0);

  // Restamos el desfase local para obtener UTC
  const utcMs = local.getTime() - local.getTimezoneOffset() * 60000;
  return new Date(utcMs).toISOString(); // => 2025-09-24T12:00:00.000Z
}

/**
 * Muestra una fecha/hora (ISO UTC) en la zona de Madrid, solo HH:mm
 * para la columna "Recogida" del admin.
 */
export function formatPickupHourMadrid(isoUtc: string): string {
  const d = new Date(isoUtc);
  return d.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Si alguna vez quieres fecha + hora completas en el admin.
 */
export function formatDateTimeMadrid(isoUtc: string): string {
  const d = new Date(isoUtc);
  return d.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
