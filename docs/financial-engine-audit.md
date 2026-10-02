# Motor financiero 3.1.2

Base revisada: `main` en `1418f2bda413001c795289382a303fac36abf602` (3.1.1).
Antes de editar: instalación limpia y 137 pruebas aprobadas. Las capturas permitieron
reproducir cifras, pero no reemplazan el JSON privado de la cuenta ni sus metadatos.

## Causa del 174%

`18_health_goals.js` dividía todo el ingreso personal de los últimos 90 días entre
tres, aunque sólo hubiera uno o dos días de historial. Con una quincena de 9,900
y 421.97 de plataforma: `10,321.97 / 3 = 3,440.6567`. Comida normalizada en 6,000
producía `6,000 / 3,440.6567 = 174.3853%`. Las obligaciones operativas no se
incluían. La meta Moto no formaba parte de ese numerador.

Se comparan ahora obligaciones mensuales normalizadas contra ingreso mensual
proyectado por frecuencia. El resultado puede variar con los datos; no contiene
porcentajes ni nombres de proveedores programados específicamente.

## Fuentes canónicas

| Responsabilidad | Módulo / función |
| --- | --- |
| Estado, backups y entradas reales | `02_data.js` |
| Conversión de frecuencias, períodos civiles, saldos y estimaciones puras | `domain/financial-rules.js` |
| Obligaciones, presupuesto y pagos del hogar | `20_home_engine.js`, `23_home_semantics.js` |
| Obligaciones de trabajo y pagos | `domain/operating-costs.js` |
| Cuentas y transferencias | `15_accounts_engine.js` |
| Situación financiera pública | `21_financial_life_v27.js::financialPosition` |
| Calendario de ingresos y deudas compatible | `13_financial_life.js::upcomingFinancialEvents` |
| Proyección de flujo | `16_forecast_engine.js::cashFlowForecast` |
| Metas y reservas | `11_savings_goals.js` |
| Carga mensual y planificación | `18_health_goals.js` |
| Conciliación de snapshots | `26_sync_merge.js` |

Se conservan los archivos versionados y las exportaciones anteriores. La UI consume
estos resultados. No se modifican navegación, estilos, logo, framework o rutas.
Los únicos textos añadidos explican la base financiera, pagos futuros y conflictos.

## Convenciones y fórmulas

| Frecuencia | Equivalente mensual |
| --- | --- |
| Diario | Importe × días del mes consultado |
| Semanal | Importe × 52 / 12 |
| Quincenal | Importe × 2; vencimientos 15 y fin de mes |
| Mensual | Importe |
| Bimestral | Importe / 2 |
| Trimestral | Importe / 3 |
| Anual | Importe / 12 |
| Pago único | 0 de carga mensual recurrente; conserva su vencimiento real |

Es la convención calendario que ya usaba Hogar para las semanas. Un calendario
puede contener cuatro o cinco vencimientos semanales reales; eso no es una segunda
normalización mensual. No se convierte una quincena en un salario mensual fijo.

- `ingresoRealPeriodo`: cobros personales efectivos hasta la fecha de consulta,
  ventana de hasta 90 días; excluye saldo inicial, terceros y transferencias.
- `ingresoMensualProyectado`: promedio por período pagado, normalizado según la
  frecuencia de fuentes activas. Se agrupan los abonos de un mismo período antes
  de promediar. Muestreo de hasta 180 días, últimos 8 períodos semanales, 6
  quincenales o 4 de otras frecuencias admitidas. Un solo período es provisional.
- `ingresoVariableEstimado`: promedio por día de semana en hasta 56 días previos
  completos, incluyendo días sin trabajo. Requiere 3 ingresos y 14 días observados.
  Se muestra separado y sólo entra en la proyección si se solicita explícitamente.
  No genera movimientos, no incrementa efectivo y no cambia el tipo de fuente.
- El equivalente mensual **observado** requiere al menos 28 días de historial:
  total / días observados × 365.25 / 12. Antes se devuelve `null`, no cero fingido.
- Carga fija = (Hogar obligatorio + presupuesto necesario + compromisos activos
  normalizados + obligaciones operativas + transporte público previsto) / ingreso
  mensual proyectado. Reservas de metas y gastos opcionales quedan fuera. Las
  cuotas de deuda se comparan aparte y sí reducen capacidad de planificación.
- Tasa de ahorro = reservas menos liberaciones / ingreso realmente cobrado en
  la misma ventana. La puntuación identifica componentes sin base suficiente.

Caso de regresión: `(3,000 × 2 + 490 × 52 / 12) / (9,900 × 2)` ≈ 41.03%.

## Efectivo, comprometido y pagos

`personalCash`, `accountLedgerBalance`, Panel y forecast consumen el mismo libro
de movimientos personales efectivos. Transferencias entre cuentas personales no
alteran patrimonio; fondos de empresa permanecen separados. Un movimiento con
cuenta desconocida se conserva y sigue incluido en el efectivo personal si es
personal: no se pierde dinero por una referencia huérfana, pero la cuenta requiere
revisión con el respaldo. No se inventa una cuenta ni cambia su ID.

