# RouteHub — contexto para continuar con Claude

Actualizado: 23 de septiembre de 2026. Repositorio: `ifitotech/routehub`, rama `main`. Aplicación: `RouteHub-v2/`.

## Estado de entrega actual

La PWA está preparada para el piloto en código. El último push es `22951f3` (`Improve CEO platform control center`). Antes de los cambios recientes pasaron:

- `npm run typecheck`
- `npm test` — 169 pruebas aprobadas
- `npm run build`

`npm run lint` también pasa; quedan avisos históricos de dependencias de hooks, elementos `<img>` y dos avisos de Autoprefixer. No bloquean el build, pero no se deben ocultar ni convertir en errores sin una revisión específica.

La pendiente principal no es otra reescritura: es validación física del piloto en iPhone y Android. No afirmar que algo de GPS, cámara, firma, notificaciones o retorno desde Maps funciona en todos los dispositivos sin probarlo en un teléfono real.

## Arquitectura y áreas vigentes

- Driver de producción: `app/driver-v3/`, `components/driver-v3/`, `lib/driver-v3/`.
- El árbol antiguo `app/driver/` fue eliminado. No recrearlo ni editar rutas V2.
- Infraestructura de navegación Driver en uso: `app/driver-navigation-map.tsx`, `app/driver-route-navigation.tsx`, `app/driver-navigation.module.css`, `components/google-route-canvas.tsx`.
- Manager: `app/manager/`, `app/routes/`, `app/contacts/`, `app/settings/`.
- La app es multi-tenant con Supabase: evitar cambios de esquema/RLS/Auth sin revisar migraciones y flujos reales.

Lee también `ROUTEHUB_HANDOFF.md` y `CHATGPT_HANDOFF.md`: contienen decisiones anteriores útiles, pero este documento prevalece cuando haya contradicción sobre el estado reciente de Driver/PWA.

## Decisiones de producto ya aprobadas

### Planes

- **Simple:** creación y despacho de rutas, varios usuarios/drivers por tienda y navegación externa (Google/Apple Maps según dispositivo). Precio de entrada considerado: $39/tienda/mes.
- **Pro:** incluye navegación interna y herramientas avanzadas. Precio de entrada considerado: $59/tienda/mes.
- Los planes son por tienda, no por conductor. La preferencia individual de navegación no sustituye la autorización del plan.
- Durante el piloto se prueba Pro, pero la separación Simple/Pro debe quedar lista para activarse después.

### Privacidad, GPS y permisos

- RouteHub **solo rastrea** al conductor mientras existe una ruta activa y la navegación interna está activa dentro de la aplicación.
- No debe enviar ubicación al entrar a Today, por estar autenticado, ni con una ruta sin navegación activa.
- En una PWA, iOS/Android no permiten aprobar permisos automáticamente al instalar. Tras el login, Driver debe explicar la preparación y, al tocar una acción explícita, solicitar notificaciones y ubicación mediante las alertas normales del sistema.
- Si el usuario rechazó el permiso, se le guía a Ajustes; no se afirma que está activo ni se inventa GPS.
- Zebra/APK es futuro: no mezclar esos requisitos con el piloto PWA actual.

### Driver — UX aprobada

- Today y mapa comparten sesión, parada, progreso y ubicación; alternar Today/mapa nunca inicia, llega, completa, cancela ni reinicia la ruta.
- Modo Simple y Pro son independientes de navegación externa/interna. Simple conserva el flujo sencillo y navegación externa. Pro da información y navegación integrada cuando el plan lo permita.
- Navegación interna debe ser realmente fullscreen: solo mapa y tarjetas flotantes de maniobra y llegada. Sin header, logo, tabs ni barra superior de RouteHub tapando el mapa.
- La tarjeta inferior de navegación es flotante, compacta, con estética glass (iOS/Android), `Arrived` verde y `Exit` rojo lado a lado. No usar paneles pesados ni texto de bajo contraste.
- El marcador del conductor debe ser el camión profesional blanco/azul tipo cab-over (Isuzu), no una flecha ni una van infantil.
- El modo oscuro tiene que respetarse de extremo a extremo, incluidos mapas/superficies/loader. Nunca renderizar accidentalmente superficies claras en tema oscuro.
- Sin rutas pendientes: pantalla Today con saludo, sucursal real, jornada, actividad real del día, botón de sincronizar e ilustración. Cero no es error; error/carga/sin conexión son estados distintos.

### Manager — UX aprobada

- Manager y Driver son experiencias distintas; tomar del Driver únicamente referencias de adaptación móvil, zonas seguras, tamaños táctiles y calidad visual.
- En Manager, asignar/mover/unassign debe ser directo y claro, sin duplicar rutas.
- Billing no es prioridad operativa todavía: debe funcionar lo existente, pero no desarrollar cobro antes de cerrar el piloto.

## Cambios recientes relevantes (commit `50c002e`)

