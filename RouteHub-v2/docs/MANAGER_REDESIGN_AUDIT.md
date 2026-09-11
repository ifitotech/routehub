# RouteHub Manager — Auditoría y plan de rediseño

**Fecha:** 2026-09-10
**Alcance:** Solo Manager (Today, Routes, Add Route, Contacts, Team, Invitations, History, Reports, Settings, More).
**Fuera de alcance:** Driver (`app/driver/**`, `app/driver-v3/**`, `components/driver-v3/**`, `lib/driver/**`, `lib/driver-v3/**`) — su flujo y estructura no se tocan. Solo se anotan defectos menores de responsive/contraste/textos.
**Restricciones respetadas:** sin cambios a Supabase schema, RLS, Auth, Storage, GPS, FCM, Service Worker, rutas de datos, cola de paradas, orden de stops, permisos ni lógica Pickup/Delivery/Return. Sin migraciones ni tablas nuevas. Sin eliminar handlers ni reemplazar queries. Sin push ni commit. Este documento es solo la propuesta; no se ha escrito código de rediseño todavía.

---

## 1. Resumen ejecutivo

El Manager funciona, pero **visualmente parece una beta**: hay tres sistemas de tokens de color compitiendo, tres azules "primarios" distintos, ~150 usos de `!important`, y una capa de "parches finales" (`app/final-polish.css`, 543 líneas) que sobrescribe módulos CSS apuntando a **hashes de CSS Modules** (`[class*="route_"]`, `[class*="history_"]`). La navegación tiene rutas duplicadas (Contacts aparece 2–3 veces, "More" y "Settings" se solapan) y **tres barras inferiores diferentes** en pantallas de Manager. El modo oscuro está **activo por defecto** para un Manager nuevo, en contra del objetivo de "solo modo claro".

El rediseño no necesita tocar lógica: casi todo el problema es **una sola fuente de verdad de estilos + jerarquía de información**. La propuesta consolida los tokens, elimina la capa de parches para Manager, unifica el shell/navegación y reordena cada pantalla alrededor de la pregunta operativa: *¿qué pasa hoy, qué ruta necesita atención, qué hago ahora?*

### Criterio de éxito
Un Manager nuevo, en <10 s en **Today**, debe ver: (a) el pulso del día (activas / pendientes / completadas / incidencias), (b) qué ruta o driver requiere atención, (c) el botón de acción evidente (Nueva ruta / Ver ruta con incidencia). El mapa es contexto, no protagonista.

---

## 2. Auditoría del código

### 2.1 Sistema visual: fragmentación (P0)

**Tres juegos de tokens en paralelo**, ninguno canónico:

| Origen | Tokens | Azul primario | Texto | Fondo página |
|---|---|---|---|---|
| `app/globals.css` `:root` | `--bg --surface --ink --muted --line --primary` | `#2468df` | `#14233b` | `#f5f8fc` |
| `app/final-polish.css` `:root` | `--rh-primary --rh-bg --rh-surface --rh-text --rh-text-secondary --rh-border --rh-radius-* --rh-shadow-card` | `#2563eb` | `#0f172a` | `#f8fafc` |
| `app/manager/manager-shell.module.css` `.shell` | `--rh-blue --rh-page-bg --rh-card --rh-text --rh-muted --rh-soft-blue --rh-success --rh-warning --rh-error --rh-border --rh-divider` | `#1667f2` | `#0f1d35` | `#f7f9fc` |

Resultado: **3 azules** (`#2468df`, `#2563eb`, `#1667f2`), **3 tintas de texto**, **3 fondos**, radios y sombras definidos 2–3 veces con valores distintos. Los módulos de pantalla mezclan `var(--rh-blue, #1667f2)` con hex sueltos (`#667892`, `#0f1d35`, `#16b96b`, `#1768ee`, `#071b42`…).

**Capa de parches global sobre CSS Modules** (`final-polish.css`):
- Reglas que seleccionan `html[data-theme="dark"] [class*="route_"]`, `[class*="history_count"]`, `.app article[class*="route_"]` — dependen del hash que genera Next en build. Frágil: cambiar el nombre de una clase en el módulo rompe el parche en silencio.
- El "Final shared workspace header" se redefine **3 veces** en `final-polish.css` (líneas ~69, ~103, ~166) con `!important` en cada capa.
- `app/routes/add-route-desktop.css`: 60 líneas, **todas** `!important`.

**Modo oscuro (P0 para el objetivo "solo claro"):**
- `lib/use-preferences.ts`: `themePreference()` devuelve `'dark'` cuando no hay preferencia guardada; `useThemePreference` inicia en `'dark'`; `applyThemePreference(preference = 'dark')`. **Un Manager nuevo arranca en oscuro.**
- Hay CSS de dark mode incrustado en `manager-shell.module.css` (`:global(html[data-theme='dark'])`), `final-polish.css`, `globals.css`.
- `app/settings/page.tsx` expone el selector Claro/Oscuro/Sistema.
- `app/driver-v3/dark-theme.css` y `app/theme-boot.tsx` son **compartidos** con Driver — no se tocan; solo se cambia el **default** a `light` y se neutraliza el conmutador en Settings de Manager.

