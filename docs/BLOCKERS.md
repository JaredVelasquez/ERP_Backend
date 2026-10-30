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

## B-004 — Fiscal (T-043 a T-052): el dueño autorizó avanzar en desarrollo con datos sintéticos

- **Tipo:** decision_negocio
- **Tarea:** T-043, T-044, T-045, T-047, T-051, T-052
- **Estado:** resuelto para DESARROLLO el 29-10-2026; sigue abierto para PRODUCCIÓN.
- **Decisión del dueño (29-10-2026):** no detener el módulo fiscal esperando la confirmación del contador/SAR ni el alta real de Michelle (B-002). Avanzar con datos de prueba realistas y, antes de habilitar emisión real, hacer la configuración fiscal verdadera.
- **Dato de prueba adoptado:** formato hondureño de CAI de fuentes públicas secundarias (no es texto oficial del SAR, ver nota en `docs/PHASE_2_PLAN.md`): CAI alfanumérico de 37 caracteres en 6 grupos separados por guion (ej. `ABCD12-345678-9ABCDE-F01234-567890-AB`); número de documento correlativo de 16 dígitos segmentado establecimiento(3)-punto de emisión(3)-tipo de documento(2)-correlativo(8) (ej. `000-001-01-00000123`); RTN de 14 dígitos; rango autorizado con número inicial, final y fecha límite de emisión.
- **Marcado:** todo dato y documento generado bajo esta decisión se etiqueta `DEV-NOT-VALID` en el snapshot y en la vista imprimible, igual que el resto del sandbox de T-043/T-055.
- **Acción humana antes de producción:** reemplazar el régimen, los documentos aplicables, el mecanismo de autorización y el CAI real confirmados por el contador y el SAR; no reutilizar el CAI de prueba.
