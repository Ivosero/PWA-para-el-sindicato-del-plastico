# Plástico · Espacio gremial

PWA de gestión gremial para delegados/as, secretarios/as gremiales y administración del Sindicato del Plástico. Adaptación directa del código de UTI: conserva su lógica, formularios, validaciones y permisos. Identidad propia con logos UOYEP/CFP, fondos profundos y degradados azul, verde y violeta. No es un campus educativo.

Muestra: https://pwa-para-el-sindicato-del-plastico.vercel.app/
Repositorio: https://github.com/Ivosero/PWA-para-el-sindicato-del-plastico

## Funciones equivalentes a UTI

- Padrón: búsqueda sin acentos, filtros, fichas completas y paginación. Administración puede crear, editar y eliminar registros.
- Convocatorias: Secretaría y Administración publican, editan y eliminan. Delegados confirman asistencia o justifican ausencia; Secretaría consulta respuestas.
- Vacaciones: declaración, cancelación y validación de superposiciones. Cada delegado consulta las propias.
- Cobertura por edificio: disponible para Secretaría y Administración; refleja horarios y vacaciones.
- Beneficios e información: consulta y administración de contenidos.
- Perfil: edificio, horario y teléfono editables; administración de roles y cuentas activas.
- Notificaciones de convocatorias, estado de conexión, instalación y uso offline de la muestra.

La marca CFP se conserva como parte de los logos solicitados; no se incluyen aulas ni cursos.

## Ejecutar y verificar

Node.js 22 o superior. `npm ci`, `npm run dev`. `npm run build` compila TypeScript y genera la aplicación con caché PWA versionada. `npm test` ejecuta Playwright; requiere `npx playwright install chromium`.

La muestra es el modo predeterminado. Se cambia de rol desde el selector superior: Delegado/a, Secretaría, Administración. Los datos son ficticios y se guardan únicamente en este navegador, con la clave `plastico-demo-v1`. No cargar datos personales reales. La selección de un rol de muestra no constituye autenticación ni seguridad de producción.

## Medidas gremiales

Los delegados pueden informar personas alcanzadas y adherentes por edificio. Secretaría y Administración crean medidas y consultan porcentajes ponderados, gráficos, edificios pendientes e informe imprimible/PDF y CSV. Un único parte por edificio y medida evita duplicar cargas. La muestra guarda estos datos en el navegador. Ver [uso, metodología, permisos y migración](docs/MEDIDAS-GREMIALES.md).

## Conexión real

Se conserva el adaptador Supabase de UTI, sus migraciones con permisos RLS y restricciones, y la función de envío de alertas Web Push, en `supabase/`. La muestra publicada no tiene una base real conectada ni envío push real. Para habilitarlo, configurar un proyecto Supabase independiente según `docs/PRODUCCION.md`, desplegar sus migraciones y función, y configurar `VITE_APP_MODE=production`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_VAPID_PUBLIC_KEY`. Nunca reutilizar el padrón ni las credenciales de UTI. Las claves administrativas deben permanecer exclusivamente en el backend.

La política CSP debe autorizar los orígenes HTTPS y WSS exactos del nuevo Supabase al conectar ese entorno. El CSP actual permite únicamente el origen propio, adecuado para la muestra.

## Publicación

Vercel vinculado a `main`; cada push despliega automáticamente. Framework Vite, `npm run build`, salida `dist`. Para la muestra no hacen falta variables de entorno. Logos locales, fuentes locales y sin servicios de IA. No se modificó el proyecto UTI original ni el campus educativo del sindicato.

## Verificación

Se reutilizan las siete pruebas funcionales de UTI: padrón y perfil, asistencia justificada, vacaciones y cobertura, publicación con notificaciones, edición administrativa, navegación móvil y uso offline. Una prueba adicional recorre las vistas de cada rol en 360, 390, 768, 1024 y 1440 píxeles. Las capturas de escritorio y celular se guardan en `evidence/`.
