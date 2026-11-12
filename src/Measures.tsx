import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  Check,
  Download,
  FileText,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { Modal, Empty } from "./components";
import { demo } from "./data";
import "./measures.css";
import type { Profile, Member } from "./types";
import {
  loadMeasures,
  createMeasure,
  closeMeasure,
  saveAdhesion,
  summarize,
  type Measure,
  type AdhesionReport,
} from "./measures-data";
const percent = (n: number | null) =>
  n === null
    ? "Sin datos"
    : `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const timestamp = (date: string) =>
  new Date(date).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
export default function Measures({
  actor,
  profiles,
  members,
}: {
  actor: Profile;
  profiles: Profile[];
  members: Member[];
}) {
  const manager = actor.role !== "delegado";
  const [measures, setMeasures] = useState<Measure[]>([]),
    [reports, setReports] = useState<AdhesionReport[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [creating, setCreating] = useState(false),
    [closing, setClosing] = useState(false),
    [building, setBuilding] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await loadMeasures(actor);
      setMeasures(d.measures);
      setReports(d.reports);
      setSelected((previous) =>
        d.measures.some((m) => m.id === previous)
          ? previous
          : d.measures[0]?.id || "",
      );
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [actor]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const measure = measures.find((m) => m.id === selected);
  const assigned =
    measure?.buildings.filter((b) => b.reporter_ids.includes(actor.id)) || [];
  const reportBuilding = assigned.some((b) => b.name === building)
    ? building
    : assigned[0]?.name || "";
  const existing = reports.find(
    (r) => r.measure_id === selected && r.building === reportBuilding,
  );
  const stats = measure ? summarize(measure, reports) : null;
  const buildings = [
    ...new Set(
      [
        ...members.map((m) => m.building),
        ...profiles
          .filter((p) => p.active && p.role === "delegado")
          .map((p) => p.building),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (await refresh()) setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const chosen = data.getAll("buildings").map(String);
    const m: Measure = {
      id: crypto.randomUUID(),
      title: String(data.get("title")).trim(),
      date: String(data.get("date")),
      description: String(data.get("description")).trim(),
      closed: false,
      buildings: chosen.map((name) => ({
        name,
        reporter_ids: profiles
          .filter(
            (p) =>
              p.active && p.role === "delegado" && p.building.trim() === name,
          )
          .map((p) => p.id),
      })),
    };
    void run(async () => {
      await createMeasure(m, actor);
      setSelected(m.id);
      setCreating(false);
    }, "Medida creada. Los delegados asignados ya pueden informar.");
  }
  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () =>
        saveAdhesion(
          {
            measure_id: selected,
            building: reportBuilding,
            total: Number(data.get("total")),
            adherents: Number(data.get("adherents")),
          },
          actor,
        ),
      "Parte actualizado. Se reemplazó el conteo anterior de este edificio.",
    );
  }
  function csv() {
    if (!measure || !stats) return;
    const cell = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const lines = [
      ["Medida", measure.title],
      ["Fecha", measure.date],
      ["Estado", measure.closed ? "Cerrada" : "Abierta"],
      ["Entorno", demo ? "MUESTRA - datos ficticios" : "Datos declarados"],
      ["Generado", timestamp(new Date().toISOString())],
      [],
      [
        "Edificio",
        "Estado del parte",
        "Personas alcanzadas",
        "Adhieren",
        "No adhieren",
        "Adhesión %",
        "Actualizado",
      ],
      ...stats.rows.map(({ building, report: r }) => [
        building,
        r ? "Informado" : "Sin parte",
        r?.total ?? "",
        r?.adherents ?? "",
        r ? r.total - r.adherents : "",
        r ? ((r.adherents / r.total) * 100).toFixed(1) : "",
        r ? timestamp(r.updated_at) : "",
      ]),
      [],
      [
        "TOTAL INFORMADO",
        "",
        stats.total,
        stats.adherents,
        stats.notAdhering,
        stats.rate === null ? "" : stats.rate.toFixed(1),
      ],
      ["Edificios con parte", stats.received],
      ["Edificios sin parte", stats.pending],
      [
        "Metodología",
        "Porcentaje ponderado: suma de adherentes / suma de personas alcanzadas de edificios informados. Sin parte no equivale a cero. No mide impacto operativo.",
      ],
    ];
    const blob = new Blob(
      ["\uFEFF" + lines.map((l) => l.map(cell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `informe-adhesion-${measure.date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="measures-module">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ORGANIZACIÓN Y PARTICIPACIÓN</p>
          <h1>
            Medidas gremiales<span className="greeting-dot">.</span>
          </h1>
          <p className="muted">
            {manager
              ? "Adhesión declarada por edificio. Una lectura compartida de cada medida."
              : "Informá el parte de tu edificio, sin registrar nombres de adherentes."}
          </p>
        </div>
        <div className="measure-actions">
          <button
            className="secondary"
            onClick={() => void refresh()}
            disabled={busy}
            aria-label="Actualizar partes"
          >
            <RefreshCw size={16} />
          </button>
          {manager && (
            <button onClick={() => setCreating(true)}>
              <Plus size={17} />
              Nueva medida
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="measure-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="measure-notice" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {loading ? (
        <p className="muted">Cargando medidas…</p>
      ) : !measures.length ? (
        <Empty>
          No hay medidas registradas.
          {manager
            ? " Creá una para comenzar."
            : " Secretaría publicará las próximas medidas."}
        </Empty>
      ) : (
        <>
          <div className="measure-toolbar">
            <label>
              Medida a consultar
              <select
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setNotice("");
                  setError("");
                  setBuilding("");
                }}
              >
                {measures.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {m.closed ? "Cerrada" : "Abierta"}
                  </option>
                ))}
              </select>
            </label>
            {measure && (
              <span
                className={`pill ${measure.closed ? "pale-orange" : "pale-lime"}`}
              >
                {measure.closed ? (
                  <LockKeyhole size={13} />
                ) : (
                  <BarChart3 size={13} />
                )}{" "}
                {measure.closed
                  ? "Carga cerrada"
                  : "Recepción de partes abierta"}
              </span>
            )}
          </div>
          {measure && (
            <>
              <div className="measure-heading">
                <span className="eyebrow">
                  {new Date(
                    measure.date + "T12:00:00-03:00",
                  ).toLocaleDateString("es-AR", { dateStyle: "long" })}
                  {demo ? " · MUESTRA" : ""}
                </span>
                <h2>{measure.title}</h2>
                <p className="muted">{measure.description}</p>
              </div>
              {!manager && (
                <div className="surface adhesion-entry">
                  <h2>Parte de adhesión</h2>
                  {!assigned.length ? (
                    <p className="muted">
                      No tenés un edificio asignado en esta medida. Solicitá a
                      Secretaría que revise la asignación.
                    </p>
                  ) : (
                    <>
                      <label>
                        Edificio asignado
                        <select
                          aria-label="Edificio para informar"
                          value={reportBuilding}
                          onChange={(e) => {
                            setBuilding(e.target.value);
                            setNotice("");
                          }}
                        >
                          {assigned.map((b) => (
                            <option key={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </label>
                      {measure.closed ? (
                        <p className="measure-notice">
                          <LockKeyhole size={17} />
                          La medida está cerrada. El parte quedó disponible solo
                          para consulta.
                        </p>
                      ) : (
                        <form
                          key={
                            selected +
                            "-" +
                            reportBuilding +
                            "-" +
                            (existing?.updated_at || "new")
                          }
                          onSubmit={submitReport}
                        >
                          <div className="form-grid">
                            <label>
                              Total de personas alcanzadas
                              <input
                                name="total"
                                type="number"
                                min="1"
                                max="1000000"
                                step="1"
                                required
                                defaultValue={existing?.total}
                              />
                            </label>
                            <label>
                              Personas que adhieren
                              <input
                                name="adherents"
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                                required
                                defaultValue={existing?.adherents}
                              />
                            </label>
                          </div>
                          <p className="measure-method">
                            Contá a todas las personas alcanzadas por esta
                            medida en el edificio, no solo las afiliadas. Si
                            comparten edificio, coordinen un único conteo: cada
                            envío reemplaza el parte anterior, no se suma. No
                            ingreses nombres ni identificaciones individuales.
                          </p>
                          <button disabled={busy} type="submit">
                            <Send size={16} />
                            {existing ? "Actualizar parte" : "Enviar parte"}
                          </button>
                        </form>
                      )}
                      {existing && (
                        <div className="own-report">
                          <strong>
                            {existing.adherents} de {existing.total} personas ·{" "}
                            {percent(
                              (existing.adherents / existing.total) * 100,
                            )}
                          </strong>
                          <small>
                            Última actualización:{" "}
                            {timestamp(existing.updated_at)}
                          </small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {manager && stats && (
                <>
                  <div className="measure-report" id="adhesion-report">
                    <div className="report-heading">
                      <div>
                        <span className="eyebrow">
                          INFORME DE ADHESIÓN DECLARADA
                          {demo ? " · DATOS FICTICIOS" : ""}
                        </span>
                        <h2>{measure.title}</h2>
                        <p>
                          {measure.date} ·{" "}
                          {measure.closed
                            ? "Cierre de carga"
                            : "Datos provisorios"}{" "}
                          · Emitido {timestamp(new Date().toISOString())}
                        </p>
                      </div>
                      <div className="measure-actions">
                        <button className="secondary" onClick={csv}>
                          <Download size={16} />
                          Descargar CSV
                        </button>
                        <button onClick={() => window.print()}>
                          <FileText size={16} />
                          Imprimir / PDF
                        </button>
                      </div>
                    </div>
                    <div className="adhesion-stats">
                      <div>
                        <span>ADHIEREN</span>
                        <strong>
                          {stats.adherents.toLocaleString("es-AR")}
                        </strong>
                        <small>
                          de {stats.total.toLocaleString("es-AR")} personas
                          informadas
                        </small>
                      </div>
                      <div>
                        <span>ADHESIÓN DECLARADA</span>
                        <strong>{percent(stats.rate)}</strong>
                        <small>Ponderada por cantidad de personas</small>
                      </div>
                      <div>
                        <span>COBERTURA DE PARTES</span>
                        <strong>
                          {stats.received} / {measure.buildings.length}
                        </strong>
                        <small>
                          {stats.pending} edificios sin informar ·{" "}
                          {percent(stats.coverage)} informado
                        </small>
                      </div>
                    </div>
                    {!stats.received && (
                      <Empty>
                        Todavía no se recibieron partes. No hay datos
                        suficientes para calcular adhesión.
                      </Empty>
                    )}
                    <div className="adhesion-charts">
                      <section className="surface">
                        <h3>Adhesión por edificio</h3>
                        <p className="muted">
                          Porcentaje sobre las personas alcanzadas en cada
                          parte.
                        </p>
                        <div
                          className="building-bars"
                          role="img"
                          aria-label="Gráfico de adhesión por edificio. Los mismos valores están disponibles en la tabla del informe."
                        >
                          {stats.rows.map(({ building, report: r }) => (
                            <div className="building-bar" key={building}>
                              <div>
                                <strong>{building}</strong>
                                <span>
                                  {r
                                    ? `${r.adherents} / ${r.total} · ${percent((r.adherents / r.total) * 100)}`
                                    : "Sin parte"}
                                </span>
                              </div>
                              <div
                                className={`bar-track ${!r ? "pending" : ""}`}
                              >
                                <span
                                  style={{
                                    width: r
                                      ? `${(r.adherents / r.total) * 100}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section className="surface">
                        <h3>Distribución informada</h3>
                        <div className="distribution">
                          <div
                            className="adhesion-donut"
                            style={{
                              background:
                                stats.rate === null
                                  ? "#49607c"
                                  : `conic-gradient(#8de1b0 0% ${stats.rate}%, #4f6795 ${stats.rate}% 100%)`,
                            }}
                            role="img"
                            aria-label={`${stats.adherents} adhieren y ${stats.notAdhering} no adhieren en los edificios informados`}
                          >
                            <span>{percent(stats.rate)}</span>
                          </div>
                          <div className="chart-legend">
                            <span>
                              <i />
                              {stats.adherents} adhieren
                            </span>
                            <span>
                              <i />
                              {stats.notAdhering} no adhieren
                            </span>
                          </div>
                        </div>
                        <p className="measure-method">
                          Los edificios sin parte quedan fuera del cálculo. Su
                          adhesión es desconocida.
                        </p>
                      </section>
                    </div>
                    <div className="surface measure-summary">
                      <h3>Lectura del relevamiento</h3>
                      <p>
                        {stats.received
                          ? `Se informaron ${stats.received} de ${measure.buildings.length} edificios. De ${stats.total} personas alcanzadas declaradas, ${stats.adherents} adhieren (${percent(stats.rate)}).`
                          : "Aún no hay partes recibidos."}{" "}
                        {stats.pending
                          ? `Faltan ${stats.pending} edificios; el resultado es parcial y no debe extrapolarse al conjunto.`
                          : "Todos los edificios definidos para esta medida tienen un parte."}
                      </p>
                      <p>
                        Estos datos describen participación declarada. No
                        permiten concluir por sí solos cuánto se afectó la
                        producción, la atención o el funcionamiento de cada
                        edificio.
                      </p>
                    </div>
                    <div className="surface report-table">
                      <div className="table-wrap">
                        <table>
                          <caption>
                            Detalle por edificio · {measure.title}
                          </caption>
                          <thead>
                            <tr>
                              <th>Edificio</th>
                              <th>Alcanzadas</th>
                              <th>Adhieren</th>
                              <th>No adhieren</th>
                              <th>Adhesión</th>
                              <th>Actualizado (Argentina)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.rows.map(({ building, report: r }) => (
                              <tr key={building}>
                                <th scope="row">{building}</th>
                                <td>{r?.total ?? "Sin parte"}</td>
                                <td>{r?.adherents ?? "—"}</td>
                                <td>{r ? r.total - r.adherents : "—"}</td>
                                <td>
                                  {r
                                    ? percent((r.adherents / r.total) * 100)
                                    : "—"}
                                </td>
                                <td>
                                  {r ? timestamp(r.updated_at) : "Pendiente"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <th>Total informado</th>
                              <td>{stats.total}</td>
                              <td>{stats.adherents}</td>
                              <td>{stats.notAdhering}</td>
                              <td>{percent(stats.rate)}</td>
                              <td>{stats.pending} sin parte</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                    <p className="measure-method">
                      Metodología: adhesión = suma de adherentes / suma de
                      personas alcanzadas de edificios con parte. Cobertura =
                      edificios con parte / edificios definidos. El padrón no se
                      utiliza como denominador automático. Un solo parte vigente
                      por edificio y medida; las actualizaciones lo reemplazan.
                      No se registra quién adhiere individualmente.
                    </p>
                  </div>
                  {!measure.closed && (
                    <div className="measure-close">
                      <p className="muted">
                        Cerrar la carga impide nuevas modificaciones y conserva
                        el informe disponible.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setClosing(true)}
                      >
                        <LockKeyhole size={16} />
                        Cerrar carga de la medida
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {creating && (
        <Modal title="Nueva medida gremial" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <div className="form-grid">
              <label className="span-2">
                Nombre de la medida
                <input name="title" required minLength={3} maxLength={250} />
              </label>
              <label>
                Fecha de la medida
                <input name="date" type="date" required />
              </label>
              <label className="span-2">
                Descripción
                <textarea name="description" maxLength={3000} />
              </label>
            </div>
            <fieldset className="measure-scopes">
              <legend>Edificios a relevar</legend>
              {buildings.map((name) => {
                const delegates = profiles.filter(
                  (p) =>
                    p.active &&
                    p.role === "delegado" &&
                    p.building.trim() === name,
                );
                return (
                  <label className="checkbox" key={name}>
                    <input
                      type="checkbox"
                      name="buildings"
                      value={name}
                      defaultChecked
                    />
                    <span>
                      {name}
                      <small>
                        {delegates.length
                          ? `${delegates.length} delegados habilitados para informar`
                          : "Sin delegados activos asignados: quedará pendiente"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <p className="measure-method">
              Se fija la lista de edificios y delegados actuales al crear la
              medida. Cambiar luego el edificio de un perfil no le habilita
              otros partes en esta medida.
            </p>
            {error && (
              <p role="alert" className="measure-error">
                {error}
              </p>
            )}
            <button disabled={busy || !buildings.length} type="submit">
              Crear medida
            </button>
          </form>
        </Modal>
      )}
      {closing && measure && (
        <Modal
          title="Cerrar carga de la medida"
          onClose={() => setClosing(false)}
        >
          <p>
            Se bloquearán las nuevas cargas y correcciones de «{measure.title}».
            Los datos y el informe se conservan.
          </p>
          {stats && stats.pending > 0 && (
            <p className="measure-method">
              Quedan {stats.pending} edificios sin parte. El informe seguirá
              indicando cobertura parcial.
            </p>
          )}
          <div className="form-actions">
            <button className="secondary" onClick={() => setClosing(false)}>
              Volver
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await closeMeasure(measure.id, actor);
                  setClosing(false);
                }, "Carga cerrada. El informe continúa disponible.")
              }
            >
              Confirmar cierre
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
