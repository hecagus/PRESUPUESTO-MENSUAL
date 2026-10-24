# Vigencia financiera y auditoría de reactivación · 3.1.8

## Problema

El motor crea **eventos de calendario y proyecciones** de cobros, gastos recurrentes y vencimientos aunque el usuario no haya registrado operaciones reales recientemente. Las proyecciones no son movimientos confirmados, pero presentar disponibilidad actual sobre un registro abandonado puede ser engañoso.

## Contrato

1. Pasados **7 días completos** desde el último registro financiero real (o auditoría confirmada), la app entra en modo `REQUIRES_AUDIT`. No se basa en clics, aperturas ni en el reloj de actividad.
2. La pantalla de auditoría se muestra **antes** de renderizar proyecciones o ejecutar reglas de ahorro. El modo es local y offline-first; no apaga contratos, elimina compromisos ni modifica Firestore por sí mismo.
3. Los registros reales antiguos no se borran. Un ingreso esperado nunca pasa a ser cobrado por esta función.
4. Al regresar, el usuario confirma los saldos de **todas las cuentas personales**, el principal restante de las **deudas registradas** y el estado de **todas las fuentes laborales**. No debe reconstruir cada movimiento del intervalo.
5. La diferencia entre saldo de cuenta registrado y saldo confirmado se asienta una sola vez como `movementKind: reconciliation`, `categoria: Sistema` y con trazabilidad del saldo previo/confirmado. Se contabiliza en efectivo y cuenta, pero se excluye de ingresos laborales y gasto adicional observado. Un segundo intento con los mismos valores no duplica el ajuste.
6. Los cambios del principal de una deuda registran `auditHistory`; no crean abonos, ni suponen que se pagó una cuota periódica. Las obligaciones de Hogar y los costos operativos anteriores siguen por verificar: la auditoría **no afirma que estén pagados**.
7. La auditoría añade metadatos en `financialPlan.freshness`, que persisten en respaldo y sincronización. Se conserva `schemaVersion: 30`, clave `moto_finanzas_vFinal` y documento `users/{uid}/budget/state`.
8. El sello `lastConfirmedAt` cambia cuando se registra o corrige un movimiento real, turno finalizado o deuda. Normalizaciones de inicio y reglas de ahorro automáticas no cuentan como uso financiero. Las restauraciones no actualizan la fecha de vigencia.
9. Antes de confirmar, se valida que saldos y registros relevantes no hayan cambiado (incluida una sincronización remota). En caso de conflicto se reabre la auditoría.
10. La primera apertura de una instalación histórica sin metadatos calcula una fecha aproximada con movimientos y turnos existentes. Si no hay registros de ese tipo no se inventa una fecha de abandono; se inicia la auditoría sólo después de registrar actividad.

## Límites y riesgos conocidos

- Un pago anterior declarado pero no registrado **sigue apareciendo pendiente**. El sistema no puede decidir si una obligación se cumplió sin evidencia del usuario. La conciliación ajusta saldos, no sustituye la gestión de vencimientos.
- La fecha de un movimiento legacy puede representar la fecha efectiva y no el día en que el usuario lo capturó. Para esos movimientos la vigencia previa a 3.1.8 es una aproximación. Los cambios nuevos quedan fechados desde su guardado.
- El ajuste de saldo se muestra en historial como ajuste de sistema; no constituye una nueva fuente de ingresos.
- No se requiere conexión para la auditoría. Una conciliación local puede generar un conflicto con datos posteriores guardados desde otro dispositivo; se usa el mecanismo existente de resolución de conflictos.

## Pruebas

`tests/financial-freshness.test.js`: detección de abandono, integridad de movimientos, efectivo por cuenta, principal, estado laboral, exclusión de métricas observadas, conciliación repetida, cambios concurrentes, escritura real y restauración histórica.

`npm test` y `npm run test:rules` deben pasar antes de integrar `main`. La prueba del emulador requiere Java 21. Verificar además en móvil la PWA instalada y el desbloqueo tras autenticación/sincronización.
