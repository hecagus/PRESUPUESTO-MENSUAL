const packageName='com.hecagus.presupuesto';
const sha1=value=>String(value||'').replace(/:/g,'').toUpperCase();
export function validateGoogleServices(config,signingSha1=''){
  if(config.project_info?.project_id!=='app-presupuesto-mensual')throw new Error('google-services.json pertenece a otro proyecto Firebase.');
  const client=config.client?.find(c=>c.client_info?.android_client_info?.package_name===packageName);
  if(!client?.client_info?.mobilesdk_app_id||!client.api_key?.some(k=>k.current_key))throw new Error('Falta la configuración Firebase de com.hecagus.presupuesto.');
  const oauth=client.oauth_client||[];
  if(!oauth.some(c=>c.client_type===3&&c.client_id))throw new Error('Falta el cliente OAuth web. Habilita Google en Firebase y descarga google-services.json de nuevo.');
  const certificates=oauth.filter(c=>c.client_type===1&&c.client_id&&c.android_info?.package_name===packageName&&/^[0-9A-F]{40}$/.test(sha1(c.android_info?.certificate_hash)));
  if(!certificates.length)throw new Error('Falta registrar la huella SHA-1 del APK en Firebase y descargar google-services.json de nuevo.');
  if(signingSha1&&(!/^[0-9A-F]{40}$/.test(sha1(signingSha1))||!certificates.some(c=>sha1(c.android_info.certificate_hash)===sha1(signingSha1))))throw new Error(`La SHA-1 de esta compilación (${signingSha1}) no está en google-services.json. Regístrala en Firebase y descarga el archivo actualizado.`);
  return true;
}
