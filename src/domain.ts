import type { Vacation } from "./types";
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const isOnLeave = (id: string, date: string, vacations: Vacation[]) =>
  vacations.some(
    (v) => v.user_id === id && v.start_date <= date && v.end_date >= date,
  );
export const overlaps = (
  a: { start_date: string; end_date: string },
  b: { start_date: string; end_date: string },
) => a.start_date <= b.end_date && a.end_date >= b.start_date;
export const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleDateString(
    "es-AR",
    { ...options, timeZone: "America/Argentina/Buenos_Aires" },
  );