**Tipografía / escala:** `Inter` se declara en `globals.css` pero no está cargada como webfont (no hay `next/font` ni `<link>` a Google Fonts), así que en la práctica cae a `system-ui`. Tamaños de encabezado ad-hoc por pantalla: `clamp(32px,5vw,48px)` (settings), `clamp(30px,4vw,42px)` (live), `28px!important` (reports), `h1` sin escala en Today.

### 2.2 Navegación e IA (P0/P1)

- **`ManagerShell` (`app/manager/manager-shell.tsx`)** define nav lateral (desktop) + nav inferior (mobile) con 4 destinos: Today, Routes, Contacts, More.
- **`app/manager/page.tsx` (Today)** renderiza **su propia** `<nav className="nav ...todayNav">` con Home/Routes/History/More — una **segunda** barra, oculta en desktop por CSS pero presente en el DOM y visible en ciertos anchos.
- **`globals.css` + `final-polish.css`** definen una **tercera** `.nav` global (pill flotante con pseudo-iconos `⌂ ⌁ ▣ •••`) que aplica a cualquier página con `.nav`.
- **Contacts** es destino de nav primaria **y** aparece dentro de `/manager/more` (grupo "Company") **y** hay un botón "Contacts" en el header de Routes. Tres entradas al mismo sitio.
- **"More" vs "Settings":** el ítem de nav "More" apunta a `/manager/more`, que es un índice que enlaza a `/settings`. `/settings` a su vez ya agrupa Perfil / Sucursal / Apariencia / Preferencias / Plan / Soporte. Dos pantallas para lo mismo; el usuario tiene que pasar por un índice intermedio.
- `active="settings"` se reusa como estado activo para More, Settings, Team e Invitations — el resaltado de nav miente en 3 de 4.
- Rutas de Manager viven en **cinco carpetas** distintas: `app/manager/*`, `app/routes/*`, `app/contacts/*`, `app/reports/*`, `app/settings/*`. Cada una reimplementa header + eyebrow + título + subtítulo con su propio CSS.

### 2.3 Auditoría por pantalla

#### Today — `app/manager/page.tsx` (+ `manager-dashboard.module.css`, `manager-today.module.css`)
- Densidad de lógica altísima en el componente (geocodificado de reparación, ETA con tráfico, 3 canales realtime) — **no se toca**, funciona.
- **Jerarquía plana:** 4 tarjetas métricas → banda "atención" (condicional) → mapa grande (`min-height:360–420px`, es el elemento más pesado) → "Delivery status" (fila de 7 métricas diminutas de 9–11px, se rompe en móvil) → aside con drivers + "pending routes".
- El mapa domina la pantalla aunque el objetivo dice que es secundario.
- "Delivery status" tiene 7 métricas (`ETA`, `Estimated arrival`, `Distance`, `Drive time`, `Traffic delay`, `Started`, `Last GPS`) a 9px — ilegible y poco jerárquico. Textos como `In Progress/Pending/Completed/Issues` **hardcodeados en inglés** en el status grid.
- La banda "atención" solo aparece si hay incidencia u overdue; cuando no hay, no queda claro que "todo está bien".
- Segunda `<nav>` en el DOM (ver 2.2).
- `displayName` se pasa como `greetingName || 'Manager'` con `'Manager'` literal (no localizado) en varios sitios.

#### Routes — `app/routes/routes-screen.tsx` (+ `routes.module.css` 830 líneas, `routes-board.module.css`, `routes-dispatch.css`, `routes-rows.module.css`)
- **Separación Today/Tomorrow/Upcoming ya existe** (`dateTabs`) — bien; hay que hacerla el eje visual principal, no una fila de tabs perdida bajo el resumen.
- `useRoutesWorkspace()` devuelve **~60 propiedades** desestructuradas en una línea; el screen las repasa manualmente. `inProgressRoutes = []` etc. con defaults en el destructuring (frágil).
- Doble control de vista lista/mapa: `pane` (list/map) **y** `dayView` **y** `managing` — tres estados de UI que se pisan (`setPane('list')` se llama en 4 sitios distintos).
- Secciones "In progress / Today / Completed / Issues" cada una con su `sectionHeading` y `<span>N active</span>` — "active" literal aunque la sección sea "Completed".
- `routes.module.css` tiene reglas para skeletons, board, dispatch, builder, contactos seleccionados, éxito… todo en un archivo.
- Header repite botón "Contacts" (ya en nav) + "Manage" (toggle) + "Add".

#### Add Route — `app/routes/new-route-dialog.tsx` (+ `new-route-fields.tsx`, `route-contrast.module.css`, `new-route-ui.module.css`, `routes.module.css`)
- Firma `NewRouteDialog(d: any)` — **props sin tipar**, se hace spread de ~40 props desde `routes-screen` a mano.
- Mezcla **3 módulos CSS** (`styles` = routes.module, `contrast`, `ui`).
- Strings hardcodeados en inglés: `ROUTE PREVIEW`, `Route preview`, `In Progress`, `Pending`, `Completed`, `Issues`.
- Es un modal a pantalla casi completa con columna de mapa + preview + "stops empty" + formulario numerado (paso 1 tipo/driver, luego `NewRouteFields`). El mapa/preview ocupa la mitad izquierda **siempre** en desktop aunque el objetivo pida mapa secundario.
- El panel de éxito (`justCreated`) reusa `successPanel` con copy parcialmente localizado.

