# Auditoría de captura, historial y persistencia · octubre 2026

## Hallazgos reproducidos y correcciones

| Prioridad | Problema | Corrección |
| --- | --- | --- |
| Alta | Un error de almacenamiento dejaba un pago en memoria; reintentar podía devolver éxito sin persistirlo. | `withTransaction` difiere escrituras anidadas, guarda una vez y revierte el estado en memoria ante errores. Se aplica a movimientos universales, captura de Hogar, creación operativa con primer pago, automatización y acciones de UI. |
| Alta | Restaurar estructuras anidadas inválidas reemplazaba el estado antes de terminar la validación. | Restauración transaccional; se conserva el estado anterior. Arranque fallido ofrece descarga y recuperación, sin reinicio automático. |
| Alta | Nombres importados se interpolaban como HTML en el renderer base. | Se escapan nombres, descripciones, unidades e identificadores antes de insertarlos en plantillas. |
| Alta | Varias reglas podían reservar más del 100% de un mismo ingreso, utilizando efectivo anterior. | Se descuenta lo ya aplicado a ese ingreso antes de ejecutar otra regla. No se reescriben aplicaciones históricas. |
| Alta | El regreso después de una ausencia prolongada seguía mostrando saldos y consejos antiguos. | Revisión obligatoria tras siete días sin registros; confirma cuentas, apartados, deudas y trabajo antes de automatizar. Acceso manual disponible. |
| Alta | Fusionar conciliaciones concurrentes podía sumar dos ajustes del mismo saldo. | Se bloquea la fusión de revisiones incompatibles y se exige elegir una versión completa. También se detectan movimientos del otro dispositivo ausentes de una revisión. |
| Media | No había forma directa de corregir el monto futuro de una obligación operativa. | “Corregir importe” modifica períodos futuros sin reescribir pagos completos ni expectativas de un período parcialmente pagado. |
| Media | El consejo de ahorro ignoraba pagos futuros y reutilizaba fuentes entre metas. | Un único fondo de consejo, repartido por prioridad; respeta el mínimo de flujo previsto en 45 días sin ingresos variables estimados. Las fuentes descuentan gastos y reservas identificados. |
| Media | Diferentes semanas pagadas el mismo día parecían cargos duplicados. | Actividad e Historial muestran vencimientos cubiertos; los pagos futuros se presentan como anticipos. |
| Media | Las reservas de metas se veían como gastos rojos. | Se presentan como apartados neutrales, indicando que no cambian el saldo. |
| Media | Historial ocultaba todos los eventos después de 150. | Paginación incremental con recuento y botón para ver más. |
| Media | Un error cerraba el formulario y eliminaba la captura. | Error dentro del diálogo, conservación de valores y protección contra segunda confirmación. Labels asociados, foco inicial, Escape y navegación de teclado. |
| Media | Registrar una compra requería entender planificación, frecuencia y vencimiento. | `+ Gasto` desde las cinco pestañas: monto, concepto y categoría; cuenta cuando hay varias y fecha opcional. Usa el motor canónico de Hogar y la cuenta elegida, sin una segunda contabilidad. |
| Media | Captura directa guardaba un plan antes de validar una fecha y usaba fecha UTC por defecto. | Validación previa, día local, identificador idempotente y una única transacción. Los gastos de días anteriores no muestran una hora inventada. |
| Baja | Controles vacíos, tarjeta de meta duplicada y etiqueta de patrimonio imprecisa. | Se ocultan secciones vacías, abonos sin deudas y KM inicial ya configurado; se consolida la meta y se usa “Dinero en tus cuentas”. |

## Contratos que se conservan

- `availableToday` y `savingsAvailableNow` conservan el cálculo canónico. El consejo es más conservador y se distingue del límite del aporte manual; el usuario puede confirmar una aportación superior al consejo dentro de los límites existentes.
- La sugerencia depende de registros y estimaciones disponibles. El horizonte es 45 días, no una garantía de solvencia ni una promesa de cobro.
- Transferencias, reservas, gastos, ingresos y fondos de terceros permanecen diferenciados.
- Se conservan clave de almacenamiento, esquema, identificadores e historial; no se deduplican pagos por igualdad de monto, nombre o fecha.
- El registro rápido es personal. Los costos de trabajo siguen en su flujo operativo. Un presupuesto declarado se consume mediante su botón de registro; una compra directa no se asigna silenciosamente a un presupuesto.
- El informe con capturas y cifras del usuario se mantiene fuera del repositorio. Las nuevas pruebas utilizan datos ficticios.

## Validación

- Suite principal: **338 pruebas aprobadas**, sin fallos ni omisiones. Incluye restauración, almacenamiento, cuentas, idempotencia, consejos, automatización, XSS, formularios, historial, anticipos y [conciliación al regresar](financial-freshness.md).
- Verificación móvil a 390 px con datos ficticios: Panel → gasto → Hogar/Wallet/Historial, meta consolidada, cobertura operativa, regreso automático y actualización manual de saldos.
- Empaquetado web Android correcto, con configuración nativa Google detectada.
- Reglas Firestore y APK instalado en dispositivo no ejecutados de nuevo en esta auditoría. No hay Java/SDK Android local; la revisión no acredita un nuevo binario instalado.

## Trabajo pendiente identificado

1. Concurrencia entre varias pestañas web sin conexión: el snapshot local completo carece de bloqueo o comparación de revisión local. La fusión remota existente no resuelve por sí sola este caso. Requiere protocolo local y pruebas entre contextos antes de desplegarlo.
2. Reducir la densidad del Panel: calendario y proyección todavía repiten parte de la información. Conviene una vista breve con expansión a detalle.
3. Unificar gasto directo y consumo de presupuestos mediante selección explícita, conservando la distinción entre plan y movimiento. No conviene inferir la asignación sólo por categoría cuando existen varios presupuestos.
4. Filtros por cuenta, categoría y rango de fechas; edición/reversión auditada de pagos operativos históricos equivocados. Corregir el monto futuro no determina ni modifica cuánto se pagó realmente antes.

La auditoría no autoriza borrar movimientos, fusionar ramas ni sustituir la instalación del usuario.
