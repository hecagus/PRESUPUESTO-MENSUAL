// La sesión del SDK web sigue siendo la única usada por Firestore y por el motor de sync.
export async function signInNativeGoogle({sdk,session,plugin,configured}){
  if(!configured)throw Object.assign(new Error('El APK necesita la configuración Android de Firebase para habilitar Google. Puedes usar el presupuesto local y restaurar un backup mientras se configura.'),{code:'sync/native-google-configuration'});
  const result=await plugin.signInWithGoogle({skipNativeAuth:true});
  const token=result?.credential?.idToken;
  if(!token)throw new Error('Google no entregó una credencial válida. No se ha cambiado tu presupuesto.');
  return sdk.signInWithCredential(session,sdk.GoogleAuthProvider.credential(token));
}
