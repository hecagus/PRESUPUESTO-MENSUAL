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

## Verificación

Tests de dominio, formulario con DOM, saldo/cuentas, métricas por fuente, abonos, liquidación, frecuencias, vencidos, finalización, backups, merge de sync, proyección variable sin doble conteo y service worker offline/actualización. Las reglas Firestore se ejecutan en CI con Java 21.
