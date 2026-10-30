# Fase 2 — Fiscalidad y madurez contable

**Estado:** propuesta para validación de negocio; no iniciar emisión fiscal hasta resolver las decisiones indicadas al final.

## Punto de partida

- La fase 1 ya incluye movimientos operativos de inventario, catálogo contable, asientos generales, reversos y reportes de balance de comprobación, balance general y estado de resultados.
- El módulo fiscal SAR todavía no existe. La tarea T-043 está pendiente.
- Un movimiento operativo de inventario y un comprobante fiscal son documentos diferentes. Entradas iniciales, ajustes, mermas y otras salidas internas deben poder registrarse con motivo y auditoría sin exigir una factura de venta.
- Para una venta real, la política configurable determina cómo se emite o registra el comprobante aplicable; no debe ofrecer un modo de eludir una obligación tributaria.

## Alcance funcional propuesto

### Configuración fiscal por empresa y establecimiento

- Perfil legal y tributario versionado por fecha de vigencia: identidad fiscal, régimen y obligaciones confirmadas por el contador/empresa.
- En desarrollo se permite un perfil sandbox completamente ficticio, identificado en UI/PDF/API como `DEV-NOT-VALID`; sus datos no se presentan como reales ni se transmiten al SAR. Los usuarios pueden probar emisión, plantillas, contabilidad y regeneración localmente. No se crea una configuración por defecto habilitada para producción.
- Modalidad de trabajo: emisión mediante un mecanismo autorizado que se haya confirmado, o registro en el ERP de un documento emitido por un canal autorizado externo.
- Excepciones solo cuando exista sustento y aprobación definidos por el responsable fiscal; registrar quién autorizó y el soporte.
- Reglas de obligatoriedad por tipo de operación y establecimiento, con historial de cambios. La regla de venta se aplica también a las llamadas MCP.
- Tasas, categorías, redondeo y tratamiento de exentos configurables con fecha de vigencia. No inferirlos del usuario, del catálogo ni de una imagen.

### Documentos fiscales

