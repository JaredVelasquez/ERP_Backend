# TASKS — Fase 1

Una tarea a la vez. `[ ]` pendiente, `[~]` en curso, `[x]` cerrada. No se marca `[x]` sin lint, test y build verdes.

## T-001 — Esqueleto del monorepo

- **Estado:** [x]
- **Nota:** cuatro apps con `GET /health`; lint, test y build verdes.
- **Deps:** ninguna
- **Dónde:** `apps/*`, `libs/*`, `package.json`
- **Hacer:**
  - [ ] Nest 11, TypeScript estricto, cuatro apps (`gateway`, `identity`, `erp`, `mcps`) y cuatro libs
  - [ ] Cada app responde `GET /health`
  - [ ] Alias `@domain`, `@application`, `@infrastructure`, `@presentation`
  - [ ] `.env.example` sin secretos, `.gitignore` incluye `.env` y `.codegraph/`
  - [ ] Jest y ESLint en verde con un spec de humo
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan

## T-002 — Arranque y configuración

- **Estado:** [x]
- **Nota:** el gateway exige los tres upstreams y solo proxea `/identity`, `/erp`, `/mcp` y `/admin`.
- **Deps:** T-001
- **Dónde:** `libs/infrastructure` config, `apps/*/src/main.ts`
- **Hacer:**
  - [ ] Config validada al arrancar. Si falta un `*_URL` del gateway, el proceso no levanta
  - [ ] Gateway enruta `/identity`, `/erp`, `/mcp` y `/admin` por variables de entorno
  - [ ] Prueba del enrutado con upstream falso
- **Listo cuando:** un prefijo desconocido no se proxea y un upstream ausente aborta el arranque

## T-003 — Dominio de tenencia y costeo

- **Estado:** [x]
- **Nota:** PEPS consume la capa más antigua; el promedio usa el costo de todo el saldo. Lint, 21 pruebas y build verdes.
- **Deps:** T-001
- **Dónde:** `libs/domain`
- **Hacer:**
  - [ ] Tipos de cuenta, sociedad, empresa y bodega. El RTN vive en la empresa
  - [ ] Función pura `allocateIssue` para PEPS, UEPS, FEFO, promedio e identificación específica
  - [ ] Pruebas: sin existencia, cantidad de más, doble consumo, producto sin método usa el de la empresa, cambio de método con existencia rechazado
- **Listo cuando:** las pruebas rompen si el orden PEPS se invierte o si el promedio usa el costo de la capa más vieja

## T-004 — Migración de tenencia

- **Estado:** [x]
- **Nota:** `001_tenancy.sql` es idempotente. Aplicarlo al servidor espera B-001.
- **Deps:** T-001
- **Dónde:** `migrations/001_tenancy.sql`, runner
- **Hacer:**
  - [ ] Tablas de cuenta, sociedad, empresa, bodega, usuario, membresía y rol
  - [ ] Runner idempotente, solo esquema
  - [ ] `.env.example` documenta las variables
- **Listo cuando:** el SQL es re-ejecutable. Aplicarlo a un servidor real espera B-001

## T-005 — Casos de uso de tenencia

- **Estado:** [x]
- **Nota:** cada empresa nace con PEPS, sin impuesto, margen vacío y su bodega Principal.
- **Deps:** T-003, T-004
- **Dónde:** `libs/application`, `libs/infrastructure/persistence`, `libs/presentation`
- **Hacer:**
  - [ ] Crear cuenta, sociedad y empresa con bodega Principal
  - [ ] La empresa nace con costeo PEPS, impuesto apagado y margen vacío
  - [ ] HTTP bajo `/admin` para el administrador de plataforma
  - [ ] Pruebas con doble del puerto, más una prueba del adapter si hay base
- **Listo cuando:** dos empresas de una sociedad no comparten bodega ni configuración

## T-006 — Identidad y permisos

- **Estado:** [x]
- **Nota:** el operador recibe 403 en plataforma y contabilidad. El login deja cookie HttpOnly y token bearer.
- **Deps:** T-005
- **Dónde:** `apps/identity`, dominio de sesión
- **Hacer:**
  - [ ] Alta de usuario, rol dueño u operador, membresía a empresa
  - [ ] Login con cookie `httpOnly` para web
  - [ ] Contrato bearer preparado para Android, sin dar por cerrado el POC
  - [ ] El gateway exige sesión salvo `/identity` login y `/health`
- **Listo cuando:** un operador no abre rutas de catálogo contable ni de plataforma

## T-006b — Elegir empresa antes de crear sesión

- **Estado:** [x]
- **Deps:** T-006
- **Hacer:** validar email y contraseña en `POST /identity/companies` sin crear sesión; devolver solo las membresías del usuario autenticado; elegir una en el login cuando haya varias; mantener el ingreso directo cuando haya una.
- **Listo cuando:** una contraseña errónea no revela empresas y un usuario con varias membresías puede seleccionar la correcta antes de iniciar sesión.

## T-007 — Semilla contable y árbol

- **Estado:** [x]
- **Nota:** cuatro niveles (clase, grupo, mayor, subcuenta). Solo la subcuenta acepta asientos. Los códigos de tres segmentos quedan bajo su mayor. Caja efectivo sigue como cuenta de cobro. El impuesto de la empresa no se enciende.
- **Deps:** T-005
- **Dónde:** migración de cuentas, seed explícito, caso de uso de listado
- **Hacer:**
  - [ ] Tablas `accounts` y `posting_rules` por empresa
  - [ ] Seed con el catálogo de SPEC § RF-05, cuentas de cobro marcadas
  - [ ] Categorías de impuesto sembradas; la empresa sigue con impuesto apagado
  - [ ] Listar el árbol ordenado por código
- **Listo cuando:** una cuenta padre rechaza un asiento y Caja efectivo aparece como cuenta de cobro

## T-008 — Productos, presentaciones y barras

- **Estado:** [x]
- **Nota:** una caja de 48 queda en unidad base y el Code 128 numérico se previsualiza en SVG y PNG.

## T-009 — Documentos de inventario y asientos

- **Estado:** [x]
- **Nota:** repetir la confirmación no duplica cantidad ni partidas. Una venta sin existencia no escribe. El debe iguala al haber. Michelle no se siembra.

## T-010 — Historial de precios

- **Estado:** [x]
- **Nota:** una entrada no mueve el precio de estante. El cálculo comercial vigente usa recargo mínimo sobre costo y aprobación, según T-031 y T-032; las rutas antiguas de cambio directo se retiraron.

## T-031 — Modelo comercial de precios Michelle Market