#### Contacts — `app/contacts/page.tsx` (+ `contacts.module.css` 310 líneas)
- **Bien encaminado:** búsqueda arriba, contador, tarjeta con acciones Pickup/Delivery/Map/Call/Edit/Delete.
- Problemas: la tarjeta tiene **6 acciones** en fila que se aprietan; `avatar` = primeras 2 letras sin uppercase (`contact.company_name.slice(0,2)` → "ab").
- Enlaces Pickup/Delivery van a `/routes?contact=…&type=…` (bien, hay que conservarlo).
- `header` propio + `eyebrow` "ORGANIZATION" + subtítulo — otra variante de header.
- Sin estados de "sin teléfono / sin dirección" más allá de placeholders; no hay ordenamiento ni filtros (solo texto).

#### Team — `app/manager/team/page.tsx` (+ `manager-tools.module.css` 116 líneas, compartido con Invitations)
- Header con acción "Invite member" que **navega a otra página** (`/manager/invitations`) en vez de abrir un panel → sensación de "formularios sueltos".
- Panel "Driver priorities" mezclado con "Automatic driving-day close" en el mismo `<section>` con copy a medio localizar (`"Driver priorities"`, `"Choose the default driver…"` en inglés fijo).
- `stats` (Team members / Drivers / Managers) como tres `<article>` sueltos.
- Lista de miembros = `memberCard` con avatar iniciales + nombre + rol + botón borrar. Sin cambio de rol inline visible (existe `updateRole` pero no hay `<select>` en la tarjeta del render actual).
- Modal de confirmación propio (`confirmBackdrop`/`confirmDialog`) — otro patrón de modal distinto al de Contacts (`backdrop`/`dialog`) y al de globals (`modal-backdrop`/`modal`).

#### Invitations — `app/manager/invitations/page.tsx` (comparte `manager-tools.module.css`)
- Formulario email + rol + enviar en un `panel`; lista de invitaciones con `statusBadge` por `data-status`.
- Comparte CSS con Team pero con clases que solo existen para una u otra (`formGrid`, `mailIcon`, `rowCard`, `revokeButton`) — el módulo "tools" es un cajón de sastre.
- `active="settings"` (nav miente).
- Mensajería de estado vía `setMessage` que también se usa como "loading" (`setMessage(t.loadingInvitations)`) — el mismo `<p role="status">` parpadea entre carga y error.

#### History — `app/manager/history/page.tsx` (+ `history.module.css` que está **vacío**, 1 línea)
- **`history.module.css` tiene 1 línea** → todo el estilo de History viene de `final-polish.css` vía `[class*="history_*"]` y de reglas dark. La pantalla **no tiene CSS propio real**.
- Componente enorme (filtros de periodo, búsqueda, status, tipo, driver, rango de fechas; filas expandibles con evidencia firmada de Storage). Lógica correcta — **no se toca**.
- Header con `eyebrow` "OPERATIONS" hardcodeado (no localizado) + link "Today".
- Las filas (`HistoryRow`) usan `styles.route_${route.status}` que resuelven a `undefined` porque el módulo está vacío; el look actual es 100% parches globales.

#### Reports — `app/reports/page.tsx` (+ `reports.module.css` **vacío**, 1 línea)
- Mismo problema: **CSS de Reports vive en `final-polish.css`** (`.report-filters`, `.report-count`, `.kpi`, etc. — pero el TSX usa `styles.kpi`, `styles.filters`… que son `undefined`). Hay desalineación entre las clases que el TSX pide (`styles.*` de un módulo vacío) y las que existen (globales `.report-*`). Funciona de milagro porque algunas clases globales coinciden por nombre plano y otras no.
- KPIs + breakdown con barras + completion status + activity feed + export CSV + print. Lógica correcta.
- Header con tercera variante de acciones (`Print`, `CSV`, `Today`).

#### Settings — `app/settings/page.tsx` (+ `settings.module.css` 49 líneas) y More — `app/manager/more/page.tsx` (+ `more.module.css` 72 líneas)
- **Solapamiento total** (ver 2.2). `more` es un índice de 3 grupos (Operación / Empresa / Cuenta) que enlaza a Truck, History, Reports, Team, Invitations, Branches, Contacts, Settings.
- `settings.module.css` (49 líneas) es de los pocos módulos **limpios y compactos** — buen punto de partida para el patrón de "lista de settings".
- Settings ya casi tiene los grupos que pide el objetivo (Perfil, Sucursal, Apariencia, Preferencias, Plan, Soporte) — falta **Notificaciones** y **App** como grupos nombrados (hoy `DeviceNotificationsSetting` + `InstallAppCard` van juntos bajo "Preferences").
- Contiene el selector de tema (a neutralizar) y un `isCeo` que cambia el layout.

### 2.4 Driver — solo observaciones menores (NO rediseñar)
- `app/final-polish.css` mete reglas de Driver navigation (líneas ~410–544) en el mismo archivo que Manager — al consolidar Manager hay que **dejar intactas** esas reglas (`.route-plan-*`, `.driver-navigation-*`, `.live-route-*`).
- `theme-boot.tsx`, `dark-theme.css`, `use-preferences.ts` son compartidos: el cambio de default a `light` afecta también a Driver. Verificar que Driver v3 se ve bien en claro (usa su propia paleta oscura en `v3-app.css` / `dark-theme.css` con clases propias, no `data-theme`, así que debería ser independiente — **confirmar en Fase 0**).
- Posible contraste bajo en textos `#9db5df` sobre `#071b42` en `route-plan-nav` (AA borderline) — anotado, no bloqueante.