`libre = efectivo - reservado en metas - comprometido`.

Comprometido conserva pagos pendientes de la ventana, presupuesto por consumir,
reservas domésticas explícitas/progresivas y transporte pendiente. Una carga
mensual normalizada es una métrica distinta; no se suma al comprometido de nuevo.

Todas las ventanas tienen N días civiles **incluyendo hoy** y finalizan a las
23:59:59.999 del último día. `days=0` conserva la consulta de hoy y vencidos.
Desde el 1 de octubre, 30 días finalizan el 30 de octubre. Por eso una obligación
quincenal con abono anterior de 2,600 conserva 400 vencidos + 3,000 el 15:
comprometido 3,400; carga mensual 6,000. La proyección de 31 días ya incluye el 31.

Los vencidos completos no desaparecen por superar un lookback ni se sustituye
un período antiguo por el último. Cada evento tiene identidad obligación + período.
Los importes abonados reducen sólo ese período. Liquidar por menos exige la opción
explícita existente. El objetivo de un período ya abonado se conserva en metadata.
La suma de cuotas de deuda proyectadas nunca supera el saldo y una última cuota
semanal no se convierte en mensual.

`fecha` indica cuándo ocurrió el movimiento; `operatingDueDate`, `householdPeriod`,
`debtPeriod` y `periodo` indican lo cubierto. Un pago nuevo rechaza días futuros;
se puede pagar hoy una obligación futura indicando su período. Datos importados
con fechas futuras se conservan y se excluyen de efectivo/consumo hasta esa fecha.
Un cobro ya registrado para un período no vuelve a entrar como ingreso esperado.
`registrarPagoFuente(..., {periodDate})` admite identificar un período cubierto
distinto del día de cobro; los registros existentes no se reinterpretan.

Actividad calcula ingreso menos **todos** sus gastos operativos personales reales,
incluyendo alquiler, sin restar combustible nuevamente por existir una carga. El
presupuesto futuro de transporte queda separado del neto realmente observado.

## Idempotencia y sincronización

Las fechas de recurrencia son vistas; no generan movimientos al recargar o pagar.
`operationId` opcional identifica un intento de captura/abono. La misma operación
reintentada devuelve el registro existente; distintos abonos siguen siendo válidos.
Los formularios conservan una identidad durante su envío. Las automatizaciones
usan regla + movimiento de ingreso tanto en aplicación como en reserva y ledger.

La fusión sigue siendo por IDs y revisión transaccional del mismo documento
`users/{uid}/budget/state`. Si ambos dispositivos añadieron pagos distintos para
un mismo período y juntos exceden el objetivo o ambos liquidan, se exige una
decisión. También se revisan cobros de período concurrentes. Se puede conservar
una versión o ambos si el usuario confirma que son pagos reales distintos. Ningún
registro de la base común se borra por esta comprobación. Abonos que juntos caben
en el objetivo se fusionan normalmente.

Reservado de metas y saldo de deuda se reconstruyen desde los deltas de historial
**sólo si** ambos snapshots son compatibles con esa derivación respecto a su base.
Ediciones manuales incompatibles mantienen la resolución de conflictos existente.
No se deduplican movimientos históricos sólo por nombre, precio, fecha o importe.
Las obligaciones operativas solas cuentan como datos locales significativos.

## Compatibilidad e integridad

- Mismo storage key, esquema 30, cuenta Google y documento Firestore. Nuevos campos
  de metadata son aditivos; no se reasignan IDs existentes.
- Fuentes explícitamente vacías en snapshots modernos siguen vacías. Sólo un
  respaldo sin campo de fuentes entra en la migración legacy anterior.
- La migración de compromisos conserva frecuencias y reconoce pagos anteriores
  mediante alias, sin reescribir el ledger. No elimina contratos por nombre parecido.
- La reparación destructiva de gastos parecidos queda retirada por flag v2,
  idempotente y sin borrar elementos. No puede recuperar registros borrados por
  versiones anteriores; para ello haría falta un respaldo previo.
- Reservas legacy identificadas por sus registros de sobre/meta y formato de abono
  se migran mediante enlaces de lectura. Se conservan movimientos y registros legacy.
  Datos ambiguos de migraciones antiguas requieren revisión; no se reclasifican por
  una simple coincidencia de nombre.
- JSON local ilegible bloquea escrituras antes de aplicar un estado vacío. Una
  restauración explícita conserva antes sus bytes originales en una clave de
  recuperación. Si falta espacio, la restauración falla sin sobreescribirlos.
- Se mantienen URLs, `offline.html`, manifest, headers Vercel y motor PWA. Shell
  3.1.2 v11 incluye las reglas puras y sustituye sólo cachés de la aplicación.

## Pendiente de datos privados y riesgos

