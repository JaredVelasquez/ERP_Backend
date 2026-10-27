# Revisión crítica de flujos — ERP Michelle Market

Fecha: 18-10-2026. Alcance: backend, frontend de tienda, PostgreSQL local y materiales entregados de Michelle Market. ERP_ADMIN queda fuera por la decisión de trasladarlo al panel general de ARQUIGRAPHIA.

## Cambios ejecutados

| Prioridad | Hallazgo | Corrección |
| --- | --- | --- |
| Crítica | El alta de usuarios aceptaba llamadas sin sesión por el servicio de identidad y por MCP; el cliente podía pedir un rol privilegiado. | HTTP y MCP exigen sesión de dueño de la misma empresa y solo crean operadores. El gateway ya no declara pública la tool de alta. |
| Crítica | Muchos controladores aceptaban `companyId` del cliente sin compararlo con la sesión. | `AreaGuard` rechaza discrepancias en query y body para módulos de empresa; productos y comprobantes derivan el identificador de la sesión. Queda pendiente revisar cada caso anidado y de plataforma. |
| Alta | Las rutas antiguas de precios cambiaban `sale_price` directamente y omitían propuestas, aprobación e historia comercial. | Se retiraron las rutas y tools directas; HTTP y MCP usan propuesta, aprobación, rechazo, historial y aprobador designado. La aprobación actualiza el precio maestro de la presentación en una transacción. |
| Alta | El login no podía elegir empresa para usuarios con varias membresías. | `POST /identity/companies` verifica la contraseña y devuelve las empresas sin crear sesión. La tienda muestra el selector cuando hay más de una. |
| Alta | Las cuatro columnas de Excel se trataban como precios sin significado comercial separado. | Se añadieron costo unitario de referencia, recargo mínimo sobre costo, venta sugerida, venta aprobada e historia. Se importaron 2.015 productos con coincidencia única. |
| Alta | La confirmación de ventas aceptaba el importe de la línea enviado por el navegador. | El servidor identifica la presentación y calcula cada importe con el precio maestro aprobado; rechaza presentaciones ambiguas o sin precio. |
| Media | El PDF era una lista de texto y su codificación de acentos no coincidía con la fuente. | Se generó una copia ampliada con encabezado, casillas de servicio, campos y firma, siguiendo el formulario entregado. Se inspeccionó una descarga real. |
| Media | La marca de Michelle Market no aparecía en el acceso ni en el shell. | Se incorporaron los dos logos originales según el fondo y se configuró el logo de la empresa local. |
| Media | El catálogo mostraba «Sin saldo» en todas las filas sin consultar existencias. | Se quitó la columna hasta disponer de existencias calculadas desde documentos confirmados. |
| Media | El formulario de alta de producto cerraba sin guardar. | Ahora crea el producto mediante la API, pide precio inicial autorizado y actualiza el catálogo. El servidor reserva productos vendibles al dueño o aprobador designado. |

## Conciliación del libro de precios

La hoja `PRECIOS dif` tiene 2.286 filas con costo y precio de gerencia numéricos. Se cotejaron por nombre normalizado con el catálogo local; la carga tomó las 2.015 referencias de coincidencia única. El 25% se interpretó como **recargo sobre costo**, de modo que `TOTAL = PRECIO UNITARIO × 1,25`, sujeto al redondeo de la hoja. No se importaron las demás hojas ni sus notas.

La gerencia debe resolver 116 productos repetidos con valores incompatibles. Sus 257 filas están en [PRICE_CONFLICTS_MICHELLE_MARKET.csv](PRICE_CONFLICTS_MICHELLE_MARKET.csv). Dos filas adicionales tienen un nombre que coincide con más de un producto del catálogo; tampoco se aplicaron. La posición de la fila no constituye fecha de vigencia.

El costo comercial de referencia no altera las capas PEPS ni las ventas confirmadas. El precio de gerencia reside en la presentación; un cambio aprobado afecta todas las unidades de esa presentación disponibles para ventas futuras, sin importar cuándo ingresaron.

## Flujo esperado de precios

1. Una persona con acceso a precios consulta costo, recargo, precio sugerido y precio vigente.
2. Propone un nuevo precio y escribe el motivo. El servidor registra su identidad desde la sesión.
3. El dueño o el aprobador designado acepta o rechaza. El servidor comprueba que el precio base sigue vigente.
4. Si se acepta, la transacción cambia el precio maestro y escribe historial comercial y el historial heredado de precios. Si el precio cambió entretanto, se exige una propuesta nueva.
5. La venta posterior usa el precio vigente; un documento ya confirmado conserva su importe histórico.

## Estado después de las correcciones de tienda

- La tienda revisa el CSV de la plantilla y lo envía solo tras confirmación. La importación del catálogo y el documento de apertura comparten una transacción PostgreSQL; repetir un CSV que produjo apertura recupera el documento mediante un hash estable del archivo.
- La ficha de empresa dejó de ofrecer un guardado ficticio y ya no muestra un RTN inventado. Es de consulta mientras el panel general de ARQUIGRAPHIA asume la administración.
- Una persona operadora puede crear un producto sin precio como borrador; la propuesta y aprobación de precio habilitan su venta. El aprobador designado no puede aprobar su propia propuesta.
- El historial comercial y las propuestas pendientes se consultan por páginas. El guard de empresa examina `companyId` también en estructuras anidadas.
- Login y listado de empresas comparten un límite local de seis intentos fallidos por cuenta en quince minutos, incluidas peticiones simultáneas.
- El comprobante ya no abre con datos ficticios de importe, cliente, DNI o cuenta. La fecha propuesta es la actual.
- Se revisaron las rutas visibles en escritorio y móvil; el tablero muestra accesos directos y movimientos reales en vez de gráficas y actividad de relleno.

