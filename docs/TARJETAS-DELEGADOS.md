# Tarjeta de delegado con QR e imagen

## Uso

El delegado abre **Tarjetas de delegados** o **Mi perfil → Ver mi tarjeta**. **Editar mis datos** permite completar WhatsApp con código de país (por ejemplo, para Argentina, +54 9 seguido del código de área y el número celular, sin 0 ni 15). El teléfono habitual queda separado de WhatsApp.

La tarjeta es una imagen PNG de 1080 píxeles de ancho con logo, nombre, edificio, horario, número de WhatsApp y QR. El QR codifica `https://wa.me/<numero-internacional>`; abre el chat del delegado y no publica el perfil privado. Se validó el QR descargado con un decodificador independiente.

**Compartir tarjeta por WhatsApp** entrega el PNG al menú de compartir del sistema cuando el navegador admite Web Share de archivos. La persona debe elegir WhatsApp y el chat de destino. La aplicación no envía mensajes automáticamente ni puede imponer la aplicación elegida en el menú nativo.

En navegadores sin Web Share de archivos, el botón descarga el PNG y ofrece abrir WhatsApp. La persona adjunta la imagen manualmente; los enlaces `wa.me` no pueden adjuntar archivos por sí solos. **Descargar tarjeta PNG** está disponible siempre que se haya configurado un WhatsApp válido.

Secretaría y Administración pueden seleccionar tarjetas de los delegados activos que ya tienen permiso para consultar. Los delegados solo reciben su propia tarjeta. La generación es local, sin servicios externos de imágenes o QR.

## Datos y actualización

Se agrega `profiles.whatsapp` como campo independiente y opcional. Un número ausente o inválido no genera QR ni permite compartir la imagen. Se normaliza a formato internacional con `+`; no se adivina el país a partir de un teléfono local.

La vista se regenera al guardar cambios en el perfil. Una imagen ya descargada o enviada conserva la versión anterior: hay que generar y compartir una nueva si cambian los datos. Las tarjetas de muestra indican que los datos son ficticios y no constituyen un canal oficial.

## Entorno conectado

Aplicar `supabase/migrations/003_delegate_whatsapp.sql` después de las migraciones anteriores. Agrega la columna con valor vacío para perfiles existentes y una restricción de formato. Conserva las políticas RLS y controles de edición de perfiles. No se aplicó a ninguna base remota; la PWA publicada continúa como muestra local.

## Verificación

Pruebas de formatos, QR decodificado desde el PNG, actualización y persistencia del perfil, envío de archivo al menú nativo simulado, cancelación sin descarga, alternativa de descarga, selección por rol y adaptación a cinco tamaños. Se prueba además la migración y su restricción en PostgreSQL embebido. Las pruebas no envían mensajes reales a WhatsApp.
