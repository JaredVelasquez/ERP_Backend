# SPEC — Fase 1 Michelle Market ERP

Especificación aceptada en conversación el 2026-10-04. Lo que no está aquí no se construye. Lo que está en "Decisiones abiertas" no se inventa.

La fase 2 está en la sección 12. No reabre los requisitos de la fase 1.

## 1. Producto

Sistema SaaS para operar un mini market: inventario, precios, contabilidad básica, tablero, códigos de barra, carga Excel y un comprobante firmable. La referencia operativa es Michelle Market (logo: Michelle Market).

Tres repositorios:

| Repo | Rol |
| --- | --- |
| `ERP_Backend` | API, MCP, reglas, SQL Server |
| `ERP_FRONTEND` | Tienda: web, Electron y Android (Capacitor), misma interfaz |
| `ERP_ADMIN` | Web para sociedades, empresas, marca y plantillas |

## 2. Actores

| Actor | Dónde entra | Puede |
| --- | --- | --- |
| Administrador de plataforma | ERP_ADMIN | Crear cuentas SaaS, sociedades, empresas, logo, colores y plantillas |
| Dueño de empresa | Tienda | Usuarios de su empresa, catálogo contable, productos, precios, reportes |
| Operador | Tienda | Entradas, salidas, consulta y firmar documentos |
| LLM externo | MCP | Las mismas acciones que el permiso del token permite |

## 3. Tenencia

```text
Cuenta SaaS
  └── Sociedad          (agrupa; no tiene RTN ni libros)
        └── Empresa     (RTN, razón social, moneda, inventario, precios, usuarios, contabilidad)
              └── Bodega
```

- Michelle Market nace como una empresa dentro de una sociedad, con una bodega llamada Principal.
- Dos empresas de la misma sociedad no comparten existencias, precios ni asientos.
- La moneda operativa de Michelle es el lempira. El formulario Ficohsa puede marcar lempiras o dólares en la cuenta del banco; eso es un dato del documento, no una segunda contabilidad.

## 4. Decisiones cerradas

| Tema | Decisión |
| --- | --- |
| Libros | Viven en la empresa, junto con el RTN |
| Costeo de Michelle | PEPS. Cada producto puede elegir otro método. Si el producto no elige, usa el de la empresa |
| Costo | Cada entrada guarda su propio costo |
| Margen | La empresa tiene un porcentaje predeterminado. El formulario del producto lo propone y deja cambiarlo. El precio de estante no cambia solo al recibir mercancía. La acción "Aplicar margen" recalcula el precio y escribe historial |
| Venta | Dos partidas: costo contra inventario, y la cuenta donde entró el dinero contra ventas |
| Fiado | Fuera de esta fase |
| ISV | No se calcula. El producto tiene categoría de impuesto. La empresa tiene el impuesto apagado. Existen cuentas de ISV sin uso |
| Existencia | Si no alcanza, la salida se bloquea |
| Catálogo contable | Semilla editable, visible en árbol de cuatro niveles. Solo la subcuenta recibe asientos |
| Cuentas de cobro iniciales | Caja efectivo, POS BAC Credomatic, POS Ficohsa, Transferencias BAC, Transferencias Ficohsa |
| MCP | Ejecuta el mismo caso de uso, con el permiso del token, y queda auditado |
| PDF firmado | Se guardan los datos y el trazo. El PDF se genera al descargar. La nube queda fuera |
| Unidades | Un producto, varias presentaciones, inventario en la unidad base |
| Código de barras | Code 128 interno, número más PNG y SVG. Se puede guardar además el código del fabricante |
| Excel de conteo | No pisa existencias. Propone un ajuste y se confirma |
| Métodos diferidos | Promedio periódico, menudeo y costo estándar no entran al motor |
| UEPS | Disponible. Michelle no lo usa. NIIF no lo recomienda como política habitual |
| Cambio de método | Bloqueado mientras el producto tenga existencia en esa empresa |
| Marca | Azul `#0157D2`, crema `#F6EDE6` |