## Hallazgos detectados en la revisión inicial

| Prioridad | Flujo | Evidencia | Mejora necesaria |
| --- | --- | --- | --- |
| Alta | Importación desde tienda | `ERP_FRONTEND/src/modules/imports/ui/imports-page.tsx`: el archivo se elige pero `onSubmit` no lo envía. | Convertir .xlsx a contrato de importación supervisada o limitar el selector a CSV, previsualizar errores y pedir confirmación explícita. |
| Alta | Importación de catálogo en backend | `ERP_Backend/libs/application/src/inventory/import-catalog.use-case.ts`: guarda productos con `Promise.all` y confirma el documento después. Un error intermedio puede dejar productos sin el asiento/stock esperado. | Procesar todo el lote en una sola transacción y usar una clave idempotente; conectar la vista previa antes de habilitar la importación masiva en tienda. La ruta y tool se limitaron entretanto al dueño o aprobador designado porque crean precios iniciales. |
| Alta | Acceso público | `POST /identity/login` y `POST /identity/companies` verifican credenciales y no tienen límite de intentos en la aplicación. | Incorporar límites por IP y cuenta, registro de intentos y protección en el gateway antes de publicar. |
| Alta | Configuración de empresa | `ERP_FRONTEND/src/modules/platform/ui/platform-page.tsx`: el botón dice «Guardar datos», pero el aviso aclara que no persiste; contiene RTN ficticio. | Mostrar datos reales de la empresa y conectar una operación autorizada para editarlos. No llevar el placeholder a producción. |
| Media | Precio inicial de producto | La creación del producto recibe presentaciones con `salePrice`. | La creación de una presentación vendible ya se restringió en HTTP y MCP a dueño/aprobador; el formulario de alta debe reflejarlo y proponer un flujo de borrador para operadores. |
| Media | Aprobación de precios | El aprobador designado puede aprobar una propuesta propia. | Definir con gerencia si se exige doble control para propuestas propias; aplicar la regla en dominio y en HTTP/MCP. |
| Media | Auditoría y paginación | La pantalla de precios lee las 100 propuestas y 100 entradas de historia más recientes. | Agregar paginación y filtros por producto/estado/fecha para consulta histórica completa. |
| Media | Tenencia | El guard nuevo compara `companyId` directo en query/body; otros campos anidados y rutas de plataforma requieren revisión por caso de uso. | Derivar siempre empresa de sesión en aplicación; usar identificadores externos solo como comprobación opcional. |
| Media | Comprobante | El PDF confirma la referencia bancaria, firma y vínculo, pero la firma es un trazo capturado, no una firma certificada. | Definir políticas operativas de custodia, retención y anulación para producción. |

## Límites que siguen pendientes

- El asistente ERP usa las herramientas MCP autorizadas por los permisos actuales de la sesión. Puede encadenar búsquedas de referencias y `read-product` para comprobar presentaciones; presenta las escrituras como propuestas que la persona revisa antes de confirmar. Los resultados de archivos y consultas enviados al proveedor de IA deben considerarse datos compartidos con ese proveedor.
- Acepta imágenes, PDF de hasta 4 MB con Gemini y video mediante hasta cuatro fotogramas comprimidos. No procesa la pista de audio ni todos los cuadros. Puede extraer renglones de facturas, pero el usuario debe verificar producto, presentación, cantidad, costo e identificador antes de confirmar un documento de compra.
- Las integraciones MCP tienen tokens persistidos por hash, empresa y usuario, perfil, lista de herramientas y caducidad. Una revocación o pérdida del permiso vigente impide llamadas posteriores. El token se muestra una sola vez al crearlo. `analyze-media` acepta imágenes, PDF o fotogramas y devuelve extracción sin escribir datos; el registro de inventario usa después `confirm-document` con permiso de edición. El proveedor IA local usa Gemini configurado en `.env` ignorado por Git; producción requiere clave y política de datos propias.

- El limitador de acceso está en memoria de una instancia y por cuenta. Para despliegue con varias réplicas faltan un almacenamiento compartido, control por IP en el gateway y registro de intentos.
- Un CSV sin cantidades positivas no genera documento de apertura y no tiene todavía un registro de lote idempotente.
- La importación presenta una muestra de cinco filas. El servidor valida el lote completo al confirmar; falta una vista previa de errores fila por fila antes del envío.
- La política de custodia, retención y anulación del comprobante depende de una decisión de negocio antes de producción.

## Comprobaciones realizadas

- Compilación de backend y frontend.
- Inicio de gateway, identidad, ERP y frontend local.
- Consulta real del catálogo y las magnitudes importadas.
- Descarga e inspección visual de un comprobante confirmado.
- Respuesta 401 para credenciales erróneas al listar empresas; 200 para credenciales válidas.
- Respuesta 401 al intentar alta de usuario sin sesión, 403 al consultar otra empresa, 404 para la ruta antigua de cambio directo de precio.

No se ejecutó la batería automatizada de pruebas en esta revisión.
