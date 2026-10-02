# Obligaciones operativas recurrentes

Actividad permite registrar un gasto ya pagado (Una sola vez) o una obligación de trabajo con importe, frecuencia y primer vencimiento. Ejemplo: Mottu, $490 semanales, categoría Renta. El día de la fecha elegida determina el día de pago semanal.

Al crear una obligación, el primer pago queda pendiente por defecto. "Ya lo pagué" registra ese primer pago y programa los siguientes. Registrar pago permite abonos o liquidación explícita por menos; solamente el importe realmente pagado sale del efectivo. Finalizar detiene vencimientos posteriores a hoy y conserva los pendientes anteriores. Pausar una fuente de ingreso no cancela contratos de trabajo pendientes.

## Fuentes de verdad y compatibilidad

- `financialPlan.operatingObligations`: única programación por ID; no se guarda en Hogar, compromisos legacy ni como otra colección de gastos pagados.
- `movimientos`: pagos reales mediante `15_accounts_engine.js`, con `operatingObligationId`, `operatingPeriod`, `operatingDueDate` y `operatingExpectedAmount`; `operatingSettled` sólo se añade al liquidar expresamente por menos.
- `20_home_engine.js`: comparte sus dos funciones puras de fechas/periodos. No cambia los cálculos ni los datos de Hogar. Quincenal conserva 15/fin de mes; mensual respeta el último día de meses cortos.
- `21_financial_life_v27.js`: agrega eventos pendientes al calendario canónico. La fórmula de dinero libre y su horizonte de 30 días siguen iguales; cada pago pendiente cuenta una vez.
- `16_forecast_engine.js`: usa esos eventos; excluye sus pagos históricos del costo ya restado al estimar ingresos variables netos, para no proyectar el mismo costo dos veces.
- `js/ui/operating-costs.js`: formulario y administración en Actividad; el orquestador solamente lo inicia y renderiza.

No cambia la ruta Firestore `users/{uid}/budget/state`, el esquema raíz, los IDs existentes ni las migraciones. La nueva lista se crea vacía e idempotentemente; backups existentes conservan sus movimientos. Los respaldos nuevos contienen programación y abonos. El merge existente combina la lista por ID y pide resolver campos incompatibles. Cuentas de terceros no se ofrecen ni aceptan para estos pagos personales; gasolina de empresa conserva su flujo existente.

Las rutas actuales y el logo se conservan. Los dos módulos nuevos se incorporan al shell PWA y se cambia su caché. Los importes y colores del resumen financiero conservan su comportamiento previo.

## Corrección de fechas de un solo uso (3.1.4)

En Costos de trabajo aparece «Corregir fechas a hoy · un solo uso» solamente si
existen pagos personales de obligaciones operativas ya registrados con fecha real
futura. No aparece para vencimientos programados sin un movimiento de pago. La
revisión muestra todos los pagos afectados, sus fechas guardadas y el total; cancelar
no modifica nada. Guardar indica que ya se pagaron y cambia `movimientos[].fecha`
a la fecha/hora actual de confirmación. Cada importe empieza a afectar el efectivo
hoy mediante el cálculo canónico existente.

No se agregan ni eliminan movimientos, aunque compartan fecha o período. Se conservan
IDs, importes históricos, cuentas, fuentes, frecuencia, `operatingPeriod`,
`operatingDueDate`, `operatingExpectedAmount` y el tratamiento de abonos. Una obligación
que ahora cuesta $490 no convierte pagos históricos de $499 a $490. Gastos de Hogar,
deudas, movimientos sin la referencia de una obligación operativa, transferencias,
metas y fondos de terceros no participan en esta corrección.

`financialPlan.operatingPaymentDateRepair` guarda versión, fecha de aplicación y
la fecha original de cada ID corregido. Es un campo aditivo del estado actual:
conserva esquema 30, clave de almacenamiento y documento Firestore; se incluye en
backups y sincronización normal. Después de guardar, la opción desaparece y un
reintento no cambia fechas ni descuenta otra vez. Restaurar un backup anterior al
cambio también restaura sus fechas y su estado anterior de uso; no se trata de una
restricción de seguridad fuera del estado de la cuenta.

Si cambian los pagos durante la revisión (edición, sincronización o cambio de cuenta),
se exige abrirla nuevamente. Si falla la escritura local se revierten fechas,
saldo derivado y marcador en memoria. La sincronización existente conserva los mismos
IDs y exige resolver fechas incompatibles entre dispositivos; no crea cobros nuevos.
No se accede al estado privado del usuario desde el despliegue ni se corrige
automáticamente al cargar. El usuario aplica esta reparación desde su propia cuenta.

La PWA 3.1.4 / shell v13 reemplaza la caché v12 y mantiene rutas y recursos offline.

## Verificación

Tests de dominio, formulario con DOM, saldo/cuentas, métricas por fuente, abonos, liquidación, frecuencias, vencidos, finalización, backups, merge de sync, proyección variable sin doble conteo y service worker offline/actualización. Las reglas Firestore se ejecutan en CI con Java 21.