## 5. Decisiones abiertas

No sembrar estos valores. Quedan en configuración o en `BLOCKERS.md`.

| # | Tema | Por qué no se adivina |
| --- | --- | --- |
| D1 | Porcentaje de margen inicial de Michelle | En el Excel aparece un encabezado `0.25`. No se trata como 25% |
| D2 | RTN, razón social y dirección de Michelle Market | No están en los documentos entregados |
| D3 | Credenciales y nombre de la base SQL Server | No hay entorno definido |
| D4 | Usuarios iniciales y quién firma el comprobante | No hay lista de personas |

## 6. Requisitos funcionales

### RF-01 Tenencia y acceso

- Alta de cuenta SaaS, sociedad y empresa.
- La empresa guarda RTN, razón social, moneda, método de costeo, margen predeterminado (nullable), impuesto encendido o apagado, y logo/colores que publica el admin.
- Usuarios con membresía a una o varias empresas y un rol: administrador de plataforma, dueño, operador.
- Cada membresía (usuario + empresa) guarda permisos de módulo en la misma base: ver o editar. Módulos: tablero, productos, inventario, precios, contabilidad, importaciones, documentos. Plataforma solo la tiene el administrador de plataforma.
- Sin lista explícita, el operador edita productos, inventario, importaciones y documentos; ve tablero y precios; no entra a contabilidad ni a plataforma. El dueño edita los módulos de la empresa. El administrador de plataforma edita todo, incluida plataforma.
- Una lista explícita reemplaza esos valores. No se puede dar plataforma a otro rol. Un módulo repetido es un error. Editar incluye ver. GET es ver; el resto de métodos es editar.
- Login devuelve los grants. El dueño o el administrador de plataforma puede reemplazarlos para esa empresa.
- Login. Si el usuario tiene varias empresas, elige una antes del inicio.
- Web y Electron usan cookie `httpOnly`. Android usa bearer. El POC de Capacitor cierra el mecanismo antes de publicar la app.

### RF-02 Productos y presentaciones

- Producto: nombre, categoría, unidad base (conteo o peso), si controla vencimiento, método de costeo opcional, margen opcional, categoría de impuesto, activo.
- Presentación: unidad, factor hacia la unidad base, si se compra, si se vende, código de barras propio.
- El inventario se guarda en unidad base. Una caja de 48 entra como 48 unidades al costo de la caja dividido entre 48.
- El peso (libra o kilo) entra y sale por la cantidad real de esa operación.
- Código interno Code 128, numérico, con vista previa y descarga PNG y SVG. Código de fabricante opcional para escanear.

### RF-03 Capas y métodos

Métodos perpetuos. La empresa y el producto eligen uno.

| Método | Orden de consumo | Costo que sale |
| --- | --- | --- |
| PEPS | Entrada más antigua | Costo de esa entrada |
| UEPS | Entrada más nueva | Costo de esa entrada |
| FEFO | Lote que vence antes. Sin fecha, al final | Costo de ese lote |
| Promedio ponderado móvil | No elige una entrada para el costo | Valor / cantidad después de cada compra |
| Identificación específica | El lote que la persona elige. Si no elige, se bloquea | Costo de ese lote |

- Cada entrada crea una capa: cantidad pendiente, costo unitario en unidad base, fecha de entrada y vencimiento si el producto lo controla.
- PEPS, UEPS, FEFO e identificación específica consumen capas y el valor del saldo es la suma de las capas vivas.
- El promedio actualiza cantidad y valor del saldo. Si el producto vence, la capa sigue existiendo para avisos y para saber qué físico sale, pero el costo del asiento es el promedio.
- La asignación de capas es una función pura del dominio, con pruebas. La transacción que descuenta capas, actualiza saldo y escribe el asiento vive en el adapter.

### RF-04 Documentos de inventario

Tipos de entrada: compra, saldo inicial.

Tipos de salida: venta, merma, ajuste de menos. El ajuste de más es una entrada de tipo ajuste.

