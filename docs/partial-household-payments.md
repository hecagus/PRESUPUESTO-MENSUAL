# Pagos parciales de obligaciones

Los movimientos de gasto de la misma obligación y `householdPeriod` se suman. El calendario, la posición financiera y la proyección muestran únicamente la diferencia pendiente. Un abono no cierra el vencimiento ni cambia el importe habitual de las quincenas futuras.

Ejemplo: obligación quincenal de $3,000, abono de $2,600: quedan $400 pendientes y $3,000 del próximo vencimiento dentro del horizonte de 30 días. Efectivo $22.97, comprometido $3,400, libre -$3,377.03. Abonar $400 después solo descuenta ese nuevo gasto y cierra el vencimiento anterior.

El formulario permite conservar el resto pendiente (predeterminado) o declarar expresamente que lo pagado liquida toda la obligación. La segunda opción agrega `householdSettled: true` al movimiento. Los pagos nuevos guardan `householdExpectedAmount` para no alterar el objetivo de un periodo ya abonado si cambia el importe habitual.

Los pagos legacy sin metadatos se comparan contra el importe de la obligación. No se escriben migraciones, no se cambian IDs ni se duplican movimientos. Esto puede volver a mostrar diferencias de pagos anteriores menores al importe registrado; no se puede inferir que fueron condonadas. Las obligaciones únicas que ya estaban inactivas permanecen inactivas.

Los abonos pendientes se mantienen aunque sean anteriores a la ventana normal de vencimientos. La proyección consume los eventos canónicos restantes, sin omitirlos por encontrar un abono previo. El importe principal verde y la alerta existente se conservan.

No se implementa una transferencia del resto al próximo vencimiento: se conservan el vencimiento original pendiente y el próximo por separado, evitando convertir $3,400 en el nuevo importe recurrente.

Validación: npm ci; npm test (121 pruebas). test:rules requiere Java 21; el entorno local tiene Java anterior. GitHub Actions ejecuta reglas con Java 21.