---

## 3. Prioridades

### P0 — bloqueantes para "listo para vender"
1. **Un solo sistema de tokens** (`app/manager/manager-theme.css` nuevo, o consolidar en `globals.css`) con un único azul, tinta, fondo, borde, radios, sombras, tipografía.
2. **Modo claro por defecto**: cambiar defaults en `lib/use-preferences.ts` a `light`; neutralizar el selector de tema en Settings de Manager (dejar el código, ocultar la opción). No tocar `theme-boot`/Driver.
3. **Shell y navegación únicos**: eliminar la 2ª `<nav>` de Today y la pill global para pantallas de Manager; una sola barra (lateral desktop / inferior mobile) con 4–5 destinos reales.
4. **Retirar la capa de parches para Manager**: mover lo necesario de `final-polish.css` a módulos propios; dejar de depender de `[class*="hash"]`. History y Reports necesitan CSS module real.
5. **Today reordenado** al criterio de éxito (pulso → atención → operación → mapa compacto).

### P1 — calidad de producto
6. Routes con Today/Tomorrow/Upcoming como eje visual; una sola noción de vista.
7. Add Route: layout mapa-secundario, tipar props, localizar strings.
8. Settings compacto por grupos (Perfil, Sucursal, Preferencias, Notificaciones, App, Plan, Soporte); fusionar "More" dentro de Settings o reducir "More" a accesos que no caben en nav.
9. Team + Invitations como un "área de empresa" coherente (panel de invitación inline, no navegación).
10. Contacts: priorizar búsqueda + acción "crear Pickup/Delivery"; menos acciones apretadas.

### P2 — pulido
11. History/Reports: encabezados y filtros consistentes con el sistema; localizar "OPERATIONS".
12. Cargar Inter con `next/font` (o aceptar system-ui explícitamente y quitar la declaración muerta).
13. Un único componente de modal/confirm para todo Manager.
14. Anotaciones de contraste Driver (sin rediseño).

---

## 4. Sistema visual propuesto ("RouteHub Logistics, light")

Marca: **navy + azul eléctrico + blanco + acentos suaves**. Denso pero respirado, tipo Samsara/Linear: listas operativas, estados visibles, poca decoración, una acción primaria por vista.

### 4.1 Tokens (fuente única — nuevo `app/manager/manager-theme.css`, importado una vez desde el layout de Manager)

```
/* Color */
--rh-navy-900: #0B1F3A;   /* texto fuerte, sidebar, headers */
--rh-navy-700: #16325C;
--rh-ink:      #0F1D35;    /* texto principal */
--rh-ink-soft: #5A6B85;    /* texto secundario */
--rh-muted:    #8A99AE;    /* placeholders, meta */
--rh-line:     #E3E9F1;    /* bordes */
--rh-divider:  #EEF2F7;
--rh-bg:       #F6F8FB;    /* fondo app */
--rh-surface:  #FFFFFF;    /* tarjetas */
--rh-surface-2:#F9FBFD;    /* filas alternas / insets */

--rh-blue:      #1660F0;   /* azul eléctrico — ÚNICO primario */
--rh-blue-700:  #0E4 ­­CC7; /* hover/pressed */
--rh-blue-soft: #EAF1FE;   /* fondo activo, chips */

--rh-success: #12A05C;  --rh-success-soft:#E7F6EE;
--rh-warning: #B26B00;  --rh-warning-soft:#FBF0DD;  /* ámbar legible AA */
--rh-danger:  #D33A3A;  --rh-danger-soft: #FBEBEB;

/* Radio */
--rh-r-xs: 8px;  --rh-r-sm: 10px;  --rh-r-md: 14px;  --rh-r-lg: 18px;  --rh-r-pill: 999px;

/* Sombra (suaves, una escala) */
--rh-shadow-sm: 0 1px 2px rgb(15 29 53 / 6%);
--rh-shadow-md: 0 6px 18px rgb(15 29 53 / 7%);
--rh-shadow-lg: 0 14px 34px rgb(15 29 53 / 10%);

/* Tipografía */
--rh-font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
--rh-fs-display: 26px/1.15 700;   /* h1 de pantalla */
--rh-fs-h2:      18px/1.25 650;
--rh-fs-h3:      15px/1.3  650;
--rh-fs-body:    14px/1.5  450;
--rh-fs-meta:    12px/1.35 550;
--rh-fs-eyebrow: 11px/1    800 (+.12em, uppercase);

/* Espaciado (escala 4) */
--rh-s1:4px --rh-s2:8px --rh-s3:12px --rh-s4:16px --rh-s5:20px --rh-s6:24px --rh-s8:32px --rh-s10:40px
```

> Nota: los tokens legacy (`--primary`, `--rh-primary`, `--rh-blue` viejo) se **aliasan** al nuevo valor durante la transición para no romper Driver ni landing, y se retiran al final.

### 4.2 Componentes base