- Borrador y confirmado. Confirmar es idempotente.
- Anular genera el documento inverso. No se edita un documento confirmado.
- Compra: la persona elige la cuenta de donde salió el dinero (cuentas de dinero o Proveedores). Predeterminada: Caja efectivo.
- Venta: la persona elige la cuenta donde entró el dinero, limitada a cuentas marcadas como cuenta de cobro.
- Saldo inicial: haber Saldos iniciales.
- Merma: debe Merma, haber Inventario.
- Ajuste: Inventario contra Ajuste de inventario.
- Un traslado entre cuentas de dinero no toca inventario.

### RF-05 Contabilidad

Semilla por empresa, editable, pintada en árbol. Niveles: clase, grupo, mayor y subcuenta. Solo la subcuenta acepta asientos. Clase, grupo y mayor quedan cerrados. El código es de negocio; el id de la fila es UUID.

El orden de clases sigue el catálogo de Contabilidad I de la UNAH (compañía comercializadora, NIIF): 1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Costos, 6 Gastos. Ese material aplana el mayor en un código de cuatro dígitos que sí recibe asientos (1101 Caja). Este ERP no adopta ese aplanado: conserva los cuatro niveles con el código punteado que ya usaba, para que el mayor no sea contabilizable.

| Código | Nombre | Nivel | Asientos | Cobro |
| --- | --- | --- | --- | --- |
| 1 | Activo | clase | no | |
| 1.01 | Activo corriente | grupo | no | |
| 1.01.01 | Caja y bancos | mayor | no | |
| 1.01.01.001 | Caja efectivo | subcuenta | sí | sí |
| 1.01.01.002 | POS BAC Credomatic | subcuenta | sí | sí |
| 1.01.01.003 | POS Ficohsa | subcuenta | sí | sí |
| 1.01.01.004 | Transferencias BAC | subcuenta | sí | sí |
| 1.01.01.005 | Transferencias Ficohsa | subcuenta | sí | sí |
| 1.01.01.006 | Banco BAC | subcuenta | sí | |
| 1.01.01.007 | Banco Ficohsa | subcuenta | sí | |
| 1.01.02 | Inventarios | mayor | no | |
| 1.01.02.001 | Inventario de mercancías | subcuenta | sí | |
| 1.01.03 | Impuestos por cobrar | mayor | no | |
| 1.01.03.001 | ISV crédito fiscal | subcuenta | sí | |
| 2 | Pasivo | clase | no | |
| 2.01 | Pasivo corriente | grupo | no | |
| 2.01.01 | Cuentas por pagar | mayor | no | |
| 2.01.01.001 | Proveedores | subcuenta | sí | |
| 2.01.02 | Impuestos por pagar | mayor | no | |
| 2.01.02.001 | ISV por pagar | subcuenta | sí | |
| 3 | Patrimonio | clase | no | |
| 3.01 | Capital | grupo | no | |
| 3.01.01 | Capital social | mayor | no | |
| 3.01.01.001 | Capital | subcuenta | sí | |
| 3.01.02 | Resultados | mayor | no | |
| 3.01.02.001 | Saldos iniciales | subcuenta | sí | |
| 4 | Ingresos | clase | no | |
| 4.01 | Ingresos operacionales | grupo | no | |
| 4.01.01 | Ventas | mayor | no | |
| 4.01.01.001 | Ventas | subcuenta | sí | |
| 5 | Costos | clase | no | |
| 5.01 | Costo de ventas | grupo | no | |
| 5.01.01 | Costo de mercancía | mayor | no | |
| 5.01.01.001 | Costo de ventas | subcuenta | sí | |
| 6 | Gastos | clase | no | |
| 6.01 | Gastos operativos | grupo | no | |
| 6.01.01 | Gastos de inventario | mayor | no | |
| 6.01.01.001 | Merma | subcuenta | sí | |
| 6.01.01.002 | Ajuste de inventario | subcuenta | sí | |

Reglas de partida editables por tipo de documento. El asiento referencia el documento origen.