- **Estado:** [x]
- **Deps:** T-010, T-030
- **Hacer:** migración PostgreSQL incremental para costo unitario de referencia, recargo mínimo, sugerido, precio aprobado e historia; conciliar e importar la hoja `PRECIOS dif` sin notas personales ni filas ambiguas; mostrar las cuatro magnitudes en el catálogo.
- **Resultado:** 2.015 coincidencias únicas importadas; 116 productos con valores incompatibles quedan en `docs/PRICE_CONFLICTS_MICHELLE_MARKET.csv` para decisión gerencial. Dos filas con nombre ambiguo en el catálogo tampoco se aplicaron.

## T-032 — Propuestas, aprobación y configuración de precios

- **Estado:** [x]
- **Deps:** T-031
- **Hacer:** propuestas de empleados, aprobación por dueño o delegado, autorización por sesión, cambio atómico del precio vigente de toda la presentación y UI con estados e historial.

## T-033 — Plantilla de comprobante y marca Michelle Market

- **Estado:** [x]
- **Deps:** T-013
- **Hacer:** adaptar el comprobante al PDF original, colocar los logos oficiales según fondo claro u oscuro y verificar la descarga legible.
- **Resultado:** una copia ampliada, según decisión del usuario; descarga real inspeccionada.

## T-011 — Tablero y reportes

- **Estado:** [x]
- **Nota:** una merma no cuenta como venta ni como ingreso. El balance de un documento anulado queda en cero.
- **Ampliación:** `GET /erp/reports/sales` y `GET /erp/reports/financial` entregan ventas por día y producto, balance de comprobación con apertura y cierre, balance general y estado de resultados para un período. Los estados contables incluyen los asientos de reversión y exigen permiso de lectura de Contabilidad. Las herramientas MCP `sales-report` y `financial-report` reciben `from` y `to`, limitan los datos a la empresa de la sesión y respetan los permisos del token.
- **Límite actual:** los estados reflejan los asientos generados por los documentos operativos existentes; `ReceiveEntryUseCase` valida cuentas, pero todavía no registra asientos manuales. Por eso no representan una contabilidad general completa hasta habilitar ese flujo.

## T-012 — Excel

- **Estado:** [x]
- **Nota:** una fila inválida no escribe nada. El conteo propone un ajuste sin confirmarlo. El libro original de precios no entra.

## T-013 — Plantilla Ficohsa, firma y PDF

- **Estado:** [x]
- **Nota:** el formulario y la firma quedan guardados. El PDF es un ejemplar y se puede volver a descargar. No se sube a una nube.
- **Deps:** T-006
- **Dónde:** `TemplatePort`, `PdfPort`
- **Hacer:**
  - [x] Plantilla HTML del comprobante con los campos de SPEC § RF-09
  - [x] Guardar formulario y firma
  - [x] Descargar PDF de un ejemplar
- **Listo cuando:** se puede repetir la descarga con los datos guardados y el PDF no se sube a una nube

## T-016 — Permisos por módulo

- **Estado:** [x]
- **Nota:** la sesión guarda grants. El operador no entra a plataforma ni a contabilidad y sí puede crear un producto. El dueño reemplaza la lista.

## T-017 — Enlace del comprobante al movimiento

- **Estado:** [x]
- **Nota:** la referencia bancaria sale en el PDF. El enlace es al traslado de la misma empresa. Anular el comprobante deja el traslado y el enlace. Firmar no crea asiento.

## T-014 — MCP

- **Estado:** [x]
- **Nota:** cada tool llama el mismo caso de uso. Sin permiso no escribe. La auditoría no guarda token, contraseña, firma ni referencia bancaria.

## T-015 — Contrato OpenAPI

- **Estado:** [x]
- **Nota:** el gateway publica `GET /openapi.json` con el login. El cliente Zod generado compila en la tienda.

---

# Fase 2

Pendientes. Las tareas de la fase 1 quedan cerradas como están. El detalle está en SPEC § 12. `[ ]` hasta lint, test y build verdes.

## T-018 — Dominio de la hoja de barras

- **Estado:** [x]
- **Nota:** la hoja usa el Code 128 ya guardado. Lista vacía, id repetido o código vacío fallan. Lint, 131 pruebas y build verdes.
- **Deps:** T-008
- **Dónde:** `libs/domain` inventario
- **Hacer:**
  - [ ] Armar la lista de etiquetas de uno o varios SKU con el Code 128 ya guardado
  - [ ] Rechazar lista vacía, duplicar un id en una sola etiqueta y fallar si falta el código interno
  - [ ] Prueba del caso de un código y del caso de varios
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y la prueba falla si la hoja acuña un número nuevo

## T-019 — Caso de uso de la hoja de barras

- **Estado:** [x]
- **Nota:** un caso de uso arma el PDF de uno o varios productos. Un id ajeno, desconocido o inactivo no produce PDF.
- **Deps:** T-018
- **Dónde:** `libs/application` inventario
- **Hacer:**
  - [ ] Un solo caso de uso para un producto y para muchos
  - [ ] PDF con nombre, número interno e imagen. No persiste la hoja
  - [ ] Id de otra empresa, desconocido o inactivo rechaza el lote entero
  - [ ] Prueba con doble del puerto: un id, varios ids y un id ajeno
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y un id inválido no produce PDF

## T-020 — HTTP de la hoja de barras

- **Estado:** [x]
- **Nota:** `POST /erp/barcode-sheets` exige `products` ver. Quien no lo tiene recibe prohibido. La vista previa de un código sigue igual.
- **Deps:** T-019
- **Dónde:** `libs/presentation` `POST /erp/barcode-sheets`
- **Hacer:**
  - [ ] El controller llama el caso de uso de T-019
  - [ ] Exige `products` ver
  - [ ] OpenAPI describe la ruta. El preview `GET /erp/products/:id/barcode` sigue igual
  - [ ] Prueba HTTP del PDF de un id, de varios y del id ajeno
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y quien no tiene `products` ver recibe prohibido

## T-021 — MCP de la hoja de barras

- **Estado:** [x]
- **Nota:** `render-barcode-sheet` llama el mismo caso de uso. La auditoría guarda ids y no guarda el PDF ni la contraseña.
- **Deps:** T-020
- **Dónde:** catálogo MCP y `render-barcode-sheet`
- **Hacer:**
  - [ ] La tool llama el mismo caso de uso que el HTTP
  - [ ] Auditoría con actor, tool, resultado e ids. Sin token, sin contraseña y sin bytes del PDF
  - [ ] Prueba: sin permiso no escribe auditoría con secretos ni devuelve PDF
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y la tool sin `products` ver responde prohibido

