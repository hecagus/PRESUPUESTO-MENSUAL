# 📈 PRESUPUESTO-MENSUAL — V11

Aplicación financiera personal **offline-first e instalable** para administrar trabajo fijo + reparto, gastos, deudas, ahorro, gasolina y kilometraje.

V11 convierte el proyecto en una base de producto: PWA real, pruebas automáticas del motor financiero y sincronización Firebase opcional con detección de conflictos entre dispositivos.

## Capacidades

- **Trabajo fijo:** configura la frecuencia de pago y registra el monto realmente recibido.
- **Reparto:** registra turnos, horas, ganancia, kilometraje y gasolina.
- **Caja única:** ambas fuentes llegan al mismo historial sin perder su origen.
- **Obligaciones:** deudas y gastos recurrentes alimentan el objetivo operativo.
- **Ahorro / patrimonio:** separado de gasto corriente.
- **Offline-first:** el motor financiero sigue funcionando sin internet.
- **PWA:** se puede instalar desde el navegador como aplicación.
- **Cloud sync opcional:** Firebase Auth + Firestore para respaldo entre dispositivos.

## Arquitectura

```text
PRESUPUESTO-MENSUAL/
├── .github/workflows/tests.yml
├── js/
│   ├── 01_consts_utils.js   # constantes y helpers puros
│   ├── 02_data.js           # estado, localStorage y dominio financiero
│   ├── 03_render.js         # presentación; no modifica dinero
│   ├── 04_charts.js         # métricas y analítica
│   ├── 05_init.js           # orquestación y eventos
│   ├── 06_income_ui.js      # UI de ingresos fijos
│   ├── 07_sync.js           # Firebase + revisiones + conflictos
│   ├── 08_pwa.js            # instalación y service worker
│   └── firebase-config.js   # configuración pública del cliente Firebase
├── tests/domain.test.js
├── firestore.rules
├── manifest.webmanifest
├── pwa-icon.svg
├── sw.js
├── offline.html
├── index.html
├── admin.html
├── wallet.html
├── stats.html
├── historial.html
├── style.css
└── package.json
```

## Reglas de arquitectura

1. `02_data.js` es la única fuente de verdad financiera y no depende del DOM.
2. `03_render.js` interpreta estado; no modifica dinero ni persistencia.
3. `05_init.js` conecta UI con acciones del dominio.
4. `06_income_ui.js` encapsula configuración/cobro del trabajo fijo.
5. `07_sync.js` replica el estado; Firebase nunca sustituye a `localStorage` como requisito para arrancar.
6. Los ingresos fijos no contaminan las métricas operativas de reparto.
7. Gasolina es consumo/reserva operativa, no deuda.
8. Un conflicto cloud nunca se resuelve sobrescribiendo silenciosamente.

## PWA y funcionamiento offline

`manifest.webmanifest` permite instalar **Mi Panel** como app standalone. `sw.js` precachea el shell local:

- Panel
- Admin
- Wallet
- Estadísticas
- Historial
- CSS
- módulos JavaScript
- manifest e icono

Las navegaciones intentan actualizarse por red y caen al caché cuando no hay conexión. Firebase queda fuera del camino crítico, por lo que perder internet no bloquea el registro de operaciones.

> Después de desplegar una nueva versión, abre la app una vez con internet para que el service worker actualice el caché.

## Pruebas automáticas

El proyecto no requiere dependencias de test. Usa el runner nativo de Node 20:

```bash
npm test
```

Actualmente se cubren regresiones del motor como:

- ciclo de turno e ingreso resultante;
- kilometraje regresivo;
- gasolina inválida;
- abonos de deuda;
- cobro duplicado de ingreso fijo;
- restauración de respaldos inválidos;
- impacto de gastos únicos y recurrentes.

GitHub Actions ejecuta la suite automáticamente en pushes y pull requests contra `main`.

## Firebase Sync

La sincronización está implementada pero **apagada por defecto** para que la app nunca dependa de una configuración inexistente.

### 1. Configurar el proyecto

En Firebase Console habilita:

- **Authentication → Google**
- **Cloud Firestore**

Agrega el dominio de GitHub Pages a los dominios autorizados de Authentication.

### 2. Configurar el cliente

Edita `js/firebase-config.js`:

```js
export const FIREBASE_SYNC = Object.freeze({
  enabled: true,
  sdkVersion: '12.18.0',
  config: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...'
  }
});
```

La configuración web de Firebase identifica el proyecto; la seguridad real está en Authentication y Security Rules.

### 3. Publicar reglas

`firestore.rules` restringe cada estado a su propietario autenticado:

```text
/users/{uid}/budget/state
```

Un usuario no puede leer ni escribir los datos de otro UID.

## Modelo de sincronización y conflictos

Cada documento cloud mantiene un número de `revision`.

- Si nube y dispositivo comparten la revisión base, el dispositivo puede publicar la siguiente revisión.
- Si la nube avanzó y el dispositivo no tiene cambios, se descarga la versión cloud.
- Si **ambos cambiaron**, la aplicación declara conflicto y no pisa ninguna versión.

El usuario puede elegir:

- **Usar nube:** reemplaza el estado local por la revisión cloud.
- **Conservar local:** publica la versión local sobre la revisión cloud actual.
- **Fusionar sin duplicar:** une colecciones por `id`; si un mismo ID existe en ambos lados, la versión local conserva prioridad.

La fusión automática está pensada principalmente para registros independientes. Cuando dos dispositivos modifican la misma entidad mutable, la elección explícita local/nube sigue siendo la opción más segura.

## Persistencia y compatibilidad

La clave histórica continúa siendo:

```text
moto_finanzas_vFinal
```

V11 incrementa `schemaVersion` sin cambiar la clave, de modo que las instalaciones existentes conservan sus datos. Los respaldos JSON manuales continúan disponibles desde **Admin → Sistema**.

## Tecnología

HTML5 · CSS3 · JavaScript ES Modules · localStorage · Service Worker · Web App Manifest · Firebase Auth · Cloud Firestore · Node Test Runner · GitHub Actions · GitHub Pages