Categorías de impuesto sembradas y apagadas en el cálculo: Sin impuesto (predeterminada, tasa 0), Exento, ISV 15, ISV 18. Con el impuesto de la empresa apagado, ninguna venta separa impuesto.

Reportes, calculados en el backend: libro diario, libro mayor, balance de comprobación, valuación de inventario, kardex, cambios de precio.

### RF-06 Precios e historial

- Precio de venta por presentación.
- Cada cambio guarda anterior, nuevo, quién, cuándo y motivo.
- El costo de cada capa queda en la capa. Un cambio manual del costo de referencia del producto también entra al historial.
- "Aplicar margen" usa el margen del producto o, si no tiene, el de la empresa. Si ninguno existe, la acción no calcula un porcentaje: pide el precio.

### RF-07 Tablero

Periodo inicial: últimos 30 días, con selector. Solo documentos confirmados. "Venta" es el único tipo que cuenta como venta.

- Productos que más entran y que más salen, en unidad base.
- Productos activos con menos cantidad vendida.
- Producto que más ingresos genera: cantidad por precio de venta.
- Producto que más margen deja: ingresos menos costo de las capas consumidas.
- Precios de venta que subieron o bajaron en el periodo.
- Productos que más veces cambiaron de precio en el periodo.

### RF-08 Excel

Dos plantillas descargables:

1. Alta: sku, nombre, categoría, unidad base, presentación, factor, costo, precio, cantidad, vencimiento opcional, código de fabricante opcional.
2. Conteo: sku, cantidad contada en unidad base.

La alta crea productos y un documento de saldo inicial. El conteo compara contra la existencia y arma un ajuste; no se confirma solo. Las filas con error se devuelven sin aplicar el archivo completo.

El libro `PRECIOS MICHELLE MARKET.xlsx` no se importa tal cual. Tiene categorías como filas, fórmulas y notas personales. Esas notas no entran al sistema.

### RF-09 Comprobante Ficohsa Tengo

Plantilla HTML administrable. Formulario:

- Tipo de servicio: depósito a cuenta, pago de préstamo, pago de tarjeta de crédito, retiro con código Tengo, cobro de remesa, pago de servicio público, retiro de banco, otro.
- Monto, moneda de la cuenta (lempiras o dólares), número de cuenta o contrato, titular, banco o remesadora, DNI, teléfono, fecha.
- Declaración del formulario: la persona confirma que la información es correcta.
- Firma dibujada en pantalla.
- Referencia bancaria: el número que muestra el banco. Puede ir vacía en el borrador. Al confirmar o descargar es obligatoria y sale en el PDF como "Referencia bancaria".
- Enlace opcional al traslado de dinero ya contabilizado (Caja, POS, transferencias o bancos). El comprobante y el traslado son de la misma empresa. Un traslado de otra empresa se rechaza. Firmar no crea otro asiento: el traslado sigue siendo el asiento.
- Confirmar es idempotente. Anular marca el comprobante como anulado y deja visibles la referencia y el enlace. No borra ni reversa el traslado.

Se guarda el formulario, la firma y ese enlace. La descarga arma el PDF. La firma es un trazo, no una firma electrónica certificada. El papel original trae seis copias; el PDF de esta fase es un ejemplar.

### RF-10 MCP

Tools de lectura y de escritura, una por caso de uso de esta fase. El token es el de la sesión, por usuario y empresa. La auditoría guarda quién llamó, qué tool, el resultado y, si aplica, el id del traslado. No guarda la contraseña, el token, el cuerpo de la firma ni la referencia bancaria completa.

## 7. Datos

Tablas. Sin vistas, procedimientos, funciones ni triggers.

- `tenants`, `societies`, `companies`, `warehouses`
- `users`, `memberships`, `roles`
- `product_categories`, `units_of_measure`, `products`, `product_presentations`, `barcodes`
- `tax_categories`
- `inventory_layers`, `stock_balances`, `inventory_documents`, `inventory_document_lines`
- `accounts`, `posting_rules`, `journal_entries`, `journal_lines`
- `price_changes`
- `document_templates`, `document_submissions`, `document_signatures`
- `import_batches`
- `mcp_tokens`, `mcp_audit_log`