## T-022 — Dominio del ajuste de menos

- **Estado:** [x]
- **Nota:** el borrador de esta salida es `adjustment` de salida. No debita Ventas ni Merma. La venta de fase 1 sigue en dos partidas.
- **Deps:** T-009
- **Dónde:** `libs/domain` inventario
- **Hacer:**
  - [ ] El borrador de esta fase solo puede ser `adjustment` con dirección `out`
  - [ ] Una línea o varias. Cantidad y factor positivos. Unidad de presentación obligatoria
  - [ ] Código vacío, desconocido, inactivo o de fabricante repetido es fallo y no trae efecto de stock
  - [ ] Prueba: el borrador no sale como venta ni como merma; la venta de fase 1 sigue en dos partidas
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y un ajuste de menos no debita Ventas ni Merma

## T-023 — Caso de uso buscar por nombre

- **Estado:** [x]
- **Nota:** el fragmento se recorta, no distingue mayúsculas y solo devuelve activos de la empresa. Buscar no guarda.
- **Deps:** T-022
- **Dónde:** `libs/application` inventario
- **Hacer:**
  - [ ] Fragmento de nombre, recortado, sin distinguir mayúsculas, solo activos de la empresa
  - [ ] Texto vacío rechazado. La búsqueda no confirma documento
  - [ ] Prueba del acierto, del vacío y de un producto de otra empresa
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y buscar no cambia capas ni saldo

## T-024 — Caso de uso de la ficha

- **Estado:** [x]
- **Nota:** la ficha exige ver inventario, productos y precios. Identificación específica sin capa no inventa un costo. Un código desconocido no escribe documento.
- **Deps:** T-022
- **Dónde:** `libs/application` inventario
- **Hacer:**
  - [ ] Leer por id de producto o por código, interno o de fabricante
  - [ ] Devolver nombre, presentación, existencia en unidad base, costo según el método, precio y código
  - [ ] Fallo claro si no hay producto. No abre la transacción de inventario
  - [ ] Exigir `inventory` ver, `products` ver y `prices` ver
  - [ ] Prueba del acierto, del fallo y de identificación específica sin capa
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y un código desconocido no escribe documento

## T-025 — Caso de uso confirmar la salida

- **Estado:** [x]
- **Nota:** una o varias líneas confirman un ajuste de salida en la misma transacción. El asiento es 6.01.01.002 contra 1.01.02.001. La clave repetida no vuelve a descontar.
- **Deps:** T-022, T-009
- **Dónde:** `libs/application` inventario
- **Hacer:**
  - [ ] Una o varias líneas en el mismo caso de uso. El tipo lo pone el caso de uso, no el cliente
  - [ ] Llamar a `ConfirmDocumentUseCase` para capas, saldo y asiento en una transacción
  - [ ] Clave de idempotencia. Existencia insuficiente no deja saldo negativo
  - [ ] Prueba de una línea, de varias, de la clave repetida y de una venta de fase 1 que conserva dos partidas
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y el asiento de esta salida es 6.01.01.002 contra 1.01.02.001

## T-026 — HTTP buscar por nombre

- **Estado:** [x]
- **Nota:** `GET /erp/products/search` exige `products` ver. El listado `GET /erp/products` sigue sin texto de búsqueda.
- **Deps:** T-023
- **Dónde:** `GET /erp/products/search`
- **Hacer:**
  - [ ] El controller llama el caso de uso de T-023 y exige `products` ver
  - [ ] `GET /erp/products` sin búsqueda sigue como en la fase 1
  - [ ] OpenAPI de la ruta nueva
  - [ ] Prueba HTTP: hay coincidencias y no se crea documento
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y el listado de fase 1 no exige un texto de búsqueda

## T-027 — HTTP de la ficha

- **Estado:** [x]
- **Nota:** `GET /erp/stock-cards` devuelve la ficha. Un código desconocido falla y no confirma salida. Sin `inventory` ver, prohibido.
- **Deps:** T-024
- **Dónde:** `GET /erp/stock-cards`
- **Hacer:**
  - [ ] El controller llama el caso de uso de T-024
  - [ ] Código desconocido responde fallo y no confirma salida
  - [ ] OpenAPI de la ruta
  - [ ] Prueba HTTP del acierto y del fallo
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y quien no tiene `inventory` ver recibe prohibido

## T-028 — HTTP confirmar la salida

- **Estado:** [x]
- **Nota:** `POST /erp/inventory-issues` exige `inventory` editar y rechaza tipo o cuenta de cobro. La venta del endpoint de fase 1 conserva dos partidas. Existencia insuficiente no deja saldo negativo.
- **Deps:** T-025
- **Dónde:** `POST /erp/inventory-issues`
- **Hacer:**
  - [ ] El controller llama el caso de uso de T-025 y exige `inventory` editar
  - [ ] El cuerpo no acepta tipo de documento ni cuenta de cobro
  - [ ] OpenAPI de la ruta. `POST /erp/inventory-documents/confirm` sigue aceptando una venta
  - [ ] Prueba HTTP de una línea, de varias y de existencia insuficiente
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y ver inventario sin editar no confirma

## T-029 — MCP de búsqueda, ficha y salida

- **Estado:** [x]
- **Nota:** `search-products-by-name`, `read-stock-card` e `issue-stock` llaman sus casos de uso. Sin permiso no hay documento. La auditoría de la salida guarda el id y no guarda secretos.
- **Deps:** T-026, T-027, T-028
- **Dónde:** catálogo MCP
- **Hacer:**
  - [ ] Tools `search-products-by-name`, `read-stock-card` e `issue-stock`, cada una sobre su caso de uso
  - [ ] Auditoría sin token, sin contraseña y sin bytes de archivo. La salida guarda el id del documento
  - [ ] Prueba: sin permiso no hay documento; con permiso, una línea y varias líneas
- **Listo cuando:** `npm run lint`, `npm test` y `npm run build` pasan, y la auditoría de `issue-stock` no guarda secretos

## T-030 — Migrar la base ERP a PostgreSQL

- **Estado:** [x]
- **Nota:** `erp_dev` y los roles `erp_owner`/`erp_app` están creados en PostgreSQL local. Las migraciones por base de datos y los datos transferidos se conciliaron. SQL Server/LocalDB se retiraron y PostgreSQL es el único motor soportado. Ver `PLAN_POSTGRESQL_ER.md`.
- **Dónde:** `migrations/erp/`, scripts PostgreSQL, adapters TypeORM y `.env` local
- **Verificación:** migraciones reejecutables por checksum, lecturas y escrituras de repositorio, HTTP, `npm run lint`, `npm test` y `npm run build`

