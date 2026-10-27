# BLOCKERS — Michelle Market ERP

No hay un bloqueo para escribir el esquema ni los casos de uso. Estas paradas aparecen cuando la tarea nombrada llegue a ejecutarse contra un entorno real o a sembrar a Michelle.

## B-001 — Base PostgreSQL local

- **Estado:** resuelto en desarrollo local el 18-10-2026.
- **Tarea:** T-030
- **Resolución:** `erp_dev` en PostgreSQL local, con `erp_owner` para migraciones y `erp_app` para el runtime. Las credenciales viven en `.env` ignorado por Git. PostgreSQL es el único motor soportado; SQL Server/LocalDB y la ruta de reversión se retiraron del proyecto.

## B-002 — Alta real de Michelle Market

- **Tipo:** decision_negocio
- **Tarea:** T-009
- **Estado:** abierto para PRODUCCIÓN
- **Desarrollo local:** hay un placeholder ficticio para poder iniciar sesión. No es el RTN, la razón social, la dirección ni el margen de Michelle. El margen quedó null. La dirección de desarrollo no es el domicilio legal.
- **Qué falta:** RTN, razón social y dirección reales. El usuario aclaró el 18-10-2026 que el 25% del Excel es el recargo mínimo sobre costo para el precio sugerido; no es margen bruto.
- **Acción humana:** reemplazar el placeholder antes de producción. El valor local vive solo en `scripts/local/`, que no se sube a git.

## B-003 — Falta endpoint para listar membresías antes del login

- **Estado:** resuelto en desarrollo el 18-10-2026.
- **Tarea:** T-006b y T-F002.
- **Resolución:** `POST /identity/companies` comprueba email y contraseña sin crear sesión y devuelve las membresías de ese usuario. La tienda muestra la elección cuando hay varias empresas y luego inicia sesión con el `companyId` seleccionado.
