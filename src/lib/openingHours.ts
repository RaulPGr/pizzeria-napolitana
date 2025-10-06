// 0=Dom, 1=Lun, ..., 6=Sáb
export type Period = { start: string; end: string }; // "HH:MM"
export type OpeningHours = { [dow: number]: Period[] };

export const openingHours: OpeningHours = {
  0: [ { start: "12:00", end: "16:00" }, { start: "20:00", end: "23:00" } ],
  1: [ { start: "12:00", end: "16:00" }, { start: "20:00", end: "23:00" } ],
  2: [ { start: "12:00", end: "16:00" }, { start: "20:00", end: "23:00" } ],
  3: [ { start: "12:00", end: "16:00" }, { start: "20:00", end: "23:00" } ],
  4: [ { start: "12:00", end: "16:00" }, { start: "20:00", end: "23:00" } ],
  5: [ { start: "12:00", end: "16:30" }, { start: "20:00", end: "23:30" } ],
  6: [ { start: "12:00", end: "16:30" }, { start: "20:00", end: "23:30" } ],
};
