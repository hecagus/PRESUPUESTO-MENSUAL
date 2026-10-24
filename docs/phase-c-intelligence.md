# Fase C — Inteligencia financiera controlada

Esta entrega agrega una pantalla accesible desde **Análisis → Inteligencia financiera**, sin cambiar el esquema financiero 30 ni las fórmulas canónicas. Es independiente de los PR #41 (inactividad) y #43 (experiencia móvil).

## Alcance

- Reglas explícitas por concepto (contiene, exacto, empieza con) y tipo ingreso/gasto. Se guardan en `financialPlan.categorizationRules`, incluidas en el respaldo y la sincronización existentes. Nunca alteran movimientos históricos ni se ejecutan al guardar reglas: solo **sugieren** categorías antes de importar.
- Importación CSV desde archivo local, UTF-8, coma o punto y coma, comillas CSV RFC4180, hasta **1 MB y 1000 filas**. Columnas elegidas por usuario: fecha, concepto e importe firmado; o fecha, concepto, cargo y abono. Fecha AAAA-MM-DD o DD/MM/AAAA; montos admiten agrupadores/decimales compatibles con México. No se importa moneda extranjera automáticamente.
- Vista previa obligatoria: errores por fila, categoría editable, filas iguales en archivo/cuenta señaladas como **posibles duplicados** y desmarcadas inicialmente. Una compra legítimamente repetida el mismo día puede seguir marcándose como posible duplicado; el usuario decide conscientemente. Una coincidencia no prueba duplicidad.
- El lote se incorpora mediante una sola restauración transaccional del estado staged; el motor recalcula balances y mantiene los identificadores previos. Se registra `importBatchId`, `importSource: csv` y `recordedAt`. Si el libro cambió desde la vista previa, se cancela y debe generarse otra. El archivo original no sale del navegador; **los movimientos confirmados sí pueden sincronizarse** con Firebase, como cualquier registro de la cuenta.
- Conciliación de saldos: la cuenta debe ser personal y activa; el usuario confirma cuánto dinero hay. La diferencia produce un movimiento identificado `movementKind: reconciliation`, `categoria: Sistema` con saldo previo, confirmado y momento. Se excluye de ingresos/gastos observados. Si no hay diferencia, no genera movimiento. No liquida cuotas, deudas ni ingresos programados.
- Recomendaciones deterministas, sin dependencia externa de IA: gastos confirmados por categoría y comparación entre ventanas de 30 días, con cantidad de movimientos y operaciones excluidas. Si no hay datos suficientes, la vista declara la limitación. No se crean movimientos desde las recomendaciones.

## Reglas de seguridad y limitaciones

1. Solo cuentas personales activas. No se importa directamente a cuentas de combustible/patrimonio de terceros.
2. No se importan transferencias automáticas; para transferir entre cuentas usar Wallet. Importar las dos patas bancarias de una transferencia como ingreso y gasto distorsionaría el patrimonio, por lo que deben desmarcarse esas filas en la vista previa.
3. Importar un salario o una obligación como movimiento universal **no registra el período salarial ni liquida un compromiso**. Para ello usar las funciones existentes en Actividad y Hogar. Conviene desmarcar esas filas.
4. El ajuste de conciliación explica una diferencia de efectivo pero **no demuestra** cuál transacción faltó. Es preferible importar y conciliar movimientos antes de efectuar un ajuste.
5. La función usa el estado local sincronizable existente, sin transmisión del CSV a un tercero, sin credenciales bancarias y sin conexión Open Banking.
6. Al integrar PR #41, la puerta de auditoría debe preceder a esta nueva vista; al integrar PR #43, fusionar las modificaciones de `js/05_init.js`, `sw.js`, estilos y navegación antes de desplegar.

## QA antes de fusionar

- `npm test` y `npm run test:rules` en CI, incluyendo `TZ=America/Mexico_City`.
- PWA instalada Android online y offline, importación con datos ficticios, pausa/reanuda reglas, recuperación después de recarga y reimportación del mismo CSV sin cargo duplicado involuntario.
- Conciliación de cuenta después de importar; comprobar que el ajuste no incremente gastos ordinarios ni dé por saldado Mottu u otra obligación.
- Probar colisión al importar simultáneamente en dos dispositivos y confirmar resolución de conflictos de Firebase.
- **No fusionar automáticamente** sin pruebas físicas y plan de integración con PR #41 y #43.
