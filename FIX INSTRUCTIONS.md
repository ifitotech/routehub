# FIX_INSTRUCTIONS.md — RouteHub

Instrucciones para aplicar tú mismo (o delegar a Grok/ChatGPT con este archivo como spec). Sigue el orden — están numeradas por prioridad, no por número de hallazgo.

---

## 1. 🔴 Verificar y, si hace falta, corregir permisos de `contacts` / `requests`

**Primero verifica.** Entra a tu Supabase → SQL Editor → corre esto:

```sql
select policyname, cmd, roles
from pg_policies
where tablename in ('contacts','requests')
order by tablename, cmd;
```

- **Si ves una política llamada `"members manage contacts"` o `"members manage requests"`** (sin restricción de rol, comando `ALL`): el problema es real en tu producción. Aplica el fix de abajo.
- **Si NO aparecen esas políticas** (solo ves `"read contacts by company"`, `"edit contacts by role"`, etc.): ya está corregido, no hagas nada más aquí.

**Fix** (crea este archivo como `RouteHub-v2/supabase/migrations/042_fix_legacy_permissive_policies.sql` y aplícalo):

```sql
-- Elimina las políticas viejas permisivas que ignoran el rol, si existen.
drop policy if exists "members manage contacts" on public.contacts;
drop policy if exists "members manage requests" on public.requests;

-- Asegura que quede una política de SELECT e INSERT para todo miembro de la empresa
-- (las de UPDATE/DELETE por rol ya existen desde las migraciones 009 y 013).
drop policy if exists "read contacts by company" on public.contacts;
create policy "read contacts by company" on public.contacts for select to authenticated
using (exists (select 1 from public.company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid()));

drop policy if exists "operate contacts by role" on public.contacts;
create policy "operate contacts by role" on public.contacts for insert to authenticated
with check (exists (select 1 from public.company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative','counter_sales')));

drop policy if exists "read requests by company" on public.requests;
create policy "read requests by company" on public.requests for select to authenticated
using (exists (select 1 from public.company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid()));

drop policy if exists "create requests by role" on public.requests;
create policy "create requests by role" on public.requests for insert to authenticated
with check (exists (select 1 from public.company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative','counter_sales')));
```

Después de aplicarla, vuelve a correr la consulta de verificación para confirmar que ya no aparecen las políticas viejas.

---

## 2. 🔴 Bloquear que Operations Manager invite Branch Managers

Crea `RouteHub-v2/supabase/migrations/043_fix_invitation_role_escalation.sql`:

```sql
create or replace function public.create_team_invitation(p_email text, p_role text)
returns uuid language plpgsql security definer as $$
declare
  v_company_id uuid;
  v_invitation_id uuid;
begin
  -- Solo ceo o branch_manager pueden invitar (antes también dejaba pasar operations_manager).
  select company_id into v_company_id
  from public.company_users
  where user_id = auth.uid() and role in ('ceo','branch_manager')
  limit 1;

  if v_company_id is null then
    raise exception 'You do not have permission to invite team members.';
  end if;

  -- (mantén aquí el resto de la lógica original de la función: inserts, tokens, etc.
  --  esto es solo el bloque de validación de permisos que hay que reemplazar —
  --  pégale a Grok/ChatGPT el archivo 020_sync_team_members_and_route_drivers.sql
  --  completo junto con este spec para que arme la función completa sin perder
  --  el resto de la lógica.)
end $$;
```

⚠️ Ojo: no tengo el cuerpo completo original de la función a mano en este archivo — antes de correr esto, pide a quien lo aplique (tú, Grok o ChatGPT) que abra `020_sync_team_members_and_route_drivers.sql`, copie la función `create_team_invitation` completa, y solo le cambie la condición `role in ('branch_manager','operations_manager')` → `role in ('ceo','branch_manager')`. Así no se pierde ninguna línea de lógica existente.

---

## 3. 🔴 Conectar la cola offline al flujo de completar entrega

Archivos a tocar: `lib/completion.ts`, `app/driver-v3/page.tsx`, `lib/offline-queue.ts`.

**Spec para quien lo implemente (tú, Grok o ChatGPT):**

1. En `completeDelivery()` (`lib/completion.ts`), envolver la llamada a Supabase en try/catch. Si el error es de red (no de validación — ej. `error.message` incluye `'fetch'` o `navigator.onLine === false`), en vez de solo hacer `throw`, llamar a `enqueue({type:'complete', payload: ctx()})` de `lib/offline-queue.ts` y devolver un estado `queued` en vez de lanzar error.
2. Igual para `uploadStopPhoto()` — si falla por red, guardar la foto (como base64, no como `File`, porque `localStorage` no soporta blobs) en el mismo registro de la cola.
3. En `app/driver-v3/page.tsx`, cuando `completeDelivery` devuelva `queued`, mostrar un mensaje distinto al de error real: algo como "Guardado — se enviará cuando vuelva la señal" en vez de "Operación fallida".
4. Agregar un listener `window.addEventListener('online', () => syncQueue(handler))` en el layout del driver (`app/driver-v3/layout.tsx`) para reintentar automáticamente apenas vuelva la conexión.
5. Revisar `localStorage` límite de tamaño (~5MB) — si vas a guardar fotos en base64 ahí, con 2-3 pendientes ya puede llenarse. Alternativa más robusta: usar `IndexedDB` en vez de `localStorage` para este caso (fotos ocupan más espacio).

Este es el fix más grande de la lista — probablemente vale la pena dárselo completo a Grok o ChatGPT como tarea de código con este spec, y que te devuelvan el diff para que tú lo pruebes en el celular antes de mandarlo a producción.

---

## 4. 🟡 Límite de intentos en el código de activación

En `supabase/functions/send-manager-invite/index.ts`, rama `action === 'activate'`:

1. Agregar columna a la migración: `alter table public.invitations add column if not exists activation_attempts int not null default 0;`
2. Antes de comparar el código, chequear `if (invitation.activation_attempts >= 5) return error('Too many attempts, request a new invitation')`.
3. Si el código no coincide, incrementar `activation_attempts` antes de devolver el error.
4. Si coincide, no hace falta resetear (la invitación ya se marca usada).

---

## 5. 🟡 Quitar rutas de desarrollo expuestas

- Borra `RouteHub-v2/app/test/page.tsx` y `RouteHub-v2/app/test/config/page.tsx` (o la carpeta `app/test/` completa) antes de invitar a testers reales.

---

## 6. 🟡 Limpieza de repo

- Elimina o archiva (mover a una rama `legacy-prototype` y sacarla de `main`) todo lo que está en la raíz del repo fuera de `RouteHub-v2/`.
- Elimina `RouteHub-v2/app/driver/` (carpeta vieja, código muerto — confirmado que `middleware.ts` nunca la sirve).
- Configura Vercel: Root Directory = `RouteHub-v2`.

---

## Orden recomendado para hoy

1. Punto 1 (verificar RLS) — 5 minutos, es solo correr una consulta.
2. Punto 2 (invitaciones) — bloqueante para lo que quieres hacer (empezar a invitar).
3. Punto 5 (borrar `/test`) — 1 minuto.
4. Punto 4 (límite de intentos) — rápido.
5. Punto 3 (offline) — el más grande, puede esperar al segundo día de pruebas si los primeros testers van a estar en zonas con buena señal.
6. Punto 6 (limpieza de repo) — cuando tengas tiempo, no es urgente.
