# La app del HecAgus · v2.1.0

**La app del HecAgus** deja de ser una aplicación diseñada alrededor de una persona concreta y pasa a ser un motor financiero configurable que adapta sus pantallas a la forma en que cada usuario vive, trabaja y cobra.

La aplicación sigue siendo **offline-first, instalable como PWA y sincronizable con Firebase por usuario**.

## Idea de v2

En v1.x existían conceptos específicos como Jaimau, Uber y Ticket Car dentro de la experiencia. En v2 esos nombres son datos configurados por el usuario.

El motor ahora entiende conceptos universales:

- perfil;
- fuentes de ingreso;
- modelos de pago;
- actividades/jornadas;
- cuentas personales;
- fondos de empresa o terceros;
- transporte y vehículos;
- combustible;
- gastos, deudas y ahorro;
- negocio, productos, ingredientes y recetas.

Una empresa, plataforma, cliente o vehículo nuevo no debería requerir código nuevo para existir.

## Onboarding adaptativo

En la primera apertura la app pregunta qué necesita administrar:

- empleo;
- trabajo por turnos/plataformas;
- freelance;
- negocio;
- o únicamente finanzas personales.

Después cada fuente puede configurarse con:

- nombre libre;
- tipo de actividad;
- forma de cobro: diario, semanal, quincenal, mensual, por turno, proyecto, venta o variable;
- seguimiento de jornadas;
- seguimiento de kilometraje;
- responsable del combustible: usuario, empresa/cliente o no aplica.

También se configura el medio de transporte y el saldo personal inicial.

A partir de esas respuestas se derivan las capacidades que la interfaz debe mostrar. Si un usuario no tiene vehículo, no necesita ver kilometraje o combustible. Si no tiene negocio, no necesita ver recetas. Si trabaja por turnos, la app sí puede capturar el ingreso al finalizar la actividad.

## Panel

El Panel responde a tres preguntas:

1. ¿Cuánto dinero personal tengo?
2. ¿Cómo van mis fuentes de ingreso?
3. ¿Qué requiere mi atención?

Las tarjetas se generan desde `workSources`, no desde nombres hardcodeados.

Ejemplos:

- un empleo quincenal muestra jornadas, horas y estado del pago del periodo;
- una plataforma por turno muestra ingreso y rendimiento reciente;
- un negocio muestra ventas y margen estimado.

## Actividad

`admin.html` pasa a presentarse como **Actividad**.

La pantalla genera acciones según la configuración:

- iniciar/finalizar una fuente con seguimiento de tiempo;
- registrar pagos por periodo;
- registrar combustible;
- registrar depósitos de fondos empresariales;
- gastos y deudas;
- operaciones de negocio cuando esa capacidad está activa.

El contexto activo decide qué información pedir. Por ejemplo, una fuente por turno solicita el ingreso al finalizar; un empleo con sueldo quincenal no inventa una ganancia diaria.

## Wallet y propiedad del dinero

v2 introduce cuentas con una distinción fundamental:

```text
ownership = personal | third_party
```

Un fondo de empresa o cliente puede estar disponible para operar sin formar parte del patrimonio personal.

Ejemplo genérico:

```text
Fuente: Empresa A
Combustible: pagado por empresa
Cuenta operativa: Fondo Empresa A

Depósito +$500
Repostaje -$200
Disponible $300
Patrimonio personal: sin cambio
```

## Metas de ahorro · v2.1

Las metas de ahorro dejan de tratarse como un gasto. El dinero sigue formando parte del patrimonio personal, pero se marca como **reservado** y deja de aparecer como disponible para gastar.

Cada meta puede definir:

- nombre;
- monto objetivo;
- fecha objetivo;
- prioridad;
- monto reservado;
- historial de aportes y retiros.

Ejemplo:

```text
Saldo personal       $12,000
Reservado en metas    $5,000
Disponible real       $7,000
```

La app calcula el ritmo necesario por mes y por semana, revisa ingresos reales registrados por fuente y puede sugerir de dónde apartar dinero sin inventar ingresos. Si una fuente no ha generado nada en el periodo, su recomendación permanece en cero.

Al intentar usar dinero reservado, la app muestra una advertencia con:

- cuánto quedará reservado;
- cuánto aumentará el ahorro mensual necesario;
- una estimación de retraso si se mantiene el ritmo actual;
- si el flujo registrado del mes parece suficiente para recuperar el retiro.

Aportar o liberar dinero de una meta no crea ingresos ni gastos ficticios: son transferencias internas que cambian `disponible` y `reservado`, pero no el patrimonio total.

## Combustible por contexto

El repostaje usa la fuente activa cuando existe:

```text
Actividad con combustible empresarial
→ carga contra su fondo de tercero
→ no afecta caja personal

Actividad con combustible personal
→ carga contra caja personal
→ registra gasto personal asociado a esa fuente

Sin actividad
→ el usuario elige el contexto
```

## Negocio y costeo

