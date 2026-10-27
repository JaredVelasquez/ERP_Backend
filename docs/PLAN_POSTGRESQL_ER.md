# PostgreSQL y TypeORM: estado de persistencia

Actualizado: 2026-10-25.

## Estado de la base local

- La única base soportada es PostgreSQL: `erp_dev`, con `erp_owner` para cambios de esquema y `erp_app` para la aplicación.
- La última inspección read-only encontró 39 tablas (37 de negocio y metadatos), 20 registros con checksum en `schema_migrations` y 1 migración TypeORM de baseline.
- Las migraciones SQL ya aplicadas y sus checksums se preservan. La migración TypeORM de baseline no ejecuta DDL de negocio.
- SQL Server, LocalDB, el driver `mssql` y los scripts de conexión/copia fueron retirados del runtime y del árbol activo.

## Protección de datos

- `synchronize: false` y `migrationsRun: false` son obligatorios. Los servicios no crean ni modifican tablas al iniciar.
- `npm run db:status` consulta base, rol, tablas e historiales sin escribir.
- `npm run migrate:postgres` es explícito; valida la base destino, los checksums y el estado del esquema antes de aplicar solo migraciones pendientes.
- El runner rechaza una base con tablas de negocio sin historial reconocido y rechaza checksums modificados. No auto-registra un baseline sobre una base desconocida.
- `npm run db:ensure` es un bootstrap separado. No crea una base salvo que se configure explícitamente `PG_ALLOW_CREATE_DATABASE=true`; nunca se ejecuta al iniciar la aplicación.
- No eliminar ni editar una migración aplicada. Los cambios de esquema futuros se agregan como una migración TypeORM nueva, revisable e idempotente cuando corresponda.

## TypeORM implementado

- TypeORM `DataSource` proporciona pool PostgreSQL y el ejecutor comparte transacciones mediante `QueryRunner`.
- La reserva idempotente de importación usa una entidad y TypeORM QueryBuilder en `import-transaction.queries.ts`.
- El repositorio de compañías usa entidades y QueryBuilder en `company.queries.ts`; el smoke PostgreSQL valida su lectura contra `erp_dev`.
- Los listados paginados de inventario, comprobantes y usuarios de empresa usan QueryBuilder y mapean entidades a los tipos de workspace.
- El baseline y el runner de migraciones TypeORM funcionan sin alterar las tablas existentes.
- Las skills `hex-backend` y sus reglas de persistencia fijan el patrón para el trabajo nuevo y la conversión de repositorios.

## Conversión de repositorios

La conversión está implementada: los repositorios de producto/precios, propuestas, identidad/sesiones, libro de inventario, comprobantes/anulaciones, compañías/workspace, asientos, layouts, MCP y configuración de IA usan entidades y TypeORM QueryBuilder. Las consultas viven en archivos `*.queries.ts` por contexto; los resultados se mapean a contratos de dominio.

Se retiraron `postgres-sql.ts`, `SqlExecutor` y `database-executor.ts`. Los scripts de mantenimiento usan QueryBuilder; los smokes usan `pg` únicamente para consultar o limpiar datos temporales.

La protección de datos continúa activa: `synchronize=false`, `migrationsRun=false`; los cambios de esquema se agregan como migraciones explícitas y no se alteran migraciones aplicadas.

## Comprobaciones vigentes

```powershell
npm run db:status
npm run migrate:postgres
npm run lint
npm test -- --runInBand
npm run build
npm run smoke:postgres
npm run smoke:import-idempotency
npm run smoke:auth-refresh
npm run smoke:auth-http
npm run smoke:voucher-storage-http
npm run smoke:frontend-mobile-routes
```

`smoke:postgres:write` requiere una base de prueba aislada cuyo nombre termine en `_test`; no ejecutarlo contra `erp_dev`. `erp_test` ya fue creada, migrada y verificada: `smoke:postgres:write` pasó para producto, historial de precios, ledger de inventario e inserción/actualización de comprobante.
