/* V10.4 - Adaptador UI para Auth + Sync. No contiene logica financiera. */
import { loginGoogle, logout, initFirebase } from './firebase_service.js';
import { SyncService } from './sync_service.js';
import { LocalRepository } from '../repositories/local_repository.js';

const $ = id => document.getElementById(id);
const status = text => { if ($('cloudStatus')) $('cloudStatus').textContent = text; };

function renderUser(user) {
  const login=$('btnCloudLogin'), logoutBtn=$('btnCloudLogout'), sync=$('btnCloudSync');
  login?.classList.toggle('hidden', !!user);
  logoutBtn?.classList.toggle('hidden', !user);
  if(sync) sync.disabled=!user;
  status(user ? `Conectado: ${user.email || 'Google'}` : 'Modo local · sin sesión');
}

async function doSync(user) {
  status('Sincronizando…');
  const local=LocalRepository.load();
  const result=await SyncService.sync(user.uid, local);
  if(result.status==='CONFLICT') {
    const localDate=result.localUpdatedAt ? new Date(result.localUpdatedAt).toLocaleString() : 'sin fecha';
    const cloudDate=result.cloudUpdatedAt ? new Date(result.cloudUpdatedAt).toLocaleString() : 'sin fecha';
    const useCloud=confirm(`Conflicto detectado.\nLocal: ${localDate}\nNube: ${cloudDate}\n\nAceptar = usar NUBE\nCancelar = conservar LOCAL`);
    await SyncService.resolveConflict(user.uid, local, result.cloud, useCloud?'cloud':'local');
    status(`Conflicto resuelto: ${useCloud?'nube':'local'}. Recargando…`);
    location.reload();
    return;
  }
  status(`Sincronizado · ${result.status}`);
  if(result.status==='DOWNLOADED') location.reload();
}

export async function initCloudUI() {
  if(document.body.dataset.page!=='admin') return;
  try {
    const ctx=await initFirebase();
    if(!ctx.enabled){status('Modo local · Firebase no configurado');return;}
    renderUser(ctx.auth.currentUser);
    ctx.authMod.onAuthStateChanged(ctx.auth, user=>renderUser(user));
    $('btnCloudLogin')?.addEventListener('click', async()=>{
      try { const cred=await loginGoogle(); renderUser(cred.user); await doSync(cred.user); }
      catch(e){ console.error(e); status(`Error de acceso: ${e.code || e.message}`); }
    });
    $('btnCloudLogout')?.addEventListener('click', async()=>{await logout();renderUser(null);});
    $('btnCloudSync')?.addEventListener('click', async()=>{
      const user=ctx.auth.currentUser;
      if(!user)return status('Inicia sesión primero.');
      try{await doSync(user);}catch(e){console.error(e);status(`Error de sync: ${e.code || e.message}`);}
    });
  } catch(e) { console.error(e); status(`Cloud no disponible: ${e.message}`); }
}
