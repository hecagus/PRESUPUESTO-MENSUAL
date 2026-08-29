# HecAgus Finance · v1.3.0

Aplicación financiera personal **offline-first, instalable y sincronizable** para un modelo de trabajo híbrido real:

- **Jaimau / Ingenico** como trabajo principal con jornadas, kilometraje y pago quincenal.
- **Uber Eats** como ingreso secundario por turno con ganancia, horas y km.
- **Ticket Car Jaimau** como fondo operativo separado de la caja personal.
- Gastos, deudas, ahorro, caja personal, PWA y sincronización Firebase por usuario.

## Modelo de trabajo

### Jaimau / Ingenico

Una jornada Jaimau registra hora de inicio/fin y kilometraje. **No genera una ganancia diaria ficticia.** El sueldo entra a la caja únicamente cuando se registra el pago quincenal real desde el módulo `Jaimau · quincena`.

Jaimau no aparece como “otro ingreso fijo”; los registros legacy pueden seguir existiendo para conservar historial, pero la interfaz los oculta para evitar cobros duplicados.

### Uber Eats

Un turno Uber registra hora, km y ganancia real. Las métricas de rentabilidad diaria/semanal aplican a Uber; Jaimau se analiza por periodo quincenal.

## Combustible unificado

v1.3.0 elimina las dos tarjetas separadas de combustible y usa un solo botón **Repostaje**.

La fuente del dinero se decide por contexto:

```text
Jornada Jaimau activa
→ Repostaje
→ Ticket Car Jaimau
→ no toca caja personal

Jornada Uber activa
→ Repostaje
→ caja personal
→ registra gasto operativo Uber

Sin jornada activa
→ Repostaje
→ la app pregunta: Jaimau o Personal / Uber
```

La tarjeta muestra el saldo operativo de Ticket Car:

```text
Saldo Ticket Car = depósitos empresa - cargas Jaimau
```

Los depósitos de empresa **no son ingresos personales** y las cargas pagadas por Jaimau **no son gastos personales**.

Cada repostaje puede guardar litros, importe, kilometraje y una gasolinera/referencia opcional.

## Versionado

El proyecto usa versionado semántico:

- `1.0.0`: primera versión estable.
- `1.1.x`: PWA + Firebase + sincronización.
- `1.2.0`: trabajo híbrido Jaimau + Uber.
- `1.3.0`: combustible unificado por contexto y eliminación de duplicados de Jaimau.
- `2.0.0`: cambio incompatible del modelo o persistencia.

`schemaVersion` es independiente de la versión comercial. v1.3.0 conserva `schemaVersion: 12` porque no rompe la estructura persistida.

## Arquitectura

```text
js/
├── 01_consts_utils.js   # constantes, versión y helpers
├── 02_data.js           # estado, persistencia y dominio
├── 03_render.js         # presentación
├── 04_charts.js         # métricas Jaimau/Uber
├── 05_init.js           # orquestación y flujo contextual
├── 06_income_ui.js      # otros ingresos fijos
├── 07_sync.js           # Firebase y conflictos
├── 08_pwa.js            # instalación PWA
└── firebase-config.js   # cliente Firebase
```

Reglas principales:

1. `02_data.js` es la única fuente de verdad financiera.
2. El dinero de empresa nunca se mezcla con la caja personal.
3. El turno activo define automáticamente quién paga el combustible.
4. Una jornada Jaimau no crea ingresos al cerrarse.
5. Un turno Uber sí crea el ingreso real del turno.
6. El pago Jaimau se registra una vez por quincena cuando se recibe.
7. Firebase replica el estado por UID; localStorage sigue siendo la base offline.
8. Los conflictos cloud nunca se sobrescriben silenciosamente.

## PWA y sincronización

La app funciona sin internet para operaciones locales. El service worker mantiene el shell y actualiza el código cuando vuelve la red.

Firebase Authentication usa Google y Firestore guarda cada estado en:

```text
/users/{uid}/budget/state
```

Las reglas de Firestore restringen cada documento al usuario autenticado correspondiente.

## Pruebas

```bash
npm test
```

La suite cubre, entre otras cosas:

- turno Uber con ingreso;
- jornada Jaimau sin ingreso diario;
- repostaje Jaimau → Ticket Car;
- repostaje Uber → caja personal;
- selección obligatoria cuando no hay jornada;
- prevención de Jaimau duplicado como ingreso fijo;
- pago quincenal Jaimau;
- deuda, gastos y respaldos inválidos.

## Persistencia

La clave histórica se conserva:

```text
moto_finanzas_vFinal
```

Los turnos antiguos de reparto se migran como Uber y los registros previos permanecen compatibles.

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · Service Worker · Web App Manifest · Firebase Auth · Cloud Firestore · Node Test Runner · GitHub Actions · Vercel
