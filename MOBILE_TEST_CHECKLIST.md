# Checklist móvil y permisos

- iPhone Safari: instalar desde Compartir → Añadir a pantalla de inicio; probar cámara y ubicación con HTTPS.
- Android Chrome: instalar desde el menú; probar orientación vertical/horizontal y volver online tras modo avión.
- Desktop Chrome y Edge: abrir `/driver`, comprobar que los controles no se cortan y que los permisos muestran mensajes claros.
- Red lenta/offline: cargar una ruta ya visitada y comprobar que sigue visible. Iniciar, marcar llegada, completar o reportar deben indicar que necesitan conexión y dejar la parada activa; al recuperar conexión se puede reintentar sin duplicar la llegada.
- GPS apagado/denegado: pulsar “Completar con GPS”; debe indicar activar Ubicación o permitir el permiso.
- Cámara denegada: pulsar completar con foto sin archivo; debe pedir seleccionar una imagen o conceder permiso.
- Usuario sin permisos: iniciar con usuario sin `company_users`; debe mostrarse el mensaje de permisos y no exponer datos.
