import type { Data } from "./types";
const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const createDemo = (): Data => ({
  profiles: [
    {
      id: "d1",
      name: "Lucía Fernández",
      role: "delegado",
      building: "Sede Central",
      start_time: "08:00",
      end_time: "15:00",
      phone: "11 5550 0101",
      active: true,
    },
    {
      id: "s1",
      name: "Martín Suárez",
      role: "secretario",
      building: "Sede Central",
      start_time: "09:00",
      end_time: "17:00",
      phone: "11 5550 0102",
      active: true,
    },
    {
      id: "a1",
      name: "Administración Plástico",
      role: "admin",
      building: "Sede Central",
      start_time: "09:00",
      end_time: "17:00",
      phone: "11 5550 0100",
      active: true,
    },
    ...[
      "Diego Romero",
      "Carolina Méndez",
      "Pablo Acosta",
      "Valentina Ríos",
      "Julián Castro",
      "Sofía Torres",
    ].map((name, i) => ({
      id: `d${i + 2}`,
      name,
      role: "delegado" as const,
      building: ["Sede Central", "Planta Norte", "Planta Sur"][i % 3],
      start_time: i % 2 ? "10:00" : "08:00",
      end_time: i % 2 ? "17:00" : "15:00",
      phone: `11 5550 010${i + 3}`,
      active: true,
    })),
  ],
  members: [
    "Ana Martínez",
    "Carlos González",
    "Mariana López",
    "Diego Rodríguez",
    "Laura Pérez",
    "Santiago García",
    "Camila Díaz",
    "Jorge Silva",
    "Florencia Ruiz",
    "Nicolás Gómez",
    "Paula Álvarez",
    "Gabriel Costa",
    "Daniela Molina",
    "Matías Herrera",
    "Luciana Vega",
    "Federico Sosa",
    "Andrea Ramos",
    "Hernán Medina",
  ].map((name, i) => ({
    id: `m${i}`,
    first_name: name.split(" ")[0],
    last_name: name.split(" ")[1],
    file_number: String(42001 + i),
    building: ["Sede Central", "Planta Norte", "Planta Sur"][i % 3],
    area: [
      "Operaciones",
      "Administración",
      "Recursos humanos",
      "Sistemas",
    ][i % 4],
    position: ["Administrativo/a", "Analista", "Profesional"][i % 3],
    management: ["Producción", "Administración", "Desarrollo Humano"][
      i % 3
    ],
    start_time: i % 2 ? "09:00" : "08:00",
    end_time: i % 2 ? "16:00" : "15:00",
    phone: `11 5550 ${String(200 + i).padStart(4, "0")}`,
  })),
  events: [
    {
      id: "e1",
      title: "Plenario de delegados",
      description:
        "Nos encontramos para compartir las novedades de cada edificio, trabajar sobre las inquietudes de nuestros compañeros y definir la agenda gremial del próximo mes.",
      date: `${day(5)}T14:00:00-03:00`,
      location: "Auditorio · Sede Central",
      category: "Plenario",
      urgent: true,
    },
    {
      id: "e2",
      title: "Encuentro de formación gremial",
      description:
        "Un espacio de intercambio sobre representación, derechos laborales y herramientas para el trabajo cotidiano de los delegados.",
      date: `${day(12)}T10:00:00-03:00`,
      location: "Sala de reuniones · Planta Norte",
      category: "Formación",
      urgent: false,
    },
    {
      id: "e3",
      title: "Jornada de integración Plástico",
      description:
        "Una jornada para encontrarnos y fortalecer los vínculos entre los equipos de los distintos edificios.",
      date: `${day(19)}T11:00:00-03:00`,
      location: "Lugar a confirmar por Secretaría",
      category: "Encuentro",
      urgent: false,
    },
  ],
  responses: [
    { id: "r1", event_id: "e1", user_id: "d2", status: "yes", reason: "" },
    { id: "r2", event_id: "e1", user_id: "d3", status: "yes", reason: "" },
  ],
  vacations: [
    { id: "v1", user_id: "d3", start_date: day(-2), end_date: day(7) },
    { id: "v2", user_id: "d5", start_date: day(3), end_date: day(14) },
  ],
  benefits: [
    {
      id: "b1",
      category: "Turismo",
      title: "Tu próximo descanso",
      description: "Propuestas para disfrutar con quienes más querés.",
      detail:
        "Contenido de muestra. Aquí Plástico podrá publicar destinos, temporadas, requisitos y tarifas de sus convenios turísticos vigentes.",
      contact: "",
    },
    {
      id: "b2",
      category: "Obra social",
      title: "Cuidarnos, siempre",
      description: "Orientación y canales de atención para tu salud.",
      detail:
        "Contenido de muestra. La administración podrá cargar los canales oficiales, trámites de afiliación y documentación necesaria.",
      contact: "",
    },
    {
      id: "b3",
      category: "Gimnasio",
      title: "Un momento para vos",
      description: "Bienestar y movimiento cerca de tu trabajo.",
      detail:
        "Contenido de muestra. Aquí se informarán los gimnasios adheridos, condiciones del beneficio y procedimiento de inscripción.",
      contact: "",
    },
    {
      id: "b4",
      category: "Recreación",
      title: "Más espacios compartidos",
      description: "Actividades y encuentros para toda la familia.",
      detail:
        "Contenido de muestra. Aquí se publicarán las actividades recreativas y los requisitos para participar.",
      contact: "",
    },
  ],
  notifications: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "s1", "a1"].map(
    (id) => ({
      id: `n-${id}`,
      user_id: id,
      event_id: "e1",
      title: "Nueva convocatoria: Plenario de delegados",
      read: false,
    }),
  ),
  settings: [
    {
      id: "general",
      name: "Plástico",
      subtitle: "Espacio de delegados",
      contact: "Secretaría gremial",
    },
  ],
});
