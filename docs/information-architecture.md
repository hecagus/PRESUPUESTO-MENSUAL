# Arquitectura de información y compatibilidad

Base revisada: main 3c760276c2da3049d8bf2393002396661f657686, versión 3.1.1. npm ci y las 115 pruebas existentes pasaron antes de editar.

## Fuente de verdad por dominio

| Dominio | Entrada canónica | Estado persistente |
| --- | --- | --- |
| Estado, jornadas, combustible, pagos, deudas y respaldo | js/02_data.js | movimientos, workSources, turnos, deudas, fondos y cargas |
| Posición financiera y eventos consolidados | js/21_financial_life_v27.js | Combina el estado; no crea un segundo presupuesto |
| Presupuesto de vida | js/23_home_semantics.js sobre js/20_home_engine.js | financialPlan.householdExpenses, IDs y semántica existentes |
| Cuentas y transferencias | js/15_accounts_engine.js | accounts y movimientos de transferencia |
| Metas | js/11_savings_goals.js | savingsGoals y aportaciones |
| Proyección | js/16_forecast_engine.js | Vista derivada del estado |
| Reglas y alertas | js/17_automation_engine.js | Preferencias y reglas existentes |
| Análisis | js/04_charts.js, js/18_health_goals.js, js/25_activity_insights.js | Derivado del estado |
| Sincronización | js/07_sync.js, js/26_sync_merge.js | users/{uid}/budget/state; mismas revisiones, bases y conflictos |
| Migraciones | js/27_legacy_migrations.js, migraciones de Presupuesto y metas | Se conservan; esta reorganización no añade una migración |

21_financial_life_v27.js sigue siendo el puente canónico, aunque el nombre tenga una versión antigua. 22_home_ui.js sigue siendo la entrada estable de UI y delega en 24_home_ui_v28.js. No se renombra ninguno.

## Rutas y experiencia

| Área | Rutas | Responsabilidad |
| --- | --- | --- |
| Inicio | index.html | Resumen accionable |
| Presupuesto | home.html | Costo de vida y gastos personales |
| Actividad | admin.html | Trabajo, transporte, gasolina y negocio |
| Dinero | wallet.html, historial.html | Cuentas, Movimientos, Metas y Deudas |
| Más | more.html | Calendario, Análisis y herramientas |
| Configuración | settings.html | Editores independientes, Google, sync, backup y PWA |
| Calendario / Análisis | calendar.html, stats.html | Vistas; pertenecen a Más |
| Primer arranque | onboarding.html | Asistente inicial |

data-page="admin", "home" y "wallet" son claves internas de compatibilidad, no nuevos nombres para el usuario. La navegación marca Dinero también en Historial, y Más en Configuración/Calendario/Análisis.

Los enlaces guardados a onboarding.html?edit=1 llevan a Configuración mediante location.replace, sin bucle. Las demás rutas anteriores permanecen directamente operativas.

## Separación gradual de UI

- js/app/navigation.js: navegación principal y navegación de Dinero.
- js/pages/settings.js: editores de perfil, fuentes y transporte. Actualiza las fuentes por ID; conserva fondos, jornadas, movimientos y presupuestos.
- js/pages/more.js: información de versión.
- js/ui/debt.js: creación y abonos por las funciones existentes de Data; no recalcula deuda.
- js/ui/data-tools.js: exportación/restauración por el formato y restaurador existentes.
- js/ui/sync-notice.js: aviso con acceso a Configuración; los controles completos están allí.
- 05_init.js: conserva el arranque y orquesta estos módulos. No se reescribe el bootstrap.
- 19_platform_ui.js: conserva cuentas, historial, metas y proyección. Las automatizaciones se muestran en Configuración. La extracción restante se deja para cambios posteriores.

Los selectores de los modales conservan ahora el valor seleccionado al editar una fuente existente.

## Datos y cálculos

No se modifica el esquema 30, la clave histórica de almacenamiento, el formato de backups, IDs de registros, colección de Firestore, fórmulas, aislamiento por cuenta Google ni reglas de seguridad.

Las transferencias siguen sin ser ingresos/gastos personales. Los fondos de terceros siguen fuera del patrimonio. Las deudas conservan saldo, cuota, frecuencia y el mismo registrador de abonos. Presupuesto conserva frecuencias semanales/quincenales/mensuales e importes de cierre inicial.

Configuración no captura saldo inicial ni vuelve a crear la cuenta. El primer arranque y la edición posterior son experiencias distintas.

## PWA

- Se mantiene el ID/start_url/scope del manifiesto y offline.html.
- Los atajos usan los nuevos nombres con las mismas URLs.
- Nueva caché shell-v6-navigation, incluyendo páginas nuevas y módulos anidados.
- El worker elimina únicamente cachés anteriores de su propio prefijo.
- Las navegaciones offline ignoran la query al buscar el HTML cacheado, permitiendo enlaces antiguos como ?edit=1.
- Se conservan los headers de sw.js, manifiesto y bootstrap en Vercel.
- La instalación continúa condicionada al prompt del navegador y se oculta en modo standalone.

## Verificación y límites

Las pruebas cubren navegación, anclas/rutas, bootstrap de todas las páginas con cuenta existente, edición de fuentes, abonos, backup, invariancia de posición financiera, transferencias, fondos de terceros y calentamiento/actualización/navegación offline del service worker.

El navegador local agent-browser no logró iniciar su daemon en este entorno. Las verificaciones DOM y offline son automatizadas; no equivalen a una prueba de instalación real en Android. Firebase requiere las comprobaciones del emulador/CI y una cuenta de prueba para verificar el acceso real de Google, sin tocar datos de usuarios.

## Próxima etapa

Extraer de 19_platform_ui.js cuentas, movimientos, forecast y metas en PRs pequeños, manteniendo adaptadores e imports estables. Renombrar módulos versionados sólo con actualización de imports, shell y pruebas. No retirar rutas antiguas sin una política de compatibilidad.
