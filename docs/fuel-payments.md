# Repostajes: actividad y origen del pago (3.1.6)

## Causa

`fuelModal` en `js/05_init.js` ocultaba el origen del combustible cuando había una actividad activa. `registrarCombustible` en `js/02_data.js` elegía primero esa actividad y su `fuelPayer`, incluso ante un pagador explícito distinto. Una carga con tarjeta empresarial durante una actividad personal terminaba como gasto de caja.

## Regla actual

- `js/ui/fuel.js` pregunta siempre **¿Con qué pagaste?** y exige seleccionar una cuenta activa. No preselecciona caja ni fondo empresarial.
- **Actividad / uso** se propone a partir de la actividad en marcha y puede cambiarse para el repostaje; el cronómetro y la actividad siguen intactos.
- `sourceId` identifica la actividad a la que corresponde la carga; `accountId` identifica la cuenta que realmente pagó. Se reutilizan ambos campos existentes.
- La cuenta de terceros produce `pagador: empresa`: consume su fondo sin generar un movimiento personal ni reducir el patrimonio. Una cuenta personal produce un gasto del importe total en esa cuenta, una sola vez.
- **Total pagado ($)** es el total del ticket. Los litros permiten obtener el precio por litro en las métricas existentes.

`fuelFundTotals` en `js/domain/financial-rules.js` conserva la regla canónica del saldo de cuentas de terceros y la comparte con `saldoFondoFuente`, `accountLedgerBalance` y el resumen legacy de empresa. El consumo del fondo se identifica por cuenta, no por la actividad activa; sólo incluye cargas pagadas por empresa. Mantiene los adaptadores existentes para registros antiguos sin IDs.

## Compatibilidad y alcance

No hay migración, cambio de esquema, IDs, rutas, reglas de Firestore ni lógica de sincronización. Se conserva `users/{uid}/budget/state`, almacenamiento local, backups y registros históricos sin reclasificarlos. Los llamadores antiguos que omiten la cuenta conservan el valor por defecto de la fuente; las elecciones explícitas prevalecen. El adaptador `registrarGasolina` respeta un pago empresarial durante otra actividad y rechaza una selección ambigua entre varios fondos.

La PWA 3.1.6 / shell v15 incorpora el nuevo módulo y mantiene todos los recursos y páginas anteriores. La actualización elimina únicamente las cachés de la aplicación anteriores.

## Verificación

`tests/fuel-payment-origin.test.js` cubre la carga de 3.21 L por $74.79 con actividad personal y Ticket Car, cuenta personal durante actividad de empresa, banco, varios fondos, actividad independiente, validación sin mutaciones, compatibilidad, backups, recarga, fusión sync por ID, métricas, historial y el formulario real con DOM. Las cantidades sólo pertenecen al caso de prueba.

Ejecutar `npm test` en UTC y America/Mexico_City y `npm run test:rules` con Java 21. Las pruebas de shell verifican instalación, actualización y recursos offline. La revisión con DOM no equivale a una comprobación visual en un navegador real.
