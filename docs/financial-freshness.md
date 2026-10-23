# Regreso a la app y conciliación de saldos

Después de siete días sin registros financieros confirmados, el arranque pide confirmar el dinero actual antes de mostrar proyecciones o ejecutar automatizaciones. Abrir la app, cambiar una preferencia o apartar dinero no renueva esa fecha. Si se registra una operación después de una ausencia larga, queda pendiente la revisión: esa operación no borra el período sin registrar.

El Panel y las cuentas ofrecen **Actualizar mis saldos** para abrir la misma revisión aunque haya movimientos recientes.

## Qué se confirma

1. El saldo real de cada cuenta personal, incluidas las inactivas. Se pueden agregar cuentas bancarias, efectivo o cuentas digitales. Los fondos de terceros quedan fuera.
2. Lo que sigue reservado en cada meta activa y, opcionalmente, la cuenta donde está. Ese apartado ya forma parte de los saldos: no se suma otra vez. La suma reservada debe estar respaldada por dinero real, tanto en el total como en cada cuenta vinculada.
3. Las deudas pendientes y el estado actual de cada fuente de trabajo. Confirmar una fuente activa permite volver a estimar sus ingresos; no registra sueldos cobrados.

Los campos de saldo se presentan vacíos, con la cifra anterior como referencia. El resumen distingue dinero total, apartado y dinero fuera de apartados **antes de descontar obligaciones**. La revisión conserva los vencimientos de Hogar y trabajo; no supone que se pagaron durante la ausencia.

## Historial y persistencia

Las diferencias se registran como ajustes de conciliación con saldo anterior, saldo confirmado e identificador de auditoría. No se inventan compras ni ingresos laborales para explicar el desfase. Los ajustes participan en el saldo contable, pero se excluyen de gastos observados, rentabilidad y capacidad de ahorro.

La confirmación de metas conserva su historial, añade reserva o liberación cuando corresponde y mantiene los apartados futuros. Si una liberación futura dejaría el reservado contable negativo, pide revisar esos movimientos antes de confirmar. No cambia dos veces el efectivo. Las deudas y fuentes guardan su confirmación en el historial de auditoría.

Todo se valida y guarda en una transacción. Una escritura fallida conserva los datos anteriores y la captura del formulario. Un cambio de los datos durante la revisión obliga a actualizarla antes de guardar. Sólo una conciliación guardada correctamente quita la revisión pendiente.

## Sincronización y acceso

El acceso a Google y la resolución de conflictos siguen disponibles en la pantalla de revisión. Cambiar a otra cuenta Google carga su presupuesto o su configuración inicial; no conserva abierto el formulario de la cuenta anterior. Dos conciliaciones concurrentes no se suman: el usuario debe elegir una versión completa. También se bloquea la fusión cuando una conciliación de un dispositivo no incluye cambios financieros del otro; sumar esos registros podría descontar dos veces dinero que ya se confirmó. Las preferencias cosméticas pueden fusionarse.

Elegir una versión completa conserva esa versión financiera; no reconstruye automáticamente registros exclusivos de la otra. La interfaz explica esa decisión. La concurrencia entre pestañas web sin sincronización sigue siendo un riesgo del almacenamiento por snapshots completos.

## Corrección de importes operativos

**Corregir importe** cambia el monto de los períodos futuros de una obligación operativa. No reescribe pagos completados, coberturas ni el importe esperado de un período parcialmente pagado. Corregir un pago histórico necesita un flujo separado de reversión o conciliación con comprobantes.

## Verificación

Las pruebas cubren antigüedad, fecha persistida, regreso después de una captura reciente, cuentas nuevas, apartados por cuenta, cambios de deuda y trabajo, escritura fallida, conflicto de snapshot, concurrencia entre dispositivos y conservación de importes históricos. La comprobación móvil usa datos ficticios y sincronización desactivada. El empaquetado web Android no acredita una instalación nueva en el teléfono.