El usuario aclaró el 1 de octubre que realizó cuatro pagos reales ese día y que
capturó fechas equivocadas. Una fecha repetida no demuestra un pago duplicado.
Se conservan los cuatro registros; corregir sus fechas y verificar los períodos
que cubrieron requiere los datos privados con IDs y metadata originales. El código no
contiene un valor 499 por defecto: es configuración/historial de la cuenta.
Este cambio no sustituye 499 por 490, no modifica pagos anteriores y no elimina
filas Mottu. Un importe actual de 490 debe editarse deliberadamente en la obligación;
un período ya abonado conserva su objetivo anterior. No se aplica edición retroactiva.

También necesitan revisión: fechas futuras que en realidad fueron anticipos ya
pagados (corregir fecha real con evidencia), períodos cubiertos de salarios atrasados,
referencias huérfanas y contratos ya mal convertidos por una migración antigua.
No es seguro reinterpretarlos sin el JSON. Cambiar una obligación aún sin abonos
usa el importe configurado actual; no se introduce una política de precios por fecha
efectiva ni se reconstruyen contratos históricos que no conservan esa información.

Las cifras pueden cambiar cuando aparecen vencidos anteriormente omitidos o dejan
de contarse movimientos fechados en el futuro. Son cambios de reglas de lectura,
no borrado de historial. Una instalación offline anterior conserva su versión
hasta actualizar; durante esa coexistencia siguen siendo importantes los conflictos.

## Verificación

- Suite existente preservada; fixtures de consultas históricas ahora contienen un
  saldo inicial histórico real, en lugar de introducir dinero con fecha de hoy.
- Regresiones A–I, todas las frecuencias, meta fuera de carga, ingresos parciales,
  límites de horizonte, medianoche, futuros, anticipos, deuda acotada, dos dispositivos,
  automatización, backups y migraciones idempotentes.
- JavaScript válido, módulos/imports existentes, shell PWA/offline y caché anterior.
- 174/174 pruebas aprobadas en UTC y `America/Mexico_City` (37 regresiones nuevas);
  CI replica ambas zonas.
- `npm run test:rules` usa Firestore emulator y Java 21 en GitHub Actions. Localmente
  Java 17 no permite iniciarlo; esto no cuenta como una prueba aprobada localmente.
- No se ha accedido ni escrito el estado privado de Firebase del usuario.

## Registro de pagos 3.1.3

El formulario de pago de obligaciones operativas ya no ofrece un calendario de
fecha del movimiento. Al confirmar usa la fecha y hora actuales; el vencimiento
y período cubiertos permanecen separados. Se muestra qué vencimiento cubre y que
el saldo se descuenta hoy. La creación conserva el calendario de primer vencimiento
para programar la obligación; la opción «Ya lo pagué hoy» registra efectivo hoy,
aunque cubra una fecha futura. Se conservan los pagos parciales y su saldo pendiente.

No se cambian fórmulas, APIs de importación histórica, sincronización ni movimientos
existentes. Las fechas erróneas ya guardadas no se reescriben automáticamente.
Cuatro regresiones de interfaz ejercitan pago a cuatro semanas, cuatro pagos reales
hoy, primer vencimiento futuro ya pagado y abono parcial adelantado. La actualización
PWA 3.1.3 / shell v12 sustituye la caché 3.1.2 y mantiene los mismos recursos offline.

## Corrección explícita de fechas 3.1.4

El usuario confirmó que los cuatro pagos eran reales y que las fechas futuras
guardadas eran un error de captura. No se deduplican. Se agrega en Costos de trabajo
una reparación opcional de un solo uso para los pagos personales de obligaciones
operativas con fecha real futura; la revisión muestra registros, fechas y total.
Sólo al guardar se cambia la fecha real a la fecha/hora actual. Se preservan
importes, IDs, cuentas, fuentes y vencimientos/períodos cubiertos, y se recalcula
el efectivo con `personalCash`, sin alterar fórmulas financieras.

El marcador aditivo y las fechas originales quedan en `financialPlan` para
backups/sync. No hay migración automática, esquema nuevo, otra colección Firestore
ni acceso al estado privado. Los cambios concurrentes exigen una nueva revisión
y un fallo de escritura revierte los cambios en memoria. La documentación de
obligaciones operativas detalla el comportamiento al restaurar respaldos antiguos.
PWA 3.1.4 / shell v13 conserva los mismos recursos y retira la caché v12.

Verificación local: 197/197 pruebas pasan en UTC y `America/Mexico_City`, con 19
regresiones nuevas sobre conservación de datos, cambio de fecha al confirmar,
uso único, cancelación, backups, sincronización y fallo de escritura. Las reglas
Firestore requieren Java 21 y se verifican en GitHub Actions; el entorno local
dispone de Java 17. Las cuatro fechas del usuario siguen sin modificarse desde el
repositorio: la reparación se aplica únicamente cuando guarda la revisión en la app.
