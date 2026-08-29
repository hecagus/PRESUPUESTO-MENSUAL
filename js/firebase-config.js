/* V11 - Configuración pública del cliente Firebase.
 * Los valores de firebaseConfig NO son secretos, pero deja enabled=false
 * hasta completar los datos reales del proyecto y autorizar el dominio de GitHub Pages.
 */
export const FIREBASE_SYNC = Object.freeze({
  enabled: false,
  sdkVersion: '12.18.0',
  config: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
});
