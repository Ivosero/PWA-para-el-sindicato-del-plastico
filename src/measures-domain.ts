export type Scope = { name: string; reporter_ids: string[] };
export type Measure = {
  id: string;
  title: string;
  date: string;
  description: string;
  closed: boolean;
  buildings: Scope[];
};
export type AdhesionReport = {
  id: string;
  measure_id: string;
  building: string;
  total: number;
  adherents: number;
  user_id: string;
  updated_at: string;
};
export function validateReport(total: number, adherents: number) {
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1_000_000)
    throw new Error("El total debe ser un entero entre 1 y 1.000.000.");
  if (!Number.isSafeInteger(adherents) || adherents < 0 || adherents > total)
    throw new Error(
      "La cantidad de adherentes debe ser un entero entre cero y el total.",
    );
}
export function summarize(measure: Measure, reports: AdhesionReport[]) {
  const rows = measure.buildings.map((b) => ({
    building: b.name,
    report: reports.find(
      (r) => r.measure_id === measure.id && r.building === b.name,
    ),
  }));
  const received = rows.filter((r) => r.report);
  const total = received.reduce((s, r) => s + r.report!.total, 0),
    adherents = received.reduce((s, r) => s + r.report!.adherents, 0);
  return {
    rows,
    total,
    adherents,
    notAdhering: total - adherents,
    received: received.length,
    pending: rows.length - received.length,
    rate: total ? (adherents / total) * 100 : null,
    coverage: rows.length ? (received.length / rows.length) * 100 : 0,
  };
}
