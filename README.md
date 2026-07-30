# RouteHub

Fundación mobile-first para rutas manuales multiempresa. La primera pantalla prioriza las rutas del día, solicitudes y conductores, con lenguaje simple y botones grandes.

## Fase 1 — estado

- [x] Next.js + TypeScript base
- [x] Dashboard responsive mobile-first
- [x] Modelo multiempresa y sucursales
- [x] Roles iniciales y separación por empresa preparada
- [x] Invitaciones controladas por Branch Manager (sin acceso automático por Google)
- [x] Manifest PWA inicial
- [ ] OAuth Google y RLS Supabase (requieren credenciales del proyecto)

### Checklist para cerrar Fase 1

- Copiar `.env.example` a `.env.local` y completar las dos variables de Supabase.
- Ejecutar `supabase/schema.sql` en el proyecto Supabase.
- Activar Google OAuth y configurar la URL de callback.
- Activar RLS y probar aislamiento entre dos compañías.
- Verificar que solo un Manager autorizado pueda invitar usuarios.
- Ejecutar `npm.cmd run typecheck`, `npm.cmd run lint` y `npm.cmd run build`.

Las reglas de interfaz están centralizadas en `lib/access.ts`; la autorización definitiva deberá ejecutarse también en RLS y nunca confiar solo en el navegador.

### Regla de acceso

Google OAuth solo identifica al usuario. El acceso a una empresa requiere una invitación válida, no vencida ni revocada, enviada por un **Branch Manager**. El rol y la sucursal se asignan desde esa invitación; nadie puede entrar y comenzar a designar rutas por su cuenta.

### Alta inicial de una empresa

1. El dueño de una empresa te contacta.
2. Tú autorizas su email como **Branch Manager** mediante `platform_manager_approvals`.
3. Ese Manager inicia sesión y queda asociado a su empresa y sucursal principal.
4. El Manager crea sucursales e invita a Operations, Sales, Counter Sales y Drivers.
5. Solo los usuarios invitados y asociados a esa empresa pueden acceder a sus datos.

### Área CEO / administración de la plataforma

Existe un apartado separado para el CEO de RouteHub. Sus funciones incluyen:

- Autorizar o revocar Managers iniciales.
- Ver empresas, sucursales, estado de suscripciones y salud técnica.
- Suspender una cuenta por seguridad o facturación.
- Administrar configuraciones globales y catálogos.
- Consultar métricas agregadas y soporte.
- Revisar auditoría de accesos y cambios administrativos.

La privacidad es obligatoria: el CEO no ve rutas, direcciones, teléfonos, packing lists, fotos, firmas ni información de clientes por defecto. Cualquier acceso excepcional debe requerir motivo, permiso explícito, alcance limitado y quedar registrado en `platform_audit_logs`.

En **Configuración → Contactar a RouteHub**, cada usuario puede enviar fallas, funciones faltantes, preguntas o sugerencias. El CEO las recibe en su panel mediante `support_requests`, con estado `open`, `in_progress`, `resolved` o `closed`.

## Siguiente fase

1. Conectar Supabase Auth (Google OAuth) y RLS por `company_id`.
2. Añadir biblioteca de contactos y bandeja de solicitudes.
3. Construir editor de rutas con reordenamiento accesible.
4. Añadir experiencia Driver, PWA, GPS, fotos y firma.

## Estado de Fase 2

Avance aproximado: **60%**. Ya existen pantallas y formularios locales para contactos y solicitudes, además del canal de soporte para usuarios. Falta conectar Supabase, autocomplete, permisos de Counter Sales y asignación persistente a rutas.

> **Pendiente antes de producción:** reactivar el middleware de autenticación de Google. Actualmente está desactivado temporalmente para desarrollo del CEO.

El MVP no incluye optimización automática ni SMS.

## Funciones futuras opcionales

- **Packing list por ruta o parada:** quien crea la ruta podrá adjuntar una foto o PDF. El driver podrá abrirlo desde la parada para verificar lo que recoge o entrega.
- **Visibilidad para clientes:** en una fase posterior, la empresa podrá decidir si el cliente ve el packing list desde su enlace de seguimiento. Será opcional y dependerá de permisos.
- **Seguimiento del cliente:** enlace seguro con estado, parada actual y confirmación de entrega.

### Flujo del Driver — navegación y local cerrado

- El driver pulsa **Navegar** y RouteHub abre Google Maps, Apple Maps o la app de mapas predeterminada.
- Al volver a RouteHub, se valida la ubicación actual con GPS.
- La parada puede completarse cuando el driver está dentro de aproximadamente **100 pies (30,5 m)** del destino, sujeto a la precisión GPS disponible.
- Si el local está cerrado, el driver puede tomar una foto, elegir **Local cerrado** y dejar la parada como `pending` o `issue` según la configuración.
- La parada no se elimina; queda visible para que Operations o el Manager decidan si reintentar, reprogramar o cancelarla.
- Si está fuera del rango GPS, una foto de evidencia permite continuar y la parada se registra con `completion_method = photo_override` para revisión posterior.
