# Contrato financiero compartido · 3.1.7

Esta entrega unifica decisiones sobre el motor existente. No añade un modelo de IA ni rehace la navegación. Los resultados calculados no generan movimientos, deudas o ingresos por sí mismos.

## Definiciones

| Resultado | Regla | Uso |
|---|---|---|
| Efectivo propio | Ingresos cobrados menos gastos registrados hasta ahora; excluye transferencias, fondos de terceros y transferencias a metas | Patrimonio y cuentas |
| Exigible hoy | Saldo pendiente de períodos vencidos o que vencen hoy | Atención y disponibilidad actual |
| Disponible hoy | Efectivo − reservado en metas − exigible hoy | Inicio y avisos actuales |
| Para apartar hoy | Máximo de cero y disponible hoy − presupuestos, reservas explícitas/progresivas y transporte protegidos | Aportes manuales, sugerencias y automatizaciones |
| Proyección | Efectivo actual + cobros esperados − pagos previstos por fecha − reservas protegidas | Calendario, flujo, alertas y metas |
| Capacidad mensual proyectada | Ingreso mensual proyectado − carga esencial − cuotas − gasto adicional observado normalizado | Plan de metas; no acredita efectivo |
| Plan con sólo efectivo actual | Fórmula anterior a 30 días, sin cobros futuros | Adaptador legacy; nunca autoriza/bloquea un aporte ni dispara alertas de hoy |

Los presupuestos y reservas elegidos por el usuario conservan su protección. No son una obligación futura vencida. Inicio muestra su importe separado cuando existe una diferencia entre disponible hoy y para apartar hoy.

Antes del vencimiento: programado; día anterior: vence mañana; día del vencimiento: vence hoy; día siguiente: vencido por el pendiente. Un abono de 2,600 sobre 3,000 deja 400 en el mismo período y no crea otros 400 de carga mensual.

## Fuentes canónicas y consumidores

- `js/domain/financial-rules.js`: propiedad, efectivo, fechas civiles, períodos y normalización. Semanal ×52/12, quincenal ×2; las ocurrencias del calendario se cuentan por sus fechas reales.
- `js/21_financial_life_v27.js`: posición canónica y vencimientos. `free` se conserva como alias de `cashOnlyPlanFree` para compatibilidad. Las decisiones actuales usan `availableToday` y `savingsAvailableNow`.
- `js/16_forecast_engine.js`: flujo y fechas de riesgo; el riesgo no deriva del plan legacy. Una ventana de N días incluye hoy y entrega N días.
- `js/app/financial-options.js`: una preferencia de ingreso variable para toda la cuenta. Permite sobrescribirla explícitamente al consultar un escenario.
- `js/app/financial-context.js`: lectura compartida de posición, flujo y plan mensual. Salud y metas consumen ese resultado; las vistas no reimplementan las fórmulas.
- Hogar conserva sus registros en `financialPlan.householdExpenses`; trabajo conserva `operatingObligations`. No se crean obligaciones paralelas al presentar el calendario.
- `js/13_financial_life.js` sigue ofreciendo servicios base/adaptadores; su posición legacy no es la fuente activa de las decisiones nuevas.

El calendario y las alertas de flujo comparten 45 días por defecto. El flujo evalúa el saldo al cierre de cada día: los horarios artificiales de presentación no deciden si falta dinero, y un ingreso posterior no tapa un faltante de días anteriores. No garantiza la disponibilidad intradía de un cobro estimado. La normalización mensual y el observado hasta 90 días son magnitudes distintas, identificadas en salud. Los gastos directos u opcionales de Hogar entran en gasto adicional observado; los pagos de obligaciones/presupuestos no vuelven a sumarse allí.

## Cobros y períodos

El formulario de cobro conserva la fecha real de recepción y pide el vencimiento del período que cubre. Como referencia inicial propone el vencimiento más reciente; el usuario lo puede cambiar. Un cobro del 1 de octubre que cubre el 30 de septiembre no liquida el 15 de octubre.

Actividad permite corregir el período de un cobro existente. La corrección conserva ID, importe, fuente y fecha real, registra `periodHistory`, rechaza períodos duplicados y comprueba que el dato revisado no haya cambiado. Si falla el guardado, revierte la corrección en memoria. No se reasignan cobros históricos automáticamente.

## Migraciones aditivas y seguridad

1. `financialPlan.forecastPreferences.includeVariable` conserva la preferencia instalada y pasa a formar parte del backup/sync de esa cuenta. La clave local anterior se mantiene como adaptador. Al cambiar de cuenta Google se limpia esa preferencia local; el estado propio de cada cuenta sigue preservado en su respaldo.
2. Reglas existentes reciben `financialPolicyVersion: 1` y `policyActivatedAt`. Los ingresos anteriores sin aplicación quedan identificados como `before_policy`, con importe cero, para evitar reservas inesperadas al liberar capacidad. No se modifican esos ingresos ni sus importes. Las reglas nuevas actúan sobre ingresos posteriores; un intento sin capacidad se marca `insufficient_today` y no reaparece días después.
3. La fusión valida que las reservas combinadas no excedan el efectivo. Si exceden, mantiene ambos historiales en el resultado y bloquea la fusión con `reservation_capacity`. El usuario puede liberar parte de una reserva y volver a fusionar; no hay una opción de consolidar efectivo inexistente. Las opciones existentes de usar una versión completa permanecen.

Se conserva esquema 30, `moto_finanzas_vFinal`, IDs, migraciones legacy, rutas y `users/{uid}/budget/state`. Estas adiciones son idempotentes y los backups anteriores siguen restaurándose. No se cambian pagos históricos de 499 a 490, ni se deducen pagos reales a partir de eventos programados.

## PWA

Versión 3.1.7, caché `hecagus-finance-3.1.7-shell-v16-financial-contract`. El shell incluye todos los módulos nuevos y las rutas antiguas, incluido `offline.html`. Si falla una página o módulo requerido, el worker nuevo no activa ni reemplaza el anterior. Los recursos no críticos siguen tolerando fallos individuales.

Se conservan los headers de Vercel para SW, manifest y bootstrap. Las pruebas ejecutan el código del SW con cachés/red simulados: precarga, actualización, navegación y módulos offline, grafo de imports y rechazo de una actualización incompleta. Esto no sustituye una prueba de instalación en un teléfono real.

## Validación y límites

Las pruebas cubren disponibilidad/ahorro, abonos, salario por período, preferencia variable compartida, gastos adicionales sin doble conteo, automatización idempotente, fusiones, backups, UTC/México y PWA. Las pruebas Firestore se ejecutan en GitHub Actions con Java 21; el entorno local tiene Java 17.

El historial variable continúa requiriendo 14 días completos y tres ingresos; el gasto adicional observado requiere 28 días. No se inventa una proyección cuando falta muestra. Los ingresos registrados al finalizar una actividad conservan su significado actual de dinero disponible; distinguir ganancias pendientes de liquidación requiere una entrega posterior. La IA, evaluación de pronósticos y objetivo de ingreso por jornada quedan para una fase posterior sobre este contrato.
