# La app del HecAgus · v2.6.0

**La app del HecAgus** es un motor financiero configurable que adapta su experiencia a cómo cada usuario vive, trabaja, cobra, se transporta, gasta y ahorra.

La aplicación es **offline-first**, instalable como **PWA**, utiliza `localStorage` como primera capa de persistencia y puede sincronizar el estado por usuario con **Firebase Auth + Firestore**.

## Principio del producto

La app no debe depender de nombres concretos de empresas, plataformas o personas. El motor trabaja con conceptos universales:

- fuentes de ingreso y su ciclo de vida;
- modelos de pago y jornadas;
- cuentas y fondos de terceros;
- movimientos y transferencias;
- transporte y costo de trabajar;
- gastos de vida y compromisos;
- calendario financiero;
- deudas y metas;
- negocio, productos, ingredientes y recetas;
- proyección, automatizaciones y salud financiera.

El flujo conceptual es:

```text
Quién eres
→ cómo generas dinero
→ cuánto cuesta generarlo
→ cómo vives
→ qué compromisos tienes
→ qué quieres lograr
→ cuánto dinero está realmente libre
```

## v2.2 · Situación financiera y calendario

El onboarding es editable y cada fuente de ingreso puede estar **activa, pausada o finalizada** sin borrar su historial. El transporte se configura por fuente; para transporte público se registran trayectos de ida/regreso, tarifa y días de uso.

El Panel separa:

```text
Dinero que tienes
- dinero comprometido
- dinero reservado para metas
= dinero realmente libre
```

El **Calendario financiero** reúne compromisos recurrentes, deudas, ingresos esperados y fechas objetivo de metas.

## v2.3 · Cuentas y movimientos universales

Wallet ya no trata todo el patrimonio como una sola caja. El usuario puede crear cuentas personales como:

- efectivo/caja;
- cuenta bancaria;
- wallet digital.

Los fondos de empresa o cliente siguen siendo cuentas de tercero y no forman parte del patrimonio personal.

Una transferencia entre cuentas personales cambia **dónde está el dinero**, no cuánto dinero existe:

```text
Caja       -$2,000
BBVA       +$2,000
Patrimonio      $0 de cambio
```

El motor universal permite registrar ingresos y gastos indicando cuenta, categoría y, opcionalmente, fuente de ingreso. El Historial distingue transferencias internas de ingresos/gastos reales.

## v2.4 · Proyección de flujo

El calendario pasa de mostrar solamente fechas a estimar **cómo estará el dinero**.

La proyección a 45 días combina:

- efectivo actual;
- compromisos/deudas próximos;
- ingresos fijos esperados;
- historial de pagos reales para estimar importes;
- dinero reservado en metas;
- presupuesto variable pendiente;
- costo de transporte laboral pendiente.

La app calcula efectivo y **dinero libre proyectado** después de cada evento y detecta tanto un saldo negativo como el momento en que sería necesario tocar dinero reservado.

## v2.5 · Automatizaciones y alertas

Se pueden crear reglas como:

```text
Cuando entre un ingreso
→ apartar 10%
→ Meta Fondo de emergencia
```

La regla puede aplicarse a cualquier ingreso o solamente a una fuente concreta. Cada movimiento se procesa una sola vez.

Las automatizaciones nunca deben reservar más dinero que el **realmente libre**.

Las alertas detectan, entre otros casos:

- dinero libre negativo;
- colchón por debajo del mínimo elegido;
- faltante futuro según la proyección;
- riesgo de tocar reservas;
- presupuesto mensual al 80% o agotado;
- pagos de los próximos días mayores al dinero libre.

## v2.6 · Metas inteligentes y salud financiera

Las metas siguen siendo reservas internas: apartar dinero no crea un gasto ficticio y liberarlo no crea un ingreso ficticio.

La app calcula para cada meta:

- monto y fecha objetivo;
- ritmo mensual necesario;
- capacidad observada según ingresos/gastos reales;
- cuánto podría apartarse ahora sin comprometer la vida cotidiana;
- fuentes que realmente generaron dinero;
- fecha estimada de cumplimiento al ritmo observado;
- estado: completada, en ruta, ajustada o sin capacidad detectada.

