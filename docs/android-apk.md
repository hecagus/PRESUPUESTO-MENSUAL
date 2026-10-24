# APK Android de HecAgus

Este proyecto reutiliza la aplicación existente dentro de Capacitor 8. No cambia de framework ni reemplaza los motores financieros. Requiere Android 10 o posterior y Android System WebView actualizado. No necesita Chrome ni su instalador PWA. Las pantallas, JavaScript, Firebase SDK e iconos se incluyen dentro del APK.

## Compilar

Node 22+, Java 21 y Android SDK 36:

```sh
npm ci
npm test
npm run android:apk
```

Salida: `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions también publica `hecagus-android-preview` con APK, SHA-256 y certificado público. El workflow se ejecuta al actualizar el PR y puede iniciarse manualmente desde Actions → Android APK.

## Google y Firebase

El SDK web de Firebase mantiene la misma sesión y la ruta `users/{uid}/budget/state`. El selector de cuenta usa el plugin nativo de Google; el token se intercambia con `signInWithCredential`. No abre Chrome ni un popup WebView, no modifica reglas Firestore ni IDs del presupuesto.

Para habilitarlo en el proyecto Firebase **app-presupuesto-mensual**:

1. Registrar la app Android con paquete **com.hecagus.presupuesto**.
2. Agregar la huella SHA-1 del certificado que firma el APK. En CI está en `SHA1`, en `certificate.txt` y en el resumen del workflow; el artefacto `hecagus-android-signing-certificate` se publica antes de compilar, incluso si la validación posterior falla. Mantener habilitado Google como proveedor.
3. Descargar el nuevo **google-services.json** y colocarlo en `android/app/google-services.json`.
4. Volver a compilar. La configuración se valida contra proyecto, paquete y clientes OAuth de Android y web; no se incluye un archivo ficticio. CI también exige que el cliente Android corresponda a la SHA-1 real de la clave restaurada y comprueba la firma del APK final.

El archivo de configuración contiene [identificadores públicos de Firebase](https://firebase.google.com/docs/android/google-services-plugin-and-file); puede incorporarse al repositorio para que CI lo incluya. No es una clave de cuenta de servicio. Las claves privadas de firma permanecen fuera de Git y de los artefactos.

Una compilación local usa su propia clave debug en `~/.android/debug.keystore`. Registrar también su SHA-1 en Firebase y descargar de nuevo la configuración si se quiere probar Google con esa firma. Para exigir su correspondencia al preparar los recursos, definir `ANDROID_SIGNING_SHA1` con esa huella (con o sin `:`) antes de ejecutar `npm run android:sync`.

Sin ese archivo, el APK funciona como presupuesto local. El acceso Google muestra explícitamente que falta la configuración y no abre navegador. El plugin nativo Firebase no se carga en ese caso. El APK no recupera datos de nube hasta configurar Google.

## Datos y backups

El APK tiene almacenamiento propio. No lee ni borra el almacenamiento de Chrome/PWA. Para conservar el presupuesto, recuperar la misma cuenta Google una vez configurada o restaurar el JSON existente desde Actividad → Restaurar respaldo. El exportador Android copia el JSON mediante Clipboard nativo. Se mantienen migraciones, resolución de conflictos y formato de backup.

Los recursos empaquetados funcionan offline y la instalación PWA se oculta dentro de Android. Las operaciones de nube siguen requiriendo conexión. Actualizar la web en Vercel no actualiza automáticamente los recursos incluidos en un APK: es necesario compilar e instalar una versión nueva.

La compilación incorpora las obligaciones operativas de Actividad: Mottu por $490 semanales, primer vencimiento, pagos parciales y eventos del calendario canónico. No descuenta pagos pendientes del efectivo. La programación y sus pagos viajan en el mismo backup del presupuesto.

## Firma y distribución

El artefacto es una **compilación de prueba**, con firma debug; no es una publicación en Play ni en Firebase App Distribution. CI conserva `~/.android/debug.keystore` en Actions Cache y restaura esa clave antes de calcular la SHA-1 y preparar los recursos. Solo se publican su certificado y huellas. La clave de caché incluye `github.ref`, por ejemplo `Linux-hecagus-preview-signing-v1-refs/pull/32/merge`, para aislar cada PR y evitar que restaure una firma de `main`. Cambiar esa clave crea otra identidad.

La caché tiene [restricciones por rama y PR y puede eliminarse por inactividad o espacio](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching). Conserva la firma mientras esa entrada esté disponible; no constituye un respaldo permanente. Si se pierde o se compila desde otro ámbito sin acceso a ella, CI genera otra clave y publica su nueva huella. Una configuración que no incluya esa SHA-1 detiene la compilación: registrar la nueva huella y descargar otra vez `google-services.json` antes de reintentar. La generación de la clave y su guardado ocurren antes de esa validación.

Dos APK con firmas distintas no pueden actualizarse uno sobre otro. No desinstalar una versión con datos locales sin exportar primero el backup. Antes de distribución estable se requiere una clave de firma permanente conservada en un almacén seguro fuera de Git y de Actions Cache, añadida a un proceso de release, y registrar sus huellas en Firebase. No se publican claves privadas ni se cargan datos del usuario.

No se probó en un teléfono físico durante la generación. Las pruebas verifican el puente de identidad, configuración, rutas locales y el motor financiero; el workflow compila y verifica la firma del APK. Comprobar login, recuperación, movimientos, jornadas y backups en Android antes de distribuir una versión estable.
