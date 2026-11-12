# Plástico · Nuestro espacio

Muestra de PWA para el Sindicato del Plástico, inspirada funcionalmente en UTI y con identidad visual propia. Logos originales de UOYEP y CFP preservados, tipografía local, azul intenso, lima y acentos cálidos. Proyecto independiente: no modifica el campus existente ni UTI.

## Desarrollo

Node.js 22 o superior. `npm ci`, `npm run dev`. Para compilar: `npm run build`. Para verificar: `npm test` (requiere Chromium de Playwright: `npx playwright install chromium`).

## Alcance de la muestra

- Inicio, tres aulas con recorridos breves, búsqueda y progreso local.
- Agenda ficticia de noviembre 2026, interés reversible y exportación de calendario.
- Presentación de categorías de beneficios y credencial explícitamente sin validez.
- Navegación móvil, instalación PWA y shell sin conexión después de una primera visita completa.
- Ayuda, notificaciones e información del perfil ficticio.

Todos los nombres, actividades y contenidos académicos son demostrativos. No hay autenticación, afiliación real, inscripciones enviadas, descuentos vigentes, emisión de certificados ni conexión al LMS. El avance y el interés se guardan únicamente en este navegador, sin compartirlos con otros dispositivos. No ingresar datos personales reales.

## Arquitectura y publicación

React + TypeScript estricto + Vite. Íconos Lucide, fuente DM Sans local, sin APIs externas ni secretos. Esta muestra visual es separada del monolito educativo Next/Nest del sindicato. No se modifican bases de datos ni Docker. Para convertirla en un servicio real hace falta integrar autenticación y permisos del backend, registros de afiliación, contenidos y convenios validados.

GitHub: https://github.com/Ivosero/PWA-para-el-sindicato-del-plastico

Vercel: importar este repositorio, framework Vite, build `npm run build`, salida `dist`. No requiere variables de entorno. `vercel.json` configura encabezados de seguridad y evita cachear permanentemente el service worker.

Pruebas E2E: progreso persistente, filtros, agenda reversible y descarga de calendario, ausencia de desbordes en 360/390/768/1024/1440, navegación móvil y funcionamiento offline. Capturas en `evidence/`.