Una meta no puede congelar dinero que ya está comprometido en vivienda, despensa, salud, transporte u otros compromisos.

### Salud financiera explicable

Stats incluye una puntuación de 0 a 100, pero no es una caja negra. Se compone de cuatro bloques de hasta 25 puntos:

1. **Liquidez** — cuánto efectivo queda realmente libre.
2. **Carga fija** — relación entre compromisos esenciales e ingreso observado.
3. **Ahorro** — ritmo de reservas frente al ingreso.
4. **Deuda** — peso aproximado de las cuotas sobre el ingreso.

Cada componente muestra el dato que provocó su puntuación.

## Negocio y costeo

Cuando el usuario activa una fuente `business`, la app habilita:

- ingredientes;
- costo por unidad;
- productos;
- recetas;
- costo calculado;
- precio de venta;
- registro de ventas;
- margen estimado.

Cambiar el costo de un ingrediente recalcula automáticamente el costo de las recetas que lo utilizan.

> El inventario físico/stock completo sigue siendo una expansión posterior; la capacidad existe, pero v2.6 se concentra en el núcleo financiero y el costeo.

## Pantallas

```text
onboarding.html  → configuración inicial y “mi situación cambió”
index.html       → dinero realmente libre, fuentes, alertas y proyección
wallet.html      → cuentas, transferencias, movimientos y metas
admin.html       → actividad, jornadas, pagos, combustible y operación
calendar.html    → calendario, flujo proyectado, compromisos y automatizaciones
stats.html       → estadísticas por fuente + salud financiera
historial.html   → trazabilidad universal
```

## Arquitectura JS

```text
01_consts_utils.js       constantes y utilidades
02_data.js               núcleo de datos y compatibilidad histórica
03_render.js             render base
04_charts.js             métricas por fuente
05_init.js               orquestación general
07_sync.js               Firebase/offline-first/conflictos
08_pwa.js                instalación PWA
10_onboarding.js         configuración adaptativa
11_savings_goals.js      metas y dinero reservado
12_savings_ui.js         UI de metas
13_financial_life.js     costo de vida, transporte y calendario
14_calendar_ui.js        UI del calendario
15_accounts_engine.js    cuentas, transferencias y movimientos
16_forecast_engine.js    proyección de flujo
17_automation_engine.js  reglas y alertas
18_health_goals.js       salud financiera y plan de metas
19_platform_ui.js        integración visual v2.3–v2.6
```

La separación busca evitar que arreglar un módulo rompa otro: cada motor se ocupa de un dominio y `05_init.js` los coordina.

## Persistencia y migración

Se conserva la clave histórica:

```text
moto_finanzas_vFinal
```

v2.6 usa:

```text
schemaVersion: 26
```

Los datos v1.x/v2.x se cargan conservando movimientos y jornadas históricas. Las estructuras nuevas se inicializan de forma compatible cuando no existen.

## Firebase

La sincronización remota vive en:

```text
/users/{uid}/budget/state
```

El estado sincronizado incluye perfil, fuentes, cuentas, activos, movimientos, metas, plan financiero, reglas de automatización y aplicaciones de reglas. La app mantiene resolución explícita de conflictos entre estado local y nube.

Las reglas de Firestore deben permitir únicamente al usuario autenticado acceder a su propio árbol `/users/{uid}`.

## PWA y pruebas

El service worker usa un shell versionado y cachea también los módulos financieros v2.3–v2.6 para conservar operación offline.

Las pruebas de dominio se ejecutan con:

```bash
npm test
```

La suite cubre, entre otros escenarios:

- migración y fuentes configurables;
- jornadas y combustible;
- metas y retiros;
- calendario/costo de vida/transporte;
- transferencias sin alterar patrimonio;
- movimientos por cuenta;
- proyección de flujo;
- automatizaciones sin duplicados;
- alertas;
- protección del dinero comprometido;
- salud financiera y metas inteligentes;
- sintaxis de los módulos de navegador.

## Próximas expansiones posibles

v2.6 deja una base para crecer hacia importación bancaria/CSV, inventario físico, comprobantes, categorías automáticas, espacios de hogar/negocio compartidos y, más adelante, una arquitectura multiusuario tipo SaaS.
