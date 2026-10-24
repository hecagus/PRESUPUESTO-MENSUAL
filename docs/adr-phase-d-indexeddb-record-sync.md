# ADR-D01 — IndexedDB y sincronización granular de HecAgus

**Estado:** propuesta experimental, NO desplegar como almacenamiento principal.
**Rama:** feature/phase-d-storage-migration-pilot, basada en main 3.1.7. No integra #41, #43 ni #44.

## 1. Diagnóstico comprobado

- `js/02_data.js` mantiene un único `store` en memoria y serializa el estado completo a la clave `moto_finanzas_vFinal` de `localStorage` en `saveData()`. Las operaciones son síncronas y el tamaño no escala indefinidamente.
- `js/07_sync.js` usa el documento Firestore `users/{uid}/budget/state`; una transacción envía el JSON completo junto con `revision`. Los conflictos actuales se deciden sobre el estado completo con `mergeStates`.
- `js/26_sync_merge.js` comprueba un umbral preventivo de unos **900 000 bytes estimados** antes de enviar.
- `js/27_legacy_migrations.js` adapta claves y relaciones de formatos antiguos; modificar su entrada sin retener los bytes originales impediría comprobar reversibilidad.
- Hay referencias mutuas entre movimiento y período de salario, deuda, cuenta, objetivo de ahorro y fondos de terceros. No puede fragmentarse el documento sin definir invariantes de varias entidades.

**Decisión:** no pasar directamente a sincronización granular. Primero almacenar una instantánea sombra IndexedDB transaccional, sin sustituir `localStorage` ni Firestore.

## 2. Piloto implementado

`js/storage/indexeddb-pilot.js`: base de datos `hecagus-indexeddb-pilot-v1` con almacenes `snapshots`, `records` y `audit`.

1. Entrada: respaldo JSON histórico íntegro y un identificador lógico del propietario.
2. Preparación: verifica que es un respaldo de la app, evalúa formato y colecciones, obtiene huella **SHA-256** de los bytes originales y de los registros proyectados. IDs ausentes o duplicados **no se inventan**; se registra incompatibilidad granular.
3. Escritura: **una sola transacción IndexedDB `readwrite`** que incluye la instantánea íntegra, registros y metadatos de auditoría. Si un paso falla, aborta el lote.
4. Lectura: verifica ambas huellas y el número de registros. La copia original mantiene incluso campos desconocidos y legado.
5. Reversión: verifica copia y metadatos y después elimina la sombra en una sola transacción. Devuelve la cadena JSON original para restauración explícita. La clave de `localStorage` queda intacta durante toda la prueba.
6. Cualquier segunda migración para el mismo dueño queda bloqueada hasta revisión o reversión.

**No está integrado al arranque** ni activado por el service worker. No hay cambio de versión de esquema financiero, migración automática ni cambio de origen canónico.

## 3. Granularidad: protocolo propuesto, no sincronización activa

`js/storage/record-sync-protocol.js` modela la comparación 3 vías entre un estado base y dos dispositivos:

- Colecciones con IDs: movimientos, cuentas, deudas, jornadas, fuentes, metas y fondos de terceros.
- Operación de alta/modificación `upsert` y eliminación lógica `tombstone`, con `owner` y revisión de servidor esperada.
- Altas independientes con IDs distintos se pueden proponer para combinación.
- Si ambos lados cambiaron el mismo ID en direcciones distintas, se **detiene** y solicita elección explícita; no se aplican reglas de «última marca horaria gana».
- Cambios en `profile`, `financialPlan`, `wallet` y otros campos todavía no particionados **bloquean el paso a granularidad**. Son dependencias del contrato financiero; no se descartan, duplican ni reconstruyen implícitamente.

No hay escritura Firestore por registro todavía. `buildSyncEnvelopes` genera **solamente propuestas**, sin efectos secundarios. Cualquier operación real necesitaría:

1. Autenticación por `uid` y reglas de seguridad por cuenta y colección.
2. Revisión de servidor monótona y **compare-and-swap** transaccional en Firestore, con revisión esperada por registro y rechazo de escrituras tardías.
3. Clave de idempotencia por operación y procesamiento estable de duplicados tras reconexión.
4. Tombstones retenidos hasta que cada dispositivo haya observado su eliminación.
5. Sincronización multirregistro atómica para pagos (por ejemplo, descuento de saldo de deuda + movimiento). No deben terminar en estados intermedios.
6. Migración de `financialPlan`, `savingsGoals`, reservas y estado de trabajo con tests de consistencia. El merge mostrado en el prototipo **no es seguro para escritura remota** hasta cumplir esto.
7. Prueba con emulador Firestore en dos dispositivos, uno fuera de línea, colisiones de fechas México y borrado/reintroducción de registros.

## 4. Compatibilidad y reversión