## T-031 — Credenciales MCP con alcance por empresa

- **Rotación:** `POST /mcp/company-tokens/:id/rotate` cambia el hash en una operación de base de datos, renueva la caducidad a 90 días y entrega la nueva credencial una sola vez. También restablece un token revocado limpiando su revocación, sin volver a validar el secreto anterior. Exige `settings:edit`; solo el dueño puede rotar tokens de otros usuarios de su empresa.
- **Actualización:** `POST /mcp/connector` acepta JSON-RPC MCP sobre HTTP para `initialize`, `tools/list` y `tools/call`; publica solo herramientas incluidas en el token y en los permisos vigentes del usuario. Las llamadas reutilizan la autorización y auditoría existentes.
- **Estado:** [x]
- **Alcance:** migración `011_mcp_token_scopes.sql`, tokens con hash, perfil, herramientas, caducidad y revocación. Cada invocación compara el token con su alcance y con la membresía y permisos actuales. El login público de MCP se eliminó.
- **Comprobación local:** creación, consulta, uso de herramienta autorizada y rechazo 401 después de revocar.

## T-032 — Asistente ERP integrado

- **Estado:** [x] para texto, imagen, PDF con Gemini, fotogramas de video y mensajes de voz con Gemini/OpenAI; [ ] para audio de video.
- **Voz:** el navegador graba hasta dos minutos, permite escuchar y enviar una grabación de hasta 4 MB. Gemini recibe el audio directamente; OpenAI lo transcribe y continúa con el modelo configurado. La grabación no se persiste. Anthropic no está habilitado para este flujo y el asistente indica cambiar a Gemini u OpenAI.
- **Alcance:** chat ligado a la cookie de sesión, proveedor Gemini/OpenAI configurable, consultas por MCP y propuestas de escritura que exigen confirmación humana. `analyze-media` expone extracción visual también a tokens MCP con alcance autorizado. El servidor vuelve a validar los permisos al confirmar.
- **Límite:** registrar inventario desde una factura requiere verificar producto, unidad, cantidad y costo. No se confirma automáticamente a partir de extracción visual.

## T-033 — Configuración de empresa, IA y actividad MCP

- **Estado:** [x] para membresías activas, módulo `settings`, administración básica de usuarios, proveedor/modelo/token de IA por empresa, tablero de conectores e historial de uso MCP.
- **Migraciones:** `012_company_settings_and_mcp_usage.sql` y `013_company_settings_owner_only.sql` aplicadas en PostgreSQL local.
- **Seguridad:** un token MCP y una sesión dejan de autorizar una empresa cuando se deshabilita su membresía; el token de IA se cifra y nunca se devuelve en la API.
- **Límite pendiente:** recuperación de clave de otro usuario requiere un flujo de invitación o recuperación verificada; no se habilita el restablecimiento por un administrador de una sola empresa porque la identidad puede pertenecer a varias empresas.

## T-034 — Cambios de precio directos y estandarización de tablas

- **Estado:** [x] para cambios de precio con historia, tablas configurables y tabla resumida de actividad del tablero; la importacion admite correccion previa en el frontend.

## T-035 — Asientos contables generales

- **Estado:** [x]
- **Deps:** T-007, T-030, T-011
- **Verificado en PostgreSQL local y Chrome:** ingreso, gasto y asiento manual; reportes antes y después del reverso; balance de comprobación; repetición idempotente con líneas reordenadas; asiento descuadrado responde 400; usuario sin acceso contable recibe 403.
- **Hacer:** crear ingresos y gastos generales y asientos manuales balanceados, persistirlos idempotentemente en PostgreSQL, anular por reverso, incluirlos en estados financieros y exponer los mismos casos de uso por HTTP y MCP.
- **Listo cuando:** solo cuentas contabilizables reciben líneas; el debe iguala al haber; permisos `accounting:view/edit` se aplican en ambas puertas; reintentos no duplican y la anulación conserva historial y cuadra los reportes.

## T-036 — Alinear autenticación con el estándar IATOOLS

- **Estado:** [~]
- **Deps:** T-006, T-030
- **Hacer:** reemplazar la sesión única actual por access token Bearer corto y refresh token rotatorio; Web guarda el refresh en cookie `HttpOnly`, `Secure`, `SameSite` y con path limitado; Electron usa `safeStorage`; Capacitor usa Keychain/Keystore; persistir solo hashes y revocar la familia cuando se reutiliza un refresh anterior.
- **Correcciones incluidas:** login entrega solo el access token corto para mantenerlo en memoria; el refresh token nunca se devuelve en JSON y solo viaja en cookie `HttpOnly`; ninguna cookie de producción puede emitirse sin `Secure`.
- **Migración:** `015_refresh_token_families.sql` ya está aplicada en PostgreSQL local. Las sesiones anteriores funcionan hasta `2026-10-28T00:00:00Z`; esa fecha también está en el `.env` local.
- **Evidencia local:** auth HTTP smoke validates login, bearer session, refresh rotation, replay revocation, and logout. A real Chrome smoke validates login, the HttpOnly refresh cookie, and browser reload recovery. Frontend unit tests, lint, build, and backend suite pass. **Pending:** Electron/Capacitor device verification (tracked in T-F006).

## T-037 — Guardar comprobantes en almacenamiento S3 privado

- **Estado:** [x]
- **Deps:** T-033, T-036
- **Hacer:** configurar el bucket privado `erp` en Cloudflare R2 y guardar cada PDF confirmado bajo `S3_VOUCHER_PREFIX/{comprobante}/`, con credenciales S3 en variables locales. La descarga continúa pasando por el endpoint autenticado del ERP.
- **Evidencia local:** `npm run smoke:s3` verifies private object upload/read/delete. `npm run smoke:voucher-storage-http` confirms the real voucher PDF is written to R2, its key is persisted in PostgreSQL and the authenticated download works. Smoke cleanup removes temporary rows and objects.

## T-038 - Attach and preview bank receipts

- **Estado:** [x]
- **Deps:** T-037
- **Hacer:** accept PDF/JPG/PNG, save the object and metadata in R2/PostgreSQL, serve it after session and company checks, and allow individual or split preview beside the ERP voucher PDF.
- **Migraciones:** 016_voucher_file_references.sql for both providers; PostgreSQL uses migrations/erp/016_voucher_file_references.sql.
- **Evidencia local:** `npm run smoke:voucher-storage-http` verifies authenticated PNG upload/read, replacement, company isolation, PostgreSQL metadata and the one-folder key layout. The documents page provides individual/side-by-side preview and full-screen controls; frontend tests, lint and build pass.
## T-039 — Aprobacion de anulacion y comparacion de archivos

