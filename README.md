# HecAgus Finance · v1.2.0

Aplicación financiera personal **offline-first, instalable y sincronizable** para un modelo de trabajo híbrido real:

- **Jaimau / Ingenico** como trabajo principal con jornadas, kilometraje y pago quincenal.
- **Uber Eats** como ingreso secundario por turno con ganancia, horas y km.
- **Combustible Jaimau** separado del dinero personal porque lo financia la empresa.
- Gastos, deudas, ahorro, caja personal, PWA y sincronización Firebase por usuario.

## Modelo de trabajo

### Jaimau / Ingenico

Una jornada Jaimau registra:

- hora de inicio y fin;
- km inicial y final;
- horas trabajadas;
- km recorridos;
- quincena a la que pertenece.

**No genera un ingreso diario ficticio.** El sueldo entra a la caja únicamente cuando se registra el pago quincenal real.

### Uber Eats

Un turno Uber registra:

- hora de inicio y fin;
- km recorridos;
- ganancia real del turno;
- ingreso por hora e ingreso por km en analítica.

Las métricas de rentabilidad diaria/semanal aplican a Uber. Jaimau se analiza por periodo quincenal.

### Combustible pagado por Jaimau

Los depósitos de gasolina de la empresa y las cargas pagadas con esos fondos se llevan en una cuenta operativa aparte:

```text
Fondos empresa = depósitos Jaimau - cargas Jaimau
```

Ese dinero **no aumenta el saldo personal** y esas cargas **no se registran como gasto personal**.

## Versionado

El proyecto adopta versionado semántico:

- `1.0.0`: primera versión estable.
- `1.1.x`: PWA + Firebase + sincronización.
- `1.2.0`: modelo híbrido Jaimau + Uber.
- `1.2.1`: correcciones compatibles.
- `1.3.0`: nueva funcionalidad compatible.
- `2.0.0`: cambio incompatible del modelo o persistencia.

El `schemaVersion` interno es independiente de la versión comercial y en v1.2.0 pasa a `12`.

## Arquitectura

```text
js/
├── 01_consts_utils.js   # constantes, versión y helpers
├── 02_data.js           # estado, persistencia y dominio
├── 03_render.js         # presentación
├── 04_charts.js         # métricas Jaimau/Uber
├── 05_init.js           # orquestación de UI
├── 06_income_ui.js      # otros ingresos fijos
├── 07_sync.js           # Firebase y conflictos
├── 08_pwa.js            # instalación PWA
└── firebase-config.js   # cliente Firebase
```

Reglas principales:

1. `02_data.js` es la única fuente de verdad financiera.
2. El dinero de empresa nunca se mezcla con la caja personal.
3. Una jornada Jaimau no crea ingresos al cerrarse.
4. Un turno Uber sí crea el ingreso real del turno.
5. El pago Jaimau se registra una vez por quincena cuando se recibe.
6. Firebase replica el estado por UID; localStorage sigue siendo la base offline.
7. Los conflictos cloud nunca se sobrescriben silenciosamente.

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
- km inválido;
- gasolina pagada por empresa sin afectar caja personal;
- pago quincenal Jaimau;
- deuda y gastos;
- cobros duplicados;
- respaldos inválidos.

## Persistencia

La clave histórica se conserva para no perder instalaciones existentes:

```text
moto_finanzas_vFinal
```

Los turnos antiguos de reparto se migran como Uber y los nuevos campos se completan al cargar el estado.

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · Service Worker · Web App Manifest · Firebase Auth · Cloud Firestore · Node Test Runner · GitHub Actions · Vercel
