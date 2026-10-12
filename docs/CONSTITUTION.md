# CONSTITUCIÓN — Michelle Market ERP

Principios no negociables. El código, las tareas y las decisiones técnicas cumplen este documento. Si un requisito de producto contradice un principio, se registra en `docs/BLOCKERS.md` y se detiene.

## 1. Propósito

ERP de inventario, contabilidad básica, precios, tablero, códigos de barra, carga Excel y documentos firmables para venderse como SaaS. La primera empresa de referencia es Michelle Market. La fase 1 no factura ante el SAR.

## 2. Principios

| # | Principio | Implicación |
| --- | --- | --- |
| P1 | Cuatro procesos | `gateway`, `identity`, `erp` y `mcps` corren como procesos NestJS desde el mismo repo y comparten `libs/{domain,application,infrastructure,presentation}`. El gateway es la única puerta pública. No se copian los procesos de sync ni de reportes largos de otros productos: aquí no existen. |
| P2 | Hexagonal | Dominio y casos de uso no dependen de Nest más allá de `Injectable`/`Inject`, ni de TypeORM, SQL ni HTTP. Los adapters viven en infrastructure. Los controllers solo llaman `execute`. |
| P3 | Idempotencia | Confirmar un documento de inventario o un asiento dos veces no duplica existencia ni partidas. La clave de idempotencia vive en el documento. |
| P4 | Trazabilidad | Entradas, salidas, cambios de precio, asientos y llamadas MCP dejan registro. Anular crea el movimiento inverso. No se borra historia. |
| P5 | Fail safe | El error se persiste o se devuelve tipado. No hay `catch` vacío. Un reintento no abre una segunda transacción a ciegas. |
| P6 | Secretos fuera del repo | Credenciales solo en `.env` o en el almacén del entorno. Nunca en git. |
| P7 | Simplicidad | La solución más pequeña que cumple la fase 1. Sin vistas, procedimientos, funciones ni triggers en SQL Server. Sin un sexto proceso “por si acaso”. |
| P8 | Una empresa, unos libros | La contabilidad, el RTN y el inventario pertenecen a la empresa. La sociedad solo agrupa empresas. Dos empresas no comparten saldos ni asientos. |
| P9 | Misma acción, dos puertas | Cada caso de uso tiene endpoint HTTP y tool MCP equivalente. No hay una segunda regla de negocio para la IA. |
| P10 | Código en inglés, documentos en español | Identificadores, comentarios y commits en inglés. SPEC, TASKS y mensajes al usuario en español. |

## 3. Arquitectura

```text
apps/
  gateway/     # proxy, auth de borde, health
  identity/    # usuarios, sesiones, roles
  erp/         # inventario, contabilidad, precios, excel, documentos, tablero
  mcps/        # MCP HTTP para un LLM externo
libs/
  domain/
  application/
  infrastructure/
  presentation/
```

`libs/` no sabe qué app la monta. Cada app importa solo sus módulos.

### Capas

| Capa | Puede | Prohibido |
| --- | --- | --- |
| domain | reglas puras, ports, tokens | `@nestjs/*`, `typeorm`, `mssql`, HTTP |
| application | orquestar un `execute` | Entity ORM, SQL, controllers |
| infrastructure | SQL, PDF, Excel, archivos | presentation |
| presentation | DTO, validación de formato, `execute` | reglas de negocio, SQL |

### Control de flujo

- Sin `else`.
- Como máximo un `if` dentro de otro `if`.
- Un ciclo hace un proceso. La escritura en base no va dentro de un `for` con `await`.
- Varias filas de un mismo documento se guardan en una transacción del adapter.

## 4. Datos

- SQL Server. `synchronize: false`.
- Migraciones numeradas, solo esquema, re-ejecutables (`IF NOT EXISTS`).
- Semillas de catálogo en scripts `seed:*` separados.
- Fechas en `DATETIME2` UTC.
- Toda clave de entidad y toda clave foránea hacia una entidad es `UNIQUEIDENTIFIER`. La aplicación genera el id con `crypto.randomUUID` antes del insert. El código de cuenta (por ejemplo `1.01.01.001`) es un código de negocio, no el id.
- Parámetros en SQL. Nunca concatenar entrada del usuario.

## 5. Seguridad

- La autorización real la aplica el backend. La interfaz solo oculta.
- Web y Electron: cookie `httpOnly`. Android (Capacitor): token bearer en almacenamiento seguro. El diseño se valida en el POC de Capacitor antes de dar por cerrada la sesión móvil.
- El token MCP tiene los mismos permisos que el usuario y cada tool queda en auditoría.
- No se registran contraseñas, tokens ni el trazo de firma completo en logs.

## 6. Fuera de alcance de la fase 1

- Factura SAR y correlativos fiscales.
- Fiado y cuentas por cobrar operativas.
- Google Drive u otra nube para el PDF.
- Recetas de productos preparados.
- Envase retornable (el chimbo lleno y el vacío son dos productos normales).
- Promedio periódico, método de menudeo y costo estándar.
- Existencia negativa.
- iOS. Mobile de esta fase es Android.

## 7. STOP

Detenerse y escribir `docs/BLOCKERS.md` cuando falten credenciales, haya una decisión de negocio abierta, un servicio externo falle tras un reintento, los datos sean ambiguos, el pedido salga del SPEC o una tarea previa no esté cerrada.

## 8. Flujo

1. Leer `docs/TASKS.md` y tomar la siguiente tarea `[ ]` cuyas dependencias estén `[x]`.
2. Implementar solo esa tarea según esta constitución y `docs/SPEC.md`.
3. `npm run lint`, `npm test`, `npm run build`.
4. Marcar `[x]` con una nota de una línea. Si algo queda rojo, no se marca.
5. Si hay bloqueo, `BLOCKERS.md` y parar.