- Emitir/registrar el documento después de validar la venta, usando una copia inmutable de líneas, precios, descuentos, impuestos, comprador, establecimiento y totales.
- Estados explícitos: borrador, pendiente de emisión, emitido/registrado, rechazado, anulado y nota de crédito/débito relacionada, según el flujo que valide el contador.
- Numeración y autorización configuradas por empresa/establecimiento/tipo; idempotencia para reintentos y auditoría de cada intento.
- Mantener historial inmutable de cada autorización fiscal (incluido CAI cuando aplique): valor autorizado, empresa/establecimiento, tipo de documento, rango autorizado, siguiente correlativo, fechas de vigencia, estado, fecha de carga y actor responsable. Los campos y validaciones exactos se confirman según el régimen aprobado.
- No sobrescribir una autorización cuando se renueva o cambia. Cerrar la anterior con su estado/fecha y registrar una nueva versión/asignación; impedir solapamientos o correlativos fuera de rango y alertar antes del vencimiento o agotamiento.
- Reservar cada correlativo de forma atómica, dentro de la emisión idempotente, para impedir duplicados ante concurrencia o reintentos. Registrar reservas, consumos, fallas, anulaciones y saltos con actor/motivo; el tratamiento de huecos sigue la regla validada para el régimen, sin reutilizar números por decisión implícita del sistema.
- Mostrar alertas configurables de próximos vencimientos y rangos bajos, y un tablero de autorizaciones por establecimiento con vigencia, saldo del rango y estado. Desactivar una autorización vencida o agotada para nuevas emisiones sin borrar su historial ni afectar documentos existentes.
- Cada documento emitido guarda una referencia inmutable a la autorización/CAI exacta, versión, correlativo y datos fiscales aplicados. La regeneración usa esa referencia histórica, incluso si la empresa ya configuró un CAI nuevo. Nunca reconstruir facturas antiguas usando la configuración fiscal vigente.
- No editar ni borrar documentos fiscales emitidos. Las correcciones conservan el original y siguen el mecanismo autorizado.
- El movimiento de inventario conserva su referencia a la venta, pero la recepción de existencias y los ajustes internos no dependen de emitir una factura fiscal.
- Los documentos fiscales y demás PDF/representaciones generados por el ERP se reconstruyen bajo demanda desde snapshots inmutables, plantilla/version exacta, autorización histórica y versión del motor de renderizado. No se guardan PDFs generados ni sus copias en buckets; se pueden descargar/imprimir al generarlos.
- Persistir los datos estructurados necesarios para regenerar, el snapshot legal del emisor/receptor/detalle/impuestos/totales, versión de plantilla y motor, configuración de página y referencias/hash de recursos. No usar datos mutables del catálogo ni configuración actual para reconstruir el pasado.
- Mantener salidas deterministas y comprobables: fijar versión del renderizador, fuentes y reglas de formato; guardar hash del PDF generado junto al documento para comparar futuras regeneraciones. Si cambia la versión de renderizado, preservar la capacidad de reproducir la versión original o identificar explícitamente cualquier diferencia.
- La descarga/regeneración valida permisos, empresa, estado del documento y snapshot antes de renderizar; registra auditoría sin guardar el PDF. El nombre/fecha de descarga no altera el contenido fiscal. Vista previa de plantilla usa datos de ejemplo y nunca consume numeración ni CAI.
- Aplicar el mismo patrón a comprobantes PDF operativos ya existentes: generar desde el snapshot firmado y los datos originales al descargarlos, sin conservar copias generadas en R2/S3. Migrar los datos fuente requeridos antes de retirar los objetos existentes. Los adjuntos originales asociados continúan en R2.
- Los adjuntos originales del POS u otros archivos aportados por usuarios no son regenerables y se guardan en Cloudflare R2 privado. PostgreSQL conserva solo metadatos, hash, tipo/tamaño validado y clave del objeto; nunca contenido binario. Servirlos mediante endpoints autenticados con verificación de empresa, no mediante URLs públicas. Definir límites, respaldo, retención y reglas de borrado.
- No borrar objetos existentes de R2/S3 hasta verificar que el contenido fue migrado o que el PDF puede regenerarse y comparar su hash. La retirada de objetos debe ser una migración explícita, auditable y reversible hasta completar la validación.

### Plantillas de documentos fiscales

- Configurar bucket, endpoint y prefijos de R2 desde variables de entorno; no codificar nombres de bucket/rutas en casos de uso ni guardar URLs públicas. Las claves de objeto se forman por empresa y recurso/documento, con validación de pertenencia en servidor.

