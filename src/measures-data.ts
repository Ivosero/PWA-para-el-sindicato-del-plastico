import { demo, supabase } from "./data";
import type { Profile } from "./types";
import {
  validateReport,
  type Measure,
  type AdhesionReport,
} from "./measures-domain";
export {
  summarize,
  validateReport,
  type Measure,
  type AdhesionReport,
} from "./measures-domain";
type Store = { measures: Measure[]; reports: AdhesionReport[] };
const key = "plastico-measures-v1";
function local(): Store {
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved) as Store;
  const id = "measure-demo-1";
  const store: Store = {
    measures: [
      {
        id,
        title: "Jornada de reclamo por condiciones de trabajo",
        date: "2026-11-18",
        description:
          "Medida ficticia para explorar la carga y el análisis de adhesión por edificio.",
        closed: false,
        buildings: [
          { name: "Sede Central", reporter_ids: ["d1", "d2", "d5"] },
          { name: "Planta Norte", reporter_ids: ["d3", "d6"] },
          { name: "Planta Sur", reporter_ids: ["d4", "d7"] },
        ],
      },
    ],
    reports: [
      {
        id: "report-demo-norte",
        measure_id: id,
        building: "Planta Norte",
        total: 80,
        adherents: 52,
        user_id: "d3",
        updated_at: "2026-11-11T18:00:00-03:00",
      },
    ],
  };
  localStorage.setItem(key, JSON.stringify(store));
  return store;
}
function canReport(measure: Measure, building: string, actor: Profile) {
  return (
    actor.active &&
    actor.role === "delegado" &&
    measure.buildings.some(
      (b) => b.name === building && b.reporter_ids.includes(actor.id),
    )
  );
}
export async function loadMeasures(actor: Profile): Promise<Store> {
  if (demo) {
    const store = local();
    return structuredClone({
      measures: store.measures,
      reports:
        actor.role === "delegado"
          ? store.reports.filter((r) =>
              store.measures.some(
                (m) => m.id === r.measure_id && canReport(m, r.building, actor),
              ),
            )
          : store.reports,
    });
  }
  const [m, r] = await Promise.all([
    supabase!
      .from("industrial_measures")
      .select("*")
      .order("date", { ascending: false }),
    supabase!.from("adhesion_reports").select("*"),
  ]);
  if (m.error || r.error)
    throw new Error(
      "No se pudo cargar el módulo. Verificá la conexión y la migración de medidas gremiales.",
    );
  return { measures: m.data as Measure[], reports: r.data as AdhesionReport[] };
}
export async function createMeasure(measure: Measure, actor: Profile) {
  if (!actor.active || actor.role === "delegado")
    throw new Error("Solo Secretaría y Administración pueden crear medidas.");
  if (
    measure.title.trim().length < 3 ||
    measure.title.length > 250 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(measure.date) ||
    !measure.buildings.length
  )
    throw new Error("Completá el título, la fecha y al menos un edificio.");
  if (demo) {
    const store = local();
    store.measures.unshift(structuredClone(measure));
    localStorage.setItem(key, JSON.stringify(store));
    return;
  }
  const { error } = await supabase!.from("industrial_measures").insert(measure);
  if (error) throw new Error(error.message);
}
export async function closeMeasure(id: string, actor: Profile) {
  if (!actor.active || actor.role === "delegado")
    throw new Error("No tenés permisos para cerrar medidas.");
  if (demo) {
    const store = local();
    const m = store.measures.find((m) => m.id === id);
    if (!m) throw new Error("Medida inexistente.");
    m.closed = true;
    localStorage.setItem(key, JSON.stringify(store));
    return;
  }
  const { error } = await supabase!
    .from("industrial_measures")
    .update({ closed: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
export async function saveAdhesion(
  input: {
    measure_id: string;
    building: string;
    total: number;
    adherents: number;
  },
  actor: Profile,
) {
  validateReport(input.total, input.adherents);
  if (demo) {
    const store = local(),
      measure = store.measures.find((m) => m.id === input.measure_id);
    if (!measure || !canReport(measure, input.building, actor))
      throw new Error("No tenés un edificio asignado para esta medida.");
    if (measure.closed)
      throw new Error("La medida está cerrada y ya no admite cambios.");
    const previous = store.reports.find(
      (r) => r.measure_id === input.measure_id && r.building === input.building,
    );
    const report = {
      ...input,
      id: previous?.id || crypto.randomUUID(),
      user_id: actor.id,
      updated_at: new Date().toISOString(),
    };
    store.reports = store.reports.filter(
      (r) =>
        !(r.measure_id === input.measure_id && r.building === input.building),
    );
    store.reports.push(report);
    localStorage.setItem(key, JSON.stringify(store));
    return;
  }
  const { error } = await supabase!
    .from("adhesion_reports")
    .upsert(
      { ...input, user_id: actor.id, updated_at: new Date().toISOString() },
      { onConflict: "measure_id,building" },
    );
  if (error) throw new Error(error.message);
}
