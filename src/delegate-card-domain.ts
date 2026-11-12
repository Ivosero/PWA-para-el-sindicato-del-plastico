import type { Profile } from "./types";
export function whatsappNumber(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact.slice(1) : null;
}
export function delegateShareText(
  profile: Profile,
  organization: string,
  sample: boolean,
) {
  const number = whatsappNumber(profile.whatsapp || "");
  return [
    sample ? "MUESTRA · Datos ficticios · Sin validez institucional" : null,
    `${organization} · Tarjeta de delegado/a`,
    profile.name,
    `Edificio: ${profile.building || "Sin asignar"}`,
    `Horario: ${profile.start_time.slice(0, 5)} a ${profile.end_time.slice(0, 5)} h`,
    number
      ? `WhatsApp de contacto: +${number}`
      : "WhatsApp de contacto: sin informar",
    number ? `https://wa.me/${number}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