- **Botón primario:** fondo `--rh-blue`, texto blanco, `--rh-r-md`, altura 40 (desktop) / 44 (mobile), `font-weight:650`, sin gradiente, sombra `sm`; hover `--rh-blue-700`. **Uno por vista.**
- **Botón secundario:** superficie blanca, borde `--rh-line`, texto `--rh-ink`; hover borde azul + `--rh-blue-soft`.
- **Botón ghost / icon:** 36×36, sin borde, hover `--rh-surface-2`.
- **Chip / badge de estado:** `--rh-r-pill`, 11px/800, par color-soft (activa=blue-soft, pendiente=line, incidencia=danger-soft, completada=success-soft).
- **Card:** superficie blanca, borde `1px --rh-line`, `--rh-r-lg`, `--rh-shadow-sm`, padding `--rh-s5`. **Sin hover-lift** (quitar `translateY`), sin sombras grandes. Menos cards, más listas.
- **List row (patrón operativo dominante):** fila de altura fija (56–64px), `grid` `[indicador 8px] [orden/icono 28px] [contenido 1fr] [estado auto] [chevron/acción auto]`, separador `1px --rh-divider`, hover `--rh-surface-2`. Es el bloque de Today, Routes, Contacts, Team, History.
- **Section header:** eyebrow + h2 a la izquierda, acción/enlace "Ver todo" a la derecha; margen inferior `--rh-s3`.
- **Page header:** una sola implementación (`<ManagerPage title subtitle actions>`): h1 display + subtítulo `--rh-ink-soft` + slot de acciones. Sin eyebrow gigante por pantalla (el contexto lo da la nav activa).
- **Empty state:** icono en círculo `--rh-blue-soft`, título h3, texto meta, 1 acción.
- **Modal:** un único `ManagerDialog` (backdrop `rgb(11 31 58 / 45%)`, panel `min(520px,100%)`, `--rh-r-lg`, `--rh-shadow-lg`). Reemplaza los 3 patrones actuales.
- **Mapa compacto:** contenedor `--rh-r-md`, alto 180px (Today) / 160px (Add Route), con botón "Ampliar mapa" que abre overlay grande (reutiliza `OperationsMap` tal cual). El mapa nunca es el elemento más alto de la vista.

### 4.3 Navegación

- **Desktop (≥1024px):** sidebar 232px, navy sutil sobre blanco, marca arriba, botón "Nueva ruta" primario, luego destinos, abajo workspace + perfil. Ya existe en `manager-shell` — se conserva y se re-tematiza.
- **Mobile (<1024px):** una barra inferior, 4 destinos + FAB central "Nueva ruta". Igual que hoy en `manager-shell`, pero **se elimina** la `.nav` extra de Today y la pill global.
- **Destinos (5):** Today · Routes · Contacts · History · More.
  - History sube a nav primaria (es consulta frecuente para vender "trazabilidad").
  - **Reports, Team, Invitations, Branches, Truck, Settings** viven dentro de **Settings/More** reagrupado (ver §5.7). "More" y "Settings" se **fusionan** en una sola pantalla con grupos; el ítem de nav se llama "More" y su primer grupo es el perfil.
- Estado activo real por sección (arreglar el `active="settings"` compartido).

### 4.4 Responsive

| Breakpoint | Layout |
|---|---|
| `<560px` | 1 columna, list rows compactas (52px), métricas 2×2, mapa 160px, barra inferior. |
| `560–1023px` | 1 columna ancha, métricas 4-up, aside de Today pasa a bloque bajo el contenido, barra inferior. |
| `≥1024px` | Sidebar + contenido `max-width: 1180px`; Today y Routes en 2 columnas (contenido 1.6fr / aside .4fr); sin barra inferior. |

Reglas: gutter lateral mínimo 16px (una sola fuente en `.content`), nada de `min-width` mayor que viewport, tablas/mapa/diagramas en su propio `overflow-x:auto`.

### 4.5 Estados y color semántico
- **Activa / en curso:** azul. **Pendiente / programada:** neutro (línea/tinta suave). **Incidencia:** rojo. **Completada:** verde. **Overdue:** ámbar.
- Nunca comunicar estado solo por color: siempre chip con texto.
- Foco visible global: `outline: 2px solid var(--rh-blue); outline-offset: 2px`.

---

## 5. Wireframes (objetivo)