1. **GPS fresco al reabrir PWA.** `use-driver-data.ts` solo usa el último fix de una sesión si `last_updated_at` tiene menos de 90 segundos. Una ubicación de la mañana no debe reaparecer como posición actual por la tarde; espera una lectura foreground nueva.
2. **PWA segura durante conducción.** El service worker se registra con `'/sw.js?v=29'`. Si llega una actualización con navegación activa, se deja pendiente y no se recarga la app a mitad de ruta. Push y registro usan el mismo worker.
3. **Tema oscuro.** Se retiraron selectores CSS globales frágiles que coloreaban componentes por fragmentos de nombre de clase. Las superficies usan tokens y estilos explícitos Driver/Manager.
4. **Permisos y tour.** El flujo de preparación del driver usa gesto explícito para notificaciones/ubicación, con copy EN/ES/FR. No pide ni envía una ubicación de prueba durante el onboarding.
5. **Navegación.** Marcador de camión actualizado; estados sin ETA/GPS/route muestran copy real localizado, no cifras inventadas ni guiones engañosos.
6. **PWA.** Errores de `registration.update()` cuando está offline se controlan para no mostrar ruido ni romper la experiencia.

## CEO/Admin — cierre operativo (23 de septiembre de 2026)

El área CEO/Admin se está cerrando para operar el piloto, no para billing. Los cambios locales posteriores al último push mejoran el control operativo de compañías, solicitudes, errores, soporte, admins y auditoría:

- Dashboard con salud de plataforma, refresco manual, conteos reales de rutas activas/incidencias/drivers/managers y estado explícito si una consulta falla. No debe mostrar ceros ni “sin solicitudes” cuando los datos no se pudieron cargar.
- Companies, Support, Errors, Admins y Audit muestran estados de carga/error, previenen dobles acciones y dejan confirmación visible tras resolver o cambiar acceso. Audit enseña el actor asociado al evento; Support permite copiar un resumen compartible.
- Support y Errors separan explícitamente carga, datos y fallo de refresco: una consulta fallida no mezcla informes antiguos con un error ni presenta un estado vacío falso.
- Platform Admins y Audit aplican la misma regla: ante un fallo eliminan datos previos de la vista y ofrecen reintento, evitando que el CEO cambie accesos o interprete actividad desde una carga incompleta.
- El detalle de cada organización verifica cada consulta antes de renderizar sus conteos. Incluye carga, refresco y reintento; ante una falla no permite crear ramas ni presenta rutas, miembros o sucursales vacíos como datos válidos.
- Navegación CEO con iconos y etiquetas, más usable en móvil. Billing sigue fuera del flujo operativo principal hasta que se defina el cobro.
- Existe una migración nueva pendiente de aplicar en el entorno Supabase: `20260923170000_platform_admin_route_read.sql`. Añade exclusivamente `SELECT` de `public.routes` para miembros de `platform_admins`, necesario para que las métricas CEO de rutas funcionen sin ensanchar permisos de escritura. No afirmar que está activa en producción hasta aplicarla mediante el flujo de migraciones del proyecto.
- La prueba `tests/ceo-route-read-policy.test.mjs` protege que esa política sea solo de lectura y solo para platform admins.

## Validación pendiente para cerrar beta

Ejecutar primero en local:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Después probar en teléfonos reales, registrando dispositivo/versión/resultado:

1. Instalar PWA en iPhone y Android; login, tema guardado, tour y permisos concedidos/rechazados.
2. Crear y asignar una ruta desde Manager; abrirla en Driver; iniciar, navegar interno, llegar, capturar evidencia/firma cuando aplique, completar y pasar a la parada siguiente.
3. Cerrar y reabrir PWA durante una ruta, después de mover físicamente el teléfono; confirmar que no aparece una posición vieja ni se duplica GPS/voz/ruta.
4. Salir a Maps externo y volver; bloquear/desbloquear; perder red y recuperar. Confirmar cola offline y feedback claro.
5. Comprobar Today, navegación y finalización en claro/oscuro, iPhone normal/Pro Max y Android.
6. En Manager: crear ruta, asignar, mover, quitar asignación, incidencia e historial en móvil y escritorio.
7. Confirmar en producción las variables de Google Maps/Routes, Supabase y VAPID. No pegar secretos ni modificar RLS por intuición.

## Reglas de trabajo

- Antes de tocar UI móvil, renderizar la pantalla o validarla en dispositivo; no hacer cuatro iteraciones de CSS a ciegas.
- No reemplazar datos reales por valores de demo (`just now`, ETA falsa, GPS falsa, conteos fijos).
- No hacer cambios amplios de CSS global con selectores por fragmento de clases (`[class*='card']`, etc.). Revisar siempre colisiones de especificidad.
- Mantener cambios pequeños, `git pull --rebase origin main` antes de empezar y push frecuente.
- No usar `git reset --hard` ni abortar un rebase con modificaciones locales sin protegerlas antes.
- Evitar costes externos innecesarios: reutilizar caché/localización/solicitudes de ruta y no duplicar listeners GPS, voz o cálculo de rutas.
- Para cualquier cambio de Supabase, leer el skill/instrucciones de Supabase y revisar migraciones existentes.

## Qué no hacer sin una solicitud concreta

- No convertir PWA a APK/Capacitor aún.
- No perseguir ubicación en segundo plano fuera de navegación interna activa.
- No empezar billing/cobros.
- No resucitar Driver V2 ni páginas Driver eliminadas.
- No modificar una pantalla aprobada solo por preferencia visual: primero confirmar el síntoma y validar visualmente.