- Configurar en **Configuración > Fiscalidad > Plantillas** dos familias: **predefinidas**, mantenidas y versionadas por el sistema, y **personalizadas**, propiedad de cada empresa.
- Mostrar las plantillas en una galería de tarjetas con miniatura fiel al documento, nombre, tipo fiscal, estado, versión y acciones claras. Una plantilla predefinida se puede previsualizar y usar como punto de partida; personalizarla crea una copia de empresa y nunca modifica la plantilla del sistema.
- Ofrecer un editor visual para usuarios no técnicos: lienzo con bloques semánticos (encabezado y marca, emisor, cliente, datos de autorización y numeración, detalle de productos, impuestos, totales, códigos/QR oficiales y pie legal), controles de estilo/orden, carga de logo y recursos, vista previa de página y versión móvil. La composición visual se serializa a un HTML determinista y sanitizado. La estructura y HTML de plantillas se guardan versionados en PostgreSQL; sus recursos binarios se almacenan en R2 privado y la base conserva solo claves, hashes y metadatos.
- Inspiración UX de INNOVAISP: galería de plantillas en tarjetas con vista previa y estado; editor en espacio de trabajo con modos visual, HTML avanzado, vista previa y vista dividida. La referencia inspeccionada tiene textarea HTML y vista previa renderizada; el editor de bloques de arrastrar y soltar es una mejora específica del ERP, no una capacidad que se asuma existente en INNOVAISP.
- Permitir guardar borradores, validar campos requeridos, previsualizar con datos de ejemplo o una factura seleccionada en modo seguro y publicar una nueva versión. El usuario puede elegir qué plantilla publicada usar por tipo de documento/establecimiento, sujeto a sus permisos de configuración.
- Los campos fiscales obligatorios, autorizaciones, correlativos, importes, impuestos y textos legales validados se representan como bloques protegidos: no se pueden borrar, ocultar, sustituir por valores arbitrarios ni cambiar sus datos desde el editor. El usuario puede ajustar su presentación dentro de límites aprobados. La validación de servidor bloquea publicar si falta un campo obligatorio.
- No ejecutar JavaScript proporcionado por usuarios, no permitir iframes ni recursos remotos arbitrarios. Sanitizar HTML/CSS, restringir etiquetas/propiedades y recursos a una lista segura; guardar assets en el almacenamiento privado de la empresa y aplicar límites de tipo/tamaño.
- Cada emisión conserva el identificador y versión exactos de la plantilla, los datos congelados y el hash de la representación generada; el archivo se vuelve a generar bajo demanda y no se persiste en un bucket. Editar o publicar una plantilla posteriormente no cambia documentos históricos; correcciones fiscales siguen el ciclo de vida autorizado.
- La configuración y publicación se autorizan por empresa mediante el módulo `settings` y los permisos fiscales que se definan. Todas las operaciones quedan auditadas por actor, empresa, plantilla y versión.
### Madurez contable

1. **Periodos contables:** apertura, cierre, bloqueo de asientos tardíos y reapertura con permiso, motivo y auditoría.
2. **Reglas de contabilización:** mapeos por operación, categoría fiscal, cuenta de cobro y establecimiento; asiento balanceado y trazable a sus documentos de origen.
3. **Integración venta-fiscal-contabilidad:** impuestos por pagar/cobrar, cuentas de ventas y costo de ventas según las reglas aprobadas; una falla de emisión no duplica inventario ni asientos.
4. **Conciliación y cierre:** comparar documentos fiscales, ventas, impuestos, inventario y asientos; explicar diferencias y registrar ajustes solo mediante asientos autorizados.
5. **Reportes de periodo:** libros y reportes fiscales/contables derivados de documentos emitidos y asientos; exportación y comparativos de periodos.
6. **Conciliación bancaria:** fase posterior, una vez acordados formatos de extracto, reglas de coincidencia y tratamiento de diferencias.

### Precisión, redondeo y visualización

- La precisión de captura/cálculo y los decimales visibles son configuraciones distintas. Mostrar 4 decimales no recupera precisión que ya se redondeó y almacenó a 2.
- Configurar por empresa y por tipo de dato: cantidades y factores de presentación; costos unitarios; precios unitarios; importes de línea/totales; tasas/impuestos; y partidas contables. Cada tipo tiene una escala máxima respaldada por la base, y el usuario autorizado elige la precisión dentro de ese límite.
- Definir por contexto los decimales mínimos/máximos de visualización: operación, precios, reportes, contabilidad y comprobantes fiscales. Los reportes pueden mostrar 2 decimales aunque usen saldos internos más precisos.
- La emisión fiscal aplica exclusivamente la precisión, redondeo y forma de presentación aprobados para el documento y régimen configurados. El formato de reportes o la preferencia visual de un usuario nunca modifica el documento emitido.
- Evitar redondear el costo unitario antes de multiplicarlo por cantidad. Persistir escalas suficientes para reproducir cálculos y snapshots; establecer por escrito en qué etapa se redondea cada importe, cómo se distribuyen diferencias y cómo se garantiza que debe/haber cuadren.
- Los cambios de escala/configuración rigen hacia adelante. No reescriben capas, asientos, documentos ni reportes históricos ya confirmados.
- Propuesta inicial para validar: captura de cantidades, factores, costo/precio unitario con hasta 4 decimales; presentación contable compacta de 2 decimales; escala de emisión fiscal según el régimen. No convertir esta propuesta en semilla sin aprobación contable/fiscal.

