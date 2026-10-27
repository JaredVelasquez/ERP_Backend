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
- Modalidad de trabajo: emisión mediante un mecanismo autorizado que se haya confirmado, o registro en el ERP de un documento emitido por un canal autorizado externo.
- Excepciones solo cuando exista sustento y aprobación definidos por el responsable fiscal; registrar quién autorizó y el soporte.
- Reglas de obligatoriedad por tipo de operación y establecimiento, con historial de cambios. La regla de venta se aplica también a las llamadas MCP.
- Tasas, categorías, redondeo y tratamiento de exentos configurables con fecha de vigencia. No inferirlos del usuario, del catálogo ni de una imagen.

### Documentos fiscales

- Emitir/registrar el documento después de validar la venta, usando una copia inmutable de líneas, precios, descuentos, impuestos, comprador, establecimiento y totales.
- Estados explícitos: borrador, pendiente de emisión, emitido/registrado, rechazado, anulado y nota de crédito/débito relacionada, según el flujo que valide el contador.
- Numeración y autorización configuradas por empresa/establecimiento/tipo; idempotencia para reintentos y auditoría de cada intento.
- No editar ni borrar documentos fiscales emitidos. Las correcciones conservan el original y siguen el mecanismo autorizado.
- El movimiento de inventario conserva su referencia a la venta, pero la recepción de existencias y los ajustes internos no dependen de emitir una factura fiscal.

### Madurez contable

1. **Periodos contables:** apertura, cierre, bloqueo de asientos tardíos y reapertura con permiso, motivo y auditoría.
2. **Reglas de contabilización:** mapeos por operación, categoría fiscal, cuenta de cobro y establecimiento; asiento balanceado y trazable a sus documentos de origen.
3. **Integración venta-fiscal-contabilidad:** impuestos por pagar/cobrar, cuentas de ventas y costo de ventas según las reglas aprobadas; una falla de emisión no duplica inventario ni asientos.
4. **Conciliación y cierre:** comparar documentos fiscales, ventas, impuestos, inventario y asientos; explicar diferencias y registrar ajustes solo mediante asientos autorizados.
5. **Reportes de periodo:** libros y reportes fiscales/contables derivados de documentos emitidos y asientos; exportación y comparativos de periodos.
6. **Conciliación bancaria:** fase posterior, una vez acordados formatos de extracto, reglas de coincidencia y tratamiento de diferencias.

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

Los modos 2 y 3 no son un interruptor para vender sin comprobante. Si la empresa tiene una excepción aplicable, se configura como regla sustentada y auditada, no como una opción general sin control.

## Seguridad e integridad

- Mantener PostgreSQL, TypeORM, consultas por repositorio y migraciones aditivas; `synchronize=false` y `migrationsRun=false`.
- Los casos de uso HTTP y MCP comparten las mismas reglas y autorización por empresa.
- Idempotencia en emisión, contabilización, reversos y reintentos externos.
- La venta conserva una sola identidad operativa; el documento fiscal guarda su snapshot para que cambios posteriores del catálogo no alteren lo emitido.
- Nada de impuestos, tasas, cuentas, CAI, correlativos ni requisitos legales se siembra a partir de supuestos.

## Validación oficial pendiente

La [página de facturación del SAR](https://www.sar.gob.hn/facturacion/) indica que los contribuyentes que transfieren bienes o prestan servicios deben emitir comprobantes fiscales y enumera documentos autorizados. La memoria institucional 2025 del SAR describía entonces la facturación electrónica como proyecto en formulación técnica; por eso no se presume una API de emisión disponible. Antes de integrar o habilitar producción hay que confirmar la situación actual y las obligaciones de Michelle Market con el SAR y su contador.

## Decisiones que bloquean la implementación fiscal

1. **Régimen y perfil de Michelle Market:** RTN/razón social reales, obligaciones aplicables, tasas/categorías y establecimientos.
2. **Documentos de venta:** tipos requeridos para cada caso de venta y si la empresa emitirá desde el ERP o registrará documentos generados con su mecanismo autorizado actual.
3. **Comportamiento cuando no se puede emitir:** bloquear la confirmación de la venta hasta tener documento, o permitir una venta pendiente controlada que no se considere fiscalmente completada. Debe aprobarlo el responsable fiscal.
4. **Contabilidad:** aprobar cuentas y reglas para ventas, costo de ventas, impuestos, compras, devoluciones y cierres; confirmar prioridad entre cierres contables y conciliación bancaria.

## Criterios de aceptación de fase

- Ninguna venta fiscalmente obligada se completa sin el documento aplicable o excepción autorizada y auditada.
- Ningún ajuste/merma/entrada inicial exige una factura de venta; todo movimiento queda identificado con actor, motivo, fecha y documento operativo.
- Reintentos no duplican documentos, movimientos, capas, impuestos ni asientos.
- Reportes concilian ventas, documentos fiscales, impuestos, inventario y libros; cada total se puede rastrear hasta el origen.
- Pruebas de permisos, aislamiento por empresa, anulaciones, devoluciones, periodos bloqueados, fallas externas y recuperación pasan antes de habilitar producción.
