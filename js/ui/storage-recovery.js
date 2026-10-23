import {STORAGE_KEY} from '../01_consts_utils.js';
import {restaurar} from '../02_data.js';

export function showStorageRecovery(onRestored=()=>window.location.reload()){
  const main=document.querySelector('main')||document.body;
  main.innerHTML='<section class="card" role="alert"><h2>No se pudieron abrir tus datos</h2><p>El presupuesto guardado se conserva. Descarga una copia antes de intentar recuperarlo o selecciona un respaldo válido.</p><button id="downloadUnreadable" class="btn btn-outline">Descargar datos guardados</button><label for="restoreRecoveryFile" style="display:block;margin:16px 0 8px">Restaurar un respaldo JSON</label><input id="restoreRecoveryFile" class="input-control" type="file" accept=".json,application/json"><p id="storageRecoveryError" role="status"></p></section>';
  const status=document.getElementById('storageRecoveryError');
  document.getElementById('downloadUnreadable').onclick=()=>{
    try{const raw=localStorage.getItem(STORAGE_KEY);if(raw===null)throw new Error('NO_DATA');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='hecagus-datos-por-recuperar.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{status.textContent='No se pudo descargar la copia. El dato guardado sigue sin borrarse.';}
  };
  document.getElementById('restoreRecoveryFile').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    if(!confirm('Se conservará una copia de los datos que no se pudieron abrir y se reemplazará el presupuesto con este respaldo. ¿Continuar?'))return;
    try{restaurar(await file.text());onRestored();}catch{status.textContent='No se pudo restaurar ese archivo. Revisa que sea un respaldo válido y que haya espacio disponible. Tus datos guardados se conservan.';}
  };
}