- **Estado:** [x]
- **Hacer:** exigir motivo y aprobacion del dueno o encargado designado antes de anular un comprobante; guardar historial y conservar datos bancarios. Ampliar visor para ocultar cualquiera de los paneles, pantalla completa y dejar claro que el comprobante POS se adjunta al manual.
- **Migracion:** `017_voucher_void_approval.sql`, aplicada en PostgreSQL local.
- **Nota:** la anulacion directa se reemplazo por solicitud y revision via HTTP/MCP; designacion por empresa en Configuracion; quien solicita no puede aprobar. El visor ofrece modo individual, comparacion y pantalla completa, y explica que el POS es un adjunto adicional.
- **Verificacion:** `npm run smoke:voucher-storage-http` verifies a pending request, rejects requester self-approval, approves through the designated owner and confirms the voucher status in PostgreSQL. The same smoke checks R2 read/replace and company isolation; frontend preview supports individual, split and full-screen modes. Frontend tests, lint/build and backend suite/lint/build pass.

## T-040 — Idempotencia de importacion de catalogo sin stock inicial

- **Estado:** [x]
- **Alcance:** cada CSV reserva una clave basada en SHA-256 y empresa antes de guardar productos. La reserva se hace en la misma transaccion que los cambios; un reintento concurrente o posterior no vuelve a ejecutar la importacion, incluso cuando cantidad es cero y no se crea documento de apertura.
- **Migraciones:** `migrations/erp/018_catalog_import_batches.sql` quedó aplicada en `erp_dev`; la migración SQL Server fue retirada.

## T-041 — TypeORM y persistencia PostgreSQL única

- **Estado:** [x]
- **Alcance:** migrar todos los repositorios relacionales a TypeORM QueryBuilder, con una entidad y archivo `<repo>.queries.ts` por repo en infrastructure; retirar el traductor SQL de compatibilidad y hacer obligatoria esta convención en la skill backend.
- **Protección:** `synchronize=false`, `migrationsRun=false`, conservar checksums aplicados, registrar baseline sin DDL de negocio y bloquear migración sobre esquema no registrado.
- **Ya hecho:** PostgreSQL es el único proveedor; SQL Server/LocalDB y sus scripts/dependencias se retiraron; TypeORM DataSource/QueryRunner, transacciones, migración baseline no destructiva y guardas de migraciones están operativos; importación idempotente, compañías y listados de workspace usan entidades/QueryBuilder con consultas en archivos separados; la skill backend se actualizó; dominio, aplicación, adaptadores de infraestructura y controladores se organizaron por contexto y agregado, y la composición de Nest se movió a `apps/modules/`.
- **Ya convertido:** repositorios de productos/precios, flujo de propuestas y auditoría de precios, comprobantes y aprobación de anulación, layouts, MCP, asientos manuales, identidad, configuración de IA y libro de inventario usan entidades con TypeORM QueryBuilder y consultas separadas. Los adaptadores de identidad conservan rotación/reutilización de refresh tokens; el ledger mantiene atomicidad entre documento, líneas, capas, asientos y anulaciones.
- **Verificación:** `erp_test` fue creada y migrada; `smoke:postgres:write` pasó para producto, historial de precios, ledger de inventario e inserción/actualización de comprobante. `smoke:postgres` de lectura pasó contra `erp_dev` (compañía, identidad/sesión, productos, inventario y listados); ese smoke requiere datos existentes. `erp_dev` no fue destino de escritura.
- **Listo cuando:** cada repositorio relacional use su query builder y mapee a tipos del dominio; no queden adaptadores ni consultas heredadas; lint, suite, build, smoke PostgreSQL y flujos visuales/funcionales pasen sin recrear esquema ni perder datos.
- **Verificacion actual:** TypeORM y QueryBuilder en repositorios y scripts de mantenimiento; traductor y ejecutor de compatibilidad retirados. Lint, 50 suites/139 pruebas, build y smokes de lectura y escritura pasan; comprobantes/R2, Chrome movil y asistente tambien pasan.
- **Product repository:** PostgreSQL QueryBuilder entity mapping, search, paging, ordering and price history pass smoke:postgres; null price ordering matches domain sort.
- **Voucher repository:** TypeORM QueryBuilder persists vouchers and signatures; R2 HTTP smoke passes file upload, read, replacement, tenant isolation and void approval.
- **Workspace layout repository:** TypeORM QueryBuilder persists table columns, dashboard widgets and UI preferences; save/read/update and cleanup pass the PostgreSQL browser smoke.
- **MCP repository:** TypeORM QueryBuilder passes token issue, hash lookup, company listing, audit paging, rotation, revocation and usage timestamp checks in the PostgreSQL browser smoke.
- **Journal-entry repository:** QueryBuilder persists balanced entry lines, idempotent retry, company-scoped reads, date range and reversal in the PostgreSQL browser smoke.
## T-042 — Historial privado de conversaciones del asistente

- **Estado:** [x]
- **Alcance:** guardar turnos de texto del asistente vinculados a usuario y empresa de la sesión; listar conversaciones paginadas y leer cada conversación con aislamiento por propietario. No persistir archivos adjuntos ni credenciales.
- **Protección:** migración TypeORM aditiva, sin `synchronize`, sin `migrationsRun` y sin borrar tablas/datos en `down`.
- **Listo cuando:** dos usuarios de la misma empresa no pueden leer el historial del otro; un usuario con varias empresas mantiene historiales separados; build, lint, tests y smoke HTTP pasan.
- **Verificacion:** migracion 019 aplicada; 52 suites / 146 pruebas, lint/build y smokes HTTP/Chrome pasan.

## T-043 — Facturación y documentos fiscales SAR