### 5.1 Today
```
┌─ Sidebar ─┐ ┌─ Content ───────────────────────────────────────────────┐
│ RouteHub  │ │  martes, 10 de septiembre · Sucursal Principal           │
│ [+ Nueva] │ │  Hoy                                        Sincronizado 9:24│
│           │ │                                                          │
│ ▸ Today   │ │  ┌ Activas 3 ┐┌ Pendientes 5 ┐┌ Completadas 8 ┐┌ Incid. 1 ┐│
│   Routes  │ │  └──────────┘└──────────────┘└───────────────┘└─────────┘│
│   Contacts│ │                                                          │
│   History │ │  ⚠ 1 incidencia abierta — Ferretería Sur   [Ver ruta →]  │   (si no hay: ✓ Sin incidencias hoy)
│   More    │ │                                                          │
│           │ │  ┌ OPERACIÓN ─────────────────┐  ┌ DRIVERS (2) ─────────┐│
│ Workspace │ │  │ En curso: Parada 2 de 5    │  │ ● Ana   → Bodega 12  ││
│ Principal │ │  │ Ferretería Sur · ETA 14min │  │ ○ Luis  3 pendientes ││
│ [AS] Ana  │ │  │ [mapa compacto 180px]      │  ├──────────────────────┤│
│           │ │  │ [Ampliar mapa]             │  │ PRÓXIMAS (5)  Ver todo││
│           │ │  ├────────────────────────────┤  │ 1 Bodega 12   Pickup ││
│           │ │  │ ETA 14m · 3.2mi · +4m tráf.│  │ 2 Cliente A   Deliv. ││
│           │ │  │ Inició 8:40 · GPS 9:22     │  │ 3 Retorno     Branch ││
│           │ │  │ [Compartir estado]         │  │ …                    ││
│           │ │  └────────────────────────────┘  └──────────────────────┘│
└───────────┘ └──────────────────────────────────────────────────────────┘
```
Cambios: pulso arriba; banda de atención **siempre visible** (verde si ok); "Operación" = 1 tarjeta con estado en texto + mapa compacto + métricas resumidas (3, no 7) + acción; el mapa deja de ser el elemento dominante; se elimina la 2ª nav.

### 5.2 Routes
```
Rutas                                          [Gestionar orden] [+ Nueva ruta]
Control operativo

┌ Hoy (9) ─────┬ Mañana (4) ─┬ Próximas (7) ┐        ← tabs = eje principal
└──────────────┴─────────────┴──────────────┘
En curso 2 · Pendientes 5 · Incidencias 1 · Drivers 3          [Ver mapa]

EN CURSO
● 2  Ferretería Sur      Pickup · PO 4471      En curso   ⋯
● 1  Bodega Central      Delivery              Pausada    ⋯
PROGRAMADAS HOY
  3  Cliente A           Delivery              Pendiente  ⋯
  4  Cliente B           Pickup                Pendiente  ⋯
INCIDENCIAS
▲ 7  Cliente D           Delivery              Incidencia [Revisar]
COMPLETADAS (8)  ▸ ver
```
Cambios: tabs Today/Tomorrow/Upcoming como control primario; una sola vista (se retira `pane` list/map: "Ver mapa" abre overlay); filas operativas uniformes; el contador de sección dice lo correcto ("8 completadas", no "8 active").

### 5.3 Add Route (modal)
```
┌ NUEVA RUTA ───────────────────────────────────────────────  ✕ ┐
│ ①  Tipo:  [ Pickup ] [ Delivery ] [ Retorno ]                  │
│ ②  Driver: [ Ana (Principal) ▾ ]     Posición: [ Al final ▾ ]  │
│ ③  Destino: [ buscar contacto o dirección…            ] 🔎     │
│     └ ABC Supply · 123 Main St            [usar]               │
│ ④  Detalles:  PO [____]  Tel [________]  Nota [__________]     │
│     Fecha [10 sep ▾]                                          │
│                                                              │
│  ┌ mapa compacto 160px ─────────┐   [Ampliar]                 │
│  └──────────────────────────────┘                             │
│                                   [Cancelar]  [Crear y asignar]│
└──────────────────────────────────────────────────────────────┘
```
Cambios: formulario primero, mapa compacto abajo como confirmación (no columna 50/50); props tipadas; strings localizados; un solo módulo CSS (`add-route.module.css`).

### 5.4 Contacts
```
Contactos                                              [+ Nuevo contacto]
Destinos y personas guardadas

[ 🔎 Buscar nombre, dirección o teléfono         ]        128 contactos
[ Todos ]  [ Con teléfono ]  [ A–Z ▾ ]                    ← filtros ligeros

AB  ABC Supply                                    [+ Pickup] [+ Delivery]
    Juan Pérez · 123 Main St · (000) 000-0000     [Mapa] [Llamar] ⋯
CD  Cliente D                                     [+ Pickup] [+ Delivery]
    456 Oak Ave                                   [Mapa] ⋯
```
Cambios: acción principal = crear Pickup/Delivery desde el contacto (2 botones claros); acciones secundarias (Mapa/Llamar/Editar/Borrar) en menú `⋯`; búsqueda + filtros arriba; avatar en mayúsculas.

### 5.5 Team (empresa)
```
Equipo                                              [+ Invitar miembro]  ← abre panel inline
Sucursal Principal

Miembros 6 · Drivers 3 · Managers 2

Ajustes de sucursal
  Driver principal    [ Ana ▾ ]        Se asigna por defecto en nuevas rutas
  Cierre automático   [ 18:00 ]        Solo cierra si no quedan rutas

Miembros
[AS] Ana Soto        ana@empresa.com        [ Driver ▾ ]        ⋯
[LR] Luis Ríos       luis@empresa.com       [ Manager ▾ ]       ⋯

▸ Panel invitar (inline):  email [______]  rol [Driver ▾]  [Enviar invitación]
```

### 5.6 Invitations (dentro de Team, sección o tab)
```
Equipo  ›  Invitaciones
Pendientes 2

✉ nuevo@empresa.com     Driver     Pendiente · 8 sep      [Revocar]
✉ otro@empresa.com      Manager    Aceptada · 6 sep
```
Cambios: Team + Invitations = una sola área con dos secciones (o tabs "Miembros / Invitaciones"); invitar es un panel, no una página.

