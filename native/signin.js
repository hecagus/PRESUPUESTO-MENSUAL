export const GOOGLE_CONFIGURATION_MESSAGE='Falta la configuración Android de Firebase en esta versión. Es necesario registrar com.hecagus.presupuesto y la huella SHA-1 del APK en Firebase, incorporar google-services.json y volver a compilar. Puedes seguir usando tu presupuesto local.';
const signInError=(message,code)=>Object.assign(new Error(message),{code});
export const googleConfigurationError=()=>signInError(GOOGLE_CONFIGURATION_MESSAGE,'sync/native-google-configuration');

// La sesión del SDK web sigue siendo la única usada por Firestore y por el motor de sync.
export async function signInNativeGoogle({sdk,session,plugin,configured}){
  if(!configured)throw googleConfigurationError();
  let result;
  try{result=await plugin.signInWithGoogle({skipNativeAuth:true});}
  catch(error){
    const code=String(error?.code||''),message=String(error?.message||'');
    if(code==='10'||/developer_error|ApiException:\s*10\b/i.test(code+' '+message))throw googleConfigurationError();
    if(code==='12501'||/cancelled|canceled|cancellation/i.test(code+' '+message))throw signInError('Inicio de sesión cancelado.','auth/popup-closed-by-user');
    if(/network|NETWORK_ERROR|ApiException:\s*7\b/i.test(code+' '+message))throw signInError('No se pudo contactar Google. Revisa tu conexión e intenta otra vez.','auth/network-request-failed');
    throw signInError('No se pudo abrir el acceso con Google. Intenta de nuevo y comprueba que Google Play esté actualizado. Tu presupuesto permanece en este dispositivo.','sync/native-google-unavailable');
  }
  const token=result?.credential?.idToken;
  if(!token)throw signInError('Google no entregó una credencial válida. No se ha cambiado tu presupuesto.','sync/native-google-credential');
  return sdk.signInWithCredential(session,sdk.GoogleAuthProvider.credential(token));
}
