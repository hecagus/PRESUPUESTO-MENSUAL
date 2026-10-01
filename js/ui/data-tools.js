import * as Data from '../02_data.js';
import { Modal } from '../03_render.js';
export function initDataTools(run){
  document.getElementById('btnExportJSON')?.addEventListener('click',async()=>{
    const json=JSON.stringify(Data.getState(),null,2);
    try{await navigator.clipboard.writeText(json);alert('Respaldo copiado.');}
    catch{const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`hecagus-finance-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);alert('Respaldo descargado.');}
  });
  document.getElementById('btnRestoreBackup')?.addEventListener('click',()=>Modal.show('Restaurar respaldo',[{label:'JSON',key:'j'}],d=>{
    if(confirm('Esto reemplazará los datos actuales. ¿Continuar?'))run(()=>Data.restaurar(d.j));
  }));
}