Índices para empresa + producto + bodega, documento + estado, cuenta + empresa, y token. Llave única de idempotencia en el documento de inventario.

## 8. Puertos

Un puerto por agregado. El caso de uso inyecta solo los que usa.

| Puerto | Responsabilidad |
| --- | --- |
| `CompanyPort` | Empresa, sociedad, bodega, configuración |
| `IdentityPort` | Usuario, sesión, membresía |
| `ProductPort` | Producto, presentación, código |
| `InventoryPort` | Documento, capas y saldo en una transacción |
| `AccountingPort` | Cuentas, reglas y asiento en la misma transacción que el inventario cuando el documento se confirma |
| `PricePort` | Precio vigente e historial |
| `DashboardPort` | Agregados del periodo |
| `ImportPort` | Lote de Excel y sus errores |
| `TemplatePort` | Plantilla, envío y firma |
| `PdfPort` | HTML a PDF |
| `BarcodePort` | Número e imagen |
| `McpTokenPort` | Token y auditoría |

`ConfirmInventoryDocument` es un caso de uso. El adapter abre una transacción que persiste documento, capas, saldo y asiento juntos. El caso de uso no abre la transacción.

## 9. API

Prefijos públicos en el gateway:

| Prefijo | Proceso |
| --- | --- |
| `/identity` | identity |
| `/erp` | erp |
| `/mcp` | mcps |
| `/admin` | erp, audiencia de plataforma |

Contrato OpenAPI. El frontend genera tipos y schemas Zod. Cada tool MCP llama el mismo caso de uso que el controller.

## 10. Cómo se prueba

- La función de capas tiene pruebas de PEPS, UEPS, FEFO, promedio, identificación específica, cantidad cero, cantidad mayor que la existencia y doble confirmación.
- Confirmar dos veces el mismo documento deja una sola salida y un solo par de asientos.
- Una venta sin existencia no escribe capa ni asiento.
- Cambiar el método con existencia responde error de negocio.
- "Aplicar margen" sin porcentaje no inventa un precio.
- El archivo Excel con una fila mala no deja productos a medias.
- El comprobante guarda datos y firma y la descarga devuelve un PDF.
- Una tool MCP sin permiso responde 403 y no escribe.

## 11. Fuera de esta fase

Factura SAR, fiado, Google Drive, recetas, envase retornable, iOS, promedio periódico, menudeo y costo estándar.

## 12. Fase 2 — Hoja de barras, disminución por nombre y lector

Aceptada en conversación el 2026-10-04. Agrega tres operaciones que la fase 1 no tenía. La vista previa PNG y SVG de un Code 128, el alta del código y la confirmación genérica de documentos siguen como están.

### 12.1 Lo que sigue vigente

- Un SKU tiene varias presentaciones. La existencia se guarda en la unidad base. La cantidad de una presentación pasa a base con su factor.
- El permiso de módulo vive en la sesión. `inventory` ver consulta. `inventory` editar confirma una salida. Editar incluye ver.
- La sociedad agrupa y no tiene libros ni RTN. El inventario, el precio y el asiento son de la empresa.
- Firmar un comprobante no crea asiento. Esta fase no toca el comprobante.
- Con el impuesto de la empresa apagado no se calcula ISV ni se parte una línea de impuesto.
- No se siembra el RTN, la razón social, la dirección ni el margen real de Michelle. El costeo de Michelle sigue siendo PEPS cuando el producto no elige otro método.
- La existencia que no alcanza bloquea la salida. Confirmar dos veces la misma clave deja un solo documento.
- Una venta (`sale`) sigue posteando dos partidas: costo de ventas contra inventario, y la cuenta de cobro contra ventas. Los flujos de esta sección no crean una venta.
- El código interno sigue siendo uno por SKU: Code 128 numérico de longitud par. El código de fabricante sigue siendo opcional y vive en la presentación.
- La cámara no entra. La fase 1 no la prometió. iOS sigue fuera. Web, Electron y Capacitor Android usan la misma interfaz React.

