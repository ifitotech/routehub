# RouteHub — actualización rápida

Desde PowerShell:

```powershell
cd C:\Users\rodol\Documents\RouteHub
.\scripts\deploy-check.ps1
git add .
git commit -m "Update RouteHub"
git push origin main
```

Vercel desplegará automáticamente el nuevo commit.

Antes de producción:

1. Ejecutar `supabase/location.sql` si aún no se ejecutó.
2. Ejecutar `supabase/roles.sql`.
3. Revisar variables de Vercel.
4. Confirmar que el middleware de autenticación esté activo.
5. Probar `/test`, `/requests`, `/routes`, `/driver` y `/reports`.
6. Ejecutar `supabase/retention.sql` cuando Storage y las tablas de evidencia estén listas.
7. Ejecutar `supabase/storage.sql` para crear el bucket privado y sus políticas.
