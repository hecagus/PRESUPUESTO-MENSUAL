import { APP_VERSION } from '../01_consts_utils.js';
export function renderMore(){
  const version=document.getElementById('appVersion');if(version)version.textContent=`Versión ${APP_VERSION}`;
}