- **Estado:** [ ] Pendiente; fuera del alcance implementado actualmente.
- **Objetivo:** extender el ERP para emitir y administrar documentos fiscales vinculados a las ventas, manteniendo separados los comprobantes operativos actuales y el módulo fiscal.
- **Antes de implementar:** confirmar con el contador y el SAR el régimen tributario de cada empresa, los documentos aplicables, los requisitos vigentes de autorización y numeración, y la modalidad de emisión disponible. No asumir que la facturación electrónica está disponible hasta verificar el mecanismo oficial.
- **Alcance propuesto:** configuración fiscal por empresa y establecimiento; categorías y cálculo de impuestos; documento fiscal con datos legales y detalle inmutable de venta e impuestos; numeración y autorización; representación imprimible; notas de crédito y débito y anulaciones trazables; permisos y auditoría; reportes fiscales y conciliación con los asientos.
- **Regla de diseño:** enlazar cada documento fiscal a una venta existente y conservar una copia de los datos, precios e impuestos usados al emitirlo. No convertir ni renombrar el comprobante firmado actual como factura fiscal.
- **Dependencias:** B-002 para la identidad legal real de Michelle Market y confirmación del régimen y mecanismo de autorización antes de habilitar emisión en producción.
- **Listo cuando:** las reglas y formatos estén validados para el régimen confirmado; correlativos y reintentos sean seguros; correcciones no borren documentos emitidos; impuesto, inventario y contabilidad cuadren; y pasen pruebas de permisos, cálculos, anulaciones y devoluciones, reportes y emisión en el entorno autorizado.
## Fase 2 — propuesta fiscal y contable

Alcance y decisiones abiertas: `docs/PHASE_2_PLAN.md`. No se habilita emisión fiscal en producción hasta que el responsable confirme régimen, documentos y mecanismo autorizado.

## T-044 — Perfil y políticas fiscales por empresa
- **Estado:** [ ] desbloqueado para desarrollo con datos sintéticos (decisión del dueño, ver `docs/BLOCKERS.md` B-004, 29-10-2026). El régimen y los datos reales se confirman antes de producción.
- **Deps:** T-043.
- **Hacer:** configurar perfil legal/fiscal, obligaciones, establecimientos, modalidad de emisión/registro, tasas con vigencia y excepciones sustentadas; aplicar permisos y auditoría.
- **Regla:** los movimientos internos de inventario no exigen factura de venta; una venta no puede omitir el comprobante aplicable.
- **Listo cuando:** políticas aisladas por empresa, con historial y validación del servidor en HTTP y MCP.

## T-045 — Ciclo de vida de comprobantes fiscales
- **Estado:** [ ] bloqueado por validación del responsable fiscal y disponibilidad del mecanismo autorizado.
- **Deps:** T-044.
- **Hacer:** enlazar ventas con documentos fiscales inmutables, numeración autorizada, idempotencia, reintento, rechazo, anulación y documentos correctivos.
- **Listo cuando:** reintentar no duplica documento ni movimiento; una corrección preserva el original; la venta respeta la política fiscal.

## T-046 — Periodos y cierres contables
- **Estado:** [ ] propuesta; falta aceptar calendario y reglas de cierre/reapertura.
- **Deps:** T-035, T-041.
- **Hacer:** periodos, bloqueo de asientos atrasados, permisos de cierre/reapertura, motivo y auditoría; reportes por periodo cerrado.
- **Listo cuando:** se rechazan escrituras en periodos cerrados salvo reapertura autorizada y cualquier corrección conserva reversos e historial.

## T-047 — Reglas de contabilización fiscal
- **Estado:** [ ] bloqueado por aprobación de cuentas y tratamiento tributario.
- **Deps:** T-044, T-045, T-046.
- **Hacer:** mapear ventas, costo, impuestos, compras, devoluciones y anulaciones a cuentas aprobadas, dentro de transacciones idempotentes.
- **Listo cuando:** documentos fiscales, movimientos y asientos cuadran y su origen es trazable.

## T-048 — Conciliación fiscal-contable y cierre
- **Estado:** [ ].
- **Deps:** T-045, T-047.
- **Hacer:** reportar diferencias entre ventas, documentos fiscales, impuestos, inventario y mayor; exportar libros confirmados por el responsable.
- **Listo cuando:** cada diferencia puede rastrearse al documento y corregirse sin alterar documentos emitidos.

## T-049 — Conciliación bancaria
- **Estado:** [ ] propuesta de fase posterior.
- **Deps:** T-046.
- **Hacer:** importar extractos en un formato acordado, sugerir coincidencias y dejar ajustes manuales trazables.
- **Listo cuando:** el saldo conciliado concuerda con el extracto y diferencias no crean asientos duplicados.
## T-050 — Precisión numérica y formato decimal por contexto
- **Estado:** [ ] propuesto para fase 2; falta aprobar escalas y redondeos con Contabilidad y responsable fiscal.
- **Deps:** T-041, T-043.
- **Hacer:** separar precisión de captura/cálculo de visualización; definir políticas tipadas para cantidad, factor, costo/precio unitario, importes de línea, impuesto y partidas; migrar columnas de escala 2 sin pérdida ni recálculo silencioso; unificar formateadores operativos, reportes, contabilidad y documentos fiscales.
- **Propuesta inicial:** hasta 4 decimales en captura/cálculo de cantidades y valores unitarios; reportes contables pueden mostrar 2; documentos fiscales siguen la regla aprobada del régimen.
- **Listo cuando:** los mismos valores de origen producen cálculos y redondeos reproducibles; las partidas cuadran; cambiar el formato visible no altera almacenamiento ni contabilidad; el histórico conserva sus valores.
## T-051 — Plantillas predefinidas y personalizadas de documentos fiscales
- **Estado:** [ ] propuesta; depende de aprobar el alcance fiscal de T-043/T-044.
- **Deps:** T-043, T-044, T-045.
- **Hacer:** crear una galería bajo Configuración > Fiscalidad > Plantillas para formatos predefinidos del sistema y copias personalizadas aisladas por empresa. Implementar editor visual de bloques y controles de estilo para personal no técnico, vista previa, borrador/publicación versionada y modo avanzado HTML con vista dividida.
- **Seguridad fiscal:** los campos legales requeridos son bloques protegidos; la validación del servidor impide ocultarlos o publicar una plantilla incompleta. No ejecutar JavaScript ni permitir iframes/recursos remotos arbitrarios; sanitizar contenido y validar assets. Los permisos de configuración se aplican también a HTTP y MCP.
- **Integridad:** cada documento emitido fija plantilla y versión, snapshot fiscal, referencia exacta al CAI/autorización y hash del PDF regenerado; no almacenar el PDF en bucket. Editar una plantilla predefinida crea una copia de empresa y no altera el original.
- **Archivos:** HTML/estructura y metadatos en PostgreSQL; todos los binarios (logos, recursos y adjuntos originales POS) en Cloudflare R2 privado. La base guarda solo claves, tamaño, tipo y hash. Lectura autenticada y aislada por empresa.
- **UX de referencia:** INNOVAISP presenta plantillas en tarjetas con miniaturas/estados y un espacio con HTML, vista previa y vista dividida. El editor visual de bloques es una capacidad añadida para que usuarios no técnicos no necesiten editar HTML.
- **Listo cuando:** aislamiento multiempresa, permisos, sanitización, validación de campos, publicación/versionado, render determinista y preservación de documentos históricos pasan pruebas.