La implementación requiere migrar los valores monetarios actualmente restringidos a escala 2, sustituir los redondeos globales fijos por políticas tipadas y unificar los formateadores del frontend. Las migraciones serán aditivas y conservarán los valores existentes; no se recalculará historia silenciosamente.

## Orden de implementación

| Orden | Entregable | Depende de |
| --- | --- | --- |
| 0 | Confirmar régimen, documentos, autorización, numeración, impuestos y responsables con la empresa/contador/SAR | Información del negocio |
| 1 | Modelo y configuración fiscal por empresa y establecimiento; permisos y auditoría | 0 |
| 2 | Registro de documento emitido externamente y validaciones; no requiere una API fiscal | 0, 1 |
| 3 | Adaptador de emisión autorizado, solo si se confirma interfaz/documentación oficial disponible | 0, 1 |
| 4 | Periodos contables, cierre/reapertura y mapeos de contabilización | Reglas contables aprobadas |
| 5 | Libros/reportes fiscales y conciliación fiscal-contable | 2 o 3, 4 |
| 6 | Conciliación bancaria | Formatos y reglas confirmados |
| 7 | Galería y editor de plantillas fiscales, versionado y render determinista | 0, 1 y catálogo de documentos fiscales aprobado |
| 8 | Historial de autorizaciones/CAI, regeneración documental y migración de archivos fuera de buckets | 0, 1 y 7 |

Los modos 2 y 3 no son un interruptor para vender sin comprobante. Si la empresa tiene una excepción aplicable, se configura como regla sustentada y auditada, no como una opción general sin control.

## Seguridad e integridad

- Mantener PostgreSQL, TypeORM, consultas por repositorio y migraciones aditivas; `synchronize=false` y `migrationsRun=false`.
- Los casos de uso HTTP y MCP comparten las mismas reglas y autorización por empresa.
- Idempotencia en emisión, contabilización, reversos y reintentos externos.
- La venta conserva una sola identidad operativa; el documento fiscal guarda su snapshot para que cambios posteriores del catálogo no alteren lo emitido.
- Los datos fiscales de producción no se siembran a partir de supuestos. Solo el sandbox de desarrollo usa valores sintéticos y marcados, sin validez legal ni conexión a un emisor real.

## Validación oficial pendiente

