import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Download,
  Dumbbell,
  Flower2,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Palmtree,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  UserRound,
  X,
  PenLine,
  Trash2,
  CheckCircle2,
  WifiOff,
  Mail,
  BarChart3,
  ContactRound,
} from "lucide-react";
import {
  configurationError,
  demo,
  loadData,
  removeRow,
  saveRow,
  subscribePush,
  supabase,
} from "./data";
import { Avatar, Empty, LinkButton, Modal, SectionTitle } from "./components";
import { AttendanceForm, Editor, VacationForm } from "./Forms";
import Measures from "./Measures";
import DelegateCards from "./DelegateCards";
import { whatsappNumber } from "./delegate-card-domain";
import { dateLabel, isOnLeave, normalize, overlaps, today } from "./domain";
import type {
  Benefit,
  Data,
  Member,
  Profile,
  Role,
  Row,
  Table,
  UnionEvent,
  Vacation,
} from "./types";
type View =
  | "inicio"
  | "padron"
  | "agenda"
  | "beneficios"
  | "vacaciones"
  | "cobertura"
  | "perfil"
  | "admin"
  | "medidas"
  | "tarjetas"
  | "notificaciones";
const names: Record<View, string> = {
  inicio: "Mi espacio",
  padron: "Padrón de afiliados",
  agenda: "Agenda gremial",
  beneficios: "Beneficios e información",
  vacaciones: "Mis vacaciones",
  cobertura: "Cobertura por edificio",
  perfil: "Mi perfil",
  admin: "Administración",
  notificaciones: "Notificaciones",
  medidas: "Medidas gremiales",
  tarjetas: "Tarjetas de delegados",
};
function readView(): View {
  const view = new URLSearchParams(location.search).get("view");
  return view && view in names ? (view as View) : "inicio";
}
const roleNames: Record<Role, string> = {
  delegado: "Delegado/a",
  secretario: "Secretario/a gremial",
  admin: "Administrador/a",
};
const icons = {
  Turismo: Palmtree,
  "Obra social": Heart,
  Gimnasio: Dumbbell,
  Recreación: Flower2,
  Otros: Sun,
};
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const [userId, setUserId] = useState<string | null>(demo ? "d1" : null),
    [data, setData] = useState<Data | null>(null),
    [view, setView] = useState<View>(() => readView()),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const [editor, setEditor] = useState<{ table: Table; row?: Row } | null>(
      null,
    ),
    [detail, setDetail] = useState<Member | Benefit | null>(null),
    [decline, setDecline] = useState<UnionEvent | null>(null),
    [vacationOpen, setVacationOpen] = useState(false),
    [confirmDelete, setConfirmDelete] = useState<{
      table: Table;
      row: Row;
    } | null>(null),
    [attendance, setAttendance] = useState<UnionEvent | null>(null);
  const actor = data?.profiles.find((p) => p.id === userId);
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const d = await loadData(userId);
      setData(d);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los datos.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (demo) return;
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id || null);
      setLoading(false);
    });
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setData(null);
      setUserId(session?.user.id || null);
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (userId) {
      setLoading(true);
      void refresh();
    }
  }, [userId, refresh]);
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`plastico-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      void supabase!.removeChannel(channel);
      clearInterval(timer);
    };
  }, [userId, refresh]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const capture = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", capture);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", capture);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(next: View) {
    setView(next);
    setSidebar(false);
    history.replaceState(null, "", `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function mutate(table: Table, row: Row) {
    if (!actor) return;
    setBusy(true);
    try {
      if (table === "profiles" && "whatsapp" in row) {
        const raw = row.whatsapp?.trim() || "";
        const number = whatsappNumber(raw);
        if (raw && !number) throw new Error("Ingresá WhatsApp con código de país, comenzando con + y entre 8 y 15 dígitos.");
        row = { ...row, whatsapp: number ? "+" + number : "" };
      }
      if (table === "vacations") {
        const v = row as Vacation;
        if (v.end_date < v.start_date)
          throw new Error(
            "La fecha de fin debe ser posterior o igual al inicio.",
          );
        if (
          data!.vacations.some(
            (x) => x.id !== v.id && x.user_id === v.user_id && overlaps(x, v),
          )
        )
          throw new Error(
            "El período se superpone con unas vacaciones ya informadas.",
          );
      }
      if (
        table === "responses" &&
        "status" in row &&
        row.status === "no" &&
        "reason" in row &&
        row.reason.trim().length < 10
      )
        throw new Error("Ingresá una justificación de al menos 10 caracteres.");
      if (
        table === "members" &&
        data!.members.some(
          (x) =>
            x.id !== row.id && x.file_number === (row as Member).file_number,
        )
      )
        throw new Error("Ya existe un afiliado con ese legajo.");
      await saveRow(table, row, actor);
      await refresh();
      setEditor(null);
      setDecline(null);
      setVacationOpen(false);
      setToast(
        table === "events"
          ? "Convocatoria guardada. Se generaron las alertas para todas las cuentas activas."
          : "Cambios guardados.",
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function respond(event: UnionEvent, status: "yes" | "no", reason = "") {
    if (!actor) return;
    const previous = data!.responses.find(
      (r) => r.event_id === event.id && r.user_id === actor.id,
    );
    await mutate("responses", {
      id: previous?.id || crypto.randomUUID(),
      event_id: event.id,
      user_id: actor.id,
      status,
      reason,
    });
  }
  async function destroy() {
    if (!confirmDelete || !actor) return;
    setBusy(true);
    try {
      await removeRow(confirmDelete.table, confirmDelete.row.id, actor);
      await refresh();
      setConfirmDelete(null);
      setToast("Registro eliminado.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }
  if (configurationError)
    return (
      <div className="login">
        <Brand />
        <h1>Entorno pendiente de configuración</h1>
        <p>
          Configurá la conexión de producción o activá explícitamente el modo de
          muestra. Los datos reales nunca se reemplazan por datos ficticios
          automáticamente.
        </p>
      </div>
    );
  if (!userId) return <Login />;
  if (loading && !data)
    return (
      <div className="loading">
        <Brand />
        <span className="loader" />
        Preparando tu espacio…
      </div>
    );
  if (!actor || !actor.active)
    return (
      <div className="login">
        <Brand />
        <h1>
          {error ? "No pudimos conectarnos" : "Tu cuenta necesita habilitación"}
        </h1>
        <p>{error || "Solicitá a Administración que habilite tu perfil."}</p>
        <button onClick={() => void refresh()}>Reintentar</button>
        <button
          className="secondary"
          onClick={() => void supabase?.auth.signOut()}
        >
          Cerrar sesión
        </button>
      </div>
    );
  const d = data!;
  const manager = actor.role !== "delegado";
  const admin = actor.role === "admin";
  const unread = d.notifications.filter(
    (n) => n.user_id === actor.id && !n.read,
  ).length;
  const events = [...d.events].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = events.filter((e) => new Date(e.date) >= new Date());
  const next = upcoming[0];
  const nav: [View, typeof Users][] = [
    ["inicio", LayoutDashboard],
    ["padron", Users],
    ["agenda", CalendarDays],
    ["beneficios", Heart],
    ["vacaciones", Palmtree],
    ["medidas", BarChart3],
    ["tarjetas", ContactRound],
    ...(manager ? [["cobertura", Building2] as [View, typeof Users]] : []),
    ...(admin ? [["admin", Settings2] as [View, typeof Users]] : []),
  ];
  const editControls = (table: Table, row: Row) => (
    <div className="edit-controls">
      <button
        className="icon-button"
        aria-label="Editar"
        onClick={() => setEditor({ table, row })}
      >
        <PenLine size={16} />
      </button>
      <button
        className="icon-button danger"
        aria-label="Eliminar"
        onClick={() => setConfirmDelete({ table, row })}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  function eventActions(event: UnionEvent) {
    const response = d.responses.find(
      (r) => r.event_id === event.id && r.user_id === actor!.id,
    );
    return (
      <div className="event-actions">
        {response ? (
          <span
            className={`response ${response.status === "yes" ? "yes" : "no"}`}
          >
            <CheckCircle2 size={16} />
            {response.status === "yes"
              ? "Asistencia confirmada"
              : "Inasistencia justificada"}
          </span>
        ) : (
          <button disabled={busy} onClick={() => void respond(event, "yes")}>
            <Check size={16} />
            Confirmar asistencia
          </button>
        )}
        {response?.status === "no" ? (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void respond(event, "yes")}
          >
            Ahora puedo asistir
          </button>
        ) : (
          <button
            className="text-button subtle"
            onClick={() => setDecline(event)}
          >
            No asistiré
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <Brand name={d.settings[0]?.name} />
        <div className="workspace-label">
          UOYEP <span>/</span> REPRESENTACIÓN GREMIAL
        </div>
        <nav aria-label="Navegación principal">
          {nav.map(([key, Icon]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => go(key)}
            >
              <Icon size={20} />
              {names[key]}
              {key === "agenda" && upcoming.length > 0 && (
                <span className="nav-count">{upcoming.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="union-note">
            <span className="mini-mark"><img src="/logo-cfp.webp" alt="CFP"/></span>
            <p>
              Más cerca.
              <br />
              <strong>Más unidos.</strong>
            </p>
          </div>
          <button className="nav-profile" onClick={() => go("perfil")}>
            <Avatar name={actor.name} small />
            <span>
              <strong>{actor.name}</strong>
              <small>{roleNames[actor.role]}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setSidebar(true)}
            >
              <Menu />
            </button>
            <span>Espacio de delegados</span>
            <ChevronRight size={14} />
            <strong>{names[view]}</strong>
          </div>
          <div className="topbar-actions">
            {demo && (
              <label className="role-switch">
                <span>MUESTRA</span>
                <select
                  aria-label="Cambiar perfil de muestra"
                  value={actor.role}
                  onChange={(e) => {
                    if (e.target.value === actor.role) return;
                    setLoading(true);
                    setData(null);
                    setUserId(
                      { delegado: "d1", secretario: "s1", admin: "a1" }[
                        e.target.value as Role
                      ],
                    );
                    go("inicio");
                  }}
                >
                  <option value="delegado">Delegado/a</option>
                  <option value="secretario">Secretaría</option>
                  <option value="admin">Administración</option>
                </select>
              </label>
            )}
            <button
              className="icon-button notification-button"
              aria-label={`Notificaciones, ${unread} sin leer`}
              onClick={() => go("notificaciones")}
            >
              <Bell size={21} />
              {unread > 0 && <span />}
            </button>
            <button
              className="avatar-button"
              aria-label="Mi perfil"
              onClick={() => go("perfil")}
            >
              <Avatar name={actor.name} small />
            </button>
          </div>
        </header>
        {!online && (
          <div className="connection-banner">
            <WifiOff size={16} /> Sin conexión.{" "}
            {demo
              ? "Podés seguir explorando la muestra."
              : "Conectate para consultar y guardar información actualizada."}
          </div>
        )}
        {error && (
          <div className="connection-banner">
            No se pudo actualizar: {error}
            <button onClick={() => void refresh()}>Reintentar</button>
          </div>
        )}
        <main id="main-content" key={view}>
          {view === "medidas" && <Measures key={actor.id} actor={actor} profiles={d.profiles} members={d.members} />}
          {view === "inicio" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">TU ESPACIO, TU GREMIO</p>
                  <h1>
                    Hola, {actor.name.split(" ")[0]}
                    <span className="greeting-dot">.</span>
                  </h1>
                  <p className="muted">
                    Todo lo que necesitás para acompañar a tus compañeros.
                  </p>
                </div>
                <div className="today">
                  <CalendarDays size={17} />
                  {dateLabel(today(), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              </div>
              <div className="home-grid">
                <section className="hero">
                  <div className="hero-top">
                    <span className="pill lime">
                      <span className="pulse" />
                      {next ? "PRÓXIMA CONVOCATORIA" : "AGENDA GREMIAL"}
                    </span>
                    <span className="hero-index">
                      Plástico / {new Date().getFullYear()}
                    </span>
                  </div>
                  <div className="hero-content">
                    <div>
                      <p className="hero-kicker">
                        La participación nos fortalece.
                      </p>
                      <h2>{next?.title || "Construimos juntos."}</h2>
                      <p>
                        {next
                          ? "Un espacio para encontrarnos, compartir y decidir lo que viene."
                          : "Todas las novedades de tu gremio, en un mismo lugar."}
                      </p>
                      {next && (
                        <div className="hero-meta">
                          <span>
                            <CalendarDays size={16} />
                            {dateLabel(next.date)} ·{" "}
                            {new Date(next.date).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                              timeZone: "America/Argentina/Buenos_Aires",
                            })}{" "}
                            h
                          </span>
                          <span>
                            <MapPin size={16} />
                            {next.location}
                          </span>
                        </div>
                      )}
                      <button
                        className="lime-button"
                        onClick={() => go("agenda")}
                      >
                        Ver convocatoria
                        <ArrowUpRight size={19} />
                      </button>
                    </div>
                    <div className="hero-date" aria-hidden="true">
                      <span>
                        {next
                          ? dateLabel(next.date, { month: "short" })
                              .replace(".", "")
                              .toUpperCase()
                          : "Plástico"}
                      </span>
                      <strong>
                        {next ? dateLabel(next.date, { day: "2-digit" }) : "+"}
                      </strong>
                      <div className="date-line" />
                      <small>Nos encontramos.</small>
                    </div>
                  </div>
                  <div className="hero-footer">
                    <div className="avatar-stack">
                      <span>UT</span>
                      <span>DG</span>
                      <span>SG</span>
                    </div>
                    <span>La fuerza de estar presentes.</span>
                    <ArrowRight size={18} />
                  </div>
                </section>
                <section className="my-building">
                  <span className="outline-icon">
                    <Building2 size={25} />
                  </span>
                  <p className="eyebrow">TU LUGAR DE TRABAJO</p>
                  <h2>{actor.building || "Asigná tu edificio"}</h2>
                  <p>
                    <Clock size={16} />
                    {actor.start_time.slice(0, 5)} —{" "}
                    {actor.end_time.slice(0, 5)} h
                  </p>
                  <div className="building-divider" />
                  <span className="muted">
                    Tu información al día nos ayuda a organizarnos mejor.
                  </span>
                  <LinkButton onClick={() => go("perfil")}>
                    Actualizar mi perfil
                  </LinkButton>
                </section>
              </div>
              <div className="quick-stats">
                <button onClick={() => go("padron")}>
                  <span className="stat-icon blue">
                    <Users size={22} />
                  </span>
                  <span>
                    <strong>{d.members.length.toLocaleString("es-AR")}</strong>
                    <small>Afiliados en el padrón</small>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
                <button onClick={() => go("agenda")}>
                  <span className="stat-icon green">
                    <CalendarDays size={22} />
                  </span>
                  <span>
                    <strong>
                      {upcoming.length.toString().padStart(2, "0")}
                    </strong>
                    <small>Próximos encuentros</small>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
                <button onClick={() => go("beneficios")}>
                  <span className="stat-icon peach">
                    <Heart size={22} />
                  </span>
                  <span>
                    <strong>
                      {d.benefits.length.toString().padStart(2, "0")}
                    </strong>
                    <small>Beneficios para vos</small>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
              </div>
              <div className="bottom-grid">
                <section>
                  <SectionTitle
                    title="Lo que viene"
                    eyebrow="ESTAMOS EN MOVIMIENTO"
                  >
                    <LinkButton onClick={() => go("agenda")}>
                      Ver agenda
                    </LinkButton>
                  </SectionTitle>
                  <div className="agenda-list">
                    {upcoming.slice(0, 3).map((event) => (
                      <button
                        className="agenda-row"
                        key={event.id}
                        onClick={() => go("agenda")}
                      >
                        <span className="calendar-tile">
                          <strong>
                            {dateLabel(event.date, { day: "2-digit" })}
                          </strong>
                          <small>
                            {dateLabel(event.date, { month: "short" }).replace(
                              ".",
                              "",
                            )}
                          </small>
                        </span>
                        <span className="agenda-copy">
                          <span className="category-label">
                            {event.category}
                          </span>
                          <strong>{event.title}</strong>
                          <small>{event.location}</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                    {!upcoming.length && (
                      <Empty>No hay convocatorias próximas.</Empty>
                    )}
                  </div>
                </section>
                <section className="benefit-teaser">
                  <span className="eyebrow">
                    SER PARTE TIENE SUS BENEFICIOS
                  </span>
                  <div className="benefit-teaser-icon">
                    <Palmtree size={46} strokeWidth={1.4} />
                  </div>
                  <h2>
                    También estamos
                    <br />
                    en tus buenos momentos.
                  </h2>
                  <p>Turismo, salud, deporte y espacios para compartir.</p>
                  <LinkButton onClick={() => go("beneficios")}>
                    Explorar beneficios
                  </LinkButton>
                </section>
              </div>
            </>
          )}
          {view !== "inicio" && view !== "medidas" && (
            <div className="page-heading">
              <div>
                <p className="eyebrow">Plástico · GESTIÓN GREMIAL</p>
                <h1>
                  {names[view]}
                  <span className="greeting-dot">.</span>
                </h1>
                <p className="muted">
                  {
                    (
                      {
                        padron:
                          "Encontrá la información que necesitás para acompañar.",
                        agenda: "Nos organizamos mejor cuando participamos.",
                        beneficios:
                          "Acompañamiento dentro y fuera del trabajo.",
                        vacaciones:
                          "Organizá tu descanso y mantené informada a Secretaría.",
                        cobertura:
                          "Una mirada compartida sobre cada lugar de trabajo.",
                        perfil:
                          "Mantené actualizados tu edificio, horario y contacto.",
                        admin:
                          "Gestión de personas, contenidos y organización.",
                        notificaciones:
                          "Las novedades importantes, en un solo lugar.",
                      } as Partial<Record<View, string>>
                    )[view]
                  }
                </p>
              </div>
              {view === "padron" && admin && (
                <button onClick={() => setEditor({ table: "members" })}>
                  <Plus size={18} />
                  Nuevo afiliado
                </button>
              )}
              {view === "agenda" && manager && (
                <button onClick={() => setEditor({ table: "events" })}>
                  <Plus size={18} />
                  Nueva convocatoria
                </button>
              )}
              {view === "beneficios" && admin && (
                <button onClick={() => setEditor({ table: "benefits" })}>
                  <Plus size={18} />
                  Nuevo beneficio
                </button>
              )}
              {view === "vacaciones" && (
                <button onClick={() => setVacationOpen(true)}>
                  <Plus size={18} />
                  Informar vacaciones
                </button>
              )}
            </div>
          )}
          {view === "padron" && (
            <MemberDirectory
              members={d.members}
              onDetail={setDetail}
              edit={admin ? (row) => editControls("members", row) : undefined}
            />
          )}
          {view === "agenda" && (
            <div className="events-grid">
              {events.map((event) => (
                <article className="event-card" key={event.id}>
                  <div className="event-card-header">
                    <span
                      className={`pill ${event.urgent ? "pale-lime" : "pale-blue"}`}
                    >
                      {event.urgent
                        ? "IMPORTANTE"
                        : event.category.toUpperCase()}
                    </span>
                    {manager && editControls("events", event)}
                  </div>
                  <div className="event-card-title">
                    <div className="calendar-tile">
                      <strong>
                        {dateLabel(event.date, { day: "2-digit" })}
                      </strong>
                      <small>{dateLabel(event.date, { month: "short" })}</small>
                    </div>
                    <div>
                      <span className="category-label">{event.category}</span>
                      <h2>{event.title}</h2>
                    </div>
                  </div>
                  <p className="muted">{event.description}</p>
                  <div className="event-info">
                    <span>
                      <Clock size={17} />
                      {dateLabel(event.date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}{" "}
                      ·{" "}
                      {new Date(event.date).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}{" "}
                      h
                    </span>
                    <span>
                      <MapPin size={17} />
                      {event.location}
                    </span>
                  </div>
                  {new Date(event.date) >= new Date() ? (
                    eventActions(event)
                  ) : (
                    <span className="pill pale-blue">Evento finalizado</span>
                  )}
                  {manager && (
                    <button
                      className="attendance-link"
                      onClick={() => setAttendance(event)}
                    >
                      <Users size={16} />
                      {
                        d.responses.filter(
                          (r) => r.event_id === event.id && r.status === "yes",
                        ).length
                      }{" "}
                      confirmados · Ver respuestas
                      <ArrowRight size={16} />
                    </button>
                  )}
                </article>
              ))}
              {!events.length && (
                <Empty>Aún no hay convocatorias publicadas.</Empty>
              )}
            </div>
          )}
          {view === "beneficios" && (
            <>
              <div className="benefits-grid">
                {d.benefits.map((b, i) => {
                  const Icon = icons[b.category as keyof typeof icons] || Heart;
                  return (
                    <article
                      key={b.id}
                      className={`benefit-card benefit-${i % 4}`}
                    >
                      <div className="benefit-visual">
                        <Icon size={64} strokeWidth={1.25} />
                        <span>{String(i + 1).padStart(2, "0")} / Plástico</span>
                      </div>
                      <div className="benefit-body">
                        <div className="benefit-category">
                          <span className="eyebrow">{b.category}</span>
                          {admin && editControls("benefits", b)}
                        </div>
                        <h2>{b.title}</h2>
                        <p>{b.description}</p>
                        <LinkButton onClick={() => setDetail(b)}>
                          Conocer más
                        </LinkButton>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!d.benefits.length && (
                <Empty>No hay beneficios publicados.</Empty>
              )}
              {demo && (
                <p className="sample-note">
                  Las propuestas son ilustrativas. Los convenios y canales
                  oficiales se cargan desde Administración.
                </p>
              )}
            </>
          )}
          {view === "vacaciones" && (
            <>
              <div className="privacy-note">
                <ShieldCheck size={22} />
                <div>
                  <strong>Tu descanso, bien organizado.</strong>
                  <p>
                    Esta información solo la ven su titular, Secretaría gremial
                    y Administración.
                  </p>
                </div>
              </div>
              <section className="surface">
                <SectionTitle
                  title={
                    admin ? "Períodos informados" : "Mis períodos informados"
                  }
                />
                {d.vacations
                  .filter((v) => admin || v.user_id === actor.id)
                  .map((v) => (
                    <div className="vacation-row" key={v.id}>
                      <span className="stat-icon green">
                        <Palmtree />
                      </span>
                      <div>
                        <strong>
                          {dateLabel(v.start_date)} —{" "}
                          {dateLabel(v.end_date, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </strong>
                        <p className="muted">
                          {admin
                            ? d.profiles.find((p) => p.id === v.user_id)?.name
                            : "Vacaciones informadas a Secretaría"}
                        </p>
                      </div>
                      <span className="pill pale-blue">
                        {v.end_date < today()
                          ? "Finalizadas"
                          : v.start_date > today()
                            ? "Próximas"
                            : "En curso"}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Editar período"
                        onClick={() =>
                          setEditor({ table: "vacations", row: v })
                        }
                      >
                        <PenLine size={18} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label="Eliminar período"
                        onClick={() =>
                          setConfirmDelete({ table: "vacations", row: v })
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                {!d.vacations.some((v) => admin || v.user_id === actor.id) && (
                  <Empty>Todavía no informaste períodos de vacaciones.</Empty>
                )}
              </section>
            </>
          )}
          {view === "tarjetas" && <DelegateCards key={actor.id} actor={actor} profiles={d.profiles} organization={d.settings[0]?.name || "Plástico"} sample={demo} onEdit={()=>setEditor({table:"profiles",row:actor})}/>}
          {view === "cobertura" && manager && <Coverage data={d} />}
          {view === "perfil" && (
            <div className="profile-grid">
              <section className="surface profile-card">
                <Avatar name={actor.name} />
                <h2>{actor.name}</h2>
                <span className="pill pale-blue">{roleNames[actor.role]}</span>
                <dl>
                  <dt>Edificio</dt>
                  <dd>{actor.building || "Sin asignar"}</dd>
                  <dt>Horario</dt>
                  <dd>
                    {actor.start_time.slice(0, 5)} —{" "}
                    {actor.end_time.slice(0, 5)} h
                  </dd>
                  <dt>Teléfono</dt>
                  <dd>{actor.phone || "Sin informar"}</dd>
                </dl>
                <button
                  onClick={() => setEditor({ table: "profiles", row: actor })}
                >
                  <PenLine size={17} />
                  Editar mi información
                </button>
                {actor.role === "delegado" && <button className="secondary" onClick={()=>go("tarjetas")}><ContactRound size={17}/>Ver mi tarjeta</button>}
              </section>
              <div>
                <section className="surface">
                  <Bell size={28} />
                  <h2>Que no se te pase nada.</h2>
                  <p className="muted">
                    Recibí avisos de plenarios y convocatorias en este
                    dispositivo.
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      void subscribePush(actor.id)
                        .then(() =>
                          setToast(
                            "Notificaciones habilitadas en este dispositivo.",
                          ),
                        )
                        .catch((e) => setToast(e.message))
                    }
                  >
                    Activar notificaciones
                  </button>
                </section>
                <section className="surface install-panel">
                  <Download size={25} />
                  <h2>Plástico, siempre a mano.</h2>
                  <p className="muted">
                    {install
                      ? "Instalá la aplicación en este dispositivo."
                      : "Para instalar, usá «Instalar aplicación» en el navegador. En iPhone: Compartir → Agregar a inicio."}
                  </p>
                  {install && (
                    <button
                      className="secondary"
                      onClick={() =>
                        void install
                          .prompt()
                          .then(() => install.userChoice)
                          .then((result) => {
                            if (result.outcome === "accepted") setInstall(null);
                          })
                      }
                    >
                      Instalar aplicación
                    </button>
                  )}
                </section>
                {!demo && (
                  <button
                    className="text-button danger"
                    onClick={() => void supabase?.auth.signOut()}
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                )}
              </div>
            </div>
          )}
          {view === "admin" && admin && (
            <>
              <section className="surface">
                <SectionTitle title="Organización">
                  <button
                    className="secondary"
                    onClick={() =>
                      setEditor({ table: "settings", row: d.settings[0] })
                    }
                  >
                    <Settings2 size={16} />
                    Editar configuración
                  </button>
                </SectionTitle>
                <p className="muted">
                  {d.settings[0]?.name} · {d.settings[0]?.subtitle} ·{" "}
                  {d.settings[0]?.contact}
                </p>
              </section>
              <section className="surface admin-users">
                <SectionTitle title="Personas y permisos" />
                <p className="muted">
                  Las nuevas cuentas se dan de alta desde el servicio de
                  autenticación. Desde aquí podés asignar roles, edificios y
                  habilitar o deshabilitar accesos.
                </p>
                {d.profiles.map((p) => (
                  <div className="user-row" key={p.id}>
                    <Avatar name={p.name} small />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.building} ·{" "}
                        {p.active
                          ? "Cuenta habilitada"
                          : "Acceso deshabilitado"}
                      </small>
                    </div>
                    <span className="pill pale-blue">{roleNames[p.role]}</span>
                    <button
                      className="secondary"
                      onClick={() => setEditor({ table: "profiles", row: p })}
                    >
                      Editar
                    </button>
                  </div>
                ))}
              </section>
              <div className="admin-shortcuts">
                <button className="secondary" onClick={() => go("padron")}>
                  Gestionar padrón
                  <ArrowRight size={17} />
                </button>
                <button className="secondary" onClick={() => go("beneficios")}>
                  Gestionar beneficios
                  <ArrowRight size={17} />
                </button>
                <button className="secondary" onClick={() => go("agenda")}>
                  Gestionar convocatorias
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {view === "notificaciones" && (
            <section className="surface">
              <SectionTitle title="Tu bandeja">
                <button
                  className="secondary"
                  onClick={() =>
                    void subscribePush(actor.id)
                      .then(() => setToast("Notificaciones habilitadas."))
                      .catch((e) => setToast(e.message))
                  }
                >
                  <Bell size={16} />
                  Activar alertas
                </button>
              </SectionTitle>
              {d.notifications
                .filter((n) => n.user_id === actor.id)
                .slice()
                .reverse()
                .map((n) => (
                  <div
                    className={`notice-row ${n.read ? "" : "unread"}`}
                    key={n.id}
                  >
                    <span className="stat-icon blue">
                      <Bell size={20} />
                    </span>
                    <div>
                      <strong>{n.title}</strong>
                      <small>
                        {n.read
                          ? "Leída"
                          : "Nueva convocatoria · Revisá tu asistencia"}
                      </small>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        void mutate("notifications", { ...n, read: true });
                        go("agenda");
                      }}
                    >
                      Ver
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              {!d.notifications.length && (
                <Empty>No tenés notificaciones pendientes.</Empty>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <strong>{d.settings[0]?.name || "Plástico"}</strong> · Cerca de quienes
              representan.
            </span>
            <span>
              {demo
                ? "Muestra interactiva · Datos ficticios"
                : "Espacio privado de gestión gremial"}
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <Editor
          table={editor.table}
          row={editor.row}
          actor={actor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(row) => mutate(editor.table, row)}
        />
      )}
      {decline && (
        <AttendanceForm
          title={decline.title}
          onClose={() => setDecline(null)}
          onSave={(reason) => void respond(decline, "no", reason)}
          busy={busy}
        />
      )}
      {vacationOpen && (
        <VacationForm
          actor={actor}
          data={d}
          onClose={() => setVacationOpen(false)}
          busy={busy}
          onSave={(row) => void mutate("vacations", row)}
        />
      )}
      {detail && (
        <Modal
          title={
            "file_number" in detail
              ? `${detail.first_name} ${detail.last_name}`
              : detail.title
          }
          onClose={() => setDetail(null)}
        >
          {"file_number" in detail ? (
            <>
              <span className="pill pale-blue">
                Legajo {detail.file_number}
              </span>
              <dl className="member-details">
                {[
                  ["Edificio", detail.building],
                  ["Área", detail.area],
                  ["Cargo", detail.position],
                  ["Gerencia", detail.management],
                  [
                    "Horario",
                    `${detail.start_time.slice(0, 5)} — ${detail.end_time.slice(0, 5)} h`,
                  ],
                  ["Teléfono", detail.phone],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <a
                className="button"
                href={`tel:${detail.phone.replace(/[^+\d]/g, "")}`}
              >
                Llamar al afiliado
                <ArrowUpRight size={17} />
              </a>
            </>
          ) : (
            <>
              <span className="eyebrow">{detail.category}</span>
              <p className="detail-text">{detail.detail}</p>
              {detail.contact && (
                <p className="contact-detail">
                  <strong>Contacto oficial</strong>
                  <br />
                  {detail.contact}
                </p>
              )}
            </>
          )}
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Eliminar registro" onClose={() => setConfirmDelete(null)}>
          <p>
            ¿Querés eliminar este registro? Esta acción no se puede deshacer.
            {confirmDelete.table === "events"
              ? " También se eliminarán las respuestas y alertas relacionadas."
              : ""}
          </p>
          <div className="form-actions">
            <button
              className="secondary"
              onClick={() => setConfirmDelete(null)}
            >
              Cancelar
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void destroy()}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
      {attendance && (
        <Modal
          title={`Respuestas · ${attendance.title}`}
          onClose={() => setAttendance(null)}
        >
          <p className="muted">
            {d.profiles.filter((p) => p.active).length} personas convocadas
          </p>
          {d.profiles
            .filter((p) => p.active)
            .map((p) => {
              const r = d.responses.find(
                (x) => x.event_id === attendance.id && x.user_id === p.id,
              );
              return (
                <div className="attendance-row" key={p.id}>
                  <strong>{p.name}</strong>
                  <span
                    className={`response ${r?.status === "yes" ? "yes" : "no"}`}
                  >
                    {r
                      ? r.status === "yes"
                        ? "Asistirá"
                        : "No asistirá"
                      : "Sin respuesta"}
                  </span>
                  {r?.reason && <p>{r.reason}</p>}
                  {admin && (
                    <div className="attendance-admin">
                      <button
                        className="text-button"
                        onClick={() =>
                          void mutate("responses", {
                            id: r?.id || crypto.randomUUID(),
                            event_id: attendance.id,
                            user_id: p.id,
                            status: "yes",
                            reason: "",
                          })
                        }
                      >
                        Marcar asistencia
                      </button>
                      {r && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditor({ table: "responses", row: r })
                          }
                        >
                          Editar respuesta
                        </button>
                      )}
                      {r && (
                        <button
                          className="text-button danger"
                          onClick={() =>
                            setConfirmDelete({ table: "responses", row: r })
                          }
                        >
                          Borrar respuesta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Brand({ name = "Plástico" }: { name?: string }) {
  return <div className="brand"><span className="brand-official"><img src="/logo-uoyep.webp" alt="UOYEP"/></span><span className="brand-identity"><strong>{name}</strong><span>REPRESENTACIÓN GREMIAL</span></span></div>;
}
function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-layout">
      <div className="login-story">
        <Brand />
        <span className="eyebrow">ESPACIO DE DELEGADOS · UOYEP</span>
        <h1>
          La fuerza
          <br />
          de estar
          <br />
          <em>presentes.</em>
        </h1>
        <p>
          Un espacio compartido para quienes acompañan a nuestros compañeros,
          todos los días.
        </p>
      </div>
      <div className="login">
        <ShieldCheck size={30} />
        <h1>Bienvenido/a.</h1>
        <p className="muted">Ingresá con la cuenta habilitada por Plástico.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            const { error } = await supabase!.auth.signInWithPassword({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
            if (error)
              setError(
                "No pudimos iniciar sesión. Revisá tus datos o consultá a Administración.",
              );
            setBusy(false);
          }}
        >
          <label>
            Correo electrónico
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button disabled={busy}>
            {busy ? "Ingresando…" : "Ingresar a mi espacio"}
            <ArrowRight size={17} />
          </button>
        </form>
        <small>
          Para recuperar tu acceso, contactá a Administración de Plástico.
        </small>
      </div>
    </div>
  );
}
function MemberDirectory({
  members,
  onDetail,
  edit,
}: {
  members: Member[];
  onDetail: (m: Member) => void;
  edit?: (m: Member) => ReactNode;
}) {
  const [search, setSearch] = useState(""),
    [building, setBuilding] = useState(""),
    [page, setPage] = useState(1);
  const filtered = members.filter(
    (m) =>
      (!building || m.building === building) &&
      normalize(`${m.first_name} ${m.last_name} ${m.file_number}`).includes(
        normalize(search),
      ),
  );
  const total = Math.ceil(filtered.length / 8);
  return (
    <section className="surface directory">
      <div className="directory-toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="Buscar afiliado"
            placeholder="Buscar por nombre, apellido o legajo…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="building-filter">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Filtrar edificio"
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los edificios</option>
            {[...new Set(members.map((m) => m.building))].sort().map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Afiliado/a</th>
              <th>Legajo</th>
              <th>Edificio y área</th>
              <th>Horario</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((page - 1) * 8, page * 8).map((m) => (
              <tr key={m.id}>
                <td>
                  <button className="member-name" onClick={() => onDetail(m)}>
                    <Avatar name={`${m.first_name} ${m.last_name}`} small />
                    <strong>
                      {m.first_name} {m.last_name}
                    </strong>
                  </button>
                </td>
                <td>
                  <span className="file-number">{m.file_number}</span>
                </td>
                <td>
                  <strong className="cell-main">{m.building}</strong>
                  <small>{m.area}</small>
                </td>
                <td className="nowrap">
                  {m.start_time.slice(0, 5)} — {m.end_time.slice(0, 5)}
                </td>
                <td>
                  <div className="row-actions">
                    {edit?.(m)}
                    <button
                      className="icon-button"
                      aria-label={`Ver ficha de ${m.first_name} ${m.last_name}`}
                      onClick={() => onDetail(m)}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <Empty>No encontramos afiliados con esos datos.</Empty>
      )}
      <div className="pagination">
        <span>{filtered.length} afiliados encontrados</span>
        <div>
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>
            {page} / {total || 1}
          </span>
          <button
            className="secondary"
            disabled={page >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
function Coverage({ data }: { data: Data }) {
  const [date, setDate] = useState(today()),
    [query, setQuery] = useState("");
  const delegates = data.profiles.filter(
    (p) => p.role === "delegado" && p.active,
  );
  const buildings = [
    ...new Set(delegates.map((p) => p.building || "Sin asignar")),
  ]
    .sort()
    .filter((b) => normalize(b).includes(normalize(query)));
  return (
    <>
      <div className="coverage-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar edificio"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un edificio…"
          />
        </label>
        <label>
          Consultar fecha
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="coverage-summary">
        <strong>
          {
            delegates.filter((p) => !isOnLeave(p.id, date, data.vacations))
              .length
          }
        </strong>
        <span>delegados sin vacaciones informadas</span>
        <strong>
          {
            delegates.filter((p) => isOnLeave(p.id, date, data.vacations))
              .length
          }
        </strong>
        <span>de vacaciones</span>
      </div>
      <p className="muted">
        La disponibilidad contempla vacaciones informadas y el horario
        declarado; no registra otras licencias ni asistencia en tiempo real.
      </p>
      <div className="coverage-grid">
        {buildings.map((building) => {
          const people = delegates.filter(
            (p) => (p.building || "Sin asignar") === building,
          );
          const available = people.filter(
            (p) => !isOnLeave(p.id, date, data.vacations),
          ).length;
          return (
            <section className="surface" key={building}>
              <div className="coverage-title">
                <Building2 size={22} />
                <h2>{building}</h2>
              </div>
              <span
                className={`pill ${available ? "pale-lime" : "pale-orange"}`}
              >
                {available} de {people.length} disponibles
              </span>
              {people.map((p) => {
                const leave = isOnLeave(p.id, date, data.vacations);
                return (
                  <div className="coverage-person" key={p.id}>
                    <Avatar name={p.name} small />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.start_time.slice(0, 5)} — {p.end_time.slice(0, 5)} h
                      </small>
                    </div>
                    <span className={leave ? "leave-label" : "available-label"}>
                      {leave ? "Vacaciones" : "Disponible"}
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      {!buildings.length && (
        <Empty>No hay delegados asignados a ese edificio.</Empty>
      )}
    </>
  );
}