## T-052 — Regeneración documental y ciclo histórico de CAI/autorizaciones
- **Estado:** [ ] propuesta; parte de fase 2 fiscal.
- **Deps:** T-043, T-044, T-045, T-051.
- **Hacer:** guardar en PostgreSQL versiones inmutables de autorizaciones fiscales/CAI, con vigencia, establecimiento, tipo, rango, correlativo, estado, actor y auditoría; definir campos exactos según régimen aprobado. Renovaciones crean un registro nuevo, nunca sobrescriben el anterior. Alertar vencimiento/agotamiento y bloquear asignaciones fuera de rango o solapadas.
- **Snapshot por documento:** registrar referencia/version exacta de CAI, valor autorizado, correlativo, perfil fiscal emisor/receptor, líneas, impuestos, redondeos, totales, plantilla/version, referencias de assets y renderer usados. El número emitido queda reservado una sola vez con idempotencia.
- **Regeneración:** crear PDF/representación bajo demanda desde el snapshot y versiones fijadas; no almacenar documentos generados en R2/S3. Guardar hash y metadatos para detectar diferencias. Nunca tomar el CAI o plantilla vigentes para regenerar un documento histórico.
- **Adjuntos:** archivos originales no regenerables se almacenan en R2 privado, nunca como binarios en PostgreSQL. Guardar en la base solo la clave de objeto y metadatos. Preservar acceso autenticado, aislamiento por empresa, límites y auditoría.
- **Migración:** aplicar la regeneración a comprobantes PDF operativos; retirar sus PDFs existentes de R2/S3 solo tras comprobar regeneración/hash. Mantener en R2 los adjuntos originales y assets. No eliminar objetos hasta validar integridad y recuperación.
- **Correlativos:** asignar folios de forma atómica/idempotente y auditar reserva, emisión, fallas, anulaciones y saltos. Alertar vencimiento/agotamiento. Nunca consumir numeración en vista previa. La reutilización de huecos requiere regla fiscal validada.
- **Listo cuando:** renovar el CAI no afecta documentos anteriores; regenerar conserva CAI, correlativo, contenido, plantilla y recursos originales; ningún PDF generado se persiste en R2/S3 y ningún binario se guarda en PostgreSQL.
## T-053 — Bodegas múltiples con inventario independiente
- **Estado:** [~] backend completo (HTTP y MCP) el 29-10-2026; falta construir la pantalla en la tienda/admin (frontend).
- **Deps:** T-024, T-025, T-028, T-029.
- **Hecho:**
  - Las capas de costo ya estaban aisladas por `(empresa, bodega, producto)` desde una migración previa (`026_phase2_financial_inventory_controls.sql`); lo que faltaba era la operación de traslado y la administración de bodegas, no el aislamiento en sí.
  - **Bug corregido:** `replaceStock` en `inventory-ledger.queries.ts` borraba las capas viejas usando la bodega del documento (un solo valor), no la de cada línea de `stock`. Un documento que tocara dos bodegas a la vez (como un traslado) habría duplicado el saldo de la bodega destino. Ahora agrupa el `DELETE` por la bodega real de cada fila.
  - Nuevo `TransferStockUseCase` (`libs/application/src/inventory/stock/transfer/transfer-stock.use-case.ts`) y dominio puro `planWarehouseTransfer` (`libs/domain/src/inventory/stock/transfer/warehouse-transfer.ts`): consume capas en origen con el método de costeo de la empresa/producto (PEPS/UEPS/FEFO/promedio/específico), **mueve cada capa consumida a destino con su mismo costo y fecha** (no revalúa), y postea un asiento balanceado a `1.01.02.001` con `costCenter` = código de bodega destino (debe) y origen (haber). Idempotente por `idempotencyKey`. Endpoint `POST /erp/inventory-transfers`.
  - `JournalLine` ganó un campo opcional `costCenter`; nueva columna `journal_lines.cost_center` (migración `027_journal_line_cost_center.sql`, aplicada en `erp_dev`).
  - Administrar bodegas: ya existía crear y fijar la bodega por defecto; se agregó **renombrar** (`PUT /erp/company-controls/warehouses/:id`) y **activar/desactivar** (`PUT .../warehouses/:id/active`, rechaza desactivar la bodega por defecto). `CompanyPort` ganó `createWarehouse` para uso fuera del contexto de Configuración.
  - Filtrar por bodega: `GET /erp/stock-cards` ya aceptaba `warehouseId`; no se tocó.
  - Herramienta MCP `transfer-stock` (mismos permisos y validaciones que el HTTP; módulo `inventory`, acceso `edit`), catálogo MCP ahora con 55 herramientas.
  - **Verificado:** lint, build (4 apps) y 58 suites/160 pruebas en verde, incluidas dos pruebas de extremo a extremo (HTTP y MCP): traslado real, idempotencia, rechazo de origen=destino, operador sin permiso de edición rechazado con 403.
- **Pendiente:**
  - Pantalla en `ERP_FRONTEND`/`ERP_ADMIN` para crear/renombrar/desactivar bodegas y hacer el traslado (hoy solo existe la API/MCP).
  - El tablero (`dashboard.use-case.ts`) todavía no filtra por bodega; `stock-cards` sí.
  - No se migró ningún saldo histórico porque en desarrollo solo existe la bodega Principal; la migración de saldos reales queda para cuando una empresa real tenga más de una bodega.
