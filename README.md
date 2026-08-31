# La app del HecAgus · v3.0.0

**La app del HecAgus** es un sistema financiero personal configurable, offline-first y sincronizable. Modela dinero, hogar, trabajo, cuentas, fondos de terceros, deudas, metas y negocio sin depender de nombres concretos de empresas o plataformas.

## Principio del producto

```text
Quién eres
→ cómo generas dinero
→ cuánto cuesta generarlo
→ cuánto cuesta vivir
→ qué ya está comprometido o reservado
→ cuánto dinero está realmente libre
```

## v3.0 · Auditoría y núcleo canónico

v3 elimina varias capas duplicadas acumuladas durante v2.x sin borrar la información histórica.

### Una fuente de verdad por dominio

- **Panel**: situación general, dinero realmente libre, calendario resumido y alertas.
- **Hogar**: obligaciones, presupuestos necesarios, reservas concretas, opcionales y gastos realizados.
- **Wallet**: cuentas, transferencias y metas de ahorro.
- **Actividad**: jornadas, pagos laborales, costos operativos, combustible y rendimiento.
- **Historial**: única línea de tiempo de dinero, actividades, fondos de tercero y combustible.
- **Calendario**: vista/proyección de eventos; ya no crea una segunda copia de los gastos de Hogar.

### Dinero realmente libre

El cálculo canónico es:

```text
efectivo personal
- metas reservadas
- pagos/deudas próximos
- presupuesto necesario aún no gastado
- reservas concretas pendientes
- transporte laboral comprometido
= dinero realmente libre
```

Los antiguos `livingBudgets`, compromisos de vivienda/servicios y gastos fijos legacy se conservan sólo para migración/compatibilidad; no pueden volver a contarse como un segundo motor financiero.

### Hogar

Hogar diferencia semánticamente:

- 🔴 **Obligación**: renta, luz, agua o cualquier pago que debe ocurrir.
- 🟡 **Presupuesto necesario**: dinero que sabes que necesitarás, aunque las compras exactas varíen.
- 🟠 **Reserva / necesidad**: compra concreta pendiente.
- 🔵 **Opcional**: suscripción o gusto que no compromete dinero hasta pagarse.
- 💸 **Gasto realizado**: salida real que queda en Historial sin crear un presupuesto futuro.

La migración v3 mueve compromisos manuales antiguos hacia Hogar y desactiva la copia anterior. También incluye una reparación conservadora de dobles capturas directas idénticas: mismo concepto, monto y fecha, registradas dentro de una ventana de cinco minutos.

### PWA

La instalación fue reconstruida para no depender de que el motor completo termine de arrancar:

- `pwa-bootstrap.js` se ejecuta desde `<head>`;
- registra el service worker con scope raíz;
- captura `beforeinstallprompt` lo antes posible;
- el botón **Instalar app** sólo aparece cuando el navegador entrega un prompt real;
- el service worker precarga el shell con `Promise.allSettled`, de modo que un recurso fallido no aborta toda la instalación;
- Vercel entrega `sw.js` y `manifest.webmanifest` con headers explícitos para evitar caches obsoletos.

El navegador conserva la decisión final sobre cuándo permite mostrar su diálogo nativo.

## Arquitectura

```text
01_consts_utils.js       versión, constantes y utilidades
02_data.js               persistencia, migración base y operaciones de dominio
03_render.js             render base
04_charts.js             métricas de fuentes, combustible y operación
05_init.js               orquestador general
07_sync.js               Firebase y resolución de conflictos
08_pwa.js                estado/instalación PWA
10_onboarding.js         configuración y recuperación inicial
11–12                    metas de ahorro
13_financial_life.js     compatibilidad financiera histórica
14_calendar_ui.js        presentación del calendario
15_accounts_engine.js    cuentas y transferencias
16_forecast_engine.js    proyección de flujo
17_automation_engine.js  reglas y alertas
18_health_goals.js       salud financiera y metas inteligentes
19_platform_ui.js        integración visual avanzada
20_home_engine.js        motor base de Hogar
21_financial_life_v27.js núcleo financiero canónico v3
22_home_ui.js            entrada estable de UI Hogar
23_home_semantics.js     semántica, migración y reparación de Hogar
24_home_ui_v28.js        UI actual de Hogar
25_activity_insights.js  rendimiento de actividad/combustible
pwa-bootstrap.js         arranque PWA temprano
```

## Persistencia y sincronización

Se mantiene la clave local histórica para no perder instalaciones existentes:

```text
moto_finanzas_vFinal
```

v3 utiliza `schemaVersion: 30` y migra datos v1/v2 en lugar de reiniciarlos.

Firebase sincroniza el estado por usuario en:

```text
/users/{uid}/budget/state
```

Los conflictos pueden usar nube, conservar local o fusionar. La fusión v3 preserva también la semántica de Hogar (`householdKinds`) además de sus registros.

## Desarrollo y pruebas

```bash
npm test
```

La suite cubre dominio financiero, onboarding, cuentas, metas, calendario, Hogar, deuda única, PWA, costos operativos, rendimiento de combustible y regresiones de v3 como doble conteo, migración de compromisos y reparación de duplicados.

## Regla de arquitectura

> Un dato se captura una sola vez. Las demás pantallas lo interpretan; no crean una segunda copia del mismo concepto.
