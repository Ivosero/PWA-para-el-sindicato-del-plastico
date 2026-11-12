import { createClient } from "@supabase/supabase-js";
import { createDemo } from "./demo";
import type { Data, Table, Row, Profile } from "./types";
const env = import.meta.env;
export const demo = (env.VITE_APP_MODE || "demo") === "demo";
export const supabase =
  !demo && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;
export const configurationError = !demo && !supabase;
const key = "plastico-demo-v1";
let memory: Data | undefined;
function local(): Data {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(key);
    memory = raw ? JSON.parse(raw) : createDemo();
  } catch {
    memory = createDemo();
  }
  // Upgrade only untouched fictitious profiles from previous sample versions.
  const defaults = createDemo().profiles;
  memory!.profiles = memory!.profiles.map((profile) => {
    const seed = defaults.find((p) => p.id === profile.id && p.phone === profile.phone);
    return { ...profile, whatsapp: profile.whatsapp ?? seed?.whatsapp ?? "" };
  });
  return memory!;
}
export async function loadData(userId: string): Promise<Data> {
  if (demo) {
    const data = structuredClone(local());
    const p = data.profiles.find((x) => x.id === userId);
    if (p?.role === "delegado") {
      data.profiles = data.profiles.filter((x) => x.id === userId);
      data.vacations = data.vacations.filter((x) => x.user_id === userId);
      data.responses = data.responses.filter((x) => x.user_id === userId);
    }
    data.notifications = data.notifications.filter((n) => n.user_id === userId);
    return data;
  }
  if (!supabase) throw new Error("Falta configurar la conexión segura.");
  const tables: Table[] = [
    "profiles",
    "members",
    "events",
    "responses",
    "vacations",
    "benefits",
    "notifications",
    "settings",
  ];
  const entries = await Promise.all(
    tables.map(async (table) => {
      let rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase!
          .from(table)
          .select("*")
          .order("id")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        rows = rows.concat(data);
        if (data.length < 1000) break;
      }
      return [table, rows];
    }),
  );
  return Object.fromEntries(entries) as Data;
}
function commit() {
  localStorage.setItem(key, JSON.stringify(memory));
}
function permitted(table: Table, row: Row, actor: Profile) {
  if (actor.role === "admin") return true;
  if (table === "events") return actor.role === "secretario";
  if (table === "profiles")
    return (
      row.id === actor.id &&
      "role" in row &&
      row.role === actor.role &&
      row.active === actor.active
    );
  if (["vacations", "responses", "notifications"].includes(table))
    return "user_id" in row && row.user_id === actor.id;
  return false;
}
export async function saveRow(table: Table, row: Row, actor: Profile) {
  if (demo) {
    if (!permitted(table, row, actor))
      throw new Error("No tenés permisos para esta acción.");
    const d = local();
    const items = d[table] as Row[];
    const index = items.findIndex((x) => x.id === row.id);
    if (index >= 0) items[index] = structuredClone(row);
    else items.push(structuredClone(row));
    if (table === "events") {
      const event = row as Data["events"][number];
      for (const p of d.profiles.filter((x) => x.active)) {
        d.notifications.push({
          id: crypto.randomUUID(),
          user_id: p.id,
          event_id: event.id,
          title: `${index >= 0 ? "Convocatoria actualizada" : "Nueva convocatoria"}: ${event.title}`,
          read: false,
        });
      }
    }
    commit();
    return;
  }
  const value = row as unknown as Record<string, unknown>;
  const { error } =
    table === "profiles" || table === "notifications"
      ? await supabase!.from(table).update(value).eq("id", row.id)
      : await supabase!.from(table).upsert(value);
  if (error) throw new Error(error.message);
}
export async function removeRow(table: Table, id: string, actor: Profile) {
  if (demo) {
    const d = local();
    const row = (d[table] as Row[]).find((x) => x.id === id);
    if (!row) return;
    if (!permitted(table, row, actor))
      throw new Error("No tenés permisos para esta acción.");
    (d[table] as Row[]) = (d[table] as Row[]).filter((x) => x.id !== id);
    if (table === "events") {
      d.responses = d.responses.filter((r) => r.event_id !== id);
      d.notifications = d.notifications.filter((n) => n.event_id !== id);
    }
    commit();
    return;
  }
  const { error } = await supabase!.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export async function subscribePush(userId: string) {
  if (demo)
    throw new Error(
      "Las alertas push se activan al conectar el entorno de producción. En la muestra podés consultar las alertas dentro de la app.",
    );
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error(
      "Este navegador no admite notificaciones push. En iPhone, instalá la app en la pantalla de inicio y abrila desde allí.",
    );
  if (!env.VITE_VAPID_PUBLIC_KEY)
    throw new Error("Falta configurar la clave pública de notificaciones.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "No se habilitaron las notificaciones. Podés cambiar el permiso en tu navegador.",
    );
  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(env.VITE_VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  const { error } = await supabase!
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}