- **Decisión de diseño (29-10-2026):** cada bodega tiene su propio inventario (capas y saldos aislados, no solo por empresa/producto) y su propio efecto contable por separado — un movimiento entre bodegas no es invisible contablemente. El dueño señaló que lo más estándar es separar también por centro de costo. Este ERP (a diferencia del Eterbook/COMPAC anterior, que ya traía `Departamento`/`Proyecto` por partida) **no tiene hoy esa dimensión**; T-053 debe introducirla: un centro de costo por bodega, sin duplicar el plan de cuentas — la cuenta de inventario sigue siendo la misma, pero cada línea del asiento lleva el centro de costo de su bodega.
- **Hacer:** administrar bodegas desde Configuración (crear, renombrar, desactivar sin borrar historia; asociar un centro de costo); asignar bodega a cada documento/capa/movimiento; filtrar fichas, existencias e informes por bodega; seleccionar origen y destino para traslados con consumo de capas, costos, asientos e idempotencia atómicos — el asiento de traslado carga/abona a las cuentas de inventario con el centro de costo de cada bodega; conservar `Principal` y migrar a ella los saldos históricos sin cambiar sus valores.
- **Regla:** no habilitar una bodega seleccionable hasta que cada escritura/lectura de inventario esté delimitada a ella. Una lista de bodegas con saldo global compartido sería engañosa. Un traslado entre bodegas de la misma empresa no genera ingreso/costo de venta, solo mueve el inventario entre centros de costo.
- **Listo cuando:** los permisos y el aislamiento por empresa/bodega se validan en HTTP y MCP; una transferencia cambia ambos saldos y sus capas una sola vez y dentro de la misma transacción genera el asiento con los centros de costo correctos; las salidas no consumen existencias de otra bodega; los saldos históricos cuadran antes/después de la migración; un reporte por centro de costo/bodega concilia contra el saldo de inventario de esa bodega.

## T-054 — Política de costeo general editable
- **Estado:** [x] API/MCP listos el 29-10-2026; falta la pantalla en frontend/admin.
- **Deps:** T-024, T-025.
- **Hecho:**
  - **Empresa (predeterminado general):** ya existía `PUT /erp/company-controls` (`ManageCompanyControlsUseCase.save`) con historial en `company_costing_policy_history`, pero **cambiaba el método en silencio sin revisar existencias** — un hueco real. Se agregó el guardia: `saveControls` ahora rechaza el cambio (`CostingMethodChangeError`, mapeado a 400) si algún producto que usa el predeterminado (`costing_method IS NULL`) tiene saldo en cualquier bodega. Verificado manualmente contra `erp_dev` con un script desechable (rechaza con saldo > 0, permite con saldo en 0).
  - **Producto (excepción):** nuevo `SetProductCostingMethodUseCase` (`libs/application/src/inventory/catalog/costing/set-product-costing-method.use-case.ts`) + puerto `CostingPolicyPort` (`changeProductCostingMethod`/`productCostingHistory`), implementado en memoria y Postgres sobre el mismo repositorio de productos (igual patrón que `PricePort`). Rechaza el cambio con `CostingMethodChangeError` si el producto tiene saldo en cualquier bodega; `costingMethod: null` vuelve a "usar el predeterminado de la empresa". Exige una razón no vacía y registra actor/fecha en `product_costing_policy_history` (migración `028`).
  - Endpoint `PUT /erp/products/:id/costing-method` y herramienta MCP `set-product-costing-method` (catálogo MCP ahora con 56 herramientas), mismos permisos (`inventory`/`edit`) que el resto de inventario.
  - La regla de resolución (`resolveCostingMethod`: producto si tiene uno propio, si no el de la empresa) ya se aplicaba en ficha, confirmación de documentos, traslados e importaciones — no hizo falta tocarla, solo exponer cómo se *cambia* el método.
  - **Verificado:** lint, build (4 apps) y 61 suites/167 pruebas en verde, incluidas pruebas HTTP y MCP de extremo a extremo (fijar excepción, rechazo con saldo, razón vacía, método desconocido, operador sin permiso).
- **Pendiente:** pantalla en `ERP_FRONTEND` (selector por producto) y `ERP_ADMIN`/Configuración (selector general); no hay endpoint de lectura del historial todavía (el registro queda en la base, pero nadie lo consulta aún).
## T-055 — Catálogo de documentos comerciales, compras y fiscales
- **Estado:** [ ] pendiente; el sandbox actual solo cubre la vista preliminar de factura desde venta confirmada.
- **Deps:** T-043, T-044, T-045, T-047, T-051, T-052, T-053.
- **Hacer:** catálogo con cotizaciones, proformas, requisiciones, solicitudes y órdenes de compra, facturas, notas de crédito/débito, retenciones y traslados entre bodegas. Implementar estados y aprobaciones por rol, vínculos con origen, conversiones seguras e historial. Añadir plantillas versionadas A4 editables con editor visual, vista previa y opciones de tamaño/orientación/márgenes; mantener HTML avanzado sanitizado para administrador.
- **Integridad:** cotizaciones, proformas, requisiciones y solicitudes no contabilizan ni mueven stock por sí mismas; la orden de compra no recibe stock hasta el documento de recepción; traslados confirman ambos almacenes en una transacción; notas correctivas enlazan documento original; devolución de dinero y reintegro físico son procesos explícitos y separados.
- **Archivos:** formatos generados bajo demanda sin persistir PDFs; los originales y logos van a R2 privado, nunca como bytes en PostgreSQL. Datos fiscales en desarrollo son sintéticos y `DEV-NOT-VALID`.
- **Listo cuando:** cada tipo conserva su ciclo de vida y permisos, conversión/reintento no duplica líneas, saldos, impuestos ni asientos, plantilla/A4 reproduce snapshots históricos, y reportes concilian sus efectos.
### Actualización de desarrollo (2026-10-27)
- T-043 tiene una implementación parcial de sandbox: emisión ficticia únicamente desde venta confirmada, secuencia/idempotencia PostgreSQL, snapshot con huella y vista imprimible marcada `DEV-NOT-VALID`.
- Esto no cierra la emisión fiscal autorizada, las políticas por empresa, las plantillas editables ni el ciclo completo de CAI. Siguen bloqueados para producción por B-002 y las decisiones fiscales.

### Seguimiento de T-055 (2026-10-27)
- **Estado:** parcial. Existe /erp/business-documents y /erp/document-templates, con un centro responsive para crear/listar documentos ficticios, formatos versionados por empresa, borrador/publicación, vista previa e impresión A4/Carta vertical/horizontal con logo configurado.
- **Tipos visibles:** factura de prueba no fiscal, proforma, cotización, requisición, solicitud y orden de compra, traslado entre bodegas, notas de crédito/débito y retención.
- **Persistencia:** migraciones aditivas 021 y 022; snapshot con hash guarda la versión del formato y datos mostrados. synchronize continúa desactivado.
- **Límite:** este centro todavía no implementa conversiones, aprobaciones/ciclos de compras, ejecución real de traslados, enlace obligatorio de notas/retenciones ni emisión fiscal autorizada. Esos efectos no ocurren al crear un documento de desarrollo.

- **Ampliación de T-055:** formatos estándar faltantes se pueden preparar en lote; los formularios capturan datos específicos de compras, traslado, notas y retención. Las notas/retenciones exigen una factura de prueba del mismo negocio; se conserva su id y número en el snapshot. La orden de compra puede enlazar una solicitud de compra existente.
