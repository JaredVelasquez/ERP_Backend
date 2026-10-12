# BLOCKERS — Michelle Market ERP

No hay un bloqueo para escribir el esquema ni los casos de uso. Estas paradas aparecen cuando la tarea nombrada llegue a ejecutarse contra un entorno real o a sembrar a Michelle.

## B-001 — Base SQL Server

- **Tipo:** credenciales
- **Tarea:** T-004
- **Qué falta:** host, puerto, nombre de base, usuario y contraseña del SQL Server de desarrollo.
- **Acción humana:** completar `.env` local. No subir el archivo.

## B-002 — Alta real de Michelle Market

- **Tipo:** decision_negocio
- **Tarea:** T-009
- **Estado:** abierto para PRODUCCIÓN
- **Desarrollo local:** hay un placeholder ficticio para poder iniciar sesión. No es el RTN, la razón social, la dirección ni el margen de Michelle. El margen quedó null. La dirección de desarrollo no es el domicilio legal.
- **Qué falta:** RTN, razón social, dirección y porcentaje de margen reales. El encabezado `0.25` del Excel no se usa como margen.
- **Acción humana:** reemplazar el placeholder antes de producción. El valor local vive solo en `scripts/local/`, que no se sube a git.