### 5.7 Settings (fusiona More)
```
Ajustes

PERFIL
 [AS]  Ana Soto            ana@empresa.com                     [Editar]
SUCURSAL
 🏢   Sucursal Principal   123 Main St                          [Editar]
      Sucursales                                                   →
PREFERENCIAS
      Idioma               [ ES ]  EN  FR
      Recorrido de la app                                    [Ver]
NOTIFICACIONES
      Notificaciones de dispositivo         [ Activar ]
APP
      Instalar RouteHub                     [ Instalar ]
      Versión 2.x
OPERACIONES        ← lo que hoy es "More"
      Reportes                                                  →
      Historial                                                 →
      Camión                                                    →
      Equipo e invitaciones                                     →
PLAN
      Plan actual          Free · prueba hasta 30 sep
SOPORTE
      Contactar soporte                                         →
      Privacidad · Términos                                     →

 [Cerrar sesión]
```
Cambios: los grupos que pide el objetivo + un grupo "Operaciones" que absorbe More; se elimina la pantalla `/manager/more` como índice separado (o queda como redirect a `/settings`). Selector de tema **retirado de la vista** (código intacto, default `light`).

### 5.8 History / Reports
- Mismo `ManagerPage` header + bloque de filtros con el patrón de chips de periodo + `select`s consistentes.
- History: filas operativas con chip de estado + badge POD/incidencia; detalle expandible sin cambios de lógica.
- Reports: fila de 4 KPIs con la escala nueva, breakdown con barras `--rh-blue`, activity feed como list rows. Print/CSV como botones secundarios en el header.
- CSS module real para ambos (hoy están vacíos).

---

## 6. Archivos que se tocarían (y por qué)

### Fase 0 — Fundaciones (sistema + shell) — **primero**
| Archivo | Acción | Motivo |
|---|---|---|
| `app/manager/manager-theme.css` | **crear** | Fuente única de tokens (color/tipo/espacio/radio/sombra) para Manager. |
| `app/manager/layout.tsx` | editar | Importar `manager-theme.css` una vez; no toca la guarda de sesión. |
| `app/globals.css` | editar | Reducir a reset + tokens legacy **aliasados** a los nuevos; quitar `.nav` con pseudo-iconos y duplicados de header. No romper landing/login. |
| `app/final-polish.css` | editar | **Extraer** todo lo de Manager (history/reports/route parches, headers repetidos, dark de Manager). Conservar intactas las reglas de Driver (`.route-plan-*`, `.driver-navigation-*`, `.live-route-*`) y landing. |
| `lib/use-preferences.ts` | editar | `themePreference()` / `useThemePreference` / `applyThemePreference` → default **`light`**. Cambio de constante, sin tocar API ni Driver logic. |
| `app/manager/manager-shell.tsx` | editar | Re-tematizar con tokens nuevos; nav de 5 destinos (Today/Routes/Contacts/History/More); estado activo real. Sin cambiar hrefs de datos. |
| `app/manager/manager-shell.module.css` | editar | Usar tokens nuevos; quitar bloque `:global(html[data-theme='dark'])`. |
| `app/manager/manager-page.tsx` + `.module.css` | **crear** | Componente `ManagerPage` (header título/subtítulo/acciones) reutilizable por todas las pantallas. |
| `app/manager/manager-dialog.tsx` + `.module.css` | **crear** | Modal único para Manager (reemplaza 3 patrones). |

### Fase 1 — Settings + More
| Archivo | Acción | Motivo |
|---|---|---|
| `app/settings/page.tsx` | editar | Reagrupar (Perfil/Sucursal/Preferencias/Notificaciones/App/Operaciones/Plan/Soporte); absorber enlaces de More; ocultar selector de tema (dejar handlers). |
| `app/settings/settings.module.css` | editar | Base del patrón "lista de settings" con tokens nuevos (ya es compacto). |
| `app/manager/more/page.tsx` | editar | Convertir en redirect/otra vista mínima a `/settings`, o dejar solo accesos que no entren en nav. Sin borrar rutas. |
| `app/manager/more/more.module.css` | editar/retirar | Consolidar en el patrón de settings. |
| `app/device-notifications-setting.tsx`, `app/install-app-card.tsx` | editar (solo clases) | Encajar en el grupo Notificaciones/App; sin tocar lógica FCM/PWA. |

### Fase 2 — Today + Routes
| Archivo | Acción | Motivo |
|---|---|---|
| `app/manager/page.tsx` | editar | Reordenar JSX (pulso → atención siempre visible → operación con mapa compacto → aside). Quitar la 2ª `<nav>`. Localizar `'Manager'` y el status grid. **No tocar** efectos de datos, realtime, geocode, ETA. |
| `app/manager/manager-today.module.css` | editar | Mapa compacto + overlay "Ampliar"; delivery status a 3 métricas; tokens nuevos. |
| `app/manager/manager-dashboard.module.css` | editar | `intro`/`summary` con `ManagerPage`; quitar `desktopOnly/todayNav`. |
| `app/routes/routes-screen.tsx` | editar | Tabs Today/Tomorrow/Upcoming como control primario; retirar estado `pane` (map → overlay); textos de contador correctos; localizar copy. **No tocar** `useRoutesWorkspace` ni handlers (`cancelRoute`, `moveRoute`, `toggleRoutePause`, `save`). |
| `app/routes/routes.module.css` | editar | Dividir/limpiar; tokens; quitar dependencia de parches globales. |
| `app/routes/routes-rows.module.css`, `routes-board.module.css`, `routes-dispatch.css` | editar | Alinear con list-row estándar; quitar `!important`. |
| `app/routes/route-contrast.module.css` | retirar | Sus overrides dejan de hacer falta con tokens correctos. |

