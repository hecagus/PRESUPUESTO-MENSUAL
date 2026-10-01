# APK Android de HecAgus

Este proyecto reutiliza la aplicación existente dentro de Capacitor 8. No cambia de framework ni reemplaza los motores financieros. Requiere Android 10 o posterior y Android System WebView actualizado. No necesita Chrome ni su instalador PWA. Las pantallas, JavaScript, Firebase SDK e iconos se incluyen dentro del APK.

## Compilar

Node 22+, Java 21 y Android SDK 36:

```sh
npm ci
npm test
npm run android:apk
```

Salida: `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions también publica `hecagus-android-preview` con APK, SHA-256 y certificado público.

## Google y Firebase

El SDK web de Firebase mantiene la misma sesión y la ruta `users/{uid}/budget/state`. El selector de cuenta usa el plugin nativo de Google; el token se intercambia con `signInWithCredential`. No abre Chrome ni un popup WebView, no modifica reglas Firestore ni IDs del presupuesto.

Para habilitarlo en el proyecto Firebase **app-presupuesto-mensual**:

1. Registrar la app Android con paquete **com.hecagus.presupuesto**.
2. Agregar la huella SHA-1 del APK, incluida en `certificate.txt` del artefacto. Mantener habilitado Google como proveedor.
3. Descargar el nuevo **google-services.json** y colocarlo en `android/app/google-services.json`.
4. Volver a compilar. La configuración se valida contra proyecto y paquete; no se incluye un archivo ficticio.

Sin ese archivo, el APK funciona como presupuesto local. El acceso Google muestra explícitamente que falta la configuración y no abre navegador. El plugin nativo Firebase no se carga en ese caso. El APK no recupera datos de nube hasta configurar Google.

## Datos y backups

El APK tiene almacenamiento propio. No lee ni borra el almacenamiento de Chrome/PWA. Para conservar el presupuesto, recuperar la misma cuenta Google una vez configurada o restaurar el JSON existente desde Actividad → Restaurar respaldo. El exportador Android copia el JSON mediante Clipboard nativo. Se mantienen migraciones, resolución de conflictos y formato de backup.

Los recursos empaquetados funcionan offline y la instalación PWA se oculta dentro de Android. Las operaciones de nube siguen requiriendo conexión. Actualizar la web en Vercel no actualiza automáticamente los recursos incluidos en un APK: es necesario compilar e instalar una versión nueva.

La compilación incorpora las obligaciones operativas de Actividad: Mottu por $490 semanales, primer vencimiento, pagos parciales y eventos del calendario canónico. No descuenta pagos pendientes del efectivo. La programación y sus pagos viajan en el mismo backup del presupuesto.

## Firma y distribución

El artefacto es una **compilación de prueba**, con firma debug; no es una publicación en Play ni en Firebase App Distribution. El certificado debug de CI puede cambiar entre ejecuciones, por lo que esta compilación no establece una identidad de firma permanente. No desinstalar una versión con datos locales sin exportar primero el backup. Antes de distribución estable se requiere una clave de firma permanente conservada fuera de Git y añadida al proceso de build, y registrar sus huellas en Firebase. No se publican claves privadas ni se cargan datos del usuario.

No se probó en un teléfono físico durante la generación. Las pruebas verifican el puente de identidad, configuración, rutas locales y el motor financiero; el workflow compila y verifica la firma del APK. Comprobar login, recuperación, movimientos, jornadas y backups en Android antes de distribuir una versión estable.
