import type { FormEvent } from "react";
import { Modal } from "./components";
import type { Data, Profile, Row, Table } from "./types";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  optional?: boolean;
};
const fields: Partial<Record<Table, Field[]>> = {
  vacations: [
    { key: "start_date", label: "Desde", type: "date" },
    { key: "end_date", label: "Hasta", type: "date" },
  ],
  responses: [
    { key: "status", label: "Respuesta", options: ["yes", "no"] },
    {
      key: "reason",
      label: "Justificación (obligatoria si no asiste)",
      type: "textarea",
      optional: true,
    },
  ],
  members: [
    { key: "first_name", label: "Nombre" },
    { key: "last_name", label: "Apellido" },
    { key: "file_number", label: "Número de legajo" },
    { key: "building", label: "Edificio" },
    { key: "area", label: "Área" },
    { key: "position", label: "Cargo" },
    { key: "management", label: "Gerencia" },
    { key: "start_time", label: "Hora de ingreso", type: "time" },
    { key: "end_time", label: "Hora de salida", type: "time" },
    { key: "phone", label: "Teléfono de contacto", type: "tel" },
  ],
  events: [
    { key: "title", label: "Título" },
    {
      key: "category",
      label: "Tipo",
      options: ["Plenario", "Formación", "Encuentro", "Asamblea", "Comunicado"],
    },
    { key: "date", label: "Fecha y hora (Argentina)", type: "datetime-local" },
    { key: "location", label: "Lugar" },
    { key: "description", label: "Descripción", type: "textarea" },
    { key: "urgent", label: "Destacar como importante", type: "checkbox" },
  ],
  benefits: [
    {
      key: "category",
      label: "Categoría",
      options: ["Turismo", "Obra social", "Gimnasio", "Recreación", "Otros"],
    },
    { key: "title", label: "Título" },
    { key: "description", label: "Resumen" },
    { key: "detail", label: "Información y requisitos", type: "textarea" },
    { key: "contact", label: "Contacto o enlace oficial", optional: true },
  ],
  settings: [
    { key: "name", label: "Nombre de la organización" },
    { key: "subtitle", label: "Nombre del espacio" },
    { key: "contact", label: "Contacto de Secretaría" },
  ],
  profiles: [
    { key: "name", label: "Nombre y apellido" },
    { key: "building", label: "Edificio asignado" },
    { key: "start_time", label: "Hora de ingreso", type: "time" },
    { key: "end_time", label: "Hora de salida", type: "time" },
    { key: "phone", label: "Teléfono", type: "tel" },
  ],
};
export function Editor({
  table,
  row,
  actor,
  onClose,
  onSave,
  busy,
}: {
  table: Table;
  row?: Row;
  actor: Profile;
  onClose: () => void;
  onSave: (row: Row) => Promise<void>;
  busy: boolean;
}) {
  const list = [...(fields[table] || [])];
  if (table === "profiles" && actor.role === "admin")
    list.push(
      {
        key: "role",
        label: "Rol",
        options: ["delegado", "secretario", "admin"],
      },
      { key: "active", label: "Cuenta habilitada", type: "checkbox" },
    );
  const current = (row || {}) as unknown as Record<string, unknown>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value: Record<string, unknown> = {
      ...current,
      id: row?.id || crypto.randomUUID(),
    };
    for (const f of list) {
      value[f.key] =
        f.type === "checkbox"
          ? form.has(f.key)
          : String(form.get(f.key) || "").trim();
    }
    if (table === "events")
      value.date = new Date(String(value.date) + "-03:00").toISOString();
    void onSave(value as Row);
  };
  return (
    <Modal
      title={`${row ? "Editar" : "Crear"} ${table === "members" ? "afiliado" : table === "events" ? "convocatoria" : table === "benefits" ? "beneficio" : table === "settings" ? "organización" : table === "responses" ? "respuesta" : table === "vacations" ? "vacaciones" : "perfil"}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-grid">
        {list.map((f) => {
          let value = current[f.key] ?? "";
          if (f.type === "datetime-local" && value) {
            const d = new Date(String(value));
            value = new Date(d.getTime() - 3 * 3600000)
              .toISOString()
              .slice(0, 16);
          }
          return (
            <label
              key={f.key}
              className={
                f.type === "textarea"
                  ? "span-2"
                  : f.type === "checkbox"
                    ? "checkbox span-2"
                    : ""
              }
            >
              {f.type !== "checkbox" && f.label}
              {f.options ? (
                <select
                  name={f.key}
                  defaultValue={String(value) || f.options[0]}
                >
                  {f.options.map((v) => (
                    <option key={v} value={v}>
                      {v === "yes"
                        ? "Asistirá"
                        : v === "no"
                          ? "No asistirá"
                          : v}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  required={!f.optional}
                  maxLength={5000}
                  defaultValue={String(value)}
                  rows={4}
                />
              ) : f.type === "checkbox" ? (
                <>
                  <input
                    type="checkbox"
                    name={f.key}
                    defaultChecked={Boolean(value)}
                  />
                  {f.label}
                </>
              ) : (
                <input
                  name={f.key}
                  type={f.type || "text"}
                  required={!f.optional}
                  maxLength={250}
                  defaultValue={String(value)}
                />
              )}
            </label>
          );
        })}
        <div className="form-actions span-2">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={busy}>
            {busy
              ? "Guardando…"
              : table === "events"
                ? "Guardar y notificar"
                : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function AttendanceForm({
  title,
  onClose,
  onSave,
  busy,
}: {
  title: string;
  onClose: () => void;
  onSave: (reason: string) => void;
  busy: boolean;
}) {
  return (
    <Modal title="Justificar inasistencia" onClose={onClose}>
      <p className="muted">{title}</p>
      <p>
        Contanos el motivo para que Secretaría pueda organizar la convocatoria.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const reason = String(
            new FormData(e.currentTarget).get("reason") || "",
          ).trim();
          if (reason.length >= 10) onSave(reason);
        }}
      >
        <label>
          Motivo de la inasistencia
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1500}
            rows={5}
            placeholder="Escribí el motivo (al menos 10 caracteres)"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Volver
          </button>
          <button disabled={busy}>Enviar justificación</button>
        </div>
      </form>
    </Modal>
  );
}
export function VacationForm({
  actor,
  data,
  onClose,
  onSave,
  busy,
}: {
  actor: Profile;
  data: Data;
  onClose: () => void;
  onSave: (row: Row) => void;
  busy: boolean;
}) {
  return (
    <Modal title="Informar vacaciones" onClose={onClose}>
      <p className="muted">
        Las fechas son inclusivas. Solo vos, Secretaría y Administración podrán
        consultarlas.
      </p>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({
            id: crypto.randomUUID(),
            user_id: String(form.get("user_id") || actor.id),
            start_date: String(form.get("start_date")),
            end_date: String(form.get("end_date")),
          });
        }}
      >
        {actor.role === "admin" && (
          <label className="span-2">
            Persona
            <select name="user_id" defaultValue={actor.id}>
              {data.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Desde
          <input type="date" name="start_date" required />
        </label>
        <label>
          Hasta
          <input type="date" name="end_date" required />
        </label>
        <div className="form-actions span-2">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={busy}>Informar período</button>
        </div>
      </form>
    </Modal>
  );
}