### 12.2 Hoja de códigos

Un caso de uso imprime o descarga las barras de un producto o de varios en la misma acción. Un id y muchos ids son la misma operación.

- Usa el Code 128 interno que el producto ya tiene. No asigna otro número ni pisa el código de fabricante.
- El resultado es un PDF de una hoja. Cada etiqueta lleva el nombre, el número interno y la imagen Code 128. Un producto aparece una vez. Descargar e imprimir entregan esos mismos bytes. El PNG y el SVG de un solo código siguen en la vista previa de la fase 1.
- La hoja no es una plantilla HTML de ERP_ADMIN. No se guarda en base. `BarcodePort` arma la imagen y `PdfPort` arma el PDF.
- Lista vacía, id de otra empresa, id desconocido o producto inactivo rechazan la hoja completa. No sale un PDF a medias.
- Permiso: módulo `products` ver. No hace falta editar el catálogo.

### 12.3 Qué documento es la disminución

La disminución por nombre y la salida del lector son una salida de inventario. No escriben el saldo a mano.

Documento: **ajuste de menos**. En el modelo ya cerrado es `adjustment` con `adjustmentDirection: 'out'`.

Por qué este y no la merma: el SPEC ya tiene dos salidas que no son venta. La merma es el gasto 6.01.01.001 y el tablero la cuenta aparte. El ajuste de menos es la salida que el conteo Excel ya usa cuando la cantidad baja y la operación no es una venta ni una merma declarada: debe 6.01.01.002 Ajuste de inventario, haber 1.01.02.001 Inventario de mercadería. Una disminución plana, por nombre o por lectura, es ese caso. No se crea un tercer tipo.

El caso de uso arma ese borrador y llama a `ConfirmDocumentUseCase`. El cliente no manda el tipo de documento, la dirección, una cuenta de cobro ni un importe de venta. Capas, saldo y asiento se escriben en la transacción que ese caso de uso ya confirma. Si una línea no tiene existencia, no se confirma ninguna.

El endpoint genérico de la fase 1 sigue aceptando una venta y, en ese caso, las dos partidas de siempre.

### 12.4 Buscar por nombre

- Caso de uso de lectura. Un texto vacío no busca. El texto se recorta y compara sin distinguir mayúsculas, como fragmento del nombre, dentro de la empresa de la sesión.
- Devuelve productos activos: id, nombre, presentaciones (unidad, factor, precio), código interno. No devuelve productos de otra empresa ni inactivos.
- Elegir una fila no descuenta. La cantidad se pide después, en la presentación elegida, y solo la confirmación del apartado 12.6 mueve existencia.

### 12.5 Lector HID

El aparato es una pistola en modo teclado: escribe el código y manda Enter. No hay plugin nativo ni lectura por cámara.

- El buffer vive en el campo de lectura de esa pantalla. Si el foco está en otro campo (cantidad, nombre, cualquier otro), esas teclas no arman un código ni confirman una salida.
- Un código interno resuelve el SKU. Un código de fabricante resuelve el SKU y esa presentación. Los dos se buscan solo en la empresa de la sesión.
- Código desconocido, producto inactivo o código de otra empresa: fallo visible y existencia intacta. Un código de fabricante repetido en la empresa no elige un producto al azar: es fallo y no mueve existencia.
- Lectura correcta muestra la ficha: nombre, presentación, existencia en unidad base, costo unitario en unidad base, precio de venta de la presentación y código. El código interno siempre se muestra. Si coincidió el de fabricante, también se muestra ese.
- El costo unitario es el de la próxima salida según el método del producto o, si el producto no tiene, el de la empresa. PEPS usa la capa abierta más antigua. El promedio usa valor entre cantidad. Identificación específica no muestra un costo único hasta que la persona elige la capa; sin capa, la salida sigue bloqueada como en la fase 1.
- Si el código interno encuentra varias presentaciones, la ficha las lista y la salida espera la unidad elegida. Si el código es de fabricante, la presentación es la de ese código.
- Desde la ficha se puede descontar ese producto o seguir leyendo hacia una lista. La lectura agrega la línea con cantidad 1 en la presentación resuelta. Esa cantidad se puede cambiar antes de confirmar. Leer no confirma.