La [página de facturación del SAR](https://www.sar.gob.hn/facturacion/) indica que los contribuyentes que transfieren bienes o prestan servicios deben emitir comprobantes fiscales y enumera documentos autorizados. La memoria institucional 2025 del SAR describía entonces la facturación electrónica como proyecto en formulación técnica; por eso no se presume una API de emisión disponible. Antes de integrar o habilitar producción hay que confirmar la situación actual y las obligaciones de Michelle Market con el SAR y su contador.

## Decisiones que bloquean la implementación fiscal

1. **Régimen y perfil de Michelle Market:** RTN/razón social reales, obligaciones aplicables, tasas/categorías y establecimientos.
2. **Documentos de venta:** tipos requeridos para cada caso de venta y si la empresa emitirá desde el ERP o registrará documentos generados con su mecanismo autorizado actual.
3. **Comportamiento cuando no se puede emitir:** bloquear la confirmación de la venta hasta tener documento, o permitir una venta pendiente controlada que no se considere fiscalmente completada. Debe aprobarlo el responsable fiscal.
4. **Contabilidad:** aprobar cuentas y reglas para ventas, costo de ventas, impuestos, compras, devoluciones y cierres; confirmar prioridad entre cierres contables y conciliación bancaria.
5. **Decimales:** confirmar escalas de captura/cálculo para cantidades, factores, costo y precio unitario, importes contables y tasas; aprobar la política de redondeo por etapa y la presentación fiscal.

## Criterios de aceptación de fase

- Ninguna venta fiscalmente obligada se completa sin el documento aplicable o excepción autorizada y auditada.
- Ningún ajuste/merma/entrada inicial exige una factura de venta; todo movimiento queda identificado con actor, motivo, fecha y documento operativo.
- Reintentos no duplican documentos, movimientos, capas, impuestos ni asientos.
- Una precisión operativa mayor no introduce diferencias ocultas entre documento, inventario y partida contable; el redondeo aplicado queda reproducible y auditable.
- Reportes concilian ventas, documentos fiscales, impuestos, inventario y libros; cada total se puede rastrear hasta el origen.
- Pruebas de permisos, aislamiento por empresa, anulaciones, devoluciones, periodos bloqueados, fallas externas y recuperación pasan antes de habilitar producción.

## Familias de documentos comerciales y operativos

El catálogo de documentos del ERP se extenderá más allá de la factura de prueba. La fase debe permitir crear cotizaciones, proformas, requisiciones internas, solicitudes de compra, órdenes de compra, facturas, notas de crédito, notas de débito, retenciones y traslados entre bodegas. Durante desarrollo se muestran únicamente datos ficticios con marcas visibles `DEV-NOT-VALID`.

- **Cotización y proforma:** propuestas comerciales versionadas; no generan asiento ni salida de existencias. La conversión a venta conserva el vínculo y vuelve a validar precios y disponibilidad.
- **Requisición y solicitud de compra:** flujo interno con solicitante, aprobador designado, líneas, cantidades, necesidad y estado. No registra recepción, obligación ni asiento.
- **Orden de compra:** compromiso autorizado y trazable. No incrementa existencias ni reconoce factura de proveedor hasta recibir mercancía/documento correspondiente.
- **Traslado entre bodegas:** documento operativo de doble efecto, origen/destino, líneas, capas de costo preservadas, idempotencia y asientos/reglas requeridos. Se confirma en una sola transacción.
- **Factura:** parte de una venta confirmada; guarda autorización y snapshot inmutable. El sandbox no es legal y la emisión productiva requiere la autorización oficial confirmada.
- **Nota de crédito/débito:** siempre ligada a una factura/documento original; conserva motivo, importes e impuestos del ajuste. Una nota de crédito solo repone inventario si se registra por separado la recepción física de los bienes.
- **Retención:** documento asociado a factura/contraparte, concepto, tasa y monto retenido, autorización y asiento. El perfil fiscal real y sus reglas requieren confirmación del contador.

Todas las familias tendrán plantillas versionadas por empresa. El formato predeterminado será papel A4; el editor permitirá ajustar tamaño/orientación, márgenes, encabezado, columnas, totales, firmas, notas y bloques requeridos, con vista previa en datos ficticios antes de publicar. Plantillas base protegidas; personalización crea una copia de empresa. Sanitización estricta de HTML, sin JavaScript ni recursos arbitrarios.

Documentos emitidos guardan una referencia a versión exacta de plantilla, datos, autorización y renderer. Las representaciones PDF se regeneran bajo demanda; no se guardan como binarios en PostgreSQL o R2. Logos y adjuntos originales sí viven en R2 privado; PostgreSQL almacena claves y metadatos. Permisos, aprobaciones, auditoría e idempotencia se validan por empresa en HTTP y MCP.

## Estado de entrega del centro de documentos (2026-10-27)
Las migraciones 021 y 022 agregan documentos comerciales y plantillas versionadas por empresa. El frontend ya ofrece rutas protegidas de documentos y plantillas, con salida de impresión configurada para A4/Carta y orientación. Los datos son sintéticos, idempotentes y marcados como sandbox/no válidos; el centro no altera inventario ni contabilidad. La factura creada allí es solo de desarrollo; para factura fiscal se conserva el flujo sandbox separado y la habilitación legal sigue bloqueada por B-002 y las decisiones fiscales.
