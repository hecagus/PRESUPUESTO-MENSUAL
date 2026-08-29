/* V11 - Configuración pública del cliente Firebase.
 * firebaseConfig contiene identificadores públicos del cliente web.
 * La seguridad de los datos depende de Firebase Authentication y Firestore Rules.
 */
export const FIREBASE_SYNC = Object.freeze({
  enabled: true,
  sdkVersion: '12.18.0',
  config: {
    apiKey: 'AIzaSyAUbrBV7CdoAsBMnKIlkhCsquRw_8fAXuc',
    authDomain: 'app-presupuesto-mensual.firebaseapp.com',
    projectId: 'app-presupuesto-mensual',
    storageBucket: 'app-presupuesto-mensual.firebasestorage.app',
    messagingSenderId: '860840576898',
    appId: '1:860840576898:web:49590a242a29ed6c1e319b'
  }
});