### Fase 3 — Add Route
| Archivo | Acción | Motivo |
|---|---|---|
| `app/routes/new-route-dialog.tsx` | editar | Tipar props (interfaz explícita en vez de `any`); layout formulario-primero + mapa compacto; localizar strings. **No tocar** `save`, `routeTypes`, lógica return/branch. |
| `app/routes/new-route-fields.tsx` | editar | Encajar en el nuevo grid de campos; sin cambiar bindings. |
| `app/routes/add-route.module.css` | **crear** | Un solo módulo (reemplaza mezcla `routes.module`+`new-route-ui`+`contrast` en el dialog). |
| `app/routes/new-route-ui.module.css`, `add-route-cards.css`, `add-route-desktop.css` | retirar/absorber | `add-route-desktop.css` son 60 líneas de `!important`. |

### Fase 4 — Contacts
| Archivo | Acción | Motivo |
|---|---|---|
| `app/contacts/page.tsx` | editar | Búsqueda + filtros ligeros arriba; Pickup/Delivery como acción primaria; secundarias en `⋯`; avatar uppercase. **Conservar** `href` a `/routes?contact=…&type=…` y CRUD. |
| `app/contacts/contacts.module.css` | editar | Tokens; list-row estándar; menú de acciones. |

### Fase 5 — Team + Invitations
| Archivo | Acción | Motivo |
|---|---|---|
| `app/manager/team/page.tsx` | editar | Panel "Invitar" inline; rol inline con `<select>` (handler `updateRole` ya existe); stats como una fila; separar "Ajustes de sucursal". Localizar copy fijo. |
| `app/manager/invitations/page.tsx` | editar | Integrar como sección/tab de Team o mantener ruta pero con el mismo shell visual; separar loading de error. |
| `app/manager/manager-tools.module.css` | editar | Dividir en clases con nombre real; tokens; quitar clases muertas. |

### Fase 6 — History + Reports
| Archivo | Acción | Motivo |
|---|---|---|
| `app/manager/history/history.module.css` | **escribir de verdad** | Hoy 1 línea; todo su estilo son parches globales frágiles. |
| `app/manager/history/page.tsx` | editar (clases + header) | `ManagerPage` header; localizar "OPERATIONS"; filas estándar. **No tocar** filtros ni Storage signed URLs. |
| `app/reports/reports.module.css` | **escribir de verdad** | Hoy 1 línea; el TSX pide `styles.*` inexistentes. |
| `app/reports/page.tsx` | editar (clases + header) | Alinear clases con el módulo nuevo; KPIs/breakdown/activity con el sistema. **No tocar** carga de datos ni `exportCsv`. |
| `app/final-polish.css` | editar | Eliminar `.report-*`, `.history-*`, `.kpi*` una vez que los módulos existen. |

### Verificación tras cada fase
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`.
- Revisión manual **desktop (≥1280), tablet (~834), móvil (~390)** de las pantallas tocadas.
- Driver sin cambios visuales: abrir `/driver-v3` (today, route, stop, map, navigation) en claro y confirmar que se ve igual.
- Sin scroll horizontal a 390px; foco visible; una sola acción primaria por vista.

---

## 7. Riesgos y mitigación
- **`final-polish.css` es compartido con Driver y landing.** Mitigación: solo extraer selectores que empiecen por clases de Manager o `[class*="route_"]`/`[class*="history_"]`; dejar el resto; diff acotado y revisión visual de Driver + landing tras Fase 0.
- **Default de tema afecta a Driver.** Mitigación: Driver v3 usa clases propias (`v3-app.css`), no `data-theme`; confirmar en Fase 0 antes de continuar. Si algo depende de `data-theme='dark'` en Driver, se fija con una clase explícita en el layout de Driver (sin tocar su lógica).
- **Aliasar tokens legacy** evita romper páginas no-Manager mientras dura la transición; se retiran los alias al final.
- **`routes-screen` desestructura ~60 props.** Solo se reordena JSX y se quita `pane`; no se toca el hook. Si `pane` está acoplado a algo, se deja y solo se re-tematiza.

---

## 8. Qué necesito de ti para arrancar
1. ¿Fusionamos **More dentro de Settings** (recomendado) o mantenemos `/manager/more` como pantalla aparte reestilizada?
2. Nav primaria de 5: **Today · Routes · Contacts · History · More** — ¿ok, o prefieres 4 (sin History) para que respire más?
3. ¿Invitations como **tab dentro de Team** o pantalla separada con el mismo shell?
4. Confirmar que puedo **cambiar el default de tema a `light`** en `lib/use-preferences.ts` (afecta también al arranque de Driver, aunque Driver v3 pinta su propia paleta).
5. ¿Cargo **Inter** como webfont (`next/font`) o nos quedamos en `system-ui` y quito la declaración muerta?

Con tus respuestas empiezo por **Fase 0 (sistema + shell) y Fase 1 (Settings)**.
