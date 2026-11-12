# Puesta en marcha del entorno conectado

## 1. Base de datos y autenticación

Crear un proyecto Supabase y ejecutar `supabase/migrations/001_initial.sql` en una base nueva. La migración se aplica una sola vez. Alternativamente, usar el CLI de Supabase y su historial de migraciones.

Desactivar el registro público en Auth. Las cuentas se crean desde Authentication → Users. Toda cuenta nueva recibe un perfil de delegado **inactivo**, independientemente de los metadatos que envíe. Definir nombre en el metadato `name` si se desea. Entregar acceso por un canal institucional; no subir claves al repositorio.

Después de crear la primera cuenta, habilitar su perfil desde SQL Editor:

```sql
update public.profiles
set role = 'admin', active = true, name = 'Administración Plástico'
where id = 'UUID-DE-LA-CUENTA-CREADA';
```

Ingresar en la aplicación con esa cuenta. En Administración se habilitan otras cuentas y se asignan roles. El alta y recuperación de credenciales permanecen en el servicio Auth; no se implementa un panel para administrar contraseñas desde el navegador. La interfaz informa que la recuperación debe tramitarse con Administración.

No eliminar el último administrador desde Auth. La aplicación impide degradar o desactivar al último administrador mediante una actualización normal. Las operaciones directas de un operador de base de datos tienen privilegios mayores que los de la aplicación.

## 2. Variables públicas del frontend

Configurar en Vercel (Production) o en el build del VPS:

```dotenv
VITE_APP_MODE=production
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=CLAVE-PUBLICA-ANON-O-PUBLISHABLE
VITE_VAPID_PUBLIC_KEY=CLAVE-PUBLICA-VAPID
```

Las variables `VITE_*` se incluyen en el JavaScript público. **Nunca** colocar la clave `service_role`, contraseñas, claves privadas VAPID o secretos de trabajos en ellas. Sin configuración de producción la aplicación se bloquea; no habilita la muestra de manera automática.

En Auth, configurar la URL final del sitio y sus redirecciones autorizadas. El frontend utiliza correo y contraseña, tokens administrados por Supabase y controles RLS en cada tabla. El selector de roles solo existe en modo demo.

## 3. Permisos y privacidad

- Padrón: lectura de cuentas activas; escritura de administradores.
- Perfiles: el titular ve y edita sus datos operativos. Secretaría ve perfiles para coordinar cobertura. Un trigger impide cambiar el rol o la habilitación propia sin ser administrador.
- Vacaciones: solo el titular, Secretaría y Administración pueden leerlas. Solo el titular y Administración pueden modificarlas.
- Respuestas: privadas para su titular y los perfiles de coordinación. Una ausencia sin motivo se rechaza también en PostgreSQL.
- Eventos: Secretaría y Administración publican. Un trigger crea las alertas dentro de la misma transacción.
- Auditoría: registra actor, tabla, identificador, operación y fecha; no copia teléfonos o justificaciones al log.
- Cuentas deshabilitadas pierden acceso a los datos aunque su token no haya vencido.

El service worker guarda únicamente la aplicación pública y sus assets; nunca respuestas de la API ni el padrón. Los registros de producción permanecen en memoria durante la sesión. La sesión de autenticación se conserva mediante el SDK; cerrar sesión borra el estado de la interfaz. En dispositivos compartidos, cerrar sesión al terminar.

La consulta inicial pagina las solicitudes a la API en lotes de 1.000. La búsqueda y filtros del padrón se ejecutan en el cliente sobre los registros accesibles. Para padrones muy grandes, conviene migrar búsqueda, filtros y paginación al servidor antes de cargar el volumen completo.

## 4. Alertas y confirmaciones

Cada publicación o modificación de un evento crea una alerta en la bandeja de **todas las cuentas activas**, junto con un trabajo durable en `push_jobs`. Realtime actualiza la bandeja y existe una actualización adicional cada 60 segundos. Una confirmación guarda la respuesta del usuario; “No asistiré” abre el formulario de justificación.

Para alertas fuera de la aplicación, configurar Web Push:

```sh
npx web-push generate-vapid-keys
```

Guardar las claves en un gestor de secretos. Desplegar `supabase/functions/deliver-push/index.ts` con estos secretos de servidor:

```text
VAPID_SUBJECT=mailto:CONTACTO-INSTITUCIONAL
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PUSH_WORKER_SECRET=valor-aleatorio-largo
```

Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función. Desplegar con `supabase functions deploy deliver-push --no-verify-jwt`: el endpoint valida su propio `PUSH_WORKER_SECRET`. Esta función no es llamada desde el navegador.

Programar un POST cada minuto desde Supabase Cron o un scheduler del VPS:

```http
POST https://TU-PROYECTO.supabase.co/functions/v1/deliver-push
Authorization: Bearer SECRETO-DEL-WORKER
```

Guardar el secreto de cron en Vault o en variables protegidas del servidor. No escribirlo en un cron público ni en GitHub. El worker reclama hasta 50 trabajos usando `FOR UPDATE SKIP LOCKED`, elimina suscripciones vencidas y reintenta hasta 5 veces. La entrega es “al menos una vez”: una falla parcial puede generar una alerta duplicada; el service worker agrupa visualmente la convocatoria con un tag común.

Revisar fallos definitivos:

```sql
select id, user_id, attempts, last_error
from public.push_jobs
where completed_at is null and attempts >= 5;
```

Reintentar manualmente luego de resolver la causa, restableciendo `attempts = 0` y `available_at = now()` en los trabajos afectados. La bandeja interna conserva la convocatoria aunque el dispositivo no reciba push.

El usuario debe aceptar notificaciones desde Mi perfil. Para iOS, usar la PWA instalada y un sistema compatible. El navegador y el sistema operativo controlan la entrega: no es posible garantizar que toda persona vea una alerta externa. La lista de respuestas permite a Secretaría identificar pendientes.

## 5. VPS Hostinger

El frontend puede salir de Vercel sin reescribir la aplicación. Docker sirve los archivos compilados con Nginx:

```sh
docker compose --env-file .env -f deploy/compose.yml up -d --build
```

Configurar `.env` con las variables de producción. El puerto queda limitado a `127.0.0.1:8080`. Colocar delante un proxy HTTPS con el dominio institucional (por ejemplo Nginx o Caddy) y certificados válidos. PWA y Web Push requieren un contexto seguro; localhost es la excepción para desarrollo.

Esta configuración mueve **el frontend** al VPS. Auth, PostgreSQL, Realtime y Edge Functions siguen en Supabase. Autoalojar también el backend requiere desplegar la plataforma Supabase completa y configurar backups, SMTP, TLS, monitorización y actualizaciones; **no** alcanza con sustituir la URL por un PostgreSQL suelto. El esquema es SQL PostgreSQL pero utiliza `auth.users`, `auth.uid()` y los roles de Supabase.

## 6. Activación institucional

Antes de cargar el padrón real: verificar los tres roles en el proyecto definitivo, confirmar restauración de backups, cargar beneficios y contactos oficiales, probar un evento con dos cuentas y dos dispositivos, y verificar que las alertas llegan y las respuestas vuelven a Secretaría. Usar un entorno de prueba separado de producción. Las pruebas locales no sustituyen esta comprobación de servicios y dispositivos reales.

Fuentes técnicas: [permisos RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [gestión de perfiles](https://supabase.com/docs/guides/auth/managing-user-data), [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) y [operación offline](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).
