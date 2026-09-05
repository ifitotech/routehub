# AGENT_LOG.md — RouteHub

Pega este archivo completo como contexto al inicio de cualquier conversación con Grok, ChatGPT o Claude sobre este repo. Actualízalo tú mismo después de cada sesión (marca qué se resolvió y con qué IA).

## ⚠️ Reglas para cualquier IA que trabaje en este repo

1. **El proyecto real vive en `RouteHub-v2/`.** La carpeta raíz del repo (`routehub-main/` fuera de `RouteHub-v2/`) es un prototipo viejo, en desuso. No lo edites ni lo uses como referencia de arquitectura actual.
2. **El código del driver que corre en producción está en `RouteHub-v2/app/driver-v3/`.** `RouteHub-v2/app/driver/` es código muerto — `middleware.ts` reescribe todo `/driver` hacia `/driver-v3` de forma invisible. Si te piden "arreglar la pantalla del driver", es en `driver-v3`.
3. **Las migraciones SQL son aditivas y numeradas.** La última aplicada es `041_destination_contact_name.sql`. Cualquier migración nueva empieza en `042`. Nunca reescribas ni renombres una migración ya numerada/aplicada — antes de escribir una nueva, revisa este archivo por si otra IA ya reservó el número.
4. **No confíes solo en `lib/permissions.ts` para decidir qué es seguro.** Es solo la capa de UI. La autoridad real es Postgres RLS (`supabase/migrations/*.sql`). Un permiso mal puesto en SQL puede contradecir lo que dice la UI — pasó al menos dos veces (ver hallazgos 1 y 2 abajo).

## Estado actual — hallazgos pendientes de resolver

| # | Hallazgo | Severidad | Estado | Resuelto por |
|---|----------|-----------|--------|--------------|
| 1 | Verificar si la política RLS vieja `"members manage contacts"` / `"members manage requests"` (permite editar/borrar a cualquier miembro sin importar rol) sigue activa en producción. Ver `FIX_INSTRUCTIONS.md` §1 para la consulta de verificación. | 🔴 Crítica (a confirmar) | Pendiente de verificar | — |
| 2 | `create_team_invitation` permite que un Operations Manager invite a alguien como Branch Manager (escalación de permisos) | 🔴 Alta | Pendiente | — |
| 3 | Fallos de red al completar entrega/subir foto se pierden sin reintento — `lib/offline-queue.ts` existe pero nunca se conecta a `driver-v3` | 🔴 Alta | Pendiente | — |
| 4 | Código de activación de invitación (6 dígitos) sin límite de intentos fallidos | 🟡 Media | Pendiente | — |
| 5 | Rutas de desarrollo `/test` y `/test/config` expuestas públicamente en producción | 🟡 Media | Pendiente | — |
| 6 | Repo duplicado: prototipo viejo en la raíz + `RouteHub-v2` real | 🟡 Media | Pendiente | — |
| 7 | Billing/planes: scaffolding sin conectar, no bloqueante | ⚪ Info | No requiere acción por ahora | — |

## Historial de decisiones
_(Agrega aquí cualquier decisión de diseño que tomes con Grok/ChatGPT/Claude, para que las otras IAs no la contradigan en la siguiente sesión.)_

-