Cuando el perfil contiene una fuente de tipo `business`, se habilita la base de costeo:

- ingredientes;
- costo por unidad;
- productos;
- recetas;
- costo calculado del producto;
- precio de venta;
- margen estimado;
- registro de ventas.

El costo de un producto se calcula desde los ingredientes de su receta, por lo que al actualizar el costo de un ingrediente el costo calculado de los productos que lo utilizan cambia automáticamente.

**Inventario físico/stock todavía no forma parte del alcance completo de v2.1.0.** La estructura está preparada para extender el módulo de negocio posteriormente sin mezclarlo con el núcleo financiero.

## Stats

Las estadísticas también son dinámicas.

- Empleo: jornadas, horas y pagos por periodo.
- Turnos/plataformas: ingreso, horas, km e ingreso por hora/km cuando aplica.
- Negocio: ventas, costos registrados y margen estimado.
- Personal: ingresos, gastos, saldo disponible y dinero reservado.

No existe una única métrica obligatoria para todos los usuarios.

## Historial universal

Historial funciona como línea de tiempo de la aplicación:

- movimientos de dinero;
- actividades/jornadas;
- depósitos de fondos de tercero;
- combustible;
- eventos de trabajo;
- reservas y liberaciones de metas.

Los fondos de tercero se identifican explícitamente como dinero que no afecta el patrimonio personal. Las reservas de metas también se registran como transferencias internas que no alteran el patrimonio.

## Persistencia y migración desde v1.x

Se conserva la clave histórica:

```text
moto_finanzas_vFinal
```

para no abandonar instalaciones existentes.

v2.1 utiliza:

```text
schemaVersion: 21
```

Durante la carga se migran datos v1.x a conceptos configurables. Los registros históricos de Jaimau/Uber pueden convertirse en fuentes equivalentes de tipo empleo/plataforma sin perder movimientos ni jornadas. Los antiguos sobres categorizados como `Ahorro` o `Meta` se pueden convertir al nuevo gestor de metas.

## Arquitectura

```text
onboarding.html             # configuración inicial/adaptativa
index.html                  # Panel
admin.html                  # Actividad
wallet.html                 # cuentas, patrimonio, compromisos y metas
stats.html                  # analítica dinámica
historial.html              # línea de tiempo universal

js/
├── 01_consts_utils.js      # versión, capacidades y modelos base
├── 02_data.js              # dominio configurable y migraciones
├── 03_render.js            # presentación según capacidades
├── 04_charts.js            # analítica por fuente y saldo disponible
├── 05_init.js              # orquestación y acciones contextuales
├── 07_sync.js              # Firebase y conflictos
├── 08_pwa.js               # instalación PWA
├── 10_onboarding.js        # asistente de configuración
├── 11_savings_goals.js     # dominio de metas, reservas y proyección
├── 12_savings_ui.js        # UI y advertencias de metas
└── firebase-config.js      # configuración cliente Firebase
```

Principios:

1. `02_data.js` es la fuente de verdad del dominio financiero general.
2. Nombres de empresas/plataformas/clientes son datos, no funciones del motor.
3. El dinero de terceros nunca debe inflar el patrimonio personal.
4. La interfaz muestra capacidades, no una lista fija de módulos.
5. Un cambio de contexto debe reutilizar la misma operación, no duplicar botones.
6. Firebase sincroniza el estado completo por UID.
7. Los conflictos cloud no se sobrescriben silenciosamente.
8. Reservar dinero para una meta no debe convertirlo en un gasto ficticio.

## Firebase

Cada usuario autenticado conserva su propio estado en:

```text
/users/{uid}/budget/state
```

Las reglas de Firestore limitan lectura/escritura al UID autenticado. Las metas de ahorro forman parte del estado sincronizado y también participan en la fusión de conflictos.

## PWA

El service worker almacena el shell de v2.1, incluido el onboarding y el gestor de metas, y mantiene funcionamiento local cuando no hay conexión. El código intenta actualizarse desde red cuando vuelve la conectividad.

## Pruebas

```bash
npm test
```

La suite cubre:

- creación de un perfil configurable;
- empleo con pago por periodo sin ingreso ficticio diario;
- trabajo por turno con ingreso al cierre;
- combustible empresarial y personal;
- fondos de tercero;
- metas que reservan dinero sin reducir patrimonio;
- retiros de metas y recálculo de ritmo;
- recomendaciones basadas en ingresos reales por fuente;
- receta y recalculo de costo;
- venta de producto;
- migración v1 → v2;
- deudas/gastos;
- validación de respaldos.

## Versionado

- `1.2.0`: trabajo híbrido específico.
- `1.3.0`: combustible contextual y eliminación de duplicados.
- `2.0.0`: motor configurable por usuario y capacidades.
- **`2.1.0`: metas de ahorro con dinero reservado, proyección y advertencias de retiro.**

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · Service Worker · Web App Manifest · Firebase Authentication · Cloud Firestore · Node Test Runner · GitHub Actions · Vercel
