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
- **Nota:** sin porcentaje no hay precio. 0.25 no se trata como 25%. Una entrada no mueve el precio de estante.

## T-011 — Tablero y reportes

- **Estado:** [x]
- **Nota:** una merma no cuenta como venta ni como ingreso. El balance de un documento anulado queda en cero.

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