| Etapa | Origen de verdad | Se puede volver atrás | Condición |
|---|---|---|---|
| Actual | localStorage + Firestore como hoy | Sí | Ninguna migración |
| Copia sombra | Igual que hoy | Sí, borrar copia IndexedDB | Huellas verificadas |
| Lectura experimental IDB | Igual que hoy | Sí | Comparación completa antes de usar |
| IDB principal | IDB, con versión de emergencia y doble escritura **controlada** | Condicional | Acceso exclusivo, commit atómico, ensayos de corte |
| Sincronización por registro | Servidor con revisiones, tombstones y migración de todos los campos | **No garantizada automáticamente** | Requiere protocolo de reversión entre formatos y retención temporal del estado anterior |

Un cambio de almacenamiento principal necesita **Web Locks** o mecanismo equivalente para impedir que dos pestañas escriban a la vez durante el corte, y recuperación ante fallos entre migración y actualización de referencias. No se activa en este PR.

## 5. Pruebas y cobertura

`tests/phase-d-storage.test.js` y `tests/helpers/fake-indexeddb-pilot.js` prueban:
- Respaldos **sintéticos de esquema antiguo y esquema 30**, preservando datos desconocidos.
- SHA-256 de datos crudos, proyección por registros, IDs antiguos ausentes, y limitación explícita.
- Transacción de escritura, lectura verificada, segunda migración bloqueada, rollback aislado por propietario.
- Falla inyectada durante `records.put`: no puede quedar mitad de los almacenes actualizados.
- Comparación de altas independientes, cambio concurrente de un cobro, borrado frente a edición, y rechazo de campos sin particionar.
- Ausencia de importación del piloto desde `05_init.js` y persistencia Firebase intacta.

**Limitación de evidencia:** estas son estructuras sintéticas basadas en esquemas del repositorio, **no respaldos privados reales** del usuario. No se localizaron JSON históricos entre los archivos disponibles. Para declarar compatibilidad real faltan muestras anonimizadas de las versiones usadas y pruebas de abrir el IndexedDB **nativo en Chrome Android** (el doble de pruebas Node usa un emulador mínimo de transacciones).

## 6. Riesgos/costos

- IndexedDB puede ser evacuado por el navegador, entrar en `QuotaExceededError` o bloquearse al actualizar su versión. Requiere comprobación de `navigator.storage.persist()` y respaldos exportables fuera del dispositivo.
- Mayor complejidad de migraciones, limpieza de tombstones y resolución de conflictos; más operaciones/documentos Firestore pueden aumentar costos y latencia. Un único documento, en cambio, seguirá teniendo límite y reescrituras completas.
- En un sistema financiero la operación multi-registro y la no duplicidad de cobros son más importantes que reducir kilobytes.
- Separación de cuentas propietarias (`uid`), fondos empresariales, restauración y cierre de sesión requieren pruebas específicas.

## 7. Criterios GO/NO-GO

**GO ahora:** mantener piloto offline sin acceso a finanzas reales, documentar y probar con backups artificiales y posteriormente backups históricos anonimizados.

**NO-GO hoy:** no sustituir `saveData()` ni activar sincronización por registro hasta tener restauración desde 3+ respaldos reales, prueba de caída durante commit en Android, aprobación de reglas Firestore, QA de doble dispositivo/offline y un rollback validado de punta a punta.

**Integración futura:** PR #41 (auditoría de inactividad) debe bloquear el inicio de sincronización granular durante una conciliación; PR #43 mejora interfaz; PR #44 agrega lotes CSV y ajustes cuya atomicidad también debe preservarse. Revisar conflictos en `05_init.js` y `sw.js` al unificar.


## 8. Prueba manual del IndexedDB nativo (datos sintéticos)

En el preview del PR #45, abrir DevTools de Chrome, pestaña Consola, y ejecutar:

```js
const raw = await fetch('/tests/fixtures/finance-schema-30-synthetic.json').then(r => r.text());
const pilot = await import('/js/storage/indexeddb-pilot.js');
const report = await pilot.writeShadowSnapshot(raw, {owner:'phase-d-demo'});
console.log('Migrado en sombra:', report);
const verified = await pilot.readShadowSnapshot({owner:'phase-d-demo'});
console.assert(verified.backup === raw, 'No coincide el respaldo');
const restored = await pilot.rollbackShadowSnapshot({owner:'phase-d-demo'});
console.assert(restored.restorableBackup === raw, 'Rollback no coincide');
```

Si la copia de pruebas `phase-d-demo` ya existe, ejecutar primero `rollbackShadowSnapshot` tras comprobarla; nunca eliminar bases de datos completas ni limpiar todo el almacenamiento del origen. Para revisar transacciones y stores, abrir **Application → IndexedDB → hecagus-indexeddb-pilot-v1**. El ejercicio no toca `moto_finanzas_vFinal` ni Firestore.

**Nota:** el protocolo incremental está separado y no debe invocarse como sincronización real: aún no hay backend, reglas por registro ni transacciones multi-entidad.