### 12.6 Una salida, una o varias líneas

El caso de uso de confirmación acepta una línea o varias. La ficha de un producto y la lista del lector lo llaman igual.

- Cada línea trae producto, unidad de presentación y cantidad mayor que cero. La cantidad entra en esa presentación y se guarda en unidad base.
- La unidad es obligatoria. No se adivina la presentación.
- Clave de idempotencia obligatoria. La misma clave devuelve el documento ya confirmado.
- El asiento de esta salida es una partida: debe 6.01.01.002, haber 1.01.02.001, por el costo de las capas consumidas. No usa Ventas, Costo de ventas ni Merma. No agrega ISV.
- El tablero sigue contando como venta solo el tipo `sale`. Este ajuste no es ingreso.
- Permiso de confirmar: `inventory` editar. Quien solo ve inventario abre la ficha y no confirma.

### 12.7 Ficha de lectura

Un caso de uso de lectura arma la ficha del apartado 12.5 a partir del id del producto o del código. Lo usan el buscador, después de elegir, y el lector. No abre transacción de inventario.

Permiso: `inventory` ver. El caso de uso también exige `products` ver y `prices` ver, porque la ficha muestra nombre, precio y código. Si falta uno, responde prohibido y no inventa el dato. En el catálogo MCP la tool queda en `inventory` ver; el caso de uso revisa los otros grants de la sesión.

### 12.8 HTTP y MCP

Misma regla de la fase 1: el controller y la tool llaman el mismo caso de uso. Prefijos `/erp` y `/mcp`. El contrato OpenAPI se extiende con estas rutas. Las rutas ya publicadas no cambian de significado.

| Acción | Caso de uso | Permiso | Ruta |
| --- | --- | --- | --- |
| Hoja de uno o muchos | Renderizar hoja | `products` ver | `POST /erp/barcode-sheets` |
| Buscar por nombre | Buscar por nombre | `products` ver | `GET /erp/products/search` |
| Ficha por id o por código | Leer ficha | `inventory` ver, más products y prices ver | `GET /erp/stock-cards` |
| Confirmar una o varias líneas | Confirmar ajuste de menos | `inventory` editar | `POST /erp/inventory-issues` |

`GET /erp/products` sin búsqueda sigue devolviendo el listado de la fase 1.

Tools MCP: `render-barcode-sheet`, `search-products-by-name`, `read-stock-card`, `issue-stock`. La auditoría guarda quién llamó, la tool, el resultado, los ids de producto y, si hubo salida, el id del documento. No guarda token, contraseña ni los bytes del PDF.

### 12.9 Cómo se prueba

- Una hoja de un id y una hoja de varios salen del mismo caso de uso. Un id ajeno no deja PDF.
- Buscar o leer un código desconocido no inserta documento, capa ni asiento.
- Confirmar una línea y confirmar varias dejan un documento `adjustment` de salida, saldo menor y una partida 6.01.01.002 contra 1.01.02.001.
- Repetir la clave no vuelve a descontar. Cantidad mayor que la existencia no deja saldo negativo ni asiento.
- Una venta confirmada por el endpoint de la fase 1 sigue con dos partidas y sin línea de ISV mientras el impuesto está apagado.
- La tool sin permiso responde prohibido, no escribe y no deja secretos en la auditoría.
- En la tienda, el recorrido del lector se hace en el navegador: código conocido abre la ficha, código desconocido no cambia existencia, una línea y varias líneas confirman, y escribir en la cantidad no dispara la lectura.

### 12.10 Fuera de la fase 2

Cámara, iOS, plugin nativo de escáner, punto de venta, fiado, factura SAR, recetas, envase, un tercer tipo de documento, plantilla nueva en el admin y carga del Excel de precios.
