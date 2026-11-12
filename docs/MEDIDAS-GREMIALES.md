# Medidas gremiales y adhesión por edificio

## Uso

1. Secretaría o Administración abre **Medidas gremiales → Nueva medida**, indica nombre, fecha, descripción y los edificios incluidos. Se guardan los delegados activos asignados a cada edificio al momento de crearla.
2. El delegado abre la medida y completa el total de personas alcanzadas y cuántas adhieren. No se piden nombres de adherentes, legajos ni motivos individuales. Cada persona debe contarse una sola vez en el edificio acordado para ese relevamiento.
3. Un parte vigente por medida y edificio evita sumar dos declaraciones del mismo edificio. Cualquier delegado asignado puede corregir ese parte; una actualización reemplaza los valores anteriores.
4. Secretaría y Administración consultan el informe agregado, los gráficos por edificio y la cobertura de los partes. **Actualizar partes** consulta nuevamente los datos.
5. **Descargar CSV** exporta el detalle y la metodología. **Imprimir / PDF** abre la impresión del navegador; seleccionar Guardar como PDF genera el informe con gráficos.
6. **Cerrar carga** requiere una confirmación y bloquea nuevas declaraciones. Se conservan los datos y el informe. No hay reapertura en esta versión.

## Cálculo y límites

- Adhesión de un edificio: adherentes / personas alcanzadas declaradas en ese edificio.
- Adhesión del conjunto informado: suma de adherentes / suma de personas alcanzadas en edificios con parte. No es un promedio simple de porcentajes.
- Cobertura: edificios con parte / edificios incluidos en la medida.
- Un edificio sin parte representa información desconocida, nunca cero adhesiones. Un parte con cero adherentes sí representa una declaración explícita de cero.
- El padrón de afiliados no se toma automáticamente como denominador; puede ser distinto del personal alcanzado por una medida.
- La adhesión declarada no demuestra impacto productivo, suspensión de servicios ni resultados de una negociación. El informe lo aclara y no extrapola edificios pendientes.
- El alcance y las asignaciones quedan fijados al crear la medida. Cambiar después el perfil de un delegado no le concede acceso a otro edificio de esa medida. Revisar los edificios y perfiles antes de crearla.

## Entornos y persistencia

La dirección pública continúa en modo muestra. Medidas y partes ficticios se guardan en `plastico-measures-v1`, dentro del navegador. Los cambios no se comparten entre dispositivos. El resto de los datos de la PWA conserva su almacenamiento previo.

Para un entorno conectado, aplicar `supabase/migrations/002_industrial_measures.sql` después de la migración inicial en el proyecto Supabase independiente de Plástico. No se ejecutó sobre ninguna base remota. La migración agrega:

- `industrial_measures`: alcance, fecha, descripción y estado de carga.
- `adhesion_reports`: restricción única por medida/edificio; enteros, total positivo y adherentes entre cero y el total.
- `adhesion_report_history`: historial de inserciones y correcciones con usuario y hora del servidor, consultable por gestión.
- RLS: gestión crea/cierra y lee el conjunto; delegados cargan/leen únicamente edificios asignados. Usuarios anónimos no acceden.
- Triggers: autor y hora se fijan en servidor, las asignaciones son inmutables y la carga se bloquea al cerrar. Un bloqueo de fila serializa cargas frente al cierre.

El historial de correcciones es de backend; no se ofrece una pantalla de historial en esta versión. La muestra local conserva únicamente el último parte.

## Verificación

`tests/measures.spec.ts`: porcentajes ponderados, faltantes, cero, validación, carga y corrección, persistencia, informe, CSV, impresión, cierre y creación. Recorre los tres roles en cinco anchos de pantalla.

`tests/measures-db.spec.ts`: aplica la migración a PostgreSQL embebido (PGlite), con una fixture mínima de perfiles/autenticación. Comprueba RLS, identidad fijada por servidor, rechazo de otro edificio, restricción de cantidades, actualización entre delegados del mismo edificio sin duplicar el parte, historial y cierre. No sustituye verificar las migraciones completas y Auth en el Supabase real antes de habilitar producción.

La dependencia PGlite se usa exclusivamente en desarrollo/pruebas, no se envía al navegador. No se modificó Docker ni una base existente.
